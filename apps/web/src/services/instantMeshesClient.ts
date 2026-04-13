/**
 * instantMeshesClient.ts
 * 
 * TypeScript bindings for Instant Meshes integration.
 * Provides field-aligned quad/tri remeshing via external binary.
 */

// Parameters for Instant Meshes remeshing
export interface InstantMeshesParams {
    /** Target face count (mutually exclusive with target_vertices and target_scale) */
    target_faces?: number;
    /** Target vertex count (mutually exclusive with target_faces and target_scale) */
    target_vertices?: number;
    /** Target edge length in world space (mutually exclusive with target_faces and target_vertices) */
    target_scale?: number;
    /** Dihedral angle threshold for creases (degrees) */
    crease_angle?: number;
    /** Number of smoothing iterations (default: 2) */
    smooth_iterations?: number;
    /** Use deterministic (slower but reproducible) algorithms */
    deterministic?: boolean;
    /** Align edges to mesh boundaries */
    align_boundaries?: boolean;
    /** Orientation symmetry: 2 (lines), 4 (quads), 6 (triangles) */
    rosy?: 2 | 4 | 6;
    /** Position symmetry: 4 (quads) or 6 (triangles) */
    posy?: 4 | 6;
    /** Generate dominant mesh (mixed tris/quads) instead of pure */
    dominant?: boolean;
    /** Use intrinsic mode (default is extrinsic) */
    intrinsic?: boolean;
}

// Result from Instant Meshes remeshing
export interface InstantMeshesResult {
    positions: number[];
    indices: number[];
    normals: number[];
    time_ms: number;
    input_vertices: number;
    output_vertices: number;
    output_faces: number;
    is_quad_mesh: boolean;
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
 * Instant Meshes Integration
 * Field-aligned quad/tri remeshing using external binary
 */
export const instantMeshes = {
    /**
     * Check if Instant Meshes is available
     */
    isAvailable: async (): Promise<boolean> => {
        const invoke = await getInvoke();
        if (invoke) {
            try {
                return await invoke('instant_meshes_available');
            } catch (e) {
                console.error('[InstantMeshes] availability check failed:', e);
                return false;
            }
        }
        return false;
    },

    /**
     * Remesh using Instant Meshes (field-aligned quad/tri)
     * 
     * @param positions - Flat array of vertex positions [x,y,z,...]
     * @param indices - Flat array of triangle indices
     * @param params - Optional parameters for target resolution, symmetry, etc.
     * @returns Remeshed positions, indices, normals, and timing stats
     * 
     * @example
     * const result = await instantMeshes.remesh(positions, indices, { 
     *   target_faces: 5000,
     *   rosy: 4,  // Quad orientation
     *   posy: 4,  // Quad positions
     * });
     * if (result) {
     *   mesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(result.positions, 3));
     *   mesh.geometry.setIndex(result.indices);
     *   console.log(`Remeshed in ${result.time_ms.toFixed(1)}ms - ${result.is_quad_mesh ? 'QUADS' : 'TRIS'}`);
     * }
     */
    remesh: async (
        positions: Float32Array | number[],
        indices: Uint32Array | number[],
        params?: InstantMeshesParams
    ): Promise<InstantMeshesResult | null> => {
        const invoke = await getInvoke();

        if (invoke) {
            try {
                const result: InstantMeshesResult = await invoke('instant_meshes_remesh', {
                    positions: Array.from(positions),
                    indices: Array.from(indices),
                    params: params || null,
                });
                console.log(
                    `[InstantMeshes] ${result.input_vertices}v → ` +
                    `${result.output_vertices}v ${result.output_faces}f ` +
                    `(${result.is_quad_mesh ? 'QUADS' : 'TRIS'}) in ${result.time_ms.toFixed(1)}ms`
                );
                return result;
            } catch (e) {
                console.error('[InstantMeshes] remesh failed:', e);
                return null;
            }
        }
        return null;
    },

    /**
     * Remesh to pure quads (shortcut for rosy=4, posy=4)
     */
    remeshQuads: async (
        positions: Float32Array | number[],
        indices: Uint32Array | number[],
        targetFaces: number = 5000
    ): Promise<InstantMeshesResult | null> => {
        return instantMeshes.remesh(positions, indices, {
            target_faces: targetFaces,
            rosy: 4,
            posy: 4,
            align_boundaries: true,
        });
    },

    /**
     * Remesh to triangles with even distribution (rosy=6, posy=6)
     */
    remeshTris: async (
        positions: Float32Array | number[],
        indices: Uint32Array | number[],
        targetFaces: number = 5000
    ): Promise<InstantMeshesResult | null> => {
        return instantMeshes.remesh(positions, indices, {
            target_faces: targetFaces,
            rosy: 6,
            posy: 6,
            align_boundaries: true,
        });
    },
};

/**
 * Apply Instant Meshes result to Three.js geometry
 */
export function applyInstantMeshesToGeometry(
    geometry: any, // THREE.BufferGeometry
    result: InstantMeshesResult
): void {
    // Dispose old geometry data
    if (geometry.dispose) geometry.dispose();

    // Set new positions
    geometry.setAttribute(
        'position',
        new (window as any).THREE.Float32BufferAttribute(result.positions, 3)
    );

    // Set new normals
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
 * Presets for common use cases
 */
export const INSTANT_MESHES_PRESETS = {
    /** Animation-ready quad mesh */
    ANIMATION: {
        target_faces: 5000,
        rosy: 4,
        posy: 4,
        crease_angle: 30,
        smooth_iterations: 2,
        align_boundaries: true,
    },

    /** High-detail quad mesh */
    HIGH_DETAIL: {
        target_faces: 20000,
        rosy: 4,
        posy: 4,
        crease_angle: 20,
        smooth_iterations: 3,
    },

    /** Low-poly game asset */
    GAME_ASSET: {
        target_faces: 2000,
        rosy: 4,
        posy: 4,
        crease_angle: 40,
        smooth_iterations: 1,
    },

    /** Even triangle distribution */
    UNIFORM_TRIS: {
        target_faces: 10000,
        rosy: 6,
        posy: 6,
        align_boundaries: true,
    },

    /** Scale-based (match edge length to 5cm) */
    SCALE_BASED: {
        target_scale: 0.05,
        rosy: 4,
        posy: 4,
    },
} as const;

export default instantMeshes;
