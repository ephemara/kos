/**
 * 2D BRUSH ENGINE
 * 
 * Handles 2D canvas painting and image editing operations.
 * Uses perfect-freehand for smooth, pressure-sensitive strokes.
 * 
 * Features:
 * - Smooth stroke interpolation
 * - Pressure sensitivity
 * - Alpha texture support
 * - Symmetry (X, Y, radial)
 * - Jitter and dynamics
 * - Multiple blend modes
 * 
 * @module Brush2DEngine
 */

import { getStroke, StrokeOptions } from 'perfect-freehand';
import * as THREE from 'three';
import {
  type BaseBrushParams,
  type Paint2DBrushParams,
  type BrushStrokePoint,
  type BrushStroke,
  type BrushResult,
  type IBrushEngine,
  DEFAULT_BRUSH_PARAMS,
} from '@mocap/shared/systems/brush/BrushTypes';

// ============================================================================
// SPLAT POINT (for rendering)
// ============================================================================

/**
 * A single brush splat/dab for rendering
 */
export interface SplatPoint {
  x: number;
  y: number;
  size: number;
  angle: number;
  pressure: number;
  color?: string;
}

// ============================================================================
// SEEDED RANDOM (for reproducible jitter)
// ============================================================================

class SeededRandom {
  private seed: number;

  constructor(seed: number = Date.now()) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

// ============================================================================
// 2D BRUSH ENGINE
// ============================================================================

/**
 * 2D brush engine for canvas painting
 */
export class Brush2DEngine implements IBrushEngine {
  private params: Paint2DBrushParams;
  private currentStroke: BrushStroke | null = null;
  private points: BrushStrokePoint[] = [];
  private rng: SeededRandom = new SeededRandom();
  private lastSplatDistance: number = 0;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private isInitialized = false;

  constructor() {
    this.params = {
      ...DEFAULT_BRUSH_PARAMS,
      color: '#000000',
      mode: 'paint',
      simulatePressure: false,
      smoothing: 0.5,
      streamline: 0.5,
      thinning: 0.5,
    };
  }

  /**
   * Initialize the brush engine with a canvas
   */
  async init(canvas?: HTMLCanvasElement): Promise<void> {
    if (canvas) {
      this.setCanvas(canvas);
    }
    this.isInitialized = true;
  }

  /**
   * Set the target canvas for painting
   */
  setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    if (!this.ctx) {
      throw new Error('Failed to get 2D context from canvas');
    }
  }

  /**
   * Start a new brush stroke
   */
  startStroke(params: Paint2DBrushParams, point: BrushStrokePoint): void {
    this.params = { ...this.params, ...params };
    this.points = [point];
    this.lastSplatDistance = 0;
    this.rng = new SeededRandom(Date.now());
    
    this.currentStroke = {
      id: `stroke_${Date.now()}_${Math.random()}`,
      params: this.params,
      points: [point],
      startTime: Date.now(),
      isComplete: false,
    };
  }

  /**
   * Continue brush stroke with new point
   */
  continueStroke(point: BrushStrokePoint): void {
    if (!this.currentStroke) {
      console.warn('[Brush2DEngine] No active stroke to continue');
      return;
    }

    this.points.push(point);
    this.currentStroke.points.push(point);
  }

  /**
   * End current brush stroke
   */
  endStroke(): void {
    if (!this.currentStroke) {
      return;
    }

    this.currentStroke.isComplete = true;
    this.currentStroke.endTime = Date.now();
    
    // Keep only last point for continuity
    if (this.points.length > 1) {
      this.points = [this.points[this.points.length - 1]];
    }
    
    this.currentStroke = null;
  }

  /**
   * Apply a complete stroke to the canvas
   */
  async applyStroke(stroke: BrushStroke): Promise<void> {
    if (!this.ctx || !this.canvas) {
      throw new Error('Brush engine not initialized with canvas');
    }

    const params = stroke.params as Paint2DBrushParams;
    const splats = this.generateSplats(stroke.points, params);

    // Apply each splat to the canvas
    for (const splat of splats) {
      this.applySplat(splat, params);
    }
  }

