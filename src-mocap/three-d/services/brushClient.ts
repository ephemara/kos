/**
 * brushClient.ts - Data-driven brush system client
 * 
 * Provides TypeScript interface to the Rust brush library system
 * Used by both KSculpt and Bevy frontends
 */

import { invoke } from '@tauri-apps/api/core';

// ============================================================================
// TYPES
// ============================================================================

interface BrushKernel {
    family: string;
    shader: string;
}

interface BrushParams {
    radius: number;
    strength: number;
    hardness: number;
    spacing: number;
    accumulate: boolean;
    subtract: boolean;
    front_faces_only: boolean;
    alpha_enabled: boolean;
    alpha_scale: number;
    jitter_position: number;
    jitter_rotation: number;
    jitter_strength: number;
    random_seed: number;
    pressure_curve_idx: number;
    speed_curve_idx: number;
    tilt_curve_idx: number;
    [key: string]: any; // Extra params
}

interface BrushTextures {
    alpha?: string;
    normal?: string;
    roughness?: string;
    [key: string]: string | undefined;
}

interface KBrushAsset {
    // Identity
    id: string;
    name: string;
    category: string;
    tags: string[];
    icon?: string;

    // Kernel
    kernel: BrushKernel;

    // Core Parameters
    params: BrushParams;

    // Textures
    textures: BrushTextures;

    // Curves
    pressure_strength?: string;
    speed_radius?: string;
    tilt_rotation?: string;
}

interface BrushCurve {
    id: string;
    name: string;
    points: number[][];
    interpolation: 'linear' | 'smooth' | 'cubic';
}

// ============================================================================
// BRUSH LIBRARY CLIENT
// ============================================================================

class BrushLibraryClient {
    private initialized = false;
    private brushes: Map<string, KBrushAsset> = new Map();
    private curves: Map<string, BrushCurve> = new Map();

    /**
     * Initialize the brush library
     */
    async init(): Promise<void> {
        if (this.initialized) return;

        try {
            const isTauri = typeof (window as any).__TAURI__ !== 'undefined';
            if (!isTauri) {
                // Browser mode: Load fallback brushes
                console.log('[BrushClient] No Tauri detected, loading fallback brushes');
                this.loadFallbackBrushes();
                this.initialized = true;
                return;
            }
            await invoke('init_brush_library');
            await this.refresh();
            this.initialized = true;
        } catch (error) {
            console.error('[BrushClient] Failed to initialize:', error);
            // Fallback to hardcoded brushes on error
            this.loadFallbackBrushes();
            this.initialized = true;
        }
    }

    /**
     * Load fallback brushes for browser mode or when Rust fails
     */
    private loadFallbackBrushes(): void {
        const defaultParams: BrushParams = {
            radius: 0.15, strength: 0.6, hardness: 0.3, spacing: 0.08,
            accumulate: true, subtract: false, front_faces_only: true,
            alpha_enabled: false, alpha_scale: 1.0,
            jitter_position: 0, jitter_rotation: 0, jitter_strength: 0, random_seed: 0,
            pressure_curve_idx: 0, speed_curve_idx: 0, tilt_curve_idx: 0
        };

        const fallbackBrushes: KBrushAsset[] = [
            {
                id: 'clay', name: 'Clay', category: 'Sculpt/Standard', tags: ['clay', 'buildup'],
                kernel: { family: 'stamp', shader: 'sculpt_stamp' },
                params: { ...defaultParams, radius: 0.15, strength: 0.6 }, textures: {}
            },
            {
                id: 'draw', name: 'Draw', category: 'Sculpt/Standard', tags: ['draw', 'stroke'],
                kernel: { family: 'stamp', shader: 'sculpt_stamp' },
                params: { ...defaultParams, radius: 0.1, strength: 0.5, hardness: 0.5, spacing: 0.05 }, textures: {}
            },
            {
                id: 'smooth', name: 'Smooth', category: 'Sculpt/Standard', tags: ['smooth', 'relax'],
                kernel: { family: 'smooth', shader: 'sculpt_smooth' },
                params: { ...defaultParams, radius: 0.2, strength: 0.5, hardness: 0.2, spacing: 0.1, accumulate: false, front_faces_only: false }, textures: {}
            },
            {
                id: 'move', name: 'Move', category: 'Sculpt/Grab', tags: ['move', 'grab'],
                kernel: { family: 'grab', shader: 'sculpt_grab' },
                params: { ...defaultParams, radius: 0.3, strength: 1.0, spacing: 0.0, accumulate: false }, textures: {}
            },
            {
                id: 'flatten', name: 'Flatten', category: 'Sculpt/Standard', tags: ['flatten', 'plane'],
                kernel: { family: 'stamp', shader: 'sculpt_stamp' },
                params: { ...defaultParams, radius: 0.2, strength: 0.5, hardness: 0.4, accumulate: false }, textures: {}
            },
            {
                id: 'inflate', name: 'Inflate', category: 'Sculpt/Standard', tags: ['inflate', 'expand'],
                kernel: { family: 'stamp', shader: 'sculpt_stamp' },
                params: { ...defaultParams, radius: 0.15, strength: 0.4 }, textures: {}
            },
            {
                id: 'pinch', name: 'Pinch', category: 'Sculpt/Standard', tags: ['pinch', 'crease'],
                kernel: { family: 'pinch', shader: 'sculpt_pinch' },
                params: { ...defaultParams, radius: 0.1, strength: 0.6, hardness: 0.5, spacing: 0.05 }, textures: {}
            },
            {
                id: 'scrape', name: 'Scrape', category: 'Sculpt/Standard', tags: ['scrape', 'trim'],
                kernel: { family: 'stamp', shader: 'sculpt_stamp' },
                params: { ...defaultParams, radius: 0.2, strength: 0.5, hardness: 0.6, accumulate: false, subtract: true }, textures: {}
            },
            {
                id: 'crease', name: 'Crease', category: 'Sculpt/Standard', tags: ['crease', 'line'],
                kernel: { family: 'stamp', shader: 'sculpt_stamp' },
                params: { ...defaultParams, radius: 0.08, strength: 0.7, hardness: 0.7, spacing: 0.04 }, textures: {}
            },
            {
                id: 'snake_hook', name: 'Snake Hook', category: 'Sculpt/Grab', tags: ['snake', 'pull'],
                kernel: { family: 'grab', shader: 'sculpt_grab' },
                params: { ...defaultParams, radius: 0.15, strength: 0.8, hardness: 0.4, spacing: 0.0, accumulate: false }, textures: {}
            },
        ];

        this.brushes.clear();
        fallbackBrushes.forEach(brush => {
            this.brushes.set(brush.id, brush);
        });
        console.log(`[BrushClient] Loaded ${fallbackBrushes.length} fallback brushes`);
    }

