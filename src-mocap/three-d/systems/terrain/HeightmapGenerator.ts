/**
 * HEIGHTMAP GENERATOR
 * 
 * Procedural heightmap generation using various noise algorithms and techniques.
 * Extracted from Tecton feature for universal terrain generation capabilities.
 * 
 * Features:
 * - Simplex noise (2D/3D)
 * - Fractional Brownian Motion (FBM)
 * - Ridged multifractal
 * - Island masking
 * - Seeded random generation
 * - Multiple noise octaves
 * - Configurable persistence and lacunarity
 * 
 * @module HeightmapGenerator
 */

import * as THREE from 'three';
import { HeightmapData, NoiseParams } from './TerrainTypes';

/**
 * Pseudo-random number generator using Mulberry32 algorithm
 * Provides deterministic random numbers from a seed
 */
class SeededRandom {
  private seed: number;
  
  constructor(seed: number) {
    this.seed = seed;
  }
  
  /**
   * Generate next random number (0-1)
   */
  next(): number {
    let t = this.seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

/**
 * Simplex noise generator
 * Provides smooth, continuous noise for terrain generation
 */
class SimplexNoise {
  private perm: Uint8Array;
  private grad3: Float32Array;
  
  constructor(random: SeededRandom) {
    this.perm = new Uint8Array(512);
    this.grad3 = new Float32Array([
      1, 1, 0,  -1, 1, 0,  1, -1, 0,  -1, -1, 0,
      1, 0, 1,  -1, 0, 1,  1, 0, -1,  -1, 0, -1,
      0, 1, 1,  0, -1, 1,  0, 1, -1,  0, -1, -1
    ]);
    
    // Initialize permutation table
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }
    
    // Shuffle using seeded random
    for (let i = 255; i > 0; i--) {
      const n = Math.floor(random.next() * (i + 1));
      const temp = p[i];
      p[i] = p[n];
      p[n] = temp;
    }
    
    // Duplicate for wrapping
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
    }
  }
  
  /**
   * Generate 2D simplex noise value at given coordinates
   */
  noise2D(xin: number, yin: number): number {
    let n0 = 0, n1 = 0, n2 = 0;
    
    // Skew input space to determine simplex cell
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    
    // Unskew cell origin
    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;
    
    // Determine which simplex we're in
    let i1, j1;
    if (x0 > y0) {
      i1 = 1;
      j1 = 0;
    } else {
      i1 = 0;
      j1 = 1;
    }
    
    // Offsets for corners
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;
    
    // Work out hashed gradient indices
    const ii = i & 255;
    const jj = j & 255;
    
    const gi0 = this.perm[ii + this.perm[jj]] % 12;
    const gi1 = this.perm[ii + i1 + this.perm[jj + j1]] % 12;
    const gi2 = this.perm[ii + 1 + this.perm[jj + 1]] % 12;
    
    // Calculate contribution from three corners
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 < 0) {
      n0 = 0.0;
    } else {
      t0 *= t0;
      n0 = t0 * t0 * (this.grad3[gi0 * 3] * x0 + this.grad3[gi0 * 3 + 1] * y0);
    }
    
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 < 0) {
      n1 = 0.0;
    } else {
      t1 *= t1;
      n1 = t1 * t1 * (this.grad3[gi1 * 3] * x1 + this.grad3[gi1 * 3 + 1] * y1);
    }
    
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 < 0) {
      n2 = 0.0;
    } else {
      t2 *= t2;
      n2 = t2 * t2 * (this.grad3[gi2 * 3] * x2 + this.grad3[gi2 * 3 + 1] * y2);
    }
    
    // Sum contributions and scale to [-1, 1]
    return 70.0 * (n0 + n1 + n2);
  }
}

/**
 * Heightmap generator with various procedural techniques
 */
export class HeightmapGenerator {
  private random: SeededRandom;
  private simplex: SimplexNoise;
  
  constructor(seed: number = Math.random() * 10000) {
    this.random = new SeededRandom(seed);
    this.simplex = new SimplexNoise(this.random);
  }
  