  /**
   * Generate splat points for rendering
   */
  generateSplats(points: BrushStrokePoint[], params: Paint2DBrushParams): SplatPoint[] {
    if (points.length < 2) return [];

    const splats: SplatPoint[] = [];
    const spacing = Math.max(0.001, params.spacing) * params.size;

    // Interpolate between points and generate splats at regular intervals
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];

      const pos0 = p0.position as THREE.Vector2;
      const pos1 = p1.position as THREE.Vector2;

      const dx = pos1.x - pos0.x;
      const dy = pos1.y - pos0.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 0.0001) continue;

      const steps = Math.max(1, Math.ceil(dist / spacing));

      for (let j = 0; j < steps; j++) {
        const t = j / steps;
        const x = pos0.x + dx * t;
        const y = pos0.y + dy * t;
        const pressure = p0.pressure + (p1.pressure - p0.pressure) * t;

        // Apply jitter
        const jitterX = params.scatterAmount > 0 
          ? this.rng.range(-params.scatterAmount, params.scatterAmount) * params.size * 0.01 
          : 0;
        const jitterY = params.scatterAmount > 0 
          ? this.rng.range(-params.scatterAmount, params.scatterAmount) * params.size * 0.01 
          : 0;
        const jitterSz = params.sizeJitter > 0 
          ? this.rng.range(1 - params.sizeJitter, 1 + params.sizeJitter) 
          : 1;
        const jitterAng = params.rotationJitter > 0 
          ? this.rng.range(-params.rotationJitter, params.rotationJitter) * Math.PI 
          : 0;

        const baseSplat: SplatPoint = {
          x: x + jitterX,
          y: y + jitterY,
          size: params.size * jitterSz * pressure,
          angle: Math.atan2(dy, dx) + jitterAng,
          pressure,
          color: params.color,
        };

        // Add base splat
        splats.push(baseSplat);

        // Add symmetry splats
        if (this.canvas) {
          const w = this.canvas.width;
          const h = this.canvas.height;

          if (params.symmetry === 'X' || params.symmetry === 'RADIAL') {
            splats.push({ 
              ...baseSplat, 
              x: w - baseSplat.x, 
              angle: Math.PI - baseSplat.angle 
            });
          }
          if (params.symmetry === 'Y' || params.symmetry === 'RADIAL') {
            splats.push({ 
              ...baseSplat, 
              y: h - baseSplat.y, 
              angle: -baseSplat.angle 
            });
          }
          if (params.symmetry === 'RADIAL') {
            splats.push({ 
              ...baseSplat, 
              x: w - baseSplat.x, 
              y: h - baseSplat.y, 
              angle: baseSplat.angle + Math.PI 
            });
          }
        }
      }
    }

    return splats;
  }

  /**
   * Apply a single splat to the canvas
   */
  private applySplat(splat: SplatPoint, params: Paint2DBrushParams): void {
    if (!this.ctx) return;

    const ctx = this.ctx;

    // Set blend mode
    ctx.globalCompositeOperation = this.mapBlendMode(params.blendMode);
    ctx.globalAlpha = params.opacity * params.flow;

    // Draw splat
    if (params.alpha) {
      // TODO: Draw with alpha texture
      // For now, draw a simple circle
      this.drawCircleSplat(ctx, splat, params);
    } else {
      this.drawCircleSplat(ctx, splat, params);
    }
  }

  /**
   * Draw a simple circle splat
   */
  private drawCircleSplat(
    ctx: CanvasRenderingContext2D, 
    splat: SplatPoint, 
    params: Paint2DBrushParams
  ): void {
    const gradient = ctx.createRadialGradient(
      splat.x, splat.y, 0,
      splat.x, splat.y, splat.size / 2
    );

    // Apply hardness
    const hardness = params.hardness;
    gradient.addColorStop(0, splat.color || params.color);
    gradient.addColorStop(hardness, splat.color || params.color);
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(splat.x, splat.y, splat.size / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Get smooth stroke outline using perfect-freehand
   */
  getStrokeOutline(options?: Partial<StrokeOptions>): number[][] {
    if (this.points.length < 2) return [];

    const inputPoints = this.points.map(p => {
      const pos = p.position as THREE.Vector2;
      return [pos.x, pos.y, p.pressure];
    });

    return getStroke(inputPoints, {
      size: this.params.size,
      thinning: this.params.thinning,
      smoothing: this.params.smoothing,
      streamline: this.params.streamline,
      simulatePressure: this.params.simulatePressure,
      ...options,
    });
  }

  /**
   * Convert stroke outline to SVG path data
   */
  static outlineToPath(outline: number[][]): string {
    if (outline.length < 2) return '';

    const d = outline.reduce(
      (acc, [x0, y0], i, arr) => {
        const [x1, y1] = arr[(i + 1) % arr.length];
        return `${acc} ${x0},${y0} ${(x0 + x1) / 2},${(y0 + y1) / 2}`;
      },
      `M ${outline[0][0]},${outline[0][1]} Q`
    );

    return `${d} Z`;
  }

  /**
   * Get current brush parameters
   */
  getParams(): Paint2DBrushParams {
    return { ...this.params };
  }

  /**
   * Update brush parameters
   */
  setParams(params: Partial<Paint2DBrushParams>): void {
    this.params = { ...this.params, ...params };
  }

  /**
   * Clear the canvas
   */
  clear(): void {
    if (!this.ctx || !this.canvas) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.canvas = null;
    this.ctx = null;
    this.points = [];
    this.currentStroke = null;
    this.isInitialized = false;
  }

  /**
   * Check if engine is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.ctx !== null;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Map blend mode to canvas composite operation
   */
  private mapBlendMode(mode: string): GlobalCompositeOperation {
    const modeMap: Record<string, GlobalCompositeOperation> = {
      normal: 'source-over',
      multiply: 'multiply',
      add: 'lighter',
      overlay: 'overlay',
      screen: 'screen',
      erase: 'destination-out',
    };

    return modeMap[mode] || 'source-over';
  }
}

// ============================================================================
// STROKE UTILITIES
// ============================================================================

/**
 * Simplify stroke points using Ramer-Douglas-Peucker algorithm
 */
export function simplifyStroke(
  points: BrushStrokePoint[],
  tolerance: number = 1.0
): BrushStrokePoint[] {
  if (points.length < 3) return points;

  // Convert to 2D points for simplification
  const points2D = points.map(p => {
    const pos = p.position as THREE.Vector2;
    return { x: pos.x, y: pos.y };
  });

  const simplified = rdpSimplify(points2D, tolerance);

  // Map back to stroke points
  return simplified.map(p => {
    const original = points.find(pt => {
      const pos = pt.position as THREE.Vector2;
      return Math.abs(pos.x - p.x) < 0.01 && Math.abs(pos.y - p.y) < 0.01;
    });
    return original || points[0];
  });
}

/**
 * Ramer-Douglas-Peucker simplification algorithm
 */
function rdpSimplify(
  points: Array<{ x: number; y: number }>,
  tolerance: number
): Array<{ x: number; y: number }> {
  if (points.length < 3) return points;

  const first = points[0];
  const last = points[points.length - 1];

  let maxDistance = 0;
  let maxIndex = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  if (maxDistance > tolerance) {
    const left = rdpSimplify(points.slice(0, maxIndex + 1), tolerance);
    const right = rdpSimplify(points.slice(maxIndex), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}

/**
 * Calculate perpendicular distance from point to line
 */
function perpendicularDistance(
  point: { x: number; y: number },
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number }
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const mag = Math.sqrt(dx * dx + dy * dy);

  if (mag === 0) {
    return Math.sqrt(
      (point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2
    );
  }

  const u =
    ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) /
    (mag * mag);

  const ix = lineStart.x + u * dx;
  const iy = lineStart.y + u * dy;

  return Math.sqrt((point.x - ix) ** 2 + (point.y - iy) ** 2);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default Brush2DEngine;
