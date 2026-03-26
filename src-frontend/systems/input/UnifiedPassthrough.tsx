/**
 * UnifiedPassthrough - Single source of truth for input passthrough
 * 
 * MERGES:
 * - InteractiveZoneContext (zone-based registration)
 * - KruePassthrough (simpler lock-based)
 * 
 * KEY CHANGE: Uses CSS pointer-events by DEFAULT, only falls back to
 * setIgnoreCursorEvents for edge cases. This eliminates flicker.
 * 
 * ARCHITECTURE:
 * - CSS mode (default): Much faster, no polling, no flicker
 * - Poll mode: For edge cases where CSS fails
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface InteractiveZone {
    id: string;
    element: HTMLElement;
    priority: number;
}

interface UnifiedPassthroughContextValue {
    // Zone registration (legacy compat)
    register: (id: string, element: HTMLElement, priority?: number) => void;
    unregister: (id: string) => void;

    // State
    isPassthrough: boolean;
    isLocked: boolean;

    // Controls
    lock: () => void;
    unlock: () => void;
}

const UnifiedPassthroughContext = createContext<UnifiedPassthroughContextValue | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

interface UnifiedPassthroughProviderProps {
    children: React.ReactNode;
    /**
     * Mode: 
     * - 'css' (default): Uses CSS pointer-events only (no polling, no flicker)
     * - 'api': Uses Tauri setIgnoreCursorEvents API (poll-based, for edge cases)
     */
    mode?: 'css' | 'api';
}

export function UnifiedPassthroughProvider({
    children,
    mode = 'css'
}: UnifiedPassthroughProviderProps) {
    const zonesRef = useRef<Map<string, InteractiveZone>>(new Map());
    const [isLocked, setIsLocked] = useState(false);
    const [isPassthrough, setIsPassthrough] = useState(false);
    const lastApiState = useRef(false);

    // Zone registration for legacy compat
    const register = useCallback((id: string, element: HTMLElement, priority = 0) => {
        zonesRef.current.set(id, { id, element, priority });
    }, []);

    const unregister = useCallback((id: string) => {
        zonesRef.current.delete(id);
    }, []);

    // Lock/unlock for modals, drag operations
    const lock = useCallback(() => setIsLocked(true), []);
    const unlock = useCallback(() => setIsLocked(false), []);

    // API mode: Poll cursor position and toggle setIgnoreCursorEvents
    useEffect(() => {
        if (mode !== 'api') return;

        let pollInterval: number | null = null;
        let windowBounds = { x: 0, y: 0, width: 0, height: 0 };

        const updateWindowBounds = async () => {
            try {
                const { getCurrentWindow } = await import('@tauri-apps/api/window');
                const win = getCurrentWindow();
                const pos = await win.outerPosition();
                const size = await win.outerSize();
                windowBounds = { x: pos.x, y: pos.y, width: size.width, height: size.height };
            } catch { }
        };

        const isOverAnyZone = (screenX: number, screenY: number): boolean => {
            const clientX = screenX - windowBounds.x;
            const clientY = screenY - windowBounds.y;

            for (const zone of zonesRef.current.values()) {
                const rect = zone.element.getBoundingClientRect();
                if (clientX >= rect.left && clientX <= rect.right &&
                    clientY >= rect.top && clientY <= rect.bottom) {
                    const style = window.getComputedStyle(zone.element);
                    if (style.display !== 'none' && style.visibility !== 'hidden') {
                        return true;
                    }
                }
            }
            return false;
        };

        const pollCursor = async () => {
            if (isLocked) return;

            try {
                const { cursorPosition, getCurrentWindow } = await import('@tauri-apps/api/window');
                const pos = await cursorPosition();
                const overZone = isOverAnyZone(pos.x, pos.y);
                const shouldPassthrough = !overZone;

                // Only call API if state actually changed
                if (shouldPassthrough !== lastApiState.current) {
                    lastApiState.current = shouldPassthrough;
                    setIsPassthrough(shouldPassthrough);
                    await getCurrentWindow().setIgnoreCursorEvents(shouldPassthrough);
                }
            } catch { }
        };

        // Init
        updateWindowBounds();

        // Poll at 30fps (slightly reduced to prevent flicker)
        pollInterval = window.setInterval(pollCursor, 33);

        // Update bounds less frequently
        const boundsInterval = window.setInterval(updateWindowBounds, 500);

        return () => {
            if (pollInterval) clearInterval(pollInterval);
            clearInterval(boundsInterval);
            // Reset on cleanup
            import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
                getCurrentWindow().setIgnoreCursorEvents(false).catch(() => { });
            });
        };
    }, [mode, isLocked]);

    // CSS mode: No polling needed, CSS handles it
    // Components use pointer-events: auto on UI, none on viewport

    const value: UnifiedPassthroughContextValue = {
        register,
        unregister,
        isPassthrough,
        isLocked,
        lock,
        unlock,
    };

    return (
        <UnifiedPassthroughContext.Provider value={value}>
            {children}
        </UnifiedPassthroughContext.Provider>
    );
}

// ============================================================================
// HOOKS (Unified API - works with both old and new code)
// ============================================================================

/**
 * Get passthrough context
 */
export function useUnifiedPassthrough() {
    const ctx = useContext(UnifiedPassthroughContext);
    if (!ctx) {
        // Graceful degradation
        return {
            register: () => { },
            unregister: () => { },
            isPassthrough: false,
            isLocked: false,
            lock: () => { },
            unlock: () => { },
        };
    }
    return ctx;
}

/**
 * Register an interactive zone (legacy compat)
 */
export function useInteractiveZone(
    id: string,
    options: { priority?: number; enabled?: boolean } = {}
) {
    const { priority = 0, enabled = true } = options;
    const ref = useRef<HTMLDivElement>(null);
    const ctx = useContext(UnifiedPassthroughContext);

    useEffect(() => {
        if (!ctx || !enabled || !ref.current) return;
        ctx.register(id, ref.current, priority);
        return () => ctx.unregister(id);
    }, [ctx, id, priority, enabled]);

    return ref;
}

/**
 * Lock passthrough during drag operations, modals, etc.
 */
export function usePassthroughLock() {
    const ctx = useUnifiedPassthrough();
    const lockedRef = useRef(false);

    const acquire = useCallback(() => {
        if (!lockedRef.current) {
            ctx.lock();
            lockedRef.current = true;
        }
    }, [ctx]);

    const release = useCallback(() => {
        if (lockedRef.current) {
            ctx.unlock();
            lockedRef.current = false;
        }
    }, [ctx]);

    useEffect(() => {
        return () => {
            if (lockedRef.current) {
                ctx.unlock();
            }
        };
    }, [ctx]);

    return { acquire, release };
}

/**
 * Wrapper that locks passthrough while mounted
 */
export function PassthroughBlocker({ children }: { children: React.ReactNode }) {
    const { acquire, release } = usePassthroughLock();

    useEffect(() => {
        acquire();
        return release;
    }, [acquire, release]);

    return <>{children}</>;
}

// ============================================================================
// LEGACY COMPAT ALIASES
// ============================================================================

// For code that imports from InteractiveZoneContext
export const InteractiveZoneProvider = UnifiedPassthroughProvider;
export const useInteractiveZoneContext = useUnifiedPassthrough;

// For code that imports from krue/passthrough
export const KruePassthroughProvider = UnifiedPassthroughProvider;
export const useKruePassthrough = useUnifiedPassthrough;
