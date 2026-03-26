/**
 * EROSION SIMULATOR
 * 
 * CPU-based erosion algorithms for terrain heightmaps.
 * Complements GPU simulation with more accurate physics-based erosion.
 * 
 * Features:
 * - Hydraulic erosion (water-based)
 * - Thermal erosion (heat diffusion)
 * - Particle-based hydraulic erosion
 * - Multi-threaded processing support
 * 
 * @module ErosionSimulator
 */

import {
  HeightmapData,
  HydraulicErosionParams,
  ThermalErosionParams
} from './TerrainTypes';

/**
 * Erosion simulator for CPU-based terrain erosion
 * 
 * Provides more accurate physics-based erosion than GPU shaders,
 * at the cost of performance. Best used for final terrain generation
 * or high-quality offline processing.
 * 
 * @example
 * ```typescript
 * const simulator = new ErosionSimulator();
 * 
 * // Apply hydraulic erosion
 * const eroded = simulator.hydraulicErosion(heightmap, {
 *   steps: 100,
 *   flowSpeed: 1.0,
 *   sedimentCapacity: 4.0,
 *   erosionStrength: 0.3,
 *   depositionStrength: 0.3,
 *   evaporationRate: 0.01
 * });
 * ```
 */
export class ErosionSimulator {
  /**
   * Apply hydraulic (water-based) erosion to heightmap
   * 
   * Simulates water droplets flowing downhill, picking up and depositing sediment.
   * Creates realistic river valleys and drainage patterns.
   */
  hydraulicErosion(
    heightmap: HeightmapData,
    params: HydraulicErosionParams
  ): HeightmapData {
    const {
      steps,
      flowSpeed,
      sedimentCapacity,
      erosionStrength,
      depositionStrength,
      evaporationRate
    } = params;
    
    const { width, height, data } = heightmap;
    const result = new Float32Array(data);
    
    // Particle-based erosion
    for (let step = 0; step < steps; step++) {
      // Random starting position
      let x = Math.random() * width;
      let y = Math.random() * height;
      
      let sediment = 0;
      let water = 1.0;
      let velocity = 0;
      
      // Simulate droplet path
      for (let lifetime = 0; lifetime < 100; lifetime++) {
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        
        // Check bounds
        if (ix < 0 || ix >= width - 1 || iy < 0 || iy >= height - 1) {
          break;
        }
        
        // Get current height
        const idx = (iy * width + ix) * 4;
        const currentHeight = result[idx];
        
        // Calculate gradient (steepest descent)
        const gradX = this.getGradientX(result, width, height, ix, iy);
        const gradY = this.getGradientY(result, width, height, ix, iy);
        
        // Update velocity
        velocity = Math.sqrt(velocity * velocity + gradX * gradX + gradY * gradY) * flowSpeed;
        
        // Calculate sediment capacity
        const capacity = Math.max(0.01, velocity) * water * sedimentCapacity;
        
        // Erosion or deposition
        if (sediment > capacity) {
          // Deposit sediment
          const deposit = (sediment - capacity) * depositionStrength;
          result[idx] += deposit;
          sediment -= deposit;
        } else {
          // Erode terrain
          const erosion = Math.min((capacity - sediment) * erosionStrength, currentHeight);
          result[idx] -= erosion;
          sediment += erosion;
        }
        
        // Move droplet
        if (gradX !== 0 || gradY !== 0) {
          const len = Math.sqrt(gradX * gradX + gradY * gradY);
          x += (gradX / len) * velocity;
          y += (gradY / len) * velocity;
        } else {
          // Stuck in local minimum
          break;
        }
        
        // Evaporate water
        water *= (1 - evaporationRate);
        
        if (water < 0.01) {
          break;
        }
      }
    }
    
    return {
      data: result,
      width,
      height
    };
  }
  
