/**
 * SVT PBR Client - TypeScript bindings for Multi-Channel PBR Painting
 * 
 * Supports 5 PBR channels:
 * - Albedo (RGBA)
 * - Normal (tangent-space)
 * - Roughness
 * - Metalness
 * - Emission
 * 
 * Features:
 * - Blend modes (Normal, Multiply, Add, Overlay, Screen)
 * - User-configurable resolution (16K virtual default)
 * - Real-time viewport sync
 * 
 * @example
 * ```ts
 * const pbr = new SvtPbrClient();
 * await pbr.init();
 * await pbr.stroke({
 *     centerUv: [0.5, 0.5],
 *     radius: 50,
 *     albedoColor: [1, 0, 0, 1],
 *     roughnessValue: 0.3,
 *     albedoEnabled: true,
 *     roughnessEnabled: true,
 * });
 * const albedoBytes = await pbr.exportChannel('albedo');
 * ```
 */

import { invoke } from '@tauri-apps/api/core';

// ============================================================================
// TYPES
// ============================================================================

/** PBR channel names */
export type PbrChannelName = 'albedo' | 'normal' | 'roughness' | 'metalness' | 'emission';

/** Channel index mapping */
export const PbrChannelIndex: Record<PbrChannelName, number> = {
    albedo: 0,
    normal: 1,
    roughness: 2,
    metalness: 3,
    emission: 4,
};

/** Blend mode options */
export type BlendModeName = 'normal' | 'multiply' | 'add' | 'overlay' | 'screen';

/** Blend mode index mapping */
export const BlendModeIndex: Record<BlendModeName, number> = {
    normal: 0,
    multiply: 1,
    add: 2,
    overlay: 3,
    screen: 4,
};

/** RGBA color tuple */
export type Color4 = [number, number, number, number];

/** UV coordinate tuple */
export type UV = [number, number];

/** Configuration for SVT PBR initialization */
export interface SvtPbrConfig {
    /** Virtual texture width (default 16384) */
    virtualWidth?: number;
    /** Virtual texture height (default 16384) */
    virtualHeight?: number;
    /** Physical cache size (default 4096) */
    physicalSize?: number;
    /** Tile size in pixels (default 128) */
    tileSize?: number;
}

/** Parameters for a PBR stroke */
export interface PbrStrokeParams {
    /** Center position in UV space [0-1] */
    centerUv: UV;
    /** Brush radius in pixels */
    radius: number;
    /** Brush hardness 0-1 (default 0.5) */
    hardness?: number;
    /** Flow/opacity 0-1 (default 1.0) */
    flow?: number;
    /** Blend mode (default 'normal') */
    blendMode?: BlendModeName;

    // Channel enables
    /** Enable albedo painting (default true) */
    albedoEnabled?: boolean;
    /** Enable normal painting (default false) */
    normalEnabled?: boolean;
    /** Enable roughness painting (default false) */
    roughnessEnabled?: boolean;
    /** Enable metalness painting (default false) */
    metalnessEnabled?: boolean;
    /** Enable emission painting (default false) */
    emissionEnabled?: boolean;

    // Values
    /** Albedo color RGBA (default white) */
    albedoColor?: Color4;
    /** Roughness value 0-1 (default 0.5) */
    roughnessValue?: number;
    /** Metalness value 0-1 (default 0) */
    metalnessValue?: number;
    /** Emission color RGB (default orange) */
    emissionColor?: Color4;
    /** Emission strength (default 0) */
    emissionStrength?: number;
}

/** Stats for the PBR SVT instance */
export interface SvtPbrStats {
    virtualWidth: number;
    virtualHeight: number;
    physicalSize: number;
    tileSize: number;
    loadedTiles: number;
    maxTiles: number;
    channels: string[];
}

// ============================================================================
// SVT PBR CLIENT
// ============================================================================

/**
 * Multi-channel PBR SVT client for high-performance texture painting.
 * 
 * Paint to all 5 PBR channels simultaneously with blend modes.
 */
export class SvtPbrClient {
    private handle: number | null = null;
    private _initialized = false;
    private _config: SvtPbrConfig = {};

    /** Check if SVT is initialized */
    get initialized(): boolean {
        return this._initialized && this.handle !== null;
    }

    /** Get the internal handle (for advanced use) */
    get svtHandle(): number | null {
        return this.handle;
    }

    /** Get the current configuration */
    get config(): SvtPbrConfig {
        return this._config;
    }

    /**
     * Initialize SVT PBR with 5 channels
     * @param config Optional configuration
     */
    async init(config?: SvtPbrConfig): Promise<number> {
        if (this.handle !== null) {
            await this.dispose();
        }

        this._config = config || {};

        this.handle = await invoke<number>('svt_pbr_init', {
            config: config ? {
                virtualWidth: config.virtualWidth,
                virtualHeight: config.virtualHeight,
                physicalSize: config.physicalSize,
                tileSize: config.tileSize,
            } : null,
        });
        this._initialized = true;
        return this.handle;
    }

