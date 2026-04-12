/**
 * RayTracer - GPU ray tracing wrapper for texture baking
 * 
 * Wraps the Rust backend GPU ray tracing functionality for high-performance
 * texture baking operations.
 */

import { invoke } from '@tauri-apps/api/core';
import type { BakeMesh, BakeSettings, MapType } from './bakeEngine';

export interface BakeResult {
  width: number;
  height: number;
  data: Uint8Array;
  timeMs: number;
}

/**
 * GPU-accelerated ray tracer for texture baking
 */
export class RayTracer {
  private initialized: boolean = false;

  /**
   * Initialize GPU ray tracer
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await invoke('init_baking_system');
      this.initialized = true;
      console.log('[RayTracer] GPU ray tracer initialized');
    } catch (error) {
      console.error('[RayTracer] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Check if GPU acceleration is available
   */
  async hasGPU(): Promise<boolean> {
    try {
      return await invoke('baking_has_gpu');
    } catch {
      return false;
    }
  }

  /**
   * Bake normal map from high-poly to low-poly mesh
   */
  async bakeNormalMap(
    highPoly: BakeMesh,
    lowPoly: BakeMesh,
    settings: BakeSettings
  ): Promise<BakeResult> {
    await this.initialize();

    const startTime = performance.now();

    try {
      const result = await invoke<{ width: number; height: number; data: number[] }>(
        'bake_normal_map',
        {
          highPoly: {
            positions: Array.from(highPoly.positions),
            normals: Array.from(highPoly.normals),
            tangents: Array.from(highPoly.tangents),
            uvs: Array.from(highPoly.uvs),
            indices: Array.from(highPoly.indices)
          },
          lowPoly: {
            positions: Array.from(lowPoly.positions),
            normals: Array.from(lowPoly.normals),
            tangents: Array.from(lowPoly.tangents),
            uvs: Array.from(lowPoly.uvs),
            indices: Array.from(lowPoly.indices)
          },
          settings: {
            resolution: settings.resolution,
            samples: settings.samples,
            maxDistance: settings.maxDistance,
            cageExtrusion: settings.cageExtrusion,
            normalSpace: settings.normalSpace,
            dilationIterations: settings.dilationIterations,
            enableAntialiasing: settings.enableAntialiasing
          }
        }
      );

      const timeMs = performance.now() - startTime;

      return {
        width: result.width,
        height: result.height,
        data: new Uint8Array(result.data),
        timeMs
      };
    } catch (error) {
      console.error('[RayTracer] Normal map baking failed:', error);
      throw error;
    }
  }

  /**
   * Bake ambient occlusion map
   */
  async bakeAOMap(
    mesh: BakeMesh,
    settings: BakeSettings
  ): Promise<BakeResult> {
    await this.initialize();

    const startTime = performance.now();

    try {
      const result = await invoke<{ width: number; height: number; data: number[] }>(
        'bake_ao_map',
        {
          mesh: {
            positions: Array.from(mesh.positions),
            normals: Array.from(mesh.normals),
            tangents: Array.from(mesh.tangents),
            uvs: Array.from(mesh.uvs),
            indices: Array.from(mesh.indices)
          },
          settings: {
            resolution: settings.resolution,
            samples: settings.samples,
            maxDistance: settings.maxDistance,
            dilationIterations: settings.dilationIterations
          }
        }
      );

      const timeMs = performance.now() - startTime;

      return {
        width: result.width,
        height: result.height,
        data: new Uint8Array(result.data),
        timeMs
      };
    } catch (error) {
      console.error('[RayTracer] AO map baking failed:', error);
      throw error;
    }
  }

  /**
   * Bake curvature map
   */
  async bakeCurvatureMap(
    mesh: BakeMesh,
    settings: BakeSettings
  ): Promise<BakeResult> {
    await this.initialize();

    const startTime = performance.now();

    try {
      const result = await invoke<{ width: number; height: number; data: number[] }>(
        'bake_curvature_map',
        {
          mesh: {
            positions: Array.from(mesh.positions),
            normals: Array.from(mesh.normals),
            tangents: Array.from(mesh.tangents),
            uvs: Array.from(mesh.uvs),
            indices: Array.from(mesh.indices)
          },
          settings: {
            resolution: settings.resolution,
            dilationIterations: settings.dilationIterations
          }
        }
      );

      const timeMs = performance.now() - startTime;

      return {
        width: result.width,
        height: result.height,
        data: new Uint8Array(result.data),
        timeMs
      };
    } catch (error) {
      console.error('[RayTracer] Curvature map baking failed:', error);
      throw error;
    }
  }

