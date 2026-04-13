/**
 * Tracking Renderer Hook
 * 
 * Custom hook for rendering skeleton overlay on canvas at 60fps.
 * Uses requestAnimationFrame for smooth rendering and reads from
 * zero-copy ref to avoid React re-renders.
 */

import { useEffect, useRef, useCallback } from 'react';
import { JointFrame, SKELETON_BONES } from '@mocap/features/ZenMocap/types';
import {
  drawSkeleton,
  drawConfidenceLegend,
  drawFPS,
  DEFAULT_RENDER_CONFIG,
  type SkeletonRenderConfig,
} from '../utils/skeletonRenderer';

export interface UseTrackingRendererOptions {
  enabled?: boolean;
  showLegend?: boolean;
  showFPS?: boolean;
  config?: Partial<SkeletonRenderConfig>;
}

export interface UseTrackingRendererReturn {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  fps: number;
}

/**
 * Hook for rendering skeleton tracking overlay
 * 
 * @param latestFrameRef - Ref containing the latest joint frame (zero-copy)
 * @param options - Rendering options
 * @returns Canvas ref and current FPS
 */
export function useTrackingRenderer(
  latestFrameRef: React.RefObject<JointFrame | null>,
  options: UseTrackingRendererOptions = {}
): UseTrackingRendererReturn {
  const {
    enabled = true,
    showLegend = true,
    showFPS = true,
    config: userConfig = {},
  } = options;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const fpsRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(performance.now());
  const frameCountRef = useRef<number>(0);
  const fpsUpdateIntervalRef = useRef<number>(0);

  const renderConfig: SkeletonRenderConfig = {
    ...DEFAULT_RENDER_CONFIG,
    ...userConfig,
  };

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const frame = latestFrameRef.current;

    if (!canvas || !ctx || !enabled) {
      animationFrameRef.current = requestAnimationFrame(render);
      return;
    }

    // Calculate FPS
    const now = performance.now();
    const delta = now - lastFrameTimeRef.current;
    lastFrameTimeRef.current = now;
    frameCountRef.current++;
    fpsUpdateIntervalRef.current += delta;

    // Update FPS counter every 500ms
    if (fpsUpdateIntervalRef.current >= 500) {
      fpsRef.current = (frameCountRef.current / fpsUpdateIntervalRef.current) * 1000;
      frameCountRef.current = 0;
      fpsUpdateIntervalRef.current = 0;
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw skeleton if frame exists
    if (frame && frame.joints) {
      drawSkeleton(
        ctx,
        frame.joints,
        SKELETON_BONES,
        canvas.width,
        canvas.height,
        renderConfig
      );
    }

    // Draw overlays
    if (showLegend) {
      drawConfidenceLegend(ctx, 10, canvas.height - 70);
    }

    if (showFPS) {
      drawFPS(ctx, fpsRef.current, canvas.width - 10, 20);
    }

    // Continue animation loop
    animationFrameRef.current = requestAnimationFrame(render);
  }, [latestFrameRef, enabled, showLegend, showFPS, renderConfig]);

  // Start/stop animation loop
  useEffect(() => {
    if (enabled) {
      animationFrameRef.current = requestAnimationFrame(render);
    }

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [enabled, render]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        
        // Set canvas internal resolution to match display size
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        
        // Scale context to match device pixel ratio
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(dpr, dpr);
        }
      }
    });

    resizeObserver.observe(canvas);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return {
    canvasRef,
    fps: fpsRef.current,
  };
}
