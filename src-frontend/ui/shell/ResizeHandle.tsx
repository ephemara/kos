/**
 * ResizeHandle — Pointer-captured panel divider
 * ─────────────────────────────────────────────────────────────────────────────
 * V2 improvements:
 *  - `document.body.style.cursor` override during drag so the cursor stays
 *    correct while moving fast (no more cursor flicker to 'default' on mouse
 *    leaving the 1px hit zone at 60fps)
 *  - `user-select: none` applied to body during drag to prevent text selection
 *  - Wider 5px hit target, visually 1px (::before pseudo via inset)
 *    → easier to grab without visual bloat
 *  - Accent glow on active expressed via CSS box-shadow (no JS repaint)
 *  - Keyboard step kept at 10px per arrow press
 */

import React from 'react';
import { cn } from '@/ui/primitives/cn';

export type ResizeHandleProps = {
    direction: 'horizontal' | 'vertical';
    onResize: (delta: number) => void;
    onResizeStart?: () => void;
    onResizeEnd?: () => void;
    className?: string;
    'aria-label'?: string;
};

export function ResizeHandle({
    direction,
    onResize,
    onResizeStart,
    onResizeEnd,
    className,
    'aria-label': ariaLabel,
}: ResizeHandleProps) {
    const handleRef      = React.useRef<HTMLDivElement>(null);
    const isDraggingRef  = React.useRef(false);
    const startPosRef    = React.useRef({ x: 0, y: 0 });
    const lastDeltaRef   = React.useRef(0);
    const rafRef         = React.useRef<number | null>(null);
    const pendingDelta   = React.useRef<number | null>(null);

    const isHorizontal = direction === 'horizontal';

    // ── RAF-throttled resize dispatch ─────────────────────────────────────────
    const scheduleResize = React.useCallback((delta: number) => {
        pendingDelta.current = delta;
        if (rafRef.current != null) return;
        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            if (pendingDelta.current != null) {
                onResize(pendingDelta.current);
                pendingDelta.current = null;
            }
        });
    }, [onResize]);

    const handlePointerDown = React.useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            if (e.button !== 0) return;

            e.preventDefault();
            e.stopPropagation();

            const handle = handleRef.current;
            if (!handle) return;

            handle.setPointerCapture(e.pointerId);
            isDraggingRef.current  = true;
            startPosRef.current    = { x: e.clientX, y: e.clientY };
            lastDeltaRef.current   = 0;

            // Visual active state
            handle.dataset.resizing = 'true';

            // Override global cursor so it doesn't flicker when moving fast
            const cursor = isHorizontal ? 'col-resize' : 'row-resize';
            document.body.style.cursor      = cursor;
            document.body.style.userSelect  = 'none';
            document.body.style.pointerEvents = 'none'; // prevent hover on other elements

            onResizeStart?.();
        },
        [isHorizontal, onResizeStart]
    );

    const handlePointerMove = React.useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            if (!isDraggingRef.current) return;

            const delta = isHorizontal
                ? e.clientX - startPosRef.current.x
                : e.clientY - startPosRef.current.y;

            if (delta !== lastDeltaRef.current) {
                lastDeltaRef.current = delta;
                scheduleResize(delta);
            }
        },
        [isHorizontal, scheduleResize]
    );

    const cleanupDrag = React.useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            if (!isDraggingRef.current) return;

            const handle = handleRef.current;
            if (handle) {
                handle.releasePointerCapture(e.pointerId);
                delete handle.dataset.resizing;
            }

            // Restore global styles
            document.body.style.cursor       = '';
            document.body.style.userSelect   = '';
            document.body.style.pointerEvents = '';

            // Cancel pending RAF
            if (rafRef.current != null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            pendingDelta.current  = null;
            isDraggingRef.current = false;
            startPosRef.current   = { x: 0, y: 0 };
            lastDeltaRef.current  = 0;

            onResizeEnd?.();
        },
        [onResizeEnd]
    );

    return (
        <div
            ref={handleRef}
            role="separator"
            aria-label={ariaLabel ?? `Resize ${direction}`}
            aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
            tabIndex={0}
            className={cn(
                'relative flex-shrink-0 touch-none select-none group',
                // Wider hit target (5px) — visual line rendered via ::before
                isHorizontal ? 'w-[5px] cursor-col-resize' : 'h-[5px] cursor-row-resize',
                'bg-transparent',
                className
            )}
            style={{
                // Isolate resize handle from compositor for zero-cost visual updates
                contain: 'strict',
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={cleanupDrag}
            onPointerCancel={cleanupDrag}
            onKeyDown={(e) => {
                if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return;
                e.preventDefault();
                const step = e.shiftKey ? 40 : 10;
                let delta = 0;
                if (isHorizontal) {
                    delta = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
                } else {
                    delta = e.key === 'ArrowUp'   ? -step : e.key === 'ArrowDown'  ? step : 0;
                }
                if (delta !== 0) {
                    onResizeStart?.();
                    onResize(delta);
                    onResizeEnd?.();
                }
            }}
        >
            {/* Visual 1px line — centered inside the 5px hit target */}
            <div
                className={cn(
                    'absolute pointer-events-none transition-all duration-150',
                    isHorizontal
                        ? 'top-0 bottom-0 left-[2px] w-[1px]'
                        : 'left-0 right-0 top-[2px] h-[1px]',
                    // Default: almost invisible
                    'bg-white/[0.04]',
                    // Hover: subtle accent
                    'group-hover:bg-orange-500/40 group-hover:shadow-[0_0_4px_rgba(249,115,22,0.3)]',
                    // Data-resizing active
                    'group-data-[resizing]:bg-orange-500 group-data-[resizing]:shadow-[0_0_8px_rgba(249,115,22,0.6)]',
                )}
                style={{
                    transition: 'background-color 0.12s, box-shadow 0.12s',
                }}
            />
            {/* Focus ring */}
            <div
                className="absolute inset-0 rounded-sm focus-visible:ring-2 focus-visible:ring-orange-500/50 pointer-events-none opacity-0 focus-visible:opacity-100"
            />
        </div>
    );
}