  /**
   * Generate heightmap using Fractional Brownian Motion (FBM)
   * 
   * @param width - Heightmap width in pixels
   * @param height - Heightmap height in pixels
   * @param params - Noise generation parameters
   * @returns HeightmapData with generated terrain
   */
  generateFBM(
    width: number,
    height: number,
    params: Partial<NoiseParams> = {}
  ): HeightmapData {
    const {
      octaves = 6,
      persistence = 0.5,
      lacunarity = 2.0,
      scale = 3.0,
      seed = this.random.next() * 10000
    } = params;
    
    // Reinitialize with new seed if provided
    if (params.seed !== undefined) {
      this.random = new SeededRandom(seed);
      this.simplex = new SimplexNoise(this.random);
    }
    
    const size = width * height;
    const data = new Float32Array(size * 4);
    const buffer = new Float32Array(size);
    
    let minVal = Infinity;
    let maxVal = -Infinity;
    
    // Generate FBM noise
    for (let i = 0; i < size; i++) {
      const x = i % width;
      const y = Math.floor(i / width);
      const nx = x / width - 0.5;
      const ny = y / height - 0.5;
      
      let amplitude = 1.0;
      let frequency = 1.0;
      let noiseVal = 0.0;
      let maxValue = 0.0;
      
      // Sum octaves
      for (let o = 0; o < octaves; o++) {
        noiseVal += this.simplex.noise2D(
          nx * scale * frequency,
          ny * scale * frequency
        ) * amplitude;
        
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
      }
      
      // Normalize
      let h = (noiseVal / maxValue) + 0.5;
      
      buffer[i] = h;
      
      if (h < minVal) minVal = h;
      if (h > maxVal) maxVal = h;
    }
    
    // Normalize to [0, 1] and fill RGBA data
    const range = maxVal - minVal;
    for (let i = 0; i < size; i++) {
      let val = buffer[i];
      if (range > 0.0001) {
        val = (val - minVal) / range;
      } else {
        val = 0.5;
      }
      
      data[i * 4] = val;     // R: Height
      data[i * 4 + 1] = 0;   // G: Unused
      data[i * 4 + 2] = 0;   // B: Unused
      data[i * 4 + 3] = 1;   // A: Alpha
    }
    
    return {
      data,
      width,
      height,
      minHeight: 0,
      maxHeight: 1
    };
  }
  
  /**
   * Generate island heightmap with radial falloff
   */
  generateIsland(
    width: number,
    height: number,
    params: Partial<NoiseParams> = {}
  ): HeightmapData {
    const baseHeightmap = this.generateFBM(width, height, params);
    const data = baseHeightmap.data;
    const size = width * height;
    
    // Apply island mask
    for (let i = 0; i < size; i++) {
      const x = i % width;
      const y = Math.floor(i / width);
      const nx = x / width - 0.5;
      const ny = y / height - 0.5;
      
      // Radial distance from center
      const d = Math.sqrt(nx * nx + ny * ny) * 2.0;
      
      // Falloff curve (adjustable power for sharper/softer edges)
      const mask = 1.0 - Math.pow(Math.min(d, 1.0), 2.5);
      
      // Apply mask to height
      const h = data[i * 4];
      data[i * 4] = h * Math.max(0, mask);
    }
    
    return baseHeightmap;
  }
  
  /**
   * Generate ridged multifractal terrain (mountains)
   */
  generateRidged(
    width: number,
    height: number,
    params: Partial<NoiseParams> = {}
  ): HeightmapData {
    const {
      octaves = 6,
      persistence = 0.5,
      lacunarity = 2.0,
      scale = 3.0,
      seed = this.random.next() * 10000
    } = params;
    
    if (params.seed !== undefined) {
      this.random = new SeededRandom(seed);
      this.simplex = new SimplexNoise(this.random);
    }
    
    const size = width * height;
    const data = new Float32Array(size * 4);
    const buffer = new Float32Array(size);
    
    let minVal = Infinity;
    let maxVal = -Infinity;
    
    // Generate ridged noise
    for (let i = 0; i < size; i++) {
      const x = i % width;
      const y = Math.floor(i / width);
      const nx = x / width - 0.5;
      const ny = y / height - 0.5;
      
      let amplitude = 1.0;
      let frequency = 1.0;
      let noiseVal = 0.0;
      
      for (let o = 0; o < octaves; o++) {
        const n = this.simplex.noise2D(
          nx * scale * frequency,
          ny * scale * frequency
        );
        
        // Ridged: invert and sharpen
        const ridge = 1.0 - Math.abs(n);
        noiseVal += ridge * ridge * amplitude;
        
        amplitude *= persistence;
        frequency *= lacunarity;
      }
      
      // Apply power curve for sharper peaks
      let h = Math.pow(Math.abs(noiseVal), 1.2);
      
      buffer[i] = h;
      
      if (h < minVal) minVal = h;
      if (h > maxVal) maxVal = h;
    }
    
    // Normalize
    const range = maxVal - minVal;
    for (let i = 0; i < size; i++) {
      let val = buffer[i];
      if (range > 0.0001) {
        val = (val - minVal) / range;
      } else {
        val = 0.5;
      }
      
      data[i * 4] = val;
      data[i * 4 + 1] = 0;
      data[i * 4 + 2] = 0;
      data[i * 4 + 3] = 1;
    }
    
    return {
      data,
      width,
      height,
      minHeight: 0,
      maxHeight: 1
    };
  }
  
