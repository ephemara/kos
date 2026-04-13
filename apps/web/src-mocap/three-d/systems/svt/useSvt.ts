/**
 * useSvt - React hook for SVT operations
 * 
 * Manages SVT lifecycle with React state.
 * Auto-disposes on unmount.
 * 
 * @example
 * ```tsx
 * function AlphaPainter() {
 *   const { initialized, stroke, stats, error } = useSvt();
 *   
 *   useEffect(() => {
 *     // SVT auto-initializes on mount
 *   }, []);
 *   
 *   const handlePaint = (uv: [number, number]) => {
 *     stroke(uv, 50, [1, 0, 0, 1]);
 *   };
 * }
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { SvtClient, SvtStats, Color4, UV } from './svtClient';

export interface UseSvtOptions {
    /** Virtual texture width (default 16384) */
    width?: number;
    /** Virtual texture height (default 16384) */
    height?: number;
    /** Tile size in pixels (default 128) */
    tileSize?: number;
    /** Auto-initialize on mount (default true) */
    autoInit?: boolean;
}

export interface UseSvtReturn {
    /** Whether SVT is initialized and ready */
    initialized: boolean;
    /** Whether currently loading/processing */
    loading: boolean;
    /** Any error that occurred */
    error: string | null;
    /** SVT handle for advanced use */
    handle: number | null;
    /** Initialize SVT (if autoInit is false) */
    init: () => Promise<void>;
    /** Apply a paint stroke */
    stroke: (centerUv: UV, radius: number, color: Color4) => Promise<void>;
    /** Read a tile as Uint8Array */
    readTile: (tileX: number, tileY: number) => Promise<Uint8Array | null>;
    /** Export as base64 PNG (SLOW - use exportRaw for performance) */
    exportPng: () => Promise<string | null>;
    /** Export as data URL (SLOW - use exportDataUrlFast for performance) */
    exportDataUrl: () => Promise<string | null>;
    /** Export as raw RGBA bytes (FAST - 5-10x faster!) */
    exportRaw: () => Promise<Uint8Array | null>;
    /** Export to canvas (FASTEST for Three.js) */
    exportToCanvas: (canvas?: HTMLCanvasElement) => Promise<HTMLCanvasElement | null>;
    /** Export to data URL via canvas (FAST) */
    exportDataUrlFast: () => Promise<string | null>;
    /** Get SVT stats */
    stats: () => Promise<SvtStats | null>;
    /** Dispose and cleanup */
    dispose: () => Promise<void>;
    /** Direct access to client (advanced) */
    client: SvtClient;
}

/**
 * React hook for SVT operations
 */
export function useSvt(options: UseSvtOptions = {}): UseSvtReturn {
    const {
        width = 16384,
        height = 16384,
        tileSize = 128,
        autoInit = true,
    } = options;

    const clientRef = useRef<SvtClient>(new SvtClient());
    const [initialized, setInitialized] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [handle, setHandle] = useState<number | null>(null);

    // Initialize
    const init = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const h = await clientRef.current.init(width, height, tileSize);
            setHandle(h);
            setInitialized(true);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }, [width, height, tileSize]);

    // Stroke
    const stroke = useCallback(async (centerUv: UV, radius: number, color: Color4) => {
        if (!clientRef.current.initialized) return;
        try {
            await clientRef.current.stroke(centerUv, radius, color);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    }, []);

    // Read tile
    const readTile = useCallback(async (tileX: number, tileY: number) => {
        if (!clientRef.current.initialized) return null;
        try {
            return await clientRef.current.readTile(tileX, tileY);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            return null;
        }
    }, []);

    // Export PNG
    const exportPng = useCallback(async () => {
        if (!clientRef.current.initialized) return null;
        try {
            return await clientRef.current.export();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            return null;
        }
    }, []);

    // Export data URL
    const exportDataUrl = useCallback(async () => {
        if (!clientRef.current.initialized) return null;
        try {
            return await clientRef.current.exportAsDataUrl();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            return null;
        }
    }, []);

    // Export raw bytes (FAST!)
    const exportRaw = useCallback(async () => {
        if (!clientRef.current.initialized) return null;
        try {
            return await clientRef.current.exportRaw();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            return null;
        }
    }, []);

    // Export to canvas (FASTEST for Three.js)
    const exportToCanvas = useCallback(async (canvas?: HTMLCanvasElement) => {
        if (!clientRef.current.initialized) return null;
        try {
            return await clientRef.current.exportToCanvas(canvas);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            return null;
        }
    }, []);

    // Export data URL via canvas (FAST)
    const exportDataUrlFast = useCallback(async () => {
        if (!clientRef.current.initialized) return null;
        try {
            return await clientRef.current.exportToDataUrlFast();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            return null;
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
        readTile,
        exportPng,
        exportDataUrl,
        exportRaw,
        exportToCanvas,
        exportDataUrlFast,
        stats,
        dispose,
        client: clientRef.current,
    };
}

export default useSvt;
