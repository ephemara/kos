/**
 * meshManager.ts - Rust Sculpt Backend Integration
 * 
 * Manages mesh handles for Rust-based sculpting.
 * All actual sculpting logic is in Rust (src-tauri/src/modules/sculpting/).
 */

import * as THREE from 'three';
import { rustSculpt, applyBrushResultToGeometry, type SculptMeshHandle, type BrushResult } from '@/services/sculptClient';
import { gpuRaycastManager } from '@/services/raycastClient';

// ============================================================================
// RUST SCULPT MANAGER
// ============================================================================

/**
 * State manager for Rust sculpt meshes
 * Maps Three.js mesh UUID to Rust handle
 */
class RustSculptManager {
    private handles: Map<string, SculptMeshHandle> = new Map();
    private initialized: boolean = false;
    private available: boolean = false;

    async init() {
        if (this.initialized) return;
        this.available = await rustSculpt.isAvailable();
        this.initialized = true;
        console.log(`[RustSculptManager] Backend available: ${this.available}`);
    }

    isAvailable(): boolean {
        return this.available;
    }

    async registerMesh(mesh: THREE.Mesh): Promise<SculptMeshHandle | null> {
        await this.init();

        if (!this.available) {
            console.warn('[RustSculptManager] Rust backend not available - sculpting will be disabled');
            return null;
        }

        const uuid = mesh.uuid;
        if (this.handles.has(uuid)) {
            return this.handles.get(uuid)!;
        }

        const geo = mesh.geometry;
        const posAttr = geo.attributes.position;
        const positions = new Float32Array(posAttr.array);

        const indexAttr = geo.index;
        if (!indexAttr) {
            console.warn('[RustSculptManager] Mesh has no indices, skipping');
            return null;
        }
        const indices = new Uint32Array(indexAttr.array);

        console.log(`[RustSculptManager] Registering mesh with ${positions.length / 3} verts, ${indices.length / 3} faces...`);
        // Use binary path: 10-50x faster than JSON for large meshes (now that Rust has init_sculpt_mesh_binary)
        const handle = await rustSculpt.initMeshBinary(positions, indices);
        if (handle !== null) {
            this.handles.set(uuid, handle);
            console.log(`[RustSculptManager] Registered mesh ${uuid} with handle ${handle}`);

            // Also register for GPU raycast (ultra-fast raycasting)
            gpuRaycastManager.registerMesh(mesh).then(gpuHandle => {
                if (gpuHandle !== null) {
                    console.log(`[RustSculptManager] GPU raycast registered: ${uuid} -> handle ${gpuHandle}`);
                }
            }).catch(() => {
                // GPU raycast is optional enhancement, fallback to three-mesh-bvh
            });
        } else {
            console.error('[RustSculptManager] Failed to register mesh with Rust backend');
        }
        return handle;
    }

    /**
     * Register mesh using BINARY IPC path (10-50x faster for large meshes)
     * 
     * Use this after subdivision/remesh when re-registering big meshes.
     * Bypasses JSON serialization overhead that causes multi-second stalls.
     */
    async registerMeshBinary(mesh: THREE.Mesh): Promise<SculptMeshHandle | null> {
        await this.init();

        if (!this.available) {
            console.warn('[RustSculptManager] Rust backend not available');
            return null;
        }

        const uuid = mesh.uuid;

        // Dispose existing handle if present
        if (this.handles.has(uuid)) {
            const oldHandle = this.handles.get(uuid)!;
            await rustSculpt.dispose(oldHandle);
            this.handles.delete(uuid);
        }

        const geo = mesh.geometry;
        const posAttr = geo.attributes.position;
        const positions = new Float32Array(posAttr.array);

        const indexAttr = geo.index;
        if (!indexAttr) {
            console.warn('[RustSculptManager] Mesh has no indices, skipping');
            return null;
        }
        const indices = new Uint32Array(indexAttr.array);

        const t0 = performance.now();
        console.log(`[RustSculptManager] BINARY registering mesh: ${positions.length / 3} verts, ${indices.length / 3} faces...`);

        // Use BINARY path - 10-50x faster!
        const handle = await rustSculpt.initMeshBinary(positions, indices);

        const t1 = performance.now();

        if (handle !== null) {
            this.handles.set(uuid, handle);
            console.log(`[RustSculptManager] BINARY registered: ${uuid} -> handle ${handle} in ${(t1 - t0).toFixed(1)}ms`);

            // Also register for GPU raycast (async, don't block)
            gpuRaycastManager.registerMesh(mesh).then(gpuHandle => {
                if (gpuHandle !== null) {
                    console.log(`[RustSculptManager] GPU raycast registered: ${uuid} -> handle ${gpuHandle}`);
                }
            }).catch(() => {
                // GPU raycast is optional enhancement
            });
        } else {
            console.error('[RustSculptManager] BINARY registration failed');
        }
        return handle;
    }

    getHandle(mesh: THREE.Mesh): SculptMeshHandle | null {
        return this.handles.get(mesh.uuid) ?? null;
    }

    /**
     * Manually set handle for a mesh (used when Rust already registered it, e.g. subdivideAndRegister)
     */
    setHandle(meshUuid: string, handle: SculptMeshHandle): void {
        // Dispose old handle if exists (shouldn't happen but be safe)
        if (this.handles.has(meshUuid)) {
            const oldHandle = this.handles.get(meshUuid)!;
            rustSculpt.dispose(oldHandle);
        }
        this.handles.set(meshUuid, handle);
        console.log(`[RustSculptManager] Handle set: ${meshUuid} -> ${handle} (pre-registered by Rust)`);
    }