  /**
   * Generate flat plane (useful for testing)
   */
  generateFlat(
    width: number,
    height: number,
    heightValue: number = 0.5
  ): HeightmapData {
    const size = width * height;
    const data = new Float32Array(size * 4);
    
    for (let i = 0; i < size; i++) {
      data[i * 4] = heightValue;
      data[i * 4 + 1] = 0;
      data[i * 4 + 2] = 0;
      data[i * 4 + 3] = 1;
    }
    
    return {
      data,
      width,
      height,
      minHeight: heightValue,
      maxHeight: heightValue
    };
  }
  
  /**
   * Generate from image data (import heightmap)
   */
  generateFromImage(
    imageData: ImageData,
    invert: boolean = false
  ): HeightmapData {
    const { width, height, data: imgData } = imageData;
    const size = width * height;
    const data = new Float32Array(size * 4);
    
    let minVal = Infinity;
    let maxVal = -Infinity;
    
    for (let i = 0; i < size; i++) {
      // Use red channel as height
      let h = imgData[i * 4] / 255;
      
      if (invert) {
        h = 1.0 - h;
      }
      
      data[i * 4] = h;
      data[i * 4 + 1] = 0;
      data[i * 4 + 2] = 0;
      data[i * 4 + 3] = 1;
      
      if (h < minVal) minVal = h;
      if (h > maxVal) maxVal = h;
    }
    
    return {
      data,
      width,
      height,
      minHeight: minVal,
      maxHeight: maxVal
    };
  }
  
  /**
   * Create Three.js texture from heightmap data
   */
  createTexture(heightmap: HeightmapData): THREE.DataTexture {
    const texture = new THREE.DataTexture(
      heightmap.data as unknown as BufferSource,
      heightmap.width,
      heightmap.height,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    
    return texture;
  }
  
  /**
   * Blend two heightmaps together
   */
  blend(
    heightmapA: HeightmapData,
    heightmapB: HeightmapData,
    factor: number
  ): HeightmapData {
    if (heightmapA.width !== heightmapB.width || heightmapA.height !== heightmapB.height) {
      throw new Error('Heightmaps must have same dimensions for blending');
    }
    
    const size = heightmapA.width * heightmapA.height;
    const data = new Float32Array(size * 4);
    
    for (let i = 0; i < size; i++) {
      const hA = heightmapA.data[i * 4];
      const hB = heightmapB.data[i * 4];
      const h = hA * (1 - factor) + hB * factor;
      
      data[i * 4] = h;
      data[i * 4 + 1] = 0;
      data[i * 4 + 2] = 0;
      data[i * 4 + 3] = 1;
    }
    
    return {
      data,
      width: heightmapA.width,
      height: heightmapA.height
    };
  }
}

/**
 * Convenience function to generate terrain data
 * Compatible with legacy Tecton code
 */
export function generateTerrainData(
  width: number,
  height: number,
  seed: number
): Float32Array {
  const generator = new HeightmapGenerator(seed);
  const heightmap = generator.generateIsland(width, height, {
    octaves: 6,
    persistence: 0.5,
    lacunarity: 2.0,
    scale: 3.0
  });
  
  return heightmap.data;
}
