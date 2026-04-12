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
    family: 'stamp' | 'smooth' | 'pinch' | 'grab' | 'physics' | 'spirv' | string;
    shader: string;
}

interface KernelInfoDto {
    id: string;
    name: string;
    category: string;
    description: string;
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

interface KainMetaConfig {
    language?: string;
    entry?: string;
    source?: string;
    targets?: string[];
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
    meta?: KainMetaConfig;
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

    private normalizeKernel(rawKernel: any): BrushKernel {
        const familyToShader: Record<string, string> = {
            stamp: 'sculpt_stamp',
            smooth: 'sculpt_smooth',
            pinch: 'sculpt_pinch',
            grab: 'sculpt_grab',
            flatten: 'sculpt_flatten',
            physics: 'sculpt_physics',
            sim_cloth: 'sim_cloth',
            sim_gravity: 'sim_gravity',
            paint_color: 'paint_color',
            paint_mask: 'paint_mask',
        };

        const parseNamedShader = (value: string): BrushKernel => {
            const normalized = value.toLowerCase();

            if (normalized.startsWith('kain:') || normalized.startsWith('spirv:')) {
                return { family: 'spirv', shader: normalized.split(':')[1] || 'stamp_main' };
            }

            if (normalized.startsWith('stamp_') || normalized.startsWith('physics_')) {
                return { family: 'spirv', shader: normalized };
            }

            const mapped = familyToShader[normalized];
            if (mapped) {
                return { family: normalized, shader: mapped };
            }

            return { family: 'stamp', shader: normalized || 'sculpt_stamp' };
        };

        if (typeof rawKernel === 'string') {
            return parseNamedShader(rawKernel);
        }

        if (rawKernel && typeof rawKernel === 'object') {
            if (typeof rawKernel.family === 'string' && typeof rawKernel.shader === 'string') {
                return { family: rawKernel.family, shader: rawKernel.shader };
            }

            if (typeof rawKernel.custom === 'string') {
                return parseNamedShader(rawKernel.custom);
            }
        }

        return { family: 'stamp', shader: 'sculpt_stamp' };
    }

    private normalizeBrush(rawBrush: any): KBrushAsset {
        const tags = Array.isArray(rawBrush?.tags) ? rawBrush.tags : [];
        const hasMetaTag = tags.some((tag: string) => {
            const lower = String(tag).toLowerCase();
            return lower === 'kain_meta' || lower === 'metaphysical' || lower === 'meta';
        });

        const rawMeta = rawBrush?.meta && typeof rawBrush.meta === 'object' ? rawBrush.meta : null;
        const normalizedMeta: KainMetaConfig | undefined = rawMeta
            ? {
                language: typeof rawMeta.language === 'string' ? rawMeta.language : undefined,
                entry: typeof rawMeta.entry === 'string' ? rawMeta.entry : undefined,
                source: typeof rawMeta.source === 'string' ? rawMeta.source : undefined,
                targets: Array.isArray(rawMeta.targets)
                    ? rawMeta.targets.filter((target: unknown): target is string => typeof target === 'string')
                    : undefined,
            }
            : hasMetaTag
                ? { language: 'kain_meta', entry: String(rawBrush?.kernel?.shader ?? rawBrush?.id ?? 'meta_entry') }
                : undefined;

        const normalized: KBrushAsset = {
            id: String(rawBrush?.id ?? 'unknown_brush'),
            name: String(rawBrush?.name ?? 'Unknown Brush'),
            category: String(rawBrush?.category ?? 'Sculpt/Standard'),
            tags,
            icon: rawBrush?.icon,
            kernel: this.normalizeKernel(rawBrush?.kernel),
            params: (rawBrush?.params ?? {
                radius: 0.15, strength: 0.6, hardness: 0.3, spacing: 0.08,
                accumulate: true, subtract: false, front_faces_only: true,
                alpha_enabled: false, alpha_scale: 1.0,
                jitter_position: 0, jitter_rotation: 0, jitter_strength: 0, random_seed: 0,
                pressure_curve_idx: 0, speed_curve_idx: 0, tilt_curve_idx: 0
            }) as BrushParams,
            textures: (rawBrush?.textures ?? {}) as BrushTextures,
            pressure_strength: rawBrush?.pressure_strength,
            speed_radius: rawBrush?.speed_radius,
            tilt_rotation: rawBrush?.tilt_rotation,
            meta: normalizedMeta,
        };

        return normalized;
    }

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
                id: 'smooth', name: 'Smooth', category: 'Sculpt/Standard', tags: ['smooth', 'relax'],
                kernel: { family: 'smooth', shader: 'sculpt_smooth' },
                params: { ...defaultParams, radius: 0.2, strength: 0.5, hardness: 0.2, spacing: 0.1, accumulate: false, front_faces_only: false }, textures: {}
            },
            {
                id: 'grab', name: 'Grab', category: 'Sculpt/Grab', tags: ['move', 'grab'],
                kernel: { family: 'grab', shader: 'sculpt_grab' },
                params: { ...defaultParams, radius: 0.3, strength: 1.0, spacing: 0.0, accumulate: false }, textures: {}
            },
            {
                id: 'pinch', name: 'Pinch', category: 'Sculpt/Standard', tags: ['pinch', 'crease'],
                kernel: { family: 'pinch', shader: 'sculpt_pinch' },
                params: { ...defaultParams, radius: 0.1, strength: 0.6, hardness: 0.5, spacing: 0.05 }, textures: {}
            },
            {
                id: 'attractor', name: 'Attractor', category: 'Sculpt/Physics', tags: ['physics', 'attractor'],
                kernel: { family: 'physics', shader: 'sculpt_physics' },
                params: { ...defaultParams, radius: 0.25, strength: 0.4, hardness: 0.4, spacing: 0.08, accumulate: false }, textures: {}
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
            const brushList = await invoke<any[]>('list_brushes');
            this.brushes.clear();
            brushList.forEach(brush => {
                const normalized = this.normalizeBrush(brush);
                this.brushes.set(normalized.id, normalized);
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
            const kernels = await invoke<KernelInfoDto[]>('list_kernels');
            return kernels.map((k) => k.id);
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
export type { BrushKernel, BrushParams, BrushTextures, KBrushAsset, BrushCurve, KainMetaConfig };