    /**
     * Apply a PBR paint stroke to multiple channels
     * @param params Stroke parameters
     */
    async stroke(params: PbrStrokeParams): Promise<void> {
        if (!this.handle) throw new Error('SVT PBR not initialized');

        await invoke('svt_pbr_stroke', {
            handle: this.handle,
            params: {
                centerUv: params.centerUv,
                radius: params.radius,
                hardness: params.hardness ?? 0.5,
                flow: params.flow ?? 1.0,
                blendMode: BlendModeIndex[params.blendMode ?? 'normal'],

                albedoEnabled: params.albedoEnabled ?? true,
                normalEnabled: params.normalEnabled ?? false,
                roughnessEnabled: params.roughnessEnabled ?? false,
                metalnessEnabled: params.metalnessEnabled ?? false,
                emissionEnabled: params.emissionEnabled ?? false,

                albedoColor: params.albedoColor ?? [1, 1, 1, 1],
                roughnessValue: params.roughnessValue ?? 0.5,
                metalnessValue: params.metalnessValue ?? 0,
                emissionColor: params.emissionColor ?? [1, 0.5, 0, 1],
                emissionStrength: params.emissionStrength ?? 0,
            },
        });
    }

    /**
     * Export a specific channel as raw RGBA bytes
     * @param channel Channel name
     * @returns Uint8Array of RGBA pixels
     */
    async exportChannel(channel: PbrChannelName): Promise<Uint8Array> {
        if (!this.handle) throw new Error('SVT PBR not initialized');

        const bytes = await invoke<number[]>('svt_pbr_export_channel', {
            handle: this.handle,
            channel: PbrChannelIndex[channel],
        });
        return new Uint8Array(bytes);
    }

    /**
     * Export a channel to a canvas element
     * @param channel Channel name
     * @param canvas Optional canvas to draw to
     * @param size Physical texture size (default from config)
     */
    async exportChannelToCanvas(
        channel: PbrChannelName,
        canvas?: HTMLCanvasElement,
        size?: number
    ): Promise<HTMLCanvasElement> {
        const rawBytes = await this.exportChannel(channel);
        const physicalSize = size || this._config.physicalSize || 4096;

        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.width = physicalSize;
            canvas.height = physicalSize;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get 2d context');

        const clampedArray = new Uint8ClampedArray(rawBytes.length);
        clampedArray.set(rawBytes);
        const imageData = new ImageData(clampedArray, physicalSize, physicalSize);

        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    /**
     * Export all channels as an object
     */
    async exportAll(): Promise<Record<PbrChannelName, Uint8Array>> {
        return {
            albedo: await this.exportChannel('albedo'),
            normal: await this.exportChannel('normal'),
            roughness: await this.exportChannel('roughness'),
            metalness: await this.exportChannel('metalness'),
            emission: await this.exportChannel('emission'),
        };
    }

    /**
     * Clear a specific channel to its default value
     * @param channel Channel name
     */
    async clearChannel(channel: PbrChannelName): Promise<void> {
        if (!this.handle) throw new Error('SVT PBR not initialized');

        await invoke('svt_pbr_clear_channel', {
            handle: this.handle,
            channel: PbrChannelIndex[channel],
        });
    }

    /**
     * Clear all channels to their default values
     */
    async clearAll(): Promise<void> {
        if (!this.handle) throw new Error('SVT PBR not initialized');
        await invoke('svt_pbr_clear_all', { handle: this.handle });
    }

    /**
     * Get stats about the SVT instance
     */
    async stats(): Promise<SvtPbrStats> {
        if (!this.handle) throw new Error('SVT PBR not initialized');
        return invoke<SvtPbrStats>('svt_pbr_stats', { handle: this.handle });
    }

    /**
     * Dispose and free GPU resources
     */
    async dispose(): Promise<void> {
        if (this.handle !== null) {
            await invoke('svt_pbr_dispose', { handle: this.handle });
            this.handle = null;
            this._initialized = false;
        }
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/** Global SVT PBR instance for apps that only need one */
export const svtPbr = new SvtPbrClient();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a new SVT PBR instance with initialization
 */
export async function createSvtPbr(config?: SvtPbrConfig): Promise<SvtPbrClient> {
    const client = new SvtPbrClient();
    await client.init(config);
    return client;
}

/**
 * Get default channel colors
 */
export function getChannelDefaultColor(channel: PbrChannelName): Color4 {
    switch (channel) {
        case 'albedo': return [0.5, 0.5, 0.5, 1.0];
        case 'normal': return [0.5, 0.5, 1.0, 1.0];
        case 'roughness': return [0.5, 0.5, 0.5, 1.0];
        case 'metalness': return [0.0, 0.0, 0.0, 1.0];
        case 'emission': return [0.0, 0.0, 0.0, 1.0];
    }
}
