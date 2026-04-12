
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useGesture } from '@use-gesture/react';
import {
    GraphosSelectionMode,
    GraphosSelectionPreview,
    GraphosTool,
} from './tools';

export const useGraphosInput = (
    canvasRef: React.RefObject<HTMLCanvasElement>,
    viewportRef: React.RefObject<HTMLDivElement>,
    engineRef: React.MutableRefObject<any>,
    targetZoomRef: React.MutableRefObject<number>,
    targetPanRef: React.MutableRefObject<THREE.Vector2>,
    zoomWorldPointRef: React.MutableRefObject<THREE.Vector2 | null>,
    zoomScreenPointRef: React.MutableRefObject<THREE.Vector2 | null>,
    onSpaceChange: (isHeld: boolean) => void,
    brush: any,
    activeLayerId: string | null,
    activeTool: GraphosTool,
    selectionMode: GraphosSelectionMode,
    wandTolerance: number,
    onSelectionPreview: (preview: GraphosSelectionPreview) => void,
    onSelectionCommitted: (bounds: { u0: number; v0: number; u1: number; v1: number } | null) => void
) => {
    const isSpaceHeld = useRef(false);
    const dragStartUV = useRef<{ u: number; v: number } | null>(null);
    const lassoPoints = useRef<Array<{ u: number; v: number }>>([]);

    // Space = pan mode, Alt = reserved
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (document.activeElement?.matches('input, textarea')) return;
            if (e.code === 'Space' && !e.repeat) {
                e.preventDefault();
                isSpaceHeld.current = true;
                onSpaceChange(true);
                if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                isSpaceHeld.current = false;
                onSpaceChange(false);
                if (canvasRef.current) canvasRef.current.style.cursor = 'crosshair';
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [onSpaceChange]);

    // ---- Gesture handling ----
    useGesture(
        {
            onPointerDown: ({ event, buttons }) => {
                if (buttons !== 1) return;
                if (activeTool !== 'wand') return;
                const r = engineRef.current;
                const canvas = canvasRef.current;
                if (!r || !canvas || !activeLayerId) return;
                if (!(event instanceof PointerEvent)) return;

                const rect = canvas.getBoundingClientRect();
                const u = (event.clientX - rect.left) / rect.width;
                const v = 1.0 - (event.clientY - rect.top) / rect.height;
                if (u < 0 || u > 1 || v < 0 || v > 1) return;

                r.selectMagicWand?.(activeLayerId, u, v, wandTolerance, selectionMode);
                onSelectionCommitted(r.getSelectionBounds?.() ?? null);
            },
            onDrag: ({ delta: [dx, dy], event, buttons, first, last, pinching, cancel }) => {
                if (pinching) return cancel();
                const r = engineRef.current;
                if (!r) return;

                const isPanAction = isSpaceHeld.current || buttons === 4 || activeTool === 'move';
                const isPaintAction = (activeTool === 'brush' || activeTool === 'eraser') && buttons === 1 && !isSpaceHeld.current;

                // PAN
                if (isPanAction) {
                    if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
                    r.pan.x += dx;
                    r.pan.y += dy;
                    targetPanRef.current.x = r.pan.x;
                    targetPanRef.current.y = r.pan.y;
                    r.setTransform(r.zoom, r.pan);
                    return;
                }

                // PAINT — delegate to engine's continueStroke which handles symmetry & erase
                if (isPaintAction && event instanceof PointerEvent) {
                    const canvas = canvasRef.current;
                    if (!canvas) return;

                    if (first) r.startStroke?.();

                    const rect = canvas.getBoundingClientRect();
                    const u = (event.clientX - rect.left) / rect.width;
                    const v = 1.0 - (event.clientY - rect.top) / rect.height;
                    const pressure = event.pressure > 0 ? event.pressure : 0.5;

                    // Slight overdraw tolerance for edge brushing
                    if (u >= -0.2 && u <= 1.2 && v >= -0.2 && v <= 1.2) {
                        const toolBrush = activeTool === 'eraser'
                            ? { ...brush, erase: true }
                            : { ...brush, erase: false };
                        r.continueStroke?.(new THREE.Vector2(u, v), pressure, toolBrush, activeLayerId);
                        r.needsUpdate = true;
                    }

                    if (last) r.endStroke?.(activeLayerId);
                }

                if ((activeTool === 'marquee' || activeTool === 'lasso') && event instanceof PointerEvent) {
                    const canvas = canvasRef.current;
                    if (!canvas || !activeLayerId) return;

                    const rect = canvas.getBoundingClientRect();
                    const u = (event.clientX - rect.left) / rect.width;
                    const v = 1.0 - (event.clientY - rect.top) / rect.height;
                    if (u < -0.2 || u > 1.2 || v < -0.2 || v > 1.2) return;

                    if (activeTool === 'marquee') {
                        if (first || !dragStartUV.current) dragStartUV.current = { u, v };
                        const start = dragStartUV.current;
                        onSelectionPreview({ rect: { u0: start.u, v0: start.v, u1: u, v1: v }, lasso: null });
                        if (last) {
                            r.selectMarquee?.(activeLayerId, start.u, start.v, u, v, selectionMode);
                            dragStartUV.current = null;
                            onSelectionPreview({ rect: null, lasso: null });
                            onSelectionCommitted(r.getSelectionBounds?.() ?? null);
                        }
                        return;
                    }

                    if (first) lassoPoints.current = [{ u, v }];
                    const lastPt = lassoPoints.current[lassoPoints.current.length - 1];
                    const du = u - lastPt.u;
                    const dv = v - lastPt.v;
                    if ((du * du + dv * dv) > 0.00004) {
                        lassoPoints.current.push({ u, v });
                        onSelectionPreview({ rect: null, lasso: [...lassoPoints.current] });
                    }
                    if (last) {
                        if (lassoPoints.current.length >= 3) {
                            r.selectLasso?.(activeLayerId, lassoPoints.current, selectionMode);
                            onSelectionCommitted(r.getSelectionBounds?.() ?? null);
                        }
                        lassoPoints.current = [];
                        onSelectionPreview({ rect: null, lasso: null });
                    }
                }
            },

            onWheel: ({ delta: [, dy], event }) => {
                event.preventDefault();
                const r = engineRef.current;
                if (!r) return;

                const viewport = viewportRef.current;
                if (!viewport) return;
                const rect = viewport.getBoundingClientRect();
                const offsetX = (event as WheelEvent).clientX - (rect.left + rect.width / 2);
                const offsetY = (event as WheelEvent).clientY - (rect.top + rect.height / 2);

                const currentWorldX = (offsetX - r.pan.x) / r.zoom;
                const currentWorldY = (offsetY - r.pan.y) / r.zoom;

                const zoomSpeed = 0.0015;
                let scaleFactor = 1.0 - dy * zoomSpeed;
                scaleFactor = Math.max(0.5, Math.min(1.5, scaleFactor));

                const newZoom = Math.max(0.01, Math.min(50.0, targetZoomRef.current * scaleFactor));
                targetZoomRef.current = newZoom;
                targetPanRef.current.x = offsetX - currentWorldX * newZoom;
                targetPanRef.current.y = offsetY - currentWorldY * newZoom;
            },

            onPinch: () => { /* handled via wheel */ },
        },
        {
            target: viewportRef,
            eventOptions: { passive: false },
            drag: { filterTaps: true },
            pinch: { scaleBounds: { min: 0.1, max: 10 } },
        }
    );

    return {};
};
