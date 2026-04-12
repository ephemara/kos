/**
 * K_OS Universal Brush Engine
 * 
 * Shared brush infrastructure for all K_OS drawing/sculpting apps:
 * - KSculpt: Alpha modulates displacement intensity
 * - KPainter: Alpha modulates paint opacity  
 * - KGraphos: Alpha modulates stroke rendering
 * 
 * This is the single source of truth for brushes across K_OS.
 */

import { invoke } from '@tauri-apps/api/core';

// ============================================================================
// TYPES
// ============================================================================

/** Handle to a loaded alpha texture in the GPU pool */
export type AlphaHandle = number;

/** Source of an alpha texture */
export type AlphaSource =
    | { File: { path: string } }
    | { Embedded: { id: string } }
    | { Procedural: { generator: string; params: Record<string, number> } };

/** Alpha texture information */
export interface AlphaInfo {
    handle: AlphaHandle;
    name: string;
    width: number;
    height: number;
    source: AlphaSource;
    /** Base64-encoded PNG preview thumbnail (data URI) */
    preview?: string;
}

/** Types of procedural alphas */
export type ProceduralType =
    | 'radial'    // Soft brush falloff
    | 'circle'    // Hard circle
    | 'square'    // Square shape
    | 'diamond'   // Diamond shape
    | 'perlin'    // Perlin noise (organic)
    | 'voronoi'   // Voronoi cells (scales, cracks)
    | 'bricks'    // Brick/tile pattern
    | 'dots';     // Dot pattern

/** Brush settings (shared across apps) */
export interface BrushSettings {
    // Alpha texture
    alpha: AlphaInfo | null;

    // Core settings
    size: number;           // World units or pixels depending on app
    opacity: number;        // 0-1
    flow: number;           // 0-1 (paint accumulation rate)
    spacing: number;        // 0-1 (distance between dabs as % of size)

    // Alpha transform
    alphaRotation: number;  // Degrees
    alphaScale: number;     // 1.0 = no scale
    alphaTiling: 'none' | 'repeat' | 'mirror';

    // Dynamics (jitter)
    sizeJitter: number;     // 0-1
    rotationJitter: number; // 0-1
    scatterAmount: number;  // 0-1
}

/** Default brush settings */
export const DEFAULT_BRUSH_SETTINGS: BrushSettings = {
    alpha: null,
    size: 0.1,
    opacity: 1.0,
    flow: 1.0,
    spacing: 0.25,
    alphaRotation: 0,
    alphaScale: 1.0,
    alphaTiling: 'none',
    sizeJitter: 0,
    rotationJitter: 0,
    scatterAmount: 0,
};

// ============================================================================
// ALPHA LOADING
// ============================================================================

/**
 * Load an alpha texture from a file path
 */
export async function loadAlphaFromFile(
    path: string,
    name?: string
): Promise<AlphaInfo> {
    const isTauri = typeof (window as any).__TAURI__ !== 'undefined';
    if (!isTauri) throw new Error('Alpha loading not available on web');
    return invoke<AlphaInfo>('load_alpha_from_file', { path, name });
}

/**
 * Load an alpha from base64-encoded image data
 */
export async function loadAlphaFromBase64(
    data: string,
    name: string
): Promise<AlphaInfo> {
    const isTauri = typeof (window as any).__TAURI__ !== 'undefined';
    if (!isTauri) throw new Error('Alpha loading not available on web');
    return invoke<AlphaInfo>('load_alpha_from_base64', { data, name });
}

/**
 * Load an alpha from a File object (browser API)
 */
export async function loadAlphaFromFile2(file: File): Promise<AlphaInfo> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const base64 = (reader.result as string).split(',')[1];
                const info = await loadAlphaFromBase64(base64, file.name);
                resolve(info);
            } catch (e) {
                reject(e);
            }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

/**
 * Load an alpha from a URL (fetches and uploads)
 */
export async function loadAlphaFromUrl(
    url: string,
    name?: string
): Promise<AlphaInfo> {
    const response = await fetch(url);
    const blob = await response.blob();
    const base64 = await blobToBase64(blob);
    return loadAlphaFromBase64(base64, name || url.split('/').pop() || 'url_alpha');
}

// ============================================================================
// PROCEDURAL GENERATION
// ============================================================================

/**
 * Generate a procedural alpha texture on the GPU
 */
export async function generateProceduralAlpha(
    type: ProceduralType,
    size: number = 256,
    params?: Record<string, number>
): Promise<AlphaInfo> {
    const isTauri = typeof (window as any).__TAURI__ !== 'undefined';
    if (!isTauri) throw new Error('Procedural alpha not available on web');
    return invoke<AlphaInfo>('generate_procedural_alpha', {
        procType: type,
        size,
        params,
    });
}

/**
 * Common procedural alpha presets
 */
