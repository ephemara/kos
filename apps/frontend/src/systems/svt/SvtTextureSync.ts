/**
 * SvtTextureSync - Real-time sync between SVT GPU textures and Three.js
 * 
 * Efficiently syncs painted SVT textures to Three.js CanvasTexture for rendering.
 * Uses throttling to cap at 60fps and dirty tracking to skip unchanged frames.
 * 
 * @example
 * ```tsx
 * const sync = new SvtTextureSync(svtPbrClient, 4096);
 * 
 * // Get textures for Three.js material
 * material.map = sync.getTexture('albedo');
 * material.roughnessMap = sync.getTexture('roughness');
 * 
 * // After painting, mark as dirty
 * sync.markDirty('albedo');
 * sync.markDirty('roughness');
 * 
 * // In animation loop
 * await sync.syncIfNeeded();
 * ```
 */

import * as THREE from 'three';
import { SvtPbrClient, PbrChannelName } from './svtPbrClient';

/** Configuration for SvtTextureSync */
export interface SvtTextureSyncConfig {
    /** Client to sync from */
    client: SvtPbrClient;
    /** Physical texture size (default 4096) */
    size?: number;
    /** Minimum ms between syncs (default 16 = ~60fps) */
    throttleMs?: number;
    /** Channels to sync (default all 5) */
    channels?: PbrChannelName[];
}

/** Per-channel sync state */
interface ChannelState {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    texture: THREE.CanvasTexture;
    dirty: boolean;
    lastSync: number;
}

/**
 * Syncs SVT PBR textures to Three.js CanvasTextures
 */
export class SvtTextureSync {
    private client: SvtPbrClient;
    private size: number;
    private throttleMs: number;
    private channels: Map<PbrChannelName, ChannelState> = new Map();
    private syncInProgress = false;

    constructor(config: SvtTextureSyncConfig) {
        this.client = config.client;
        this.size = config.size ?? 4096;
        this.throttleMs = config.throttleMs ?? 16;

        const channelsToSync = config.channels ?? ['albedo', 'normal', 'roughness', 'metalness', 'emission'];

        // Create canvas and texture for each channel
        for (const channel of channelsToSync) {
            const canvas = document.createElement('canvas');
            canvas.width = this.size;
            canvas.height = this.size;

            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error(`Could not get 2d context for ${channel}`);

            // Fill with default color
            ctx.fillStyle = this.getDefaultColor(channel);
            ctx.fillRect(0, 0, this.size, this.size);

            const texture = new THREE.CanvasTexture(canvas);
            texture.colorSpace = channel === 'albedo' || channel === 'emission'
                ? THREE.SRGBColorSpace
                : THREE.LinearSRGBColorSpace;
            texture.needsUpdate = true;

            this.channels.set(channel, {
                canvas,
                ctx,
                texture,
                dirty: false,
                lastSync: 0,
            });
        }
    }

    /** Get default CSS color for a channel */
    private getDefaultColor(channel: PbrChannelName): string {
        switch (channel) {
            case 'albedo': return '#808080';      // Gray
            case 'normal': return '#8080ff';      // Flat normal (z-up)
            case 'roughness': return '#808080';   // 50%
            case 'metalness': return '#000000';   // Non-metallic
            case 'emission': return '#000000';    // No emission
        }
    }

    /** Get the Three.js texture for a channel */
    getTexture(channel: PbrChannelName): THREE.CanvasTexture | null {
        return this.channels.get(channel)?.texture ?? null;
    }

    /** Get all textures as an object */
    getAllTextures(): Record<PbrChannelName, THREE.CanvasTexture | null> {
        return {
            albedo: this.getTexture('albedo'),
            normal: this.getTexture('normal'),
            roughness: this.getTexture('roughness'),
            metalness: this.getTexture('metalness'),
            emission: this.getTexture('emission'),
        };
    }

    /** Mark a channel as dirty (needs sync) */
    markDirty(channel: PbrChannelName): void {
        const state = this.channels.get(channel);
        if (state) {
            state.dirty = true;
        }
    }

    /** Mark all channels as dirty */
    markAllDirty(): void {
        for (const channel of this.channels.keys()) {
            this.markDirty(channel);
        }
    }

    /** Check if any channel is dirty */
    get hasDirtyChannels(): boolean {
        for (const state of this.channels.values()) {
            if (state.dirty) return true;
        }
        return false;
    }

    /**
     * Sync dirty channels if enough time has passed
     * Returns true if any sync occurred
     */
    async syncIfNeeded(): Promise<boolean> {
        if (this.syncInProgress) return false;
        if (!this.client.initialized) return false;
        if (!this.hasDirtyChannels) return false;

        const now = performance.now();
        let synced = false;

        this.syncInProgress = true;

        try {
            for (const [channel, state] of this.channels.entries()) {
                if (!state.dirty) continue;
                if (now - state.lastSync < this.throttleMs) continue;

                // Sync this channel
                await this.syncChannel(channel);
                state.dirty = false;
                state.lastSync = now;
                synced = true;
            }
        } finally {
            this.syncInProgress = false;
        }

        return synced;
    }

    /**
     * Force sync a specific channel immediately
     */
    async syncChannel(channel: PbrChannelName): Promise<void> {
        const state = this.channels.get(channel);
        if (!state) return;
        if (!this.client.initialized) return;

        try {
            const rawBytes = await this.client.exportChannel(channel);

            // Create ImageData from raw bytes
            const clampedArray = new Uint8ClampedArray(rawBytes.length);
            clampedArray.set(rawBytes);
            const imageData = new ImageData(clampedArray, this.size, this.size);

            // Draw to canvas
            state.ctx.putImageData(imageData, 0, 0);

            // Mark texture for update
            state.texture.needsUpdate = true;
        } catch (e) {
            console.warn(`[SvtTextureSync] Failed to sync ${channel}:`, e);
        }
    }

    /**
     * Force sync all channels immediately (expensive!)
     */
    async syncAll(): Promise<void> {
        for (const channel of this.channels.keys()) {
            await this.syncChannel(channel);
        }
    }

    /**
     * Apply textures to a Three.js MeshStandardMaterial
     */
    applyToMaterial(material: THREE.MeshStandardMaterial): void {
        const textures = this.getAllTextures();

        if (textures.albedo) material.map = textures.albedo;
        if (textures.normal) material.normalMap = textures.normal;
        if (textures.roughness) material.roughnessMap = textures.roughness;
        if (textures.metalness) material.metalnessMap = textures.metalness;
        if (textures.emission) {
            material.emissiveMap = textures.emission;
            material.emissive = new THREE.Color(1, 1, 1);
        }

        material.needsUpdate = true;
    }

    /**
     * Dispose all textures and canvases
     */
    dispose(): void {
        for (const state of this.channels.values()) {
            state.texture.dispose();
        }
        this.channels.clear();
    }
}

/**
 * Create a sync instance from a PBR client
 */
export function createTextureSync(client: SvtPbrClient, size?: number): SvtTextureSync {
    return new SvtTextureSync({ client, size });
}
