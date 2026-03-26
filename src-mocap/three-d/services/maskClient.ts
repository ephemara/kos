/**
 * maskClient.ts
 * 
 * TypeScript bindings for K_OS Rust masking backend.
 * Provides high-performance vertex masking via Tauri.
 * Shared between Simple mode (KSculpt) and could be used by Bevy via direct calls.
 */

import type { SculptMeshHandle } from './sculptClient';

// Check if we're running in Tauri
const isTauri = (): boolean => {
    return typeof window !== 'undefined' && '__TAURI__' in window;
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

// ============================================================================
// TYPES
// ============================================================================

export interface MaskPaintResult {
    modified_indices: number[];
    new_values: number[];
    time_ms: number;
}

// ============================================================================
// RUST MASK MODULE BINDINGS
// ============================================================================

export const rustMask = {
    /**
     * Paint mask at a position
     * @param handle Sculpt mesh handle
     * @param positions Flat vertex positions array
     * @param center Brush center [x, y, z]
     * @param radius Brush radius
     * @param intensity Mask intensity (+1.0 to add, -1.0 to remove)
     * @param falloff Falloff curve (0.0 = hard, 1.0 = smooth)
     */
    paint: async (
        handle: SculptMeshHandle,
        positions: Float32Array | number[],
        center: [number, number, number],
        radius: number,
        intensity: number,
        falloff: number = 1.0
    ): Promise<MaskPaintResult | null> => {
        const invoke = await getInvoke();
        if (!invoke) return null;

        try {
            const result: MaskPaintResult = await invoke('paint_mask_cmd', {
                handle,
                positions: Array.from(positions),
                center,
                radius,
                intensity,
                falloff,
            });
            return result;
        } catch (e) {
            console.error('[rustMask] Paint failed:', e);
            return null;
        }
    },

    /**
     * Clear all mask values to 0
     */
    clear: async (handle: SculptMeshHandle): Promise<boolean> => {
        const invoke = await getInvoke();
        if (!invoke) return false;

        try {
            await invoke('clear_mask_cmd', { handle });
            return true;
        } catch (e) {
            console.error('[rustMask] Clear failed:', e);
            return false;
        }
    },

    /**
     * Invert mask: 1.0 - current value
     */
    invert: async (handle: SculptMeshHandle): Promise<boolean> => {
        const invoke = await getInvoke();
        if (!invoke) return false;

        try {
            await invoke('invert_mask_cmd', { handle });
            return true;
        } catch (e) {
            console.error('[rustMask] Invert failed:', e);
            return false;
        }
    },

    /**
     * Expand mask by edge rings
     * @param handle Sculpt mesh handle
     * @param indices Triangle indices array
     * @param iterations Number of times to expand
     */
    grow: async (
        handle: SculptMeshHandle,
        indices: Uint32Array | number[],
        iterations: number = 1
    ): Promise<boolean> => {
        const invoke = await getInvoke();
        if (!invoke) return false;

        try {
            await invoke('grow_mask_cmd', {
                handle,
                indices: Array.from(indices),
                iterations,
            });
            return true;
        } catch (e) {
            console.error('[rustMask] Grow failed:', e);
            return false;
        }
    },

    /**
     * Contract mask by edge rings
     * @param handle Sculpt mesh handle
     * @param indices Triangle indices array
     * @param iterations Number of times to contract
     */
    shrink: async (
        handle: SculptMeshHandle,
        indices: Uint32Array | number[],
        iterations: number = 1
    ): Promise<boolean> => {
        const invoke = await getInvoke();
        if (!invoke) return false;

        try {
            await invoke('shrink_mask_cmd', {
                handle,
                indices: Array.from(indices),
                iterations,
            });
            return true;
        } catch (e) {
            console.error('[rustMask] Shrink failed:', e);
            return false;
        }
    },

    /**
     * Blur/smooth mask values
     * @param handle Sculpt mesh handle
     * @param indices Triangle indices array
     * @param iterations Number of blur passes
     */
    blur: async (
        handle: SculptMeshHandle,
        indices: Uint32Array | number[],
        iterations: number = 1
    ): Promise<boolean> => {
        const invoke = await getInvoke();
        if (!invoke) return false;

        try {
            await invoke('blur_mask_cmd', {
                handle,
                indices: Array.from(indices),
                iterations,
            });
            return true;
        } catch (e) {
            console.error('[rustMask] Blur failed:', e);
            return false;
        }
    },

    /**
     * Get current mask values
     */
    get: async (handle: SculptMeshHandle): Promise<Float32Array | null> => {
        const invoke = await getInvoke();
        if (!invoke) return null;

        try {
            const values: number[] = await invoke('get_mask_cmd', { handle });
            return new Float32Array(values);
        } catch (e) {
            console.error('[rustMask] Get failed:', e);
            return null;
        }
    },

    /**
     * Check if Rust mask backend is available
     */
    isAvailable: async (): Promise<boolean> => {
        const invoke = await getInvoke();
        return invoke !== null;
    },
};

/**
 * Apply mask result to Three.js geometry mask attribute
 */
export function applyMaskResultToGeometry(
    geometry: any, // THREE.BufferGeometry
    result: MaskPaintResult
): void {
    const maskAttr = geometry.attributes.mask;
    if (!maskAttr) return;

    const maskArray = maskAttr.array as Float32Array;

    for (let i = 0; i < result.modified_indices.length; i++) {
        const idx = result.modified_indices[i];
        maskArray[idx] = result.new_values[i];
    }

    maskAttr.needsUpdate = true;
}

export default rustMask;
