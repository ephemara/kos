/**
 * useSvtPbr - React hook for multi-channel PBR SVT painting
 * 
 * Manages SVT PBR lifecycle with React state.
 * Auto-disposes on unmount.
 * 
 * @example
 * ```tsx
 * function PbrPainter() {
 *   const { initialized, stroke, exportChannel } = useSvtPbr();
 *   
 *   const handlePaint = (uv: [number, number]) => {
 *     stroke({
 *       centerUv: uv,
 *       radius: 50,
 *       albedoColor: [1, 0, 0, 1],
 *       albedoEnabled: true,
 *       roughnessEnabled: true,
 *       roughnessValue: 0.2,
 *     });
 *   };
 * }
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    SvtPbrClient,
    SvtPbrConfig,
    SvtPbrStats,
    PbrStrokeParams,
    PbrChannelName,
    Color4,
} from './svtPbrClient';

export interface UseSvtPbrOptions extends SvtPbrConfig {
    /** Auto-initialize on mount (default true) */
    autoInit?: boolean;
}

export interface UseSvtPbrReturn {
    /** Whether SVT PBR is initialized and ready */
    initialized: boolean;
    /** Whether currently loading/processing */
    loading: boolean;
    /** Any error that occurred */
    error: string | null;
    /** SVT handle for advanced use */
    handle: number | null;
    /** Initialize SVT PBR (if autoInit is false) */
    init: () => Promise<void>;
    /** Apply a PBR paint stroke */
    stroke: (params: PbrStrokeParams) => Promise<void>;
    /** Export a specific channel as Uint8Array */
    exportChannel: (channel: PbrChannelName) => Promise<Uint8Array | null>;
    /** Export a channel to canvas */
    exportChannelToCanvas: (channel: PbrChannelName, canvas?: HTMLCanvasElement) => Promise<HTMLCanvasElement | null>;
    /** Export all channels */
    exportAll: () => Promise<Record<PbrChannelName, Uint8Array> | null>;
    /** Clear a specific channel */
    clearChannel: (channel: PbrChannelName) => Promise<void>;
    /** Clear all channels */
    clearAll: () => Promise<void>;
    /** Get SVT stats */
    stats: () => Promise<SvtPbrStats | null>;
    /** Dispose and cleanup */
    dispose: () => Promise<void>;
    /** Direct access to client (advanced) */
    client: SvtPbrClient;
}

/**
 * React hook for multi-channel PBR SVT painting
 */
export function useSvtPbr(options: UseSvtPbrOptions = {}): UseSvtPbrReturn {
    const {
        virtualWidth,
        virtualHeight,
        physicalSize,
        tileSize,
        autoInit = true,
    } = options;

    const clientRef = useRef<SvtPbrClient>(new SvtPbrClient());
    const [initialized, setInitialized] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [handle, setHandle] = useState<number | null>(null);

    // Initialize
    const init = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const h = await clientRef.current.init({
                virtualWidth,
                virtualHeight,
                physicalSize,
                tileSize,
            });
            setHandle(h);
            setInitialized(true);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }, [virtualWidth, virtualHeight, physicalSize, tileSize]);

    // Stroke
    const stroke = useCallback(async (params: PbrStrokeParams) => {
        if (!clientRef.current.initialized) return;
        try {
            await clientRef.current.stroke(params);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    }, []);

    // Export channel
    const exportChannel = useCallback(async (channel: PbrChannelName) => {
        if (!clientRef.current.initialized) return null;
        try {
            return await clientRef.current.exportChannel(channel);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            return null;
        }
    }, []);

    // Export channel to canvas
    const exportChannelToCanvas = useCallback(async (channel: PbrChannelName, canvas?: HTMLCanvasElement) => {
        if (!clientRef.current.initialized) return null;
        try {
            return await clientRef.current.exportChannelToCanvas(channel, canvas);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            return null;
        }
    }, []);

    // Export all
    const exportAll = useCallback(async () => {
        if (!clientRef.current.initialized) return null;
        try {
            return await clientRef.current.exportAll();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            return null;
        }
    }, []);

    // Clear channel
    const clearChannel = useCallback(async (channel: PbrChannelName) => {
        if (!clientRef.current.initialized) return;
        try {
            await clientRef.current.clearChannel(channel);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    }, []);

    // Clear all
    const clearAll = useCallback(async () => {
        if (!clientRef.current.initialized) return;
        try {
            await clientRef.current.clearAll();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    }, []);

    // Stats
    const stats = useCallback(async () => {
        if (!clientRef.current.initialized) return null;
        try {
            return await clientRef.current.stats();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            return null;
        }
    }, []);

    // Dispose
    const dispose = useCallback(async () => {
        await clientRef.current.dispose();
        setInitialized(false);
        setHandle(null);
    }, []);

    // Auto-init and cleanup
    useEffect(() => {
        if (autoInit) {
            init();
        }
        return () => {
            clientRef.current.dispose();
        };
    }, [autoInit, init]);

    return {
        initialized,
        loading,
        error,
        handle,
        init,
        stroke,
        exportChannel,
        exportChannelToCanvas,
        exportAll,
        clearChannel,
        clearAll,
        stats,
        dispose,
        client: clientRef.current,
    };
}

export default useSvtPbr;