export const PROCEDURAL_PRESETS = {
    // Soft standard brush
    softRound: () => generateProceduralAlpha('radial', 256, { falloff: 2.0 }),

    // Hard edge brush
    hardRound: () => generateProceduralAlpha('circle', 256, { softness: 0.02 }),

    // Square brush
    square: () => generateProceduralAlpha('square', 256, { softness: 0.02 }),

    // Diamond brush
    diamond: () => generateProceduralAlpha('diamond', 256, { softness: 0.05 }),

    // Organic noise
    perlinNoise: (scale = 4, octaves = 4) =>
        generateProceduralAlpha('perlin', 256, { scale, octaves }),

    // Scales/cells pattern
    voronoiCells: (cells = 16, edgeWidth = 0.1) =>
        generateProceduralAlpha('voronoi', 256, { cells, edge_width: edgeWidth }),

    // Brick/tile pattern
    bricks: (width = 0.25, height = 0.1) =>
        generateProceduralAlpha('bricks', 256, { width, height, mortar: 0.02 }),

    // Dot pattern
    dots: (dotSize = 0.08, spacing = 0.15) =>
        generateProceduralAlpha('dots', 256, { dot_size: dotSize, spacing }),
};

// ============================================================================
// ALPHA MANAGEMENT
// ============================================================================

/**
 * List all loaded alpha textures
 */
export async function listAlphas(): Promise<AlphaInfo[]> {
    const isTauri = typeof (window as any).__TAURI__ !== 'undefined';
    if (!isTauri) return [];
    return invoke<AlphaInfo[]>('list_alphas');
}

/**
 * Get info for a specific alpha
 */
export async function getAlphaInfo(handle: AlphaHandle): Promise<AlphaInfo | null> {
    const isTauri = typeof (window as any).__TAURI__ !== 'undefined';
    if (!isTauri) return null;
    return invoke<AlphaInfo | null>('get_alpha_info', { handle });
}

/**
 * Dispose/unload an alpha texture
 */
export async function disposeAlpha(handle: AlphaHandle): Promise<boolean> {
    const isTauri = typeof (window as any).__TAURI__ !== 'undefined';
    if (!isTauri) return false;
    return invoke<boolean>('dispose_alpha', { handle });
}

// ============================================================================
// BRUSH ENGINE (SINGLETON)
// ============================================================================

/**
 * Global brush engine state
 */
class BrushEngine {
    private settings: BrushSettings = { ...DEFAULT_BRUSH_SETTINGS };
    private loadedAlphas: Map<AlphaHandle, AlphaInfo> = new Map();
    private listeners: Set<() => void> = new Set();

    /** Get current brush settings */
    getSettings(): Readonly<BrushSettings> {
        return this.settings;
    }

    /** Update brush settings */
    setSettings(partial: Partial<BrushSettings>) {
        this.settings = { ...this.settings, ...partial };
        this.notifyListeners();
    }

    /** Get current alpha (or null) */
    getAlpha(): AlphaInfo | null {
        return this.settings.alpha;
    }

    /** Set current alpha by handle */
    async setAlpha(handle: AlphaHandle | null) {
        if (handle === null) {
            this.settings.alpha = null;
        } else {
            const info = await getAlphaInfo(handle);
            this.settings.alpha = info;
        }
        this.notifyListeners();
    }

    /** Load and set alpha from file */
    async loadAndSetAlpha(path: string, name?: string) {
        const info = await loadAlphaFromFile(path, name);
        this.loadedAlphas.set(info.handle, info);
        this.settings.alpha = info;
        this.notifyListeners();
        return info;
    }

    /** Generate and set procedural alpha */
    async generateAndSetAlpha(
        type: ProceduralType,
        size?: number,
        params?: Record<string, number>
    ) {
        const info = await generateProceduralAlpha(type, size, params);
        this.loadedAlphas.set(info.handle, info);
        this.settings.alpha = info;
        this.notifyListeners();
        return info;
    }

    /** Subscribe to settings changes */
    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notifyListeners() {
        this.listeners.forEach(l => l());
    }

    /** Get all loaded alphas */
    getLoadedAlphas(): AlphaInfo[] {
        return Array.from(this.loadedAlphas.values());
    }

    /** Refresh alphas from backend */
    async refreshAlphas(): Promise<AlphaInfo[]> {
        const alphas = await listAlphas();
        this.loadedAlphas.clear();
        alphas.forEach(a => this.loadedAlphas.set(a.handle, a));
        return alphas;
    }
}

/** Global brush engine instance */
export const brushEngine = new BrushEngine();

// ============================================================================
// REACT HOOK
// ============================================================================

import { useState, useEffect, useCallback } from 'react';

/**
 * React hook for accessing the brush engine
 */
export function useBrushEngine() {
    const [settings, setSettings] = useState(brushEngine.getSettings());

    useEffect(() => {
        return brushEngine.subscribe(() => {
            setSettings(brushEngine.getSettings());
        });
    }, []);

    const updateSettings = useCallback((partial: Partial<BrushSettings>) => {
        brushEngine.setSettings(partial);
    }, []);

    const loadAlpha = useCallback(async (path: string, name?: string) => {
        return brushEngine.loadAndSetAlpha(path, name);
    }, []);

    const generateAlpha = useCallback(async (
        type: ProceduralType,
        size?: number,
        params?: Record<string, number>
    ) => {
        return brushEngine.generateAndSetAlpha(type, size, params);
    }, []);

    return {
        settings,
        updateSettings,
        loadAlpha,
        generateAlpha,
        clearAlpha: () => brushEngine.setAlpha(null),
        alpha: settings.alpha,
    };
}

// ============================================================================
// UTILITIES
// ============================================================================

/** Convert Blob to base64 string */
async function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

export default brushEngine;
