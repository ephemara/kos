/**
 * dynameshClient.ts
 * 
 * TypeScript bindings for K_OS GPU-accelerated Dynamesh remeshing.
 * Uses WGPU compute shaders for ZBrush-style mesh retopology.
 * 
 * Performance: 100K triangles @ 128³ resolution in <100ms
 */

// Type definitions matching Rust structs

export interface GpuDynameshParams {
    resolution?: number;        // Grid resolution (32-256, default 128)
    smooth_steps?: number;      // SDF smoothing iterations (0-4, default 2)
    padding?: number;           // Padding around mesh (default 0.05)
    iso_level?: number;         // Isosurface level (default 0.0)
    vertex_smooth?: number;     // Output mesh smoothing (0-8, default 2)
}

export interface GpuDynameshStats {
    original_vertices: number;
    original_triangles: number;
    output_vertices: number;
    output_triangles: number;
    grid_resolution: number;
    sdf_build_ms: number;
    sdf_smooth_ms: number;
    marching_cubes_ms: number;
    vertex_smooth_ms: number;
    gpu_used: boolean;
}

export interface GpuDynameshResult {
    positions: number[];
    indices: number[];
    normals: number[];
    time_ms: number;
    stats: GpuDynameshStats;
}

// Lazy import Tauri invoke
let tauriInvoke: ((cmd: string, args?: any) => Promise<any>) | null = null;

const isTauri = (): boolean => {
    return typeof window !== 'undefined' && '__TAURI__' in window;
};

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
 * GPU Dynamesh Backend
 * ZBrush-style remeshing using WGPU compute shaders
 */
export const gpuDynamesh = {
    /**
     * Remesh using GPU-accelerated SDF + Marching Cubes
     * 
     * @param positions - Flat array of vertex positions [x,y,z,...]
     * @param indices - Flat array of triangle indices
     * @param params - Optional parameters for resolution, smoothing, etc.
     * @returns Remeshed positions, indices, normals, and timing stats
     * 
     * @example
     * const result = await gpuDynamesh.remesh(positions, indices, { resolution: 128 });
     * if (result) {
     *   mesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(result.positions, 3));
     *   mesh.geometry.setIndex(result.indices);
     *   console.log(`Remeshed in ${result.time_ms.toFixed(1)}ms`);
     * }
     */
    remesh: async (
        positions: Float32Array | number[],
        indices: Uint32Array | number[],
        params?: GpuDynameshParams
    ): Promise<GpuDynameshResult | null> => {
        const invoke = await getInvoke();

        if (invoke) {
            try {
                const result: GpuDynameshResult = await invoke('gpu_dynamesh', {
                    positions: Array.from(positions),
                    indices: Array.from(indices),
                    params: params || null,
                });
                console.log(
                    `[gpuDynamesh] ${result.stats.original_vertices}v ${result.stats.original_triangles}t → ` +
                    `${result.stats.output_vertices}v ${result.stats.output_triangles}t @ ` +
                    `res=${result.stats.grid_resolution} in ${result.time_ms.toFixed(1)}ms ` +
                    `(build:${result.stats.sdf_build_ms.toFixed(1)} smooth:${result.stats.sdf_smooth_ms.toFixed(1)} ` +
                    `mc:${result.stats.marching_cubes_ms.toFixed(1)} vtx:${result.stats.vertex_smooth_ms.toFixed(1)})`
                );
                return result;
            } catch (e) {
                console.error('[gpuDynamesh] remesh failed:', e);
                return null;
            }
        }
        return null;
    },

    /**
     * Benchmark GPU dynamesh performance with synthetic data
     * 
     * @param vertexCount - Number of vertices to generate
     * @param resolution - Grid resolution to test
     * @returns Stats from the benchmark run
     */
    benchmark: async (
        vertexCount: number = 10000,
        resolution: number = 128
    ): Promise<GpuDynameshStats | null> => {
        const invoke = await getInvoke();

        if (invoke) {
            try {
                const result: GpuDynameshStats = await invoke('gpu_dynamesh_benchmark', {
                    vertexCount,
                    resolution,
                });
                console.log(
                    `[gpuDynamesh] Benchmark: ${vertexCount}v @ res=${resolution} → ` +
                    `${result.output_vertices}v in (build:${result.sdf_build_ms.toFixed(1)} ` +
                    `smooth:${result.sdf_smooth_ms.toFixed(1)} mc:${result.marching_cubes_ms.toFixed(1)})`
                );
                return result;
            } catch (e) {
                console.error('[gpuDynamesh] benchmark failed:', e);
                return null;
            }
        }
        return null;
    },

    /**
     * Check if GPU dynamesh is available
     */
    isAvailable: async (): Promise<boolean> => {
        const invoke = await getInvoke();
        return invoke !== null;
    },
};

/**
 * Apply GPU dynamesh result to Three.js geometry
 */
export function applyDynameshToGeometry(
    geometry: any, // THREE.BufferGeometry
    result: GpuDynameshResult
): void {
    // Dispose old geometry data
    if (geometry.dispose) geometry.dispose();

    // Set new positions
    geometry.setAttribute(
        'position',
        new (window as any).THREE.Float32BufferAttribute(result.positions, 3)
    );

    // Set new normals (from GPU result)
    geometry.setAttribute(
        'normal',
        new (window as any).THREE.Float32BufferAttribute(result.normals, 3)
    );

    // Set new indices
    geometry.setIndex(Array.from(result.indices));

    // Add default color attribute (white)
    const vertexCount = result.positions.length / 3;
    const colors = new Float32Array(vertexCount * 3).fill(1.0);
    geometry.setAttribute('color', new (window as any).THREE.Float32BufferAttribute(colors, 3));

    // Add mask attribute (zeroed)
    const mask = new Float32Array(vertexCount).fill(0);
    geometry.setAttribute('mask', new (window as any).THREE.Float32BufferAttribute(mask, 1));

    // Recompute bounds
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    // Rebuild BVH if available
    // @ts-ignore
    if (geometry.computeBoundsTree) {
        // @ts-ignore
        geometry.computeBoundsTree();
    }
}

/**
 * Resolution presets for different use cases
 */
export const DYNAMESH_PRESETS = {
    /** Fast preview - low detail, quick feedback */
    PREVIEW: { resolution: 64, smooth_steps: 1, vertex_smooth: 1 },

    /** Standard sculpting - good balance */
    STANDARD: { resolution: 128, smooth_steps: 2, vertex_smooth: 2 },

    /** High detail - more polygons, slower */
    HIGH: { resolution: 192, smooth_steps: 2, vertex_smooth: 3 },

    /** Maximum detail - production quality */
    ULTRA: { resolution: 256, smooth_steps: 3, vertex_smooth: 4 },

    /** Clean topology - extra smoothing for hard surface */
    HARD_SURFACE: { resolution: 128, smooth_steps: 4, vertex_smooth: 4 },

    /** Organic smooth - less angular, more organic feel */
    ORGANIC: { resolution: 128, smooth_steps: 3, vertex_smooth: 6, padding: 0.08 },
} as const;

export default gpuDynamesh;
