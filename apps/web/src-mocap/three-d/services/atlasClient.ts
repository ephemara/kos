/**
 * GPU Atlas Client - TypeScript bindings for GPU-accelerated UV unwrapping
 * 
 * Handles 1M+ vertices in milliseconds using WGPU compute shaders.
 */

import { invoke } from '@tauri-apps/api/core';

// ============================================================================
// Types
// ============================================================================

export interface AtlasInitResult {
    handle: number;
    vertex_count: number;
}

export interface AtlasProjectResult {
    uvs: number[];
    time_ms: number;
}

export type ProjectionMode =
    | 'BOX'
    | 'BOX_6AXIS'
    | 'PLANAR_X'
    | 'PLANAR_Y'
    | 'PLANAR_Z'
    | 'PLANAR_AXIS'
    | 'CYLINDRICAL'
    | 'SPHERICAL';

// ============================================================================
// GPU Atlas API (Handle-based)
// ============================================================================

/**
 * Initialize GPU atlas for a mesh
 * Returns a handle for subsequent operations
 */
export async function gpuAtlasInit(
    positions: number[],
    normals: number[] = []
): Promise<AtlasInitResult> {
    return invoke<AtlasInitResult>('gpu_atlas_init', { positions, normals });
}

/**
 * Project UVs using GPU compute
 */
export async function gpuAtlasProject(
    handle: number,
    mode: ProjectionMode,
    scale: number = 1.0,
    offsetU: number = 0.0,
    offsetV: number = 0.0
): Promise<AtlasProjectResult> {
    return invoke<AtlasProjectResult>('gpu_atlas_project', {
        handle,
        mode,
        scale,
        offsetU,
        offsetV,
    });
}

/**
 * Dispose of an atlas instance
 */
export async function gpuAtlasDispose(handle: number): Promise<void> {
    return invoke<void>('gpu_atlas_dispose', { handle });
}

/**
 * One-shot projection (init + project + dispose in one call)
 * Best for simple use cases where you don't need to re-project
 */
export async function gpuAtlasProjectOneshot(
    positions: number[],
    normals: number[] = [],
    mode: ProjectionMode = 'BOX',
    scale: number = 1.0,
    offsetU: number = 0.0,
    offsetV: number = 0.0
): Promise<AtlasProjectResult> {
    return invoke<AtlasProjectResult>('gpu_atlas_project_oneshot', {
        positions,
        normals,
        mode,
        scale,
        offsetU,
        offsetV,
    });
}

// ============================================================================
// GPU Atlas Packing
// ============================================================================

export interface AtlasPackResult {
    uvs: number[];
    island_count: number;
    time_ms: number;
}

/**
 * Pack UV islands using GPU compute
 * Takes existing UVs and packs them efficiently into 0-1 space
 */
export async function gpuAtlasPack(
    uvs: number[],
    indices: number[],
    padding: number = 0.01
): Promise<AtlasPackResult> {
    return invoke<AtlasPackResult>('gpu_atlas_pack', {
        uvs,
        indices,
        padding,
    });
}

// ============================================================================
// GPU Atlas Manager (Singleton with caching)
// ============================================================================

/**
 * GPU Atlas Manager - handles instance lifecycle
 */
class GpuAtlasManager {
    private handles: Map<string, number> = new Map();

    /**
     * Get or create atlas for a mesh
     */
    async getOrCreate(
        id: string,
        positions: number[],
        normals: number[]
    ): Promise<number> {
        // If we have a cached handle, dispose it first (mesh may have changed)
        if (this.handles.has(id)) {
            try {
                await gpuAtlasDispose(this.handles.get(id)!);
            } catch (e) {
                console.warn('[GpuAtlasManager] Dispose failed:', e);
            }
        }

        const result = await gpuAtlasInit(positions, normals);
        this.handles.set(id, result.handle);
        return result.handle;
    }

    /**
     * Project UVs for a mesh
     */
    async project(
        id: string,
        positions: number[],
        normals: number[],
        mode: ProjectionMode,
        scale: number = 1.0,
        offsetU: number = 0.0,
        offsetV: number = 0.0
    ): Promise<AtlasProjectResult> {
        const handle = await this.getOrCreate(id, positions, normals);
        return gpuAtlasProject(handle, mode, scale, offsetU, offsetV);
    }

    /**
     * Dispose all cached handles
     */
    async disposeAll(): Promise<void> {
        for (const [id, handle] of this.handles) {
            try {
                await gpuAtlasDispose(handle);
            } catch (e) {
                console.warn(`[GpuAtlasManager] Failed to dispose ${id}:`, e);
            }
        }
        this.handles.clear();
    }

    /**
     * Dispose a specific mesh
     */
    async dispose(id: string): Promise<void> {
        const handle = this.handles.get(id);
        if (handle !== undefined) {
            await gpuAtlasDispose(handle);
            this.handles.delete(id);
        }
    }
}

// Singleton instance
export const gpuAtlasManager = new GpuAtlasManager();

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Check if GPU atlas is available (Tauri environment)
 */
export function isGpuAtlasAvailable(): boolean {
    return typeof window !== 'undefined' && '__TAURI__' in window;
}

/**
 * Quick GPU projection for a Three.js mesh
 */
export async function gpuProjectMesh(
    mesh: THREE.Mesh,
    mode: ProjectionMode = 'BOX',
    scale: number = 1.0
): Promise<{ uvs: Float32Array; timeMs: number }> {
    const geometry = mesh.geometry;

    // Extract positions
    const posAttr = geometry.attributes.position;
    const positions: number[] = [];
    for (let i = 0; i < posAttr.count; i++) {
        positions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
    }

    // Extract normals (or empty for auto-generation)
    const normals: number[] = [];
    const normAttr = geometry.attributes.normal;
    if (normAttr) {
        for (let i = 0; i < normAttr.count; i++) {
            normals.push(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i));
        }
    }

    // Project on GPU
    const result = await gpuAtlasProjectOneshot(positions, normals, mode, scale);

    return {
        uvs: new Float32Array(result.uvs),
        timeMs: result.time_ms,
    };
}

// Type declaration for THREE (so we don't need to import it)
declare namespace THREE {
    interface Mesh {
        geometry: {
            attributes: {
                position: { count: number; getX(i: number): number; getY(i: number): number; getZ(i: number): number };
                normal?: { count: number; getX(i: number): number; getY(i: number): number; getZ(i: number): number };
                uv?: any;
            };
            setAttribute(name: string, attr: any): void;
        };
    }
}
