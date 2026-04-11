/**
 * BevyTether - Universal Bevy Window Sync Component
 * 
 * Extracted from legacy KSculptBevy.tsx to provide reusable
 * Bevy window positioning/visibility for Advanced Mode.
 * 
 * Usage:
 *   <BevyTether viewportRef={myRef} />
 *   - viewportRef: ref to the DOM element Bevy should position behind
 *   - Handles: visibility, window sync, egui mode, click-through
 * 
 * Now uses robust window management with proper event listeners
 * and debounced sync to reduce IPC noise.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { UnlistenFn } from '@tauri-apps/api/event';

export interface BevyTetherProps {
    /** Ref to the viewport div that Bevy should position behind */
    viewportRef: React.RefObject<HTMLDivElement>;
    /** Whether the tether is enabled (only activate in Advanced mode) */
    enabled?: boolean;
    /** Enable egui-only mode (click-through for Bevy input) */
    eguiOnly?: boolean;
    /** Enable egui debug panel */
    debugPanel?: boolean;
    /** Callback when connection status changes */
    onConnectionChange?: (connected: boolean) => void;
}

interface WindowBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Hook that manages Bevy window sync lifecycle
 */
export function useBevyTether({
    viewportRef,
    enabled = false,
    eguiOnly = false,  // Default to false - React handles UI now
    debugPanel = false,
    onConnectionChange
}: BevyTetherProps) {
    const [isConnected, setIsConnected] = useState(false);
    const [isEguiOnly, setIsEguiOnly] = useState(eguiOnly);
    const [isDebugOpen, setIsDebugOpen] = useState(debugPanel);
    
    const lastSyncRef = useRef<WindowBounds | null>(null);
    const unlistenersRef = useRef<UnlistenFn[]>([]);
    const syncTimeoutRef = useRef<number | null>(null);

    const syncViewport = useCallback(async () => {
        if (!enabled || !viewportRef?.current) return false;

        try {
            const win = getCurrentWindow();
            const [windowPos, scaleFactor] = await Promise.all([
                win.innerPosition(),
                win.scaleFactor(),
            ]);
            const rect = viewportRef.current.getBoundingClientRect();

            const bounds: WindowBounds = {
                x: Math.round(windowPos.x + rect.left * scaleFactor),
                y: Math.round(windowPos.y + rect.top * scaleFactor),
                width: Math.max(1, Math.round(rect.width * scaleFactor)),
                height: Math.max(1, Math.round(rect.height * scaleFactor)),
            };

            const last = lastSyncRef.current;
            if (!last ||
                bounds.x !== last.x ||
                bounds.y !== last.y ||
                bounds.width !== last.width ||
                bounds.height !== last.height
            ) {
                await invoke('sync_bevy_window', {
                    x: bounds.x,
                    y: bounds.y,
                    width: bounds.width,
                    height: bounds.height
                });
                lastSyncRef.current = bounds;
            }

            if (!isConnected) {
                setIsConnected(true);
                onConnectionChange?.(true);
            }

            return true;
        } catch (e) {
            if (isConnected) {
                setIsConnected(false);
                onConnectionChange?.(false);
            }
            return false;
        }
    }, [enabled, viewportRef, isConnected, onConnectionChange]);

    // =========================================================================
    // BEVY VISIBILITY - Show Bevy on mount, hide on unmount (only when enabled)
    // =========================================================================
    useEffect(() => {
        if (!enabled) {
            console.log('[BevyTether] Not enabled, skipping visibility');
            return;
        }

        console.log('[BevyTether] Enabled! Syncing viewport before showing Bevy window...');
        let cancelled = false;

        void (async () => {
            const synced = await syncViewport();
            if (cancelled) {
                return;
            }

            if (!synced) {
                console.warn('[BevyTether] Initial viewport sync failed; skipping Bevy show');
                return;
            }

            await invoke('set_bevy_visible', { visible: true })
                .then(() => console.log('[BevyTether] set_bevy_visible(true) succeeded'))
                .catch((e) => console.error('[BevyTether] set_bevy_visible(true) failed:', e));
            invoke('leash_debug_ui', { enabled: debugPanel }).catch(() => { });
        })();

        return () => {
            cancelled = true;
            console.log('[BevyTether] Cleanup - hiding Bevy window');
            // Cleanup: ensure overlay isn't stuck in click-through mode
            getCurrentWindow().setIgnoreCursorEvents(false).catch(() => { });
            // Hide Bevy window when leaving Advanced mode
            invoke('set_bevy_visible', { visible: false }).catch(() => { });
        };
    }, [enabled, debugPanel, syncViewport]);

    // =========================================================================
    // EGUI-ONLY MODE (Click-through overlay so Bevy receives mouse input)
    // =========================================================================
    useEffect(() => {
        if (!enabled) return;
        getCurrentWindow().setIgnoreCursorEvents(isEguiOnly).catch(() => { });
        invoke('leash_egui_only', { enabled: isEguiOnly }).catch(() => { });
    }, [enabled, isEguiOnly]);

    // =========================================================================
    // VIEWPORT SYNC - Efficient position/size sync with debouncing
    // =========================================================================
    // =========================================================================
    // WINDOW EVENT LISTENERS - React to window move/resize
    // =========================================================================
    useEffect(() => {
        if (!enabled) return;

        const win = getCurrentWindow();
        const unlisteners: Promise<UnlistenFn>[] = [];

        // Listen for window move events
        unlisteners.push(
            win.onMoved(async () => {
                // Debounce sync
                if (syncTimeoutRef.current) {
                    clearTimeout(syncTimeoutRef.current);
                }
                syncTimeoutRef.current = window.setTimeout(() => {
                    syncViewport();
                }, 16); // ~60fps
            })
        );

        // Listen for window resize events
        unlisteners.push(
            win.onResized(async () => {
                // Debounce sync
                if (syncTimeoutRef.current) {
                    clearTimeout(syncTimeoutRef.current);
                }
                syncTimeoutRef.current = window.setTimeout(() => {
                    syncViewport();
                }, 16);
            })
        );

        // Store unlisteners for cleanup
        Promise.all(unlisteners).then(fns => {
            unlistenersRef.current = fns;
        });

        return () => {
            unlistenersRef.current.forEach(fn => fn());
            unlistenersRef.current = [];
            if (syncTimeoutRef.current) {
                clearTimeout(syncTimeoutRef.current);
            }
        };
    }, [enabled, syncViewport]);

    // =========================================================================
    // CONTINUOUS SYNC LOOP - Smooth tracking during drag
    // =========================================================================
    useEffect(() => {
        if (!enabled) return;

        let animFrame: number;
        const sync = () => {
            syncViewport();
            animFrame = requestAnimationFrame(sync);
        };

        animFrame = requestAnimationFrame(sync);
        return () => cancelAnimationFrame(animFrame);
    }, [enabled, syncViewport]);

    // =========================================================================
    // DEBUG KEY HANDLERS (F1/F2) - Only when tether is enabled
    // =========================================================================
    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // F1: Toggle egui debug panel
            if (e.key === 'F1' && !e.repeat) {
                e.preventDefault();
                setIsDebugOpen(prev => {
                    const next = !prev;
                    invoke('leash_debug_ui', { enabled: next }).catch(() => { });
                    return next;
                });
            }

            // F2: Toggle egui-only mode (click-through)
            if (e.key === 'F2' && !e.repeat) {
                e.preventDefault();
                setIsEguiOnly(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [enabled]);

    return {
        isConnected,
        isEguiOnly,
        setIsEguiOnly,
        isDebugOpen,
        setIsDebugOpen,
        syncViewport,
    };
}

/**
 * Standalone component for Bevy window tethering
 * Use when you just need window sync without custom viewport handling
 */
export function BevyTether({ viewportRef, enabled, eguiOnly, debugPanel, onConnectionChange }: BevyTetherProps) {
    useBevyTether({ viewportRef, enabled, eguiOnly, debugPanel, onConnectionChange });
    return null; // Headless component - just handles sync
}

/**
 * Connection status badge component
 */
export function BevyConnectionBadge({ connected }: { connected: boolean }) {
    return (
        <div className={`px-3 py-1.5 rounded-full text-[9px] font-bold flex items-center gap-2 ${connected
            ? 'bg-green-500/10 text-green-400 border border-green-500/30'
            : 'bg-red-500/10 text-red-400 border border-red-500/30'
            }`}>
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            {connected ? 'BEVY ACTIVE' : 'BEVY OFFLINE'}
        </div>
    );
}

export default BevyTether;
