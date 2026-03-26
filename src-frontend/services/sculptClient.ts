/**
 * sculptClient.ts
 * 
 * TypeScript bindings for K_OS Rust sculpting backend.
 * Provides high-performance brush operations via Tauri.
 * Falls back to JavaScript implementation when Tauri is not available.
 * 
 * PERFORMANCE NOTES:
 * - Use initMeshBinary for meshes > 50k verts (10-50x faster than JSON)
 * - Use applyBrushBinary for ~2-5x faster brush strokes
 * - Use updatePositionsBinary for ~10x faster position sync
 * - Binary variants eliminate JSON serialization overhead
 */

import {
    float32ToBytes,
    uint32ToBytes,
    bytesToFloat32,
    bytesToUint32,
    binaryInvoke,
    type BrushResultBinary,
    type DecodedBrushResult,
    decodeBrushResult,
    applyBrushResultToGeometry as applyBinaryBrushResultToGeometry,
} from '@/systems/ipc/binaryIpc';

// Type definitions matching Rust structs
export interface BrushResult {
    modified_indices: number[];
    new_positions: number[];
    new_normals?: number[];      // Normals computed by Rust (glam SIMD)
    normal_indices?: number[];   // Indices for new_normals (superset of modified_indices)
    new_tangents?: number[];     // Tangents computed by Rust for PBR materials
    tangent_indices?: number[];  // Indices for new_tangents
    time_ms: number;
    affected_count: number;
    used_gpu: boolean;
    gpu_fallback_reason?: string | null;
}

export type SculptMeshHandle = number;

// Check if we're running in Tauri
const isTauri = (): boolean => {
    return typeof window !== 'undefined' && '__TAURI__' in window;
};

const estimateF32Bytes = (v: Float32Array | number[]): number => {
    if (v instanceof Float32Array) return v.byteLength;
    return v.length * 4;
};

const estimateU32Bytes = (v: Uint32Array | number[]): number => {
    if (v instanceof Uint32Array) return v.byteLength;
    return v.length * 4;
};

// Lazy import Tauri invoke
let tauriInvoke: ((cmd: string, args?: any) => Promise<any>) | null = null;

const getInvoke = async () => {
    if (tauriInvoke) return tauriInvoke;

    if (isTauri()) {
        try {
            const tauri = await import('@tauri-apps/api/core');
            tauriInvoke = tauri.invoke;
            return tauriInvoke;
        } catch (e) {
            console.warn('Failed to import Tauri API:', e);
        }
    }
    return null;
};

/**
 * Rust Sculpting Backend
 */