  /**
   * Apply thermal erosion to heightmap
   * 
   * Simulates material sliding down slopes based on talus angle.
   * Creates more natural-looking slopes and removes unrealistic steep cliffs.
   */
  thermalErosion(
    heightmap: HeightmapData,
    params: ThermalErosionParams
  ): HeightmapData {
    const {
      steps,
      diffusionRate,
      talusAngle,
      strength
    } = params;
    
    const { width, height, data } = heightmap;
    const result = new Float32Array(data);
    
    // Convert talus angle to height difference threshold
    const talusThreshold = Math.tan(talusAngle * Math.PI / 180);
    
    for (let step = 0; step < steps; step++) {
      const temp = new Float32Array(result);
      
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = (y * width + x) * 4;
          const h = temp[idx];
          
          // Check all 8 neighbors
          const neighbors = [
            { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
            { dx: -1, dy: 0 },                      { dx: 1, dy: 0 },
            { dx: -1, dy: 1 },  { dx: 0, dy: 1 },  { dx: 1, dy: 1 }
          ];
          
          let totalDiff = 0;
          let count = 0;
          
          for (const { dx, dy } of neighbors) {
            const nx = x + dx;
            const ny = y + dy;
            const nIdx = (ny * width + nx) * 4;
            const nh = temp[nIdx];
            
            const diff = h - nh;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Check if slope exceeds talus angle
            if (diff > talusThreshold * distance) {
              totalDiff += diff;
              count++;
            }
          }
          
          if (count > 0) {
            // Erode based on average difference
            const erosion = (totalDiff / count) * diffusionRate * strength;
            result[idx] -= erosion;
            
            // Distribute to neighbors
            const deposit = erosion / count;
            for (const { dx, dy } of neighbors) {
              const nx = x + dx;
              const ny = y + dy;
              const nIdx = (ny * width + nx) * 4;
              result[nIdx] += deposit;
            }
          }
        }
      }
    }
    
    return {
      data: result,
      width,
      height
    };
  }
  
  /**
   * Apply combined erosion (hydraulic + thermal)
   * 
   * Applies both erosion types in sequence for more realistic results.
   */
  combinedErosion(
    heightmap: HeightmapData,
    hydraulicParams: HydraulicErosionParams,
    thermalParams: ThermalErosionParams
  ): HeightmapData {
    // Apply hydraulic first (creates valleys)
    let result = this.hydraulicErosion(heightmap, hydraulicParams);
    
    // Then thermal (smooths slopes)
    result = this.thermalErosion(result, thermalParams);
    
    return result;
  }
  
  /**
   * Smooth heightmap using box blur
   */
  smooth(
    heightmap: HeightmapData,
    radius: number = 1
  ): HeightmapData {
    const { width, height, data } = heightmap;
    const result = new Float32Array(data);
    
    for (let y = radius; y < height - radius; y++) {
      for (let x = radius; x < width - radius; x++) {
        let sum = 0;
        let count = 0;
        
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const idx = ((y + dy) * width + (x + dx)) * 4;
            sum += data[idx];
            count++;
          }
        }
        
        const idx = (y * width + x) * 4;
        result[idx] = sum / count;
      }
    }
    
    return {
      data: result,
      width,
      height
    };
  }
  
  /**
   * Calculate gradient in X direction
   */
  private getGradientX(
    data: Float32Array,
    width: number,
    height: number,
    x: number,
    y: number
  ): number {
    if (x <= 0 || x >= width - 1) return 0;
    
    const idx = (y * width + x) * 4;
    const left = data[idx - 4];
    const right = data[idx + 4];
    
    return (right - left) * 0.5;
  }
  
  /**
   * Calculate gradient in Y direction
   */
  private getGradientY(
    data: Float32Array,
    width: number,
    height: number,
    x: number,
    y: number
  ): number {
    if (y <= 0 || y >= height - 1) return 0;
    
    const idx = (y * width + x) * 4;
    const up = data[idx - width * 4];
    const down = data[idx + width * 4];
    
    return (down - up) * 0.5;
  }
  
  /**
   * Normalize heightmap to [0, 1] range
   */
  normalize(heightmap: HeightmapData): HeightmapData {
    const { width, height, data } = heightmap;
    const result = new Float32Array(data);
    
    let minVal = Infinity;
    let maxVal = -Infinity;
    
    // Find min/max
    for (let i = 0; i < width * height; i++) {
      const h = data[i * 4];
      if (h < minVal) minVal = h;
      if (h > maxVal) maxVal = h;
    }
    
    // Normalize
    const range = maxVal - minVal;
    if (range > 0.0001) {
      for (let i = 0; i < width * height; i++) {
        result[i * 4] = (data[i * 4] - minVal) / range;
      }
    }
    
    return {
      data: result,
      width,
      height,
      minHeight: 0,
      maxHeight: 1
    };
  }
  
  /**
   * Terrace heightmap (create stepped levels)
   */
  terrace(
    heightmap: HeightmapData,
    levels: number = 10,
    smoothness: number = 0.1
  ): HeightmapData {
    const { width, height, data } = heightmap;
    const result = new Float32Array(data);
    
    for (let i = 0; i < width * height; i++) {
      const h = data[i * 4];
      const level = Math.floor(h * levels) / levels;
      const nextLevel = Math.ceil(h * levels) / levels;
      
      // Smooth transition between levels
      const t = (h * levels) % 1.0;
      const smoothT = Math.pow(t, 1.0 / smoothness);
      
      result[i * 4] = level * (1 - smoothT) + nextLevel * smoothT;
    }
    
    return {
      data: result,
      width,
      height
    };
  }
}
