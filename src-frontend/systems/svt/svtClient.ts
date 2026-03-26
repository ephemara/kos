/**
 * SVT Client - TypeScript bindings for Sparse Virtual Texturing
 * 
 * Handle-based API for 16K+ texture operations without JSON overhead.
 * All texture data stays in Rust/GPU - only small params cross IPC.
 * 
 * @example
 * ```ts
 * const svt = new SvtClient();
 * await svt.init(16384, 16384);
 * await svt.stroke([0.5, 0.5], 100, [1, 0, 0, 1]);
 * const tile = await svt.readTile(0, 0);
 * await svt.dispose();
 * ```
 */

import { invoke } from '@tauri-apps/api/core';

// ============================================================================
// TYPES
// ============================================================================

export interface SvtStats {
    virtual_width: number;
    virtual_height: number;
    tile_size: number;
    loaded_tiles: number;
    max_tiles: number;
}

export type Color4 = [number, number, number, number]; // RGBA 0-1
export type UV = [number, number];

// ============================================================================
// SVT CLIENT CLASS
// ============================================================================

/**
 * Sparse Virtual Texture client for high-performance texture operations.
 * 
 * Use cases:
 * - 16K+ texture painting (KPainter, KGraphos)
 * - Alpha/stencil libraries (KSculpt)
 * - Displacement maps
 * - Any large texture that needs streaming
 */
export class SvtClient {
    private handle: number | null = null;
    private _initialized = false;

    /** Check if SVT is initialized */
    get initialized(): boolean {
        return this._initialized && this.handle !== null;
    }

    /** Get the internal handle (for advanced use) */
    get svtHandle(): number | null {
        return this.handle;
    }

    /**
     * Initialize SVT texture
     * @param width Virtual width (default 16384)
     * @param height Virtual height (default 16384)
     * @param tileSize Tile size in pixels (default 128)
     */
    async init(width = 16384, height = 16384, tileSize = 128): Promise<number> {
        if (this.handle !== null) {
            await this.dispose();
        }

        this.handle = await invoke<number>('svt_init', {
            width,
            height,
            tileSize,
        });
        this._initialized = true;
        return this.handle;
    }

    /**
     * Apply a paint stroke
     * @param centerUv Center position in UV space [0-1]
     * @param radius Brush radius in pixels
     * @param color RGBA color [0-1]
     */
    async stroke(centerUv: UV, radius: number, color: Color4): Promise<void> {
        if (!this.handle) throw new Error('SVT not initialized');

        await invoke('svt_stroke', {
            handle: this.handle,
            centerUv,
            radius,
            color,
        });
    }

    /**
     * Read a tile as raw RGBA bytes
     * @param tileX Tile X coordinate
     * @param tileY Tile Y coordinate
     * @returns Uint8Array of RGBA pixels (tileSize^2 * 4 bytes)
     */
    async readTile(tileX: number, tileY: number): Promise<Uint8Array> {
        if (!this.handle) throw new Error('SVT not initialized');

        const bytes = await invoke<number[]>('svt_read_tile', {
            handle: this.handle,
            tileX,
            tileY,
        });
        return new Uint8Array(bytes);
    }

    /**
     * Export entire texture as base64 PNG
     * @returns Base64-encoded PNG string
     */
    async export(): Promise<string> {
        if (!this.handle) throw new Error('SVT not initialized');
        return invoke<string>('svt_export', { handle: this.handle });
    }

    /**
     * Export as Blob (for download or img src)
     */
    async exportAsBlob(): Promise<Blob> {
        const base64 = await this.export();
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return new Blob([bytes], { type: 'image/png' });
    }

    /**
     * Export as data URL (for img src)
     * NOTE: This is SLOW due to PNG encoding. Use exportRaw() for performance-critical code.
     */
    async exportAsDataUrl(): Promise<string> {
        const base64 = await this.export();
        return `data:image/png;base64,${base64}`;
    }

    /**
     * Export as raw RGBA bytes (FAST - no PNG encoding!)
     * Returns Uint8Array of 4096*4096*4 = 67MB raw pixels
     * ~5-10x faster than exportAsDataUrl()
     */
    async exportRaw(): Promise<Uint8Array> {
        if (!this.handle) throw new Error('SVT not initialized');
        const bytes = await invoke<number[]>('svt_export_raw', { handle: this.handle });
        return new Uint8Array(bytes);
    }

    /**
     * Export to a canvas element (FASTEST for Three.js integration)
     * Uses raw bytes + ImageData for zero PNG overhead
     * @param canvas Optional canvas to draw to. Creates one if not provided.
     * @param width Physical texture width (default 4096)
     * @param height Physical texture height (default 4096)
     */
    async exportToCanvas(
        canvas?: HTMLCanvasElement,
        width = 4096,
        height = 4096
    ): Promise<HTMLCanvasElement> {
        const rawBytes = await this.exportRaw();

        // Create canvas if not provided
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get 2d context');

        // Create ImageData from raw bytes
        // Note: We need to copy to a new ArrayBuffer to satisfy TypeScript's strict typing
        const clampedArray = new Uint8ClampedArray(rawBytes.length);
        clampedArray.set(rawBytes);
        const imageData = new ImageData(clampedArray, width, height);

        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    /**
     * Export to a data URL using raw bytes (FAST path)
     * Uses canvas internally - faster than PNG encode in Rust + base64
     */
    async exportToDataUrlFast(): Promise<string> {
        const canvas = await this.exportToCanvas();
        return canvas.toDataURL('image/png');
    }

    /**
     * Get stats about the SVT instance
     */
    async stats(): Promise<SvtStats> {
        if (!this.handle) throw new Error('SVT not initialized');
        return invoke<SvtStats>('svt_stats', { handle: this.handle });
    }

    /**
     * Dispose and free GPU resources
     */
    async dispose(): Promise<void> {
        if (this.handle !== null) {
            await invoke('svt_dispose', { handle: this.handle });
            this.handle = null;
            this._initialized = false;
        }
    }
}

// ============================================================================
// SINGLETON INSTANCE (for simple use cases)
// ============================================================================

/** Global SVT instance for apps that only need one texture */
export const svt = new SvtClient();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a new SVT instance with initialization
 */
export async function createSvt(
    width = 16384,
    height = 16384,
    tileSize = 128
): Promise<SvtClient> {
    const client = new SvtClient();
    await client.init(width, height, tileSize);
    return client;
}