    /**
     * Refresh brushes from the library
     */
    async refresh(): Promise<void> {
        try {
            const isTauri = typeof (window as any).__TAURI__ !== 'undefined';
            if (!isTauri) {
                // In browser mode, just use fallback brushes
                if (this.brushes.size === 0) {
                    this.loadFallbackBrushes();
                }
                return;
            }
            const brushList = await invoke<KBrushAsset[]>('list_brushes');
            this.brushes.clear();
            brushList.forEach(brush => {
                this.brushes.set(brush.id, brush);
            });
        } catch (error) {
            console.error('[BrushClient] Failed to load brushes:', error);
            // Don't throw - use existing fallback brushes
            if (this.brushes.size === 0) {
                this.loadFallbackBrushes();
            }
        }
    }

    /**
     * Get all brushes
     */
    getAllBrushes(): KBrushAsset[] {
        return Array.from(this.brushes.values());
    }

    /**
     * Get brushes by category
     */
    getBrushesByCategory(category: string): KBrushAsset[] {
        return this.getAllBrushes().filter(brush => brush.category === category);
    }

    /**
     * Get a specific brush by ID
     */
    getBrush(id: string): KBrushAsset | undefined {
        return this.brushes.get(id);
    }

    /**
     * Save a brush to the library
     */
    async saveBrush(brush: KBrushAsset): Promise<void> {
        try {
            await invoke('save_brush', { brush });
            this.brushes.set(brush.id, brush);
        } catch (error) {
            console.error('[BrushClient] Failed to save brush:', error);
            throw error;
        }
    }

    /**
     * Delete a brush from the library
     */
    async deleteBrush(id: string): Promise<void> {
        try {
            await invoke('delete_brush', { id });
            this.brushes.delete(id);
        } catch (error) {
            console.error('[BrushClient] Failed to delete brush:', error);
            throw error;
        }
    }

    /**
     * Get available kernel families
     */
    async getKernelFamilies(): Promise<string[]> {
        try {
            return await invoke<string[]>('list_kernels');
        } catch (error) {
            console.error('[BrushClient] Failed to get kernels:', error);
            return [];
        }
    }

    /**
     * Check if library is initialized
     */
    isReady(): boolean {
        return this.initialized;
    }

    /**
     * Get default brush (fallback)
     */
    getDefaultBrush(): KBrushAsset {
        return this.getBrush('clay') || this.getAllBrushes()[0] || {
            id: 'fallback',
            name: 'Fallback Brush',
            category: 'Sculpt/Clay',
            tags: ['fallback'],
            kernel: { family: 'stamp', shader: 'sculpt_stamp' },
            params: {
                radius: 0.15,
                strength: 0.6,
                hardness: 0.3,
                spacing: 0.08,
                accumulate: true,
                subtract: false,
                front_faces_only: true,
                alpha_enabled: false,
                alpha_scale: 1.0,
                jitter_position: 0.0,
                jitter_rotation: 0.0,
                jitter_strength: 0.0,
                random_seed: 0.0,
                pressure_curve_idx: 0,
                speed_curve_idx: 0,
                tilt_curve_idx: 0,
            },
            textures: {},
        };
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const brushClient = new BrushLibraryClient();
export type { BrushKernel, BrushParams, BrushTextures, KBrushAsset, BrushCurve };
