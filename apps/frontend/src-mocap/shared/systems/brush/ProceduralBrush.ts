/**
 * PROCEDURAL BRUSH SYSTEM
 * 
 * Noise-based and algorithmic brush generation.
 * Creates dynamic, non-repeating brush patterns using procedural algorithms.
 * 
 * Features:
 * - Perlin noise brushes
 * - Voronoi/cellular patterns
 * - Fractional Brownian Motion (fBm)
 * - Turbulence and distortion
 * - Geometric patterns
 * - Physics-based simulations
 * 
 * @module ProceduralBrush
 */

import * as THREE from 'three';
import type { BaseBrushParams } from './BrushTypes';

// ============================================================================
// NOISE FUNCTIONS
// ============================================================================

/**
 * Simple 2D Perlin noise implementation
 */
export class PerlinNoise2D {
  private permutation: number[];
  private p: number[];

  constructor(seed: number = 0) {
    this.permutation = this.generatePermutation(seed);
    this.p = [...this.permutation, ...this.permutation];
  }

  private generatePermutation(seed: number): number[] {
    const p = Array.from({ length: 256 }, (_, i) => i);
    
    // Shuffle using seed
    let random = seed;
    for (let i = 255; i > 0; i--) {
      random = (random * 1103515245 + 12345) & 0x7fffffff;
      const j = Math.floor((random / 0x7fffffff) * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    
    return p;
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number): number {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  noise(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;

    x -= Math.floor(x);
    y -= Math.floor(y);

    const u = this.fade(x);
    const v = this.fade(y);

    const a = this.p[X] + Y;
    const b = this.p[X + 1] + Y;

    return this.lerp(
      v,
      this.lerp(u, this.grad(this.p[a], x, y), this.grad(this.p[b], x - 1, y)),
      this.lerp(u, this.grad(this.p[a + 1], x, y - 1), this.grad(this.p[b + 1], x - 1, y - 1))
    );
  }
}

/**
 * Fractional Brownian Motion (fBm)
 */
export function fbm(
  x: number,
  y: number,
  octaves: number = 6,
  lacunarity: number = 2.0,
  gain: number = 0.5,
  noise: PerlinNoise2D
): number {
  let value = 0;
  let amplitude = 1.0;
  let frequency = 1.0;

  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise.noise(x * frequency, y * frequency);
    frequency *= lacunarity;
    amplitude *= gain;
  }

  return value;
}

/**
 * Turbulence (absolute value of fBm)
 */
export function turbulence(
  x: number,
  y: number,
  octaves: number = 6,
  roughness: number = 0.5,
  noise: PerlinNoise2D
): number {
  let value = 0;
  let amplitude = 1.0;
  let frequency = 1.0;

  for (let i = 0; i < octaves; i++) {
    value += amplitude * Math.abs(noise.noise(x * frequency, y * frequency));
    frequency *= 2.0;
    amplitude *= roughness;
  }

  return value;
}

/**
 * Voronoi/Worley noise
 */
export function voronoi(
  x: number,
  y: number,
  cells: number = 8,
  distanceType: 'euclidean' | 'manhattan' | 'chebyshev' = 'euclidean'
): number {
  const cellSize = 1.0 / cells;
  const cellX = Math.floor(x / cellSize);
  const cellY = Math.floor(y / cellSize);

  let minDist = Infinity;

  // Check neighboring cells
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const neighborX = cellX + dx;
      const neighborY = cellY + dy;

      // Generate cell point (pseudo-random based on cell coordinates)
      const seed = neighborX * 73856093 ^ neighborY * 19349663;
      const random = (seed * 2654435761) / 4294967296;
      const pointX = (neighborX + random) * cellSize;
      const pointY = (neighborY + ((seed * 1103515245 + 12345) / 4294967296)) * cellSize;

      // Calculate distance
      const dist = calculateDistance(x, y, pointX, pointY, distanceType);
      minDist = Math.min(minDist, dist);
    }
  }

  return minDist * cells; // Normalize
}

function calculateDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  type: 'euclidean' | 'manhattan' | 'chebyshev'
): number {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);

  switch (type) {
    case 'euclidean':
      return Math.sqrt(dx * dx + dy * dy);
    case 'manhattan':
      return dx + dy;
    case 'chebyshev':
      return Math.max(dx, dy);
  }
}

// ============================================================================
// PROCEDURAL BRUSH GENERATORS
// ============================================================================

/**
 * Generate a procedural brush intensity map
 */
export interface ProceduralBrushParams {
  type: 'perlin' | 'fbm' | 'turbulence' | 'voronoi' | 'cellular' | 'ridged' | 'billow';
  size: number;
  scale: number;
  octaves?: number;
  lacunarity?: number;
  gain?: number;
  seed?: number;
  cells?: number;
  distanceType?: 'euclidean' | 'manhattan' | 'chebyshev';
}

/**
 * Generate a procedural brush intensity map as Float32Array
 */
