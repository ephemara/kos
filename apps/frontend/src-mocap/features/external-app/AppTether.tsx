/**
 * AppTether - Universal External Application Window Sync Component
 * 
 * The SECRET SAUCE! This component allows you to bootstrap ANY external
 * application (Bevy, Unity, Godot, Unreal, custom engines, etc.) to this
 * React frontend in a whim.
 * 
 * Originally designed for Bevy integration, but generalized to work with
 * any external application that can be controlled via Tauri commands.
 * 
 * Features:
 * - Window positioning sync (external app follows React viewport)
 * - Visibility management (show/hide external app)
 * - Click-through mode (for UI-only overlays)
 * - Debug panel support
 * - Connection status monitoring
 * 
 * Usage:
 *   <AppTether viewportRef={myRef} enabled={true} />
 *   
 * Requirements:
 * - Tauri commands: set_bevy_visible, sync_bevy_window, leash_egui_only, leash_debug_ui
 * - External app must support window positioning via IPC
 * 
 * @example
 * ```tsx
 * const viewportRef = useRef<HTMLDivElement>(null);
 * 
 * return (
 *   <div ref={viewportRef} className="viewport">
 *     <AppTether viewportRef={viewportRef} enabled={advancedMode} />
 *     {/* Your React UI here *\/}
 *   </div>
 * );
 * ```
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { UnlistenFn } from '@tauri-apps/api/event';

export interface AppTetherProps {
    /** Ref to the viewport div that the external app should position behind */
    viewportRef: React.RefObject<HTMLDivElement>;
    
    /** Whether the tether is enabled (only activate when needed) */
    enabled?: boolean;
    
    /** Enable UI-only mode (click-through for external app input) */
    uiOnly?: boolean;
    
    /** Enable debug panel in external app */
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
 * Hook that manages external app window sync lifecycle
 * 
 * This is the core logic that makes the magic happen!
 */
export function useAppTether({
    viewportRef,
    enabled = false,
    uiOnly = false,  // Default to false - React handles UI
    debugPanel = false,
    onConnectionChange
}: AppTetherProps) {
    const [isConnected, setIsConnected] = useState(false);
    const [isUiOnly, setIsUiOnly] = useState(uiOnly);
    const [isDebugOpen, setIsDebugOpen] = useState(debugPanel);
    
    const lastSyncRef = useRef<WindowBounds | null>(null);
    const unlistenersRef = useRef<UnlistenFn[]>([]);
    const syncTimeoutRef = useRef<number | null>(null);

    // =========================================================================
    // EXTERNAL APP VISIBILITY - Show on mount, hide on unmount
    // =========================================================================
    useEffect(() => {
        if (!enabled) {
            console.log('[AppTether] Not enabled, skipping visibility');
            return;
        }

        console.log('[AppTether] Enabled! Showing external app window...');
        
        // Show external app window when tether activates
        invoke('set_bevy_visible', { visible: true })
            .then(() => console.log('[AppTether] External app window shown'))
            .catch((e) => console.error('[AppTether] Failed to show external app:', e));
        
        // Enable debug panel on mount
        invoke('leash_debug_ui', { enabled: debugPanel }).catch(() => { });

        return () => {
            console.log('[AppTether] Cleanup - hiding external app window');
            
            // Cleanup: ensure overlay isn't stuck in click-through mode
            getCurrentWindow().setIgnoreCursorEvents(false).catch(() => { });
            
            // Hide external app window when tether deactivates
            invoke('set_bevy_visible', { visible: false }).catch(() => { });
        };
    }, [enabled, debugPanel]);

    // =========================================================================
    // UI-ONLY MODE (Click-through overlay so external app receives input)
    // =========================================================================
    useEffect(() => {
        if (!enabled) return;
        
        getCurrentWindow().setIgnoreCursorEvents(isUiOnly).catch(() => { });
        invoke('leash_egui_only', { enabled: isUiOnly }).catch(() => { });
    }, [enabled, isUiOnly]);

    // =========================================================================
    // VIEWPORT SYNC - Efficient position/size sync with debouncing
    // =========================================================================
    const syncViewport = useCallback(async () => {
        if (!enabled || !viewportRef?.current) return;

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

            // Only sync if changed (reduce IPC noise)
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
                
                if (!isConnected) {
                    setIsConnected(true);
                    onConnectionChange?.(true);
                }
            }
        } catch (e) {
            if (isConnected) {
                setIsConnected(false);
                onConnectionChange?.(false);
            }
        }
    }, [enabled, viewportRef, isConnected, onConnectionChange]);

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
            // F1: Toggle debug panel
            if (e.key === 'F1' && !e.repeat) {
                e.preventDefault();
                setIsDebugOpen(prev => {
                    const next = !prev;
                    invoke('leash_debug_ui', { enabled: next }).catch(() => { });
                    return next;
                });
            }

            // F2: Toggle UI-only mode (click-through)
            if (e.key === 'F2' && !e.repeat) {
                e.preventDefault();
                setIsUiOnly(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [enabled]);

    return {
        isConnected,
        isUiOnly,
        setIsUiOnly,
        isDebugOpen,
        setIsDebugOpen,
        syncViewport,
    };
}

/**
 * Standalone component for external app window tethering
 * Use when you just need window sync without custom viewport handling
 */
export function AppTether({ viewportRef, uiOnly, debugPanel, onConnectionChange, enabled }: AppTetherProps) {
    useAppTether({ viewportRef, uiOnly, debugPanel, onConnectionChange, enabled });
    return null; // Headless component - just handles sync
}

/**
 * Connection status badge component
 */
export function AppConnectionBadge({ connected, appName = 'EXTERNAL APP' }: { connected: boolean; appName?: string }) {
    return (
        <div className={`px-3 py-1.5 rounded-full text-[9px] font-bold flex items-center gap-2 ${connected
            ? 'bg-green-500/10 text-green-400 border border-green-500/30'
            : 'bg-red-500/10 text-red-400 border border-red-500/30'
            }`}>
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            {connected ? `${appName} ACTIVE` : `${appName} OFFLINE`}
        </div>
    );
}

export default AppTether;
