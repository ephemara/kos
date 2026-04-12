import { useState, useRef, useCallback, useEffect } from 'react';

export type ResizablePanelOptions = {
    /**
     * Unique key for localStorage persistence (e.g., 'ksculpt-left-panel')
     */
    storageKey: string;
    
    /**
     * Initial size in pixels
     */
    initialSize: number;
    
    /**
     * Minimum size in pixels
     */
    minSize?: number;
    
    /**
     * Maximum size in pixels
     */
    maxSize?: number;
    
    /**
     * Debounce delay in milliseconds (default: 16ms for 60fps)
     */
    debounceMs?: number;
    
    /**
     * Callback when resize completes (after debounce)
     */
    onResizeComplete?: (size: number) => void;
};

export type ResizablePanelState = {
    /**
     * Current panel size in pixels
     */
    size: number;
    
    /**
     * Whether the panel is currently being resized
     */
    isResizing: boolean;
    
    /**
     * Start resizing (call from ResizeHandle onResizeStart)
     */
    startResize: () => void;
    
    /**
     * Apply resize delta (call from ResizeHandle onResize)
     */
    resize: (delta: number) => void;
    
    /**
     * End resizing (call from ResizeHandle onResizeEnd)
     */
    endResize: () => void;
    
    /**
     * Reset to initial size
     */
    reset: () => void;
    
    /**
     * Set size directly (bypasses animation)
     */
    setSize: (size: number) => void;
};

/**
 * Custom hook for managing resizable panel state with:
 * - requestAnimationFrame for 60fps resize updates
 * - Debouncing (16ms default) to prevent excessive re-renders
 * - localStorage persistence per app
 * 
 * This hook is designed to work with the ResizeHandle component
 * to provide smooth, flicker-free panel resizing.
 * 
 * @example
 * ```tsx
 * const leftPanel = useResizablePanel({
 *   storageKey: 'ksculpt-left-panel',
 *   initialSize: 300,
 *   minSize: 200,
 *   maxSize: 600,
 * });
 * 
 * return (
 *   <div style={{ width: leftPanel.size }}>
 *     <ResizeHandle
 *       direction="horizontal"
 *       onResizeStart={leftPanel.startResize}
 *       onResize={leftPanel.resize}
 *       onResizeEnd={leftPanel.endResize}
 *     />
 *   </div>
 * );
 * ```
 */
export function useResizablePanel(options: ResizablePanelOptions): ResizablePanelState {
    const {
        storageKey,
        initialSize,
        minSize = 0,
        maxSize = Infinity,
        debounceMs = 16, // 60fps = 16.67ms per frame
        onResizeComplete,
    } = options;

    // Load initial size from localStorage if available
    const getInitialSize = useCallback(() => {
        try {
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                const parsed = parseFloat(stored);
                if (!isNaN(parsed) && parsed >= minSize && parsed <= maxSize) {
                    return parsed;
                }
            }
        } catch (error) {
            console.warn(`Failed to load panel size from localStorage (${storageKey}):`, error);
        }
        return initialSize;
    }, [storageKey, initialSize, minSize, maxSize]);

    const [size, setSize] = useState(getInitialSize);
    const [isResizing, setIsResizing] = useState(false);

    // Refs for managing animation and debouncing
    const rafRef = useRef<number | null>(null);
    const debounceTimerRef = useRef<number | null>(null);
    const startSizeRef = useRef<number>(size);
    const pendingSizeRef = useRef<number>(size);

    // Save to localStorage with debouncing
    const saveToStorage = useCallback(
        (newSize: number) => {
            // Clear existing debounce timer
            if (debounceTimerRef.current !== null) {
                window.clearTimeout(debounceTimerRef.current);
            }

            // Set new debounce timer
            debounceTimerRef.current = window.setTimeout(() => {
                try {
                    localStorage.setItem(storageKey, newSize.toString());
                    onResizeComplete?.(newSize);
                } catch (error) {
                    console.warn(`Failed to save panel size to localStorage (${storageKey}):`, error);
                }
                debounceTimerRef.current = null;
            }, debounceMs);
        },
        [storageKey, debounceMs, onResizeComplete]
    );

    // Start resize operation
    const startResize = useCallback(() => {
        setIsResizing(true);
        startSizeRef.current = size;
        pendingSizeRef.current = size;
    }, [size]);

    // Apply resize delta using requestAnimationFrame
    const resize = useCallback(
        (delta: number) => {
            // Calculate new size with constraints
            const newSize = Math.max(minSize, Math.min(maxSize, startSizeRef.current + delta));
            pendingSizeRef.current = newSize;

            // Cancel any pending animation frame
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
            }

            // Schedule update for next frame (60fps)
            rafRef.current = requestAnimationFrame(() => {
                setSize(pendingSizeRef.current);
                rafRef.current = null;
            });
        },
        [minSize, maxSize]
    );

    // End resize operation
    const endResize = useCallback(() => {
        setIsResizing(false);

        // Ensure final size is applied
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }

        const finalSize = pendingSizeRef.current;
        setSize(finalSize);
        saveToStorage(finalSize);
    }, [saveToStorage]);

    // Reset to initial size
    const reset = useCallback(() => {
        const resetSize = initialSize;
        setSize(resetSize);
        saveToStorage(resetSize);
    }, [initialSize, saveToStorage]);

    // Set size directly (bypasses animation)
    const setSizeDirectly = useCallback(
        (newSize: number) => {
            const constrainedSize = Math.max(minSize, Math.min(maxSize, newSize));
            setSize(constrainedSize);
            saveToStorage(constrainedSize);
        },
        [minSize, maxSize, saveToStorage]
    );

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
            }
            if (debounceTimerRef.current !== null) {
                window.clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    return {
        size,
        isResizing,
        startResize,
        resize,
        endResize,
        reset,
        setSize: setSizeDirectly,
    };
}