export function generateProceduralBrush(params: ProceduralBrushParams): Float32Array {
  const { size, scale, seed = 0 } = params;
  const data = new Float32Array(size * size);
  const noise = new PerlinNoise2D(seed);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size - 0.5) * scale;
      const v = (y / size - 0.5) * scale;

      let value = 0;

      switch (params.type) {
        case 'perlin':
          value = noise.noise(u, v) * 0.5 + 0.5;
          break;

        case 'fbm':
          value = fbm(
            u, v,
            params.octaves || 6,
            params.lacunarity || 2.0,
            params.gain || 0.5,
            noise
          ) * 0.5 + 0.5;
          break;

        case 'turbulence':
          value = turbulence(u, v, params.octaves || 6, params.gain || 0.5, noise);
          break;

        case 'voronoi':
        case 'cellular':
          value = voronoi(
            u + 0.5,
            v + 0.5,
            params.cells || 8,
            params.distanceType || 'euclidean'
          );
          break;

        case 'ridged':
          value = 1.0 - Math.abs(fbm(
            u, v,
            params.octaves || 6,
            params.lacunarity || 2.0,
            params.gain || 0.5,
            noise
          ));
          break;

        case 'billow':
          value = Math.abs(fbm(
            u, v,
            params.octaves || 6,
            params.lacunarity || 2.0,
            params.gain || 0.5,
            noise
          )) * 2.0 - 1.0;
          value = value * 0.5 + 0.5;
          break;
      }

      // Apply radial falloff
      const dx = (x / size - 0.5) * 2;
      const dy = (y / size - 0.5) * 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const falloff = Math.max(0, 1.0 - dist);

      data[y * size + x] = THREE.MathUtils.clamp(value * falloff, 0, 1);
    }
  }

  return data;
}

/**
 * Generate a procedural brush as ImageData (for canvas rendering)
 */
export function generateProceduralBrushImageData(
  params: ProceduralBrushParams
): ImageData {
  const { size } = params;
  const intensityMap = generateProceduralBrush(params);
  const imageData = new ImageData(size, size);

  for (let i = 0; i < intensityMap.length; i++) {
    const value = Math.floor(intensityMap[i] * 255);
    imageData.data[i * 4] = value;     // R
    imageData.data[i * 4 + 1] = value; // G
    imageData.data[i * 4 + 2] = value; // B
    imageData.data[i * 4 + 3] = 255;   // A
  }

  return imageData;
}

/**
 * Generate a procedural brush as canvas
 */
export function generateProceduralBrushCanvas(
  params: ProceduralBrushParams
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = params.size;
  canvas.height = params.size;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get 2D context');
  }

  const imageData = generateProceduralBrushImageData(params);
  ctx.putImageData(imageData, 0, 0);

  return canvas;
}

// ============================================================================
// PROCEDURAL BRUSH PRESETS
// ============================================================================

export const PROCEDURAL_BRUSH_PRESETS = {
  /**
   * Organic noise brush
   */
  organic: (size: number = 256): Float32Array => {
    return generateProceduralBrush({
      type: 'perlin',
      size,
      scale: 4.0,
      seed: Date.now(),
    });
  },

  /**
   * Detailed terrain-like brush
   */
  terrain: (size: number = 256): Float32Array => {
    return generateProceduralBrush({
      type: 'fbm',
      size,
      scale: 8.0,
      octaves: 8,
      lacunarity: 2.0,
      gain: 0.5,
      seed: Date.now(),
    });
  },

  /**
   * Turbulent chaotic brush
   */
  chaos: (size: number = 256): Float32Array => {
    return generateProceduralBrush({
      type: 'turbulence',
      size,
      scale: 6.0,
      octaves: 6,
      gain: 0.6,
      seed: Date.now(),
    });
  },

  /**
   * Cellular/scales pattern
   */
  scales: (size: number = 256): Float32Array => {
    return generateProceduralBrush({
      type: 'voronoi',
      size,
      scale: 1.0,
      cells: 16,
      distanceType: 'euclidean',
      seed: Date.now(),
    });
  },

  /**
   * Ridged mountains brush
   */
  ridged: (size: number = 256): Float32Array => {
    return generateProceduralBrush({
      type: 'ridged',
      size,
      scale: 6.0,
      octaves: 6,
      lacunarity: 2.2,
      gain: 0.5,
      seed: Date.now(),
    });
  },

  /**
   * Billowy clouds brush
   */
  clouds: (size: number = 256): Float32Array => {
    return generateProceduralBrush({
      type: 'billow',
      size,
      scale: 4.0,
      octaves: 6,
      lacunarity: 2.0,
      gain: 0.5,
      seed: Date.now(),
    });
  },
};

// ============================================================================
// BRUSH MODULATION
// ============================================================================

/**
 * Apply procedural modulation to brush intensity
 */
export function modulateBrushIntensity(
  baseIntensity: number,
  x: number,
  y: number,
  params: BaseBrushParams,
  proceduralParams?: ProceduralBrushParams
): number {
  if (!proceduralParams) {
    return baseIntensity;
  }

  const noise = new PerlinNoise2D(proceduralParams.seed || 0);
  const u = x * proceduralParams.scale;
  const v = y * proceduralParams.scale;

  let modulation = 1.0;

  switch (proceduralParams.type) {
    case 'perlin':
      modulation = noise.noise(u, v) * 0.5 + 0.5;
      break;

    case 'fbm':
      modulation = fbm(
        u, v,
        proceduralParams.octaves || 6,
        proceduralParams.lacunarity || 2.0,
        proceduralParams.gain || 0.5,
        noise
      ) * 0.5 + 0.5;
      break;

    case 'turbulence':
      modulation = turbulence(u, v, proceduralParams.octaves || 6, proceduralParams.gain || 0.5, noise);
      break;

    case 'voronoi':
      modulation = voronoi(u + 0.5, v + 0.5, proceduralParams.cells || 8, proceduralParams.distanceType);
      break;
  }

  return baseIntensity * modulation;
}

/**
 * Generate time-varying procedural brush (animated)
 */
export function generateAnimatedBrush(
  params: ProceduralBrushParams,
  time: number
): Float32Array {
  const animatedParams = {
    ...params,
    seed: Math.floor(time * 1000), // Change seed over time
  };

  return generateProceduralBrush(animatedParams);
}