export const rustSculpt = {
    /**
     * Initialize a mesh for Rust-accelerated sculpting (JSON path - SLOW for big meshes)
     * @param positions Flat array of vertex positions [x0,y0,z0, x1,y1,z1, ...]
     * @param indices Flat array of triangle indices
     * @returns Handle for subsequent operations
     * @deprecated Use initMeshBinary for meshes > 50k verts (10-50x faster)
     */
    initMesh: async (positions: Float32Array | number[], indices: Uint32Array | number[]): Promise<SculptMeshHandle | null> => {
        const invoke = await getInvoke();

        if (invoke) {
            try {
                const posArray = Array.from(positions);
                const idxArray = Array.from(indices);

                const t0 = performance.now();
                const handle: SculptMeshHandle = await invoke('init_sculpt_mesh', {
                    positions: posArray,
                    indices: idxArray,
                });
                const t1 = performance.now();

                console.log(`[rustSculpt] Mesh initialized (JSON): handle=${handle}, verts=${posArray.length / 3}, time=${(t1 - t0).toFixed(1)}ms`);
                return handle;
            } catch (e) {
                console.error('[rustSculpt] Failed to init mesh:', e);
                return null;
            }
        }
        return null;
    },

    /**
     * Initialize a mesh for Rust-accelerated sculpting (BINARY path - FAST!)
     * 
     * Sends raw ArrayBuffer bytes directly to Rust, bypassing JSON serialization.
     * 10-50x faster than initMesh for large meshes (100k+ vertices).
     * 
     * @param positions Float32Array of vertex positions [x0,y0,z0, x1,y1,z1, ...]
     * @param indices Uint32Array of triangle indices
     * @returns Handle for subsequent operations
     */
    initMeshBinary: async (positions: Float32Array, indices: Uint32Array): Promise<SculptMeshHandle | null> => {
        const invoke = await getInvoke();

        if (invoke) {
            try {
                const vertCount = positions.length / 3;
                const faceCount = indices.length / 3;

                const t0 = globalThis.performance.now();

                // Tauri 2.0 can send Uint8Array directly -> Vec<u8> on Rust side
                // CRITICAL: Do NOT use Array.from() - that creates millions of boxed numbers!
                // Just create a view of the underlying ArrayBuffer
                const posBytes = new Uint8Array(positions.buffer, positions.byteOffset, positions.byteLength);
                const idxBytes = new Uint8Array(indices.buffer, indices.byteOffset, indices.byteLength);

                const bytesSent = posBytes.byteLength + idxBytes.byteLength;

                const handle: SculptMeshHandle = await invoke('init_sculpt_mesh_binary', {
                    positionsBytes: posBytes,
                    indicesBytes: idxBytes,
                });

                const t1 = globalThis.performance.now();

                console.log(`[rustSculpt] Mesh initialized (BINARY): handle=${handle}, verts=${vertCount}, faces=${faceCount}, bytes=${(bytesSent / 1024 / 1024).toFixed(2)}MB, time=${(t1 - t0).toFixed(1)}ms`);
                return handle;
            } catch (e) {
                console.error('[rustSculpt] Failed to init mesh (binary):', e);
                // Fallback to JSON path if binary fails
                console.warn('[rustSculpt] Falling back to JSON path...');
                return rustSculpt.initMesh(positions, indices);
            }
        }
        return null;
    },

    /**
     * Apply a brush stroke to the mesh
     * @param useGpu Enable GPU compute for ~30x faster brushing (requires GPU init)
     * @param alphaHandle Optional handle to GPU alpha texture for intensity modulation
     * @param delta Optional world-space mouse movement for Grab/Snake Hook/Move brushes
     */
    applyBrush: async (
        handle: SculptMeshHandle,
        point: [number, number, number],
        normal: [number, number, number],
        tool: string,
        radius: number,
        intensity: number,
        symmetry?: 'X' | 'NONE',
        useGpu: boolean = false,
        alphaHandle: number | null = null,
        delta: [number, number, number] | null = null
    ): Promise<BrushResult | null> => {
        const invoke = await getInvoke();

        if (invoke && handle) {
            try {
                const t0 = performance.now();
                const result: BrushResult = await invoke('apply_brush', {
                    handle,
                    point,
                    normal,
                    tool,
                    radius,
                    intensity,
                    symmetry: symmetry === 'X' ? 'X' : null,
                    useGpu, // GPU compute mode
                    use_gpu: useGpu,
                    alpha_handle: alphaHandle, // GPU alpha texture handle
                    delta,  // For Grab/Snake Hook/Move brushes
                });
                const t1 = performance.now();


                return result;
            } catch (e) {
                console.error('[rustSculpt] Brush failed:', e);
                return null;
            }
        }
        return null;
    },

    /**
     * Apply brush stroke using SPIR-V shader (KAIN-compiled)
     * 
     * Uses pre-compiled SPIR-V shaders from KAIN (.kn) source files.
     * Provides access to physics-based and advanced stamp brushes.
     * 
     * Available shaders:
     * - Stamp: stamp_main, stamp_clay, stamp_inflate, stamp_flatten, stamp_crease,
     *          stamp_layer, stamp_blob, stamp_hpolish, stamp_scrape
     * - Physics: physics_attractor, physics_magnet, physics_elastic, physics_inflate_pulse,
     *            physics_turbulence, physics_gravity_drop, physics_wind, physics_vortex
     * 
     * @param handle Sculpt mesh handle
     * @param point Brush center position in world space
     * @param normal Brush normal direction
     * @param shaderName SPIR-V shader name (e.g., "stamp_clay", "physics_attractor")
     * @param radius Brush radius
     * @param intensity Brush strength/intensity
     * @param alphaHandle Optional alpha texture handle
     * @returns Brush result with modified vertices
     */
    applyBrushSpirv: async (
        handle: SculptMeshHandle,
        point: [number, number, number],
        normal: [number, number, number],
        shaderName: string,
        radius: number,
        intensity: number,
        alphaHandle: number | null = null
    ): Promise<BrushResult | null> => {
        const invoke = await getInvoke();

        if (invoke && handle) {
            try {
                const t0 = performance.now();
                const result: BrushResult = await invoke('apply_brush_spirv', {
                    handle,
                    point,
                    normal,
                    shaderName,
                    shader_name: shaderName,
                    radius,
                    intensity,
                    alphaHandle,
                    alpha_handle: alphaHandle,
                });
                const t1 = performance.now();

                console.log(`[rustSculpt] SPIR-V brush: shader=${shaderName}, affected=${result.affected_count}, time=${result.time_ms.toFixed(2)}ms (total=${(t1 - t0).toFixed(1)}ms)`);

                return result;
            } catch (e) {
                console.error('[rustSculpt] SPIR-V brush failed:', e);
                return null;
            }
        }
        return null;
    },

    /**
     * Update mesh positions in Rust (after JS-side changes like undo)
     */
    updatePositions: async (handle: SculptMeshHandle, positions: Float32Array | number[]): Promise<boolean> => {
        const invoke = await getInvoke();

        if (invoke && handle) {
            try {
                const payloadBytes = estimateF32Bytes(positions);
                const t0 = performance.now();
                await invoke('update_sculpt_positions', {
                    handle,
                    positions: Array.from(positions),
                });
                const t1 = performance.now();

                return true;
            } catch (e) {
                console.error('[rustSculpt] Update positions failed:', e);
                return false;
            }
        }
        return false;
    },

    /**
     * Get all positions from Rust mesh
     */
    getPositions: async (handle: SculptMeshHandle): Promise<Float32Array | null> => {
        const invoke = await getInvoke();

        if (invoke && handle) {
            try {
                const t0 = performance.now();
                const positions: number[] = await invoke('get_sculpt_positions', { handle });
                const t1 = performance.now();


                return new Float32Array(positions);
            } catch (e) {
                console.error('[rustSculpt] Get positions failed:', e);
                return null;
            }
        }
        return null;
    },

    /**
     * Dispose of a sculpt mesh handle
     */
    dispose: async (handle: SculptMeshHandle): Promise<void> => {
        const invoke = await getInvoke();

        if (invoke && handle) {
            try {
                await invoke('dispose_sculpt_mesh', { handle });
            } catch (e) {
                console.error('[rustSculpt] Dispose failed:', e);
            }
        }
    },

    /**
     * Benchmark the spatial grid performance
     */
    benchmark: async (vertexCount: number, radius: number): Promise<string | null> => {
        const invoke = await getInvoke();

        if (invoke) {
            try {
                return await invoke('benchmark_sculpt', { vertexCount, radius });
            } catch (e) {
                console.error('[rustSculpt] Benchmark failed:', e);
                return null;
            }
        }
        return null;
    },

    /**
     * Check if Rust backend is available
     */
    isAvailable: async (): Promise<boolean> => {
        const invoke = await getInvoke();
        return invoke !== null;
    },

    // ========================================================================
    // BINARY IPC VARIANTS (High Performance)
    // ========================================================================

    /**
     * Apply brush stroke with BINARY response (2-5x faster than JSON)
     * 
     * Returns raw byte arrays that can be decoded with decodeBrushResult()
     * or applied directly with applyBinaryBrushResultToGeometry()
     */
    applyBrushBinary: async (
        handle: SculptMeshHandle,
        point: [number, number, number],
        normal: [number, number, number],
        tool: string,
        radius: number,
        intensity: number,
        symmetry?: 'X' | 'NONE',
        useGpu: boolean = false,
        alphaHandle: number | null = null,
        delta: [number, number, number] | null = null
    ): Promise<DecodedBrushResult | null> => {
        const invoke = await getInvoke();

        if (invoke && handle) {
            try {
                const result: BrushResultBinary = await invoke('apply_brush_binary', {
                    handle,
                    point,
                    normal,
                    tool,
                    radius,
                    intensity,
                    symmetry: symmetry === 'X' ? 'X' : null,
                });

                // Decode binary result to typed arrays
                return decodeBrushResult(result);
            } catch (e) {
                console.error('[rustSculpt] Binary brush failed:', e);
                return null;
            }
        }
        return null;
    },

    /**
     * Update mesh positions with BINARY data (~10x faster than JSON)
     */
    updatePositionsBinary: async (handle: SculptMeshHandle, positions: Float32Array): Promise<boolean> => {
        const invoke = await getInvoke();

        if (invoke && handle) {
            try {
                const posBytes = new Uint8Array(positions.buffer, positions.byteOffset, positions.byteLength);
                
                await invoke('update_sculpt_positions_binary', {
                    handle,
                    positionsBytes: posBytes,
                });
                return true;
            } catch (e) {
                console.error('[rustSculpt] Binary update positions failed:', e);
                // Fallback to JSON
                return rustSculpt.updatePositions(handle, positions);
            }
        }
        return false;
    },

    /**
     * Get positions as binary data (~5x faster than JSON for large meshes)
     */
    getPositionsBinary: async (handle: SculptMeshHandle): Promise<Float32Array | null> => {
        const invoke = await getInvoke();

        if (invoke && handle) {
            try {
                const result: { positions_bytes: number[] } = await invoke('get_sculpt_positions_binary', { handle });
                return bytesToFloat32(result.positions_bytes);
            } catch (e) {
                // Fallback to JSON path
                console.warn('[rustSculpt] Binary get positions not available, using JSON fallback');
                return rustSculpt.getPositions(handle);
            }
        }
        return null;
    },

    /**
     * Batch multiple brush strokes in a single IPC call
     * Ideal for stroke interpolation - reduces IPC overhead by 10-20x
     * 
     * @param strokes Array of brush stroke parameters
     * @returns Combined result of all strokes
     */
    applyBrushBatch: async (
        handle: SculptMeshHandle,
        strokes: Array<{
            point: [number, number, number];
            normal: [number, number, number];
            delta?: [number, number, number];
            radius: number;
            intensity: number;
        }>,
        tool: string,
        symmetry?: 'X' | 'NONE',
        useGpu: boolean = false
    ): Promise<BrushResult | null> => {
        const invoke = await getInvoke();

        if (invoke && handle && strokes.length > 0) {
            try {
                // Pack strokes into flat arrays for efficient transfer
                const pointsFlat: number[] = [];
                const normalsFlat: number[] = [];
                const deltasFlat: number[] = [];
                const radii: number[] = [];
                const intensities: number[] = [];

                for (const s of strokes) {
                    pointsFlat.push(...s.point);
                    normalsFlat.push(...s.normal);
                    deltasFlat.push(...(s.delta || [0, 0, 0]));
                    radii.push(s.radius);
                    intensities.push(s.intensity);
                }

                const result: BrushResult = await invoke('apply_brush_batch', {
                    handle,
                    points: pointsFlat,
                    normals: normalsFlat,
                    deltas: deltasFlat,
                    radii,
                    intensities,
                    tool,
                    symmetry: symmetry === 'X' ? 'X' : null,
                    useGpu,
                });

                return result;
            } catch (e) {
                console.error('[rustSculpt] Batch brush failed:', e);
                // Fallback: apply strokes one by one
                let lastResult: BrushResult | null = null;
                for (const s of strokes) {
                    lastResult = await rustSculpt.applyBrush(
                        handle, s.point, s.normal, tool, s.radius, s.intensity,
                        symmetry, useGpu, null, s.delta || null
                    );
                }
                return lastResult;
            }
        }
        return null;
    },
};