  /**
   * Bake thickness map
   */
  async bakeThicknessMap(
    mesh: BakeMesh,
    settings: BakeSettings
  ): Promise<BakeResult> {
    await this.initialize();

    const startTime = performance.now();

    try {
      const result = await invoke<{ width: number; height: number; data: number[] }>(
        'bake_thickness_map',
        {
          mesh: {
            positions: Array.from(mesh.positions),
            normals: Array.from(mesh.normals),
            tangents: Array.from(mesh.tangents),
            uvs: Array.from(mesh.uvs),
            indices: Array.from(mesh.indices)
          },
          settings: {
            resolution: settings.resolution,
            maxDistance: settings.maxDistance,
            dilationIterations: settings.dilationIterations
          }
        }
      );

      const timeMs = performance.now() - startTime;

      return {
        width: result.width,
        height: result.height,
        data: new Uint8Array(result.data),
        timeMs
      };
    } catch (error) {
      console.error('[RayTracer] Thickness map baking failed:', error);
      throw error;
    }
  }

  /**
   * Bake position map
   */
  async bakePositionMap(
    mesh: BakeMesh,
    settings: BakeSettings
  ): Promise<BakeResult> {
    await this.initialize();

    const startTime = performance.now();

    try {
      const result = await invoke<{ width: number; height: number; data: number[] }>(
        'bake_position_map',
        {
          mesh: {
            positions: Array.from(mesh.positions),
            normals: Array.from(mesh.normals),
            tangents: Array.from(mesh.tangents),
            uvs: Array.from(mesh.uvs),
            indices: Array.from(mesh.indices)
          },
          settings: {
            resolution: settings.resolution,
            dilationIterations: settings.dilationIterations
          }
        }
      );

      const timeMs = performance.now() - startTime;

      return {
        width: result.width,
        height: result.height,
        data: new Uint8Array(result.data),
        timeMs
      };
    } catch (error) {
      console.error('[RayTracer] Position map baking failed:', error);
      throw error;
    }
  }

  /**
   * Bake material ID map
   */
  async bakeIDMap(
    mesh: BakeMesh,
    materialIds: Uint32Array,
    settings: BakeSettings
  ): Promise<BakeResult> {
    await this.initialize();

    const startTime = performance.now();

    try {
      const result = await invoke<{ width: number; height: number; data: number[] }>(
        'bake_id_map',
        {
          mesh: {
            positions: Array.from(mesh.positions),
            normals: Array.from(mesh.normals),
            tangents: Array.from(mesh.tangents),
            uvs: Array.from(mesh.uvs),
            indices: Array.from(mesh.indices)
          },
          materialIds: Array.from(materialIds),
          settings: {
            resolution: settings.resolution,
            dilationIterations: settings.dilationIterations
          }
        }
      );

      const timeMs = performance.now() - startTime;

      return {
        width: result.width,
        height: result.height,
        data: new Uint8Array(result.data),
        timeMs
      };
    } catch (error) {
      console.error('[RayTracer] ID map baking failed:', error);
      throw error;
    }
  }

  /**
   * Batch bake multiple map types
   */
  async bakeBatch(
    highPoly: BakeMesh | null,
    lowPoly: BakeMesh,
    mapTypes: MapType[],
    settings: BakeSettings
  ): Promise<Map<MapType, BakeResult>> {
    await this.initialize();

    const results = new Map<MapType, BakeResult>();

    for (const mapType of mapTypes) {
      console.log(`[RayTracer] Baking ${mapType} map...`);

      try {
        let result: BakeResult;

        switch (mapType) {
          case 'normal':
            if (!highPoly) {
              throw new Error('High-poly mesh required for normal map baking');
            }
            result = await this.bakeNormalMap(highPoly, lowPoly, settings);
            break;

          case 'ao':
            result = await this.bakeAOMap(lowPoly, settings);
            break;

          case 'curvature':
            result = await this.bakeCurvatureMap(lowPoly, settings);
            break;

          case 'thickness':
            result = await this.bakeThicknessMap(lowPoly, settings);
            break;

          case 'position':
            result = await this.bakePositionMap(lowPoly, settings);
            break;

          case 'id':
            // Default material IDs (all 0)
            const triangleCount = lowPoly.indices.length / 3;
            const materialIds = new Uint32Array(triangleCount);
            result = await this.bakeIDMap(lowPoly, materialIds, settings);
            break;

          default:
            throw new Error(`Unknown map type: ${mapType}`);
        }

        results.set(mapType, result);
        console.log(`[RayTracer] ${mapType} map baked in ${result.timeMs.toFixed(2)}ms`);
      } catch (error) {
        console.error(`[RayTracer] Failed to bake ${mapType} map:`, error);
        throw error;
      }
    }

    return results;
  }
}

// Singleton instance
export const rayTracer = new RayTracer();
