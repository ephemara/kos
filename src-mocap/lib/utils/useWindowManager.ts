/**
 * useWindowManager - Robust Window Management for K_OS
 * 
 * Handles coordination between:
 * - Tauri main window (React UI)
 * - Bevy viewport window (3D rendering)
 * - Window focus, dragging, resizing
 * 
 * Fixes glitchy window behavior by providing:
 * - Proper window event listeners
 * - Debounced sync to reduce IPC noise
 * - Focus coordination between windows
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { UnlistenFn } from '@tauri-apps/api/event';

export interface WindowBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface UseWindowManagerOptions {
    /** Ref to the viewport element for Bevy sync */
    viewportRef?: React.RefObject<HTMLElement>;
    /** Whether Bevy sync is enabled (Advanced mode) */
    bevyEnabled?: boolean;
    /** Sync interval in ms (default: 16ms = 60fps) */
    syncInterval?: number;
    /** Debounce delay for resize events */
    resizeDebounce?: number;
}

export interface WindowManagerState {
    bounds: WindowBounds | null;
    isMaximized: boolean;
    isMinimized: boolean;
    isFocused: boolean;
    isDragging: boolean;
}

export function useWindowManager({
    viewportRef,
    bevyEnabled = false,
    syncInterval = 16,
    resizeDebounce = 50,
}: UseWindowManagerOptions = {}) {
    const [state, setState] = useState<WindowManagerState>({
        bounds: null,
        isMaximized: false,
        isMinimized: false,
        isFocused: true,
        isDragging: false,
    });

    const lastSyncRef = useRef<WindowBounds | null>(null);
    const syncTimeoutRef = useRef<number | null>(null);
    const unlistenersRef = useRef<UnlistenFn[]>([]);

    // =========================================================================
    // WINDOW DRAGGING - Custom drag handler for frameless window
    // =========================================================================
    const startDrag = useCallback(async () => {
        setState(prev => ({ ...prev, isDragging: true }));
        try {
            await getCurrentWindow().startDragging();
        } catch (e) {
            console.error('Failed to start window drag:', e);
        } finally {
            setState(prev => ({ ...prev, isDragging: false }));
        }
    }, []);

    // =========================================================================
    // WINDOW CONTROLS
    // =========================================================================
    const minimize = useCallback(async () => {
        try {
            await getCurrentWindow().minimize();
            setState(prev => ({ ...prev, isMinimized: true }));
        } catch (e) {
            console.error('Failed to minimize:', e);
        }
    }, []);

    const toggleMaximize = useCallback(async () => {
        try {
            const win = getCurrentWindow();
            const isMax = await win.isMaximized();
            if (isMax) {
                await win.unmaximize();
            } else {
                await win.maximize();
            }
            setState(prev => ({ ...prev, isMaximized: !isMax }));
        } catch (e) {
            console.error('Failed to toggle maximize:', e);
        }
    }, []);

    const close = useCallback(async () => {
        try {
            // Hide Bevy first if enabled
            if (bevyEnabled) {
                await invoke('set_bevy_visible', { visible: false }).catch(() => { });
            }
            await getCurrentWindow().close();
        } catch (e) {
            console.error('Failed to close:', e);
        }
    }, [bevyEnabled]);

    const focus = useCallback(async () => {
        try {
            await getCurrentWindow().setFocus();
            setState(prev => ({ ...prev, isFocused: true }));
        } catch (e) {
            console.error('Failed to focus:', e);
        }
    }, []);

    // =========================================================================
    // BEVY VIEWPORT SYNC - Efficient position/size sync
    // =========================================================================
    const syncBevyViewport = useCallback(async () => {
        if (!bevyEnabled || !viewportRef?.current) return;

        try {
            const win = getCurrentWindow();
            const windowPos = await win.outerPosition();
            const rect = viewportRef.current.getBoundingClientRect();

            const bounds: WindowBounds = {
                x: Math.round(windowPos.x + rect.left),
                y: Math.round(windowPos.y + rect.top),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
            };

            // Only sync if changed
            const last = lastSyncRef.current;
            if (!last ||
                bounds.x !== last.x ||
                bounds.y !== last.y ||
                bounds.width !== last.width ||
                bounds.height !== last.height
            ) {
                await invoke('sync_bevy_window', bounds as any);
                lastSyncRef.current = bounds;
            }
        } catch (e) {
            // Silently fail - Bevy might not be ready
        }
    }, [bevyEnabled, viewportRef]);

    // =========================================================================
    // WINDOW EVENT LISTENERS
    // =========================================================================
    useEffect(() => {
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
                    syncBevyViewport();
                }, resizeDebounce);
            })
        );

        // Listen for window resize events
        unlisteners.push(
            win.onResized(async (event) => {
                setState(prev => ({
                    ...prev,
                    bounds: prev.bounds ? {
                        ...prev.bounds,
                        width: event.payload.width,
                        height: event.payload.height,
                    } : null,
                }));

                // Debounce sync
                if (syncTimeoutRef.current) {
                    clearTimeout(syncTimeoutRef.current);
                }
                syncTimeoutRef.current = window.setTimeout(() => {
                    syncBevyViewport();
                }, resizeDebounce);
            })
        );

        // Listen for focus events
        unlisteners.push(
            win.onFocusChanged(({ payload: focused }) => {
                setState(prev => ({ ...prev, isFocused: focused }));
            })
        );

        // Store unlisteners for cleanup
        Promise.all(unlisteners).then(fns => {
            unlistenersRef.current = fns;
        });

        // Initial state fetch
        (async () => {
            try {
                const [pos, size, isMax, isFocused] = await Promise.all([
                    win.outerPosition(),
                    win.outerSize(),
                    win.isMaximized(),
                    win.isFocused(),
                ]);
                setState(prev => ({
                    ...prev,
                    bounds: { x: pos.x, y: pos.y, width: size.width, height: size.height },
                    isMaximized: isMax,
                    isFocused,
                }));
            } catch (e) {
                console.error('Failed to get initial window state:', e);
            }
        })();

        return () => {
            unlistenersRef.current.forEach(fn => fn());
            unlistenersRef.current = [];
            if (syncTimeoutRef.current) {
                clearTimeout(syncTimeoutRef.current);
            }
        };
    }, [syncBevyViewport, resizeDebounce]);

    // =========================================================================
    // CONTINUOUS BEVY SYNC (for smooth tracking during drag)
    // =========================================================================
    useEffect(() => {
        if (!bevyEnabled) return;

        let animFrame: number;
        const sync = () => {
            syncBevyViewport();
            animFrame = requestAnimationFrame(sync);
        };

        // Start sync loop
        animFrame = requestAnimationFrame(sync);

        return () => {
            cancelAnimationFrame(animFrame);
        };
    }, [bevyEnabled, syncBevyViewport]);

    return {
        state,
        startDrag,
        minimize,
        toggleMaximize,
        close,
        focus,
        syncBevyViewport,
    };
}

export default useWindowManager;