/**
 * Helper to apply brush result to Three.js geometry
 * Now uses Rust-computed normals for high performance
 */
/**
 * Apply JSON brush result to Three.js geometry
 * Now uses Rust-computed normals for high performance
 */
export function applyBrushResultToGeometry(
    geometry: any, // THREE.BufferGeometry
    result: BrushResult,
    skipNormals: boolean = false // Now we can afford normals since Rust computes them!
): void {
    const posAttr = geometry.attributes.position;
    const posArray = posAttr.array as Float32Array;

    // Apply modified positions
    for (let i = 0; i < result.modified_indices.length; i++) {
        const idx = result.modified_indices[i];
        posArray[idx * 3] = result.new_positions[i * 3];
        posArray[idx * 3 + 1] = result.new_positions[i * 3 + 1];
        posArray[idx * 3 + 2] = result.new_positions[i * 3 + 2];
    }
    posAttr.needsUpdate = true;

    // Apply Rust-computed normals (FAST - no JS recomputation needed!)
    if (!skipNormals && result.new_normals && result.normal_indices) {
        const normalAttr = geometry.attributes.normal;
        if (normalAttr) {
            const normalArray = normalAttr.array as Float32Array;
            for (let i = 0; i < result.normal_indices.length; i++) {
                const idx = result.normal_indices[i];
                normalArray[idx * 3] = result.new_normals[i * 3];
                normalArray[idx * 3 + 1] = result.new_normals[i * 3 + 1];
                normalArray[idx * 3 + 2] = result.new_normals[i * 3 + 2];
            }
            normalAttr.needsUpdate = true;
        }
    } else if (!skipNormals && !result.new_normals) {
        // Fallback to JS if Rust didn't provide normals
        geometry.computeVertexNormals();
    }

    // Apply Rust-computed tangents for PBR normal mapping
    if (!skipNormals && result.new_tangents && result.tangent_indices) {
        const tangentAttr = geometry.attributes.tangent;
        if (tangentAttr) {
            const tangentArray = tangentAttr.array as Float32Array;
            // Tangents are vec4 (x, y, z, w) where w is handedness
            for (let i = 0; i < result.tangent_indices.length; i++) {
                const idx = result.tangent_indices[i];
                tangentArray[idx * 4] = result.new_tangents[i * 4];
                tangentArray[idx * 4 + 1] = result.new_tangents[i * 4 + 1];
                tangentArray[idx * 4 + 2] = result.new_tangents[i * 4 + 2];
                tangentArray[idx * 4 + 3] = result.new_tangents[i * 4 + 3]; // handedness
            }
            tangentAttr.needsUpdate = true;
        }
    }

    // Update bounding sphere for proper matcap/depth rendering
    // Without this, the matcap shader uses stale bounds and depth looks flat
    geometry.computeBoundingSphere();
}

/**
 * Apply BINARY brush result to Three.js geometry
 * Uses TypedArrays directly for zero-copy GPU upload
 */
export function applyDecodedBrushResultToGeometry(
    geometry: any, // THREE.BufferGeometry
    result: DecodedBrushResult,
    skipNormals: boolean = false
): void {
    applyBinaryBrushResultToGeometry(geometry, result);
}

// Re-export binary utilities for convenience
export { 
    decodeBrushResult,
    type DecodedBrushResult,
    type BrushResultBinary,
    float32ToBytes,
    uint32ToBytes,
    bytesToFloat32,
    bytesToUint32,
};

export default rustSculpt;