    async syncPositions(mesh: THREE.Mesh): Promise<void> {
        const handle = this.handles.get(mesh.uuid);
        if (!handle) return;

        const positions = mesh.geometry.attributes.position.array as Float32Array;
        await rustSculpt.updatePositions(handle, positions);
    }

    async disposeMesh(mesh: THREE.Mesh): Promise<void> {
        const uuid = mesh.uuid;
        const handle = this.handles.get(uuid);
        if (handle) {
            await rustSculpt.dispose(handle);
            this.handles.delete(uuid);
        }
    }

    async disposeAll(): Promise<void> {
        for (const [_uuid, handle] of this.handles) {
            await rustSculpt.dispose(handle);
        }
        this.handles.clear();
    }
}

// Global singleton
export const rustSculptManager = new RustSculptManager();

// ============================================================================
// BRUSH APPLICATION - Rust with JS Fallback
// ============================================================================

import { jsSculptEngine } from './jsSculptEngine';

/**
 * Apply brush using Rust backend (with JavaScript fallback for browser mode)
 * 
 * This is the main entry point for high-performance sculpting.
 * - In Tauri: Uses Rust + optional GPU compute (30x faster)
 * - In Browser: Falls back to pure JavaScript engine (functional but slower)
 * 
 * @param useGpu Enable GPU compute for ~30x faster brushing (requires GPU init via GPU TEST button)
 * @param alphaHandle Optional GPU alpha texture handle for intensity modulation
 * @param delta Optional world-space mouse movement vector for Grab/Snake Hook/Move brushes
 * @param hardness Brush hardness for falloff curve (0.0-1.0)
 */
export async function applyBrushRust(
    mesh: THREE.Mesh,
    worldPoint: THREE.Vector3,
    worldNormal: THREE.Vector3,
    radius: number,
    intensity: number,
    tool: string,
    symmetry: 'X' | 'NONE' = 'NONE',
    useGpu: boolean = false,
    alphaHandle: number | null = null,
    delta: THREE.Vector3 | null = null,
    hardness: number = 0.5
): Promise<{ usedRust: boolean; timeMs: number; affectedCount: number; usedGpu: boolean; gpuFallbackReason?: string | null }> {
    // Initialize manager on first call
    await rustSculptManager.init();

    // Check Rust availability
    const handle = rustSculptManager.getHandle(mesh);
    const isAvailable = rustSculptManager.isAvailable();

    // =========================================================================
    // JAVASCRIPT FALLBACK (Browser Mode)
    // =========================================================================
    if (!handle || !isAvailable) {
        // Use JavaScript sculpting engine as fallback
        const jsResult = jsSculptEngine.applyBrush(
            mesh,
            worldPoint,
            worldNormal,
            tool,
            radius,
            intensity,
            hardness,
            symmetry,
            delta
        );

        return {
            usedRust: false,
            timeMs: jsResult.timeMs,
            affectedCount: jsResult.affectedCount,
            usedGpu: false,
            gpuFallbackReason: jsResult.gpuFallbackReason
        };
    }

    // =========================================================================
    // RUST BACKEND (Native Mode)
    // =========================================================================
    // Transform world to local space
    const invMat = mesh.matrixWorld.clone().invert();
    const localPoint = worldPoint.clone().applyMatrix4(invMat);
    const localNormal = worldNormal.clone().transformDirection(invMat).normalize();

    const scale = new THREE.Vector3();
    mesh.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
    const safeScale = (Math.abs(scale.x) + Math.abs(scale.y) + Math.abs(scale.z)) / 3 || 1;
    const localRadius = radius / safeScale;

    // Transform delta to local space (direction only, no translation)
    let localDelta: [number, number, number] | null = null;
    if (delta) {
        const transformedDelta = delta.clone().transformDirection(invMat);
        localDelta = [transformedDelta.x, transformedDelta.y, transformedDelta.z];
    }

    // Apply brush via Rust + optional GPU compute + optional alpha texture
    const result = await rustSculpt.applyBrush(
        handle,
        [localPoint.x, localPoint.y, localPoint.z],
        [localNormal.x, localNormal.y, localNormal.z],
        tool,
        localRadius,
        intensity,
        symmetry,
        useGpu,  // GPU compute mode - 30x faster!
        alphaHandle,  // GPU alpha texture for intensity modulation
        localDelta   // For Grab/Snake Hook/Move brushes
    );

    if (result) {
        applyBrushResultToGeometry(mesh.geometry, result);
        return {
            usedRust: true,
            timeMs: result.time_ms,
            affectedCount: result.affected_count,
            usedGpu: Boolean(result.used_gpu),
            gpuFallbackReason: result.gpu_fallback_reason ?? null,
        };
    }

    return { usedRust: false, timeMs: 0, affectedCount: 0, usedGpu: false, gpuFallbackReason: 'No result from Rust apply_brush' };
}

// Re-exports
export { rustSculpt, applyBrushResultToGeometry, type SculptMeshHandle, type BrushResult };
export { jsSculptEngine } from './jsSculptEngine';

