/**
 * CageGenerator - Auto cage generation for controlled baking
 * 
 * Generates cage meshes by extruding the low-poly mesh along vertex normals.
 * Cages control ray casting direction and distance for more accurate baking.
 */

import { invoke } from '@tauri-apps/api/core';
import type { BakeMesh } from './bakeEngine';

export interface CageGenerationSettings {
  extrusion: number;
  adaptive: boolean;
  minExtrusion?: number;
  maxExtrusion?: number;
}

/**
 * Generate cage mesh for controlled baking
 */
export class CageGenerator {
  /**
   * Generate uniform cage mesh with fixed extrusion
   */
  async generateUniform(
    mesh: BakeMesh,
    extrusion: number
  ): Promise<BakeMesh> {
    try {
      const result = await invoke<{
        positions: number[];
        normals: number[];
        tangents: number[];
        uvs: number[];
        indices: number[];
      }>('generate_cage', {
        mesh: {
          positions: Array.from(mesh.positions),
          normals: Array.from(mesh.normals),
          tangents: Array.from(mesh.tangents),
          uvs: Array.from(mesh.uvs),
          indices: Array.from(mesh.indices)
        },
        extrusion
      });

      return {
        positions: new Float32Array(result.positions),
        normals: new Float32Array(result.normals),
        tangents: new Float32Array(result.tangents),
        uvs: new Float32Array(result.uvs),
        indices: new Uint32Array(result.indices)
      };
    } catch (error) {
      console.error('[CageGenerator] Failed to generate uniform cage:', error);
      throw error;
    }
  }

  /**
   * Generate adaptive cage mesh with variable extrusion
   * 
   * Adaptive cages use larger extrusion in areas with high curvature
   * and smaller extrusion in flat areas for better baking quality.
   */
  async generateAdaptive(
    mesh: BakeMesh,
    minExtrusion: number,
    maxExtrusion: number
  ): Promise<BakeMesh> {
    try {
      const result = await invoke<{
        positions: number[];
        normals: number[];
        tangents: number[];
        uvs: number[];
        indices: number[];
      }>('generate_cage_adaptive', {
        mesh: {
          positions: Array.from(mesh.positions),
          normals: Array.from(mesh.normals),
          tangents: Array.from(mesh.tangents),
          uvs: Array.from(mesh.uvs),
          indices: Array.from(mesh.indices)
        },
        minExtrusion,
        maxExtrusion
      });

      return {
        positions: new Float32Array(result.positions),
        normals: new Float32Array(result.normals),
        tangents: new Float32Array(result.tangents),
        uvs: new Float32Array(result.uvs),
        indices: new Uint32Array(result.indices)
      };
    } catch (error) {
      console.error('[CageGenerator] Failed to generate adaptive cage:', error);
      throw error;
    }
  }

  /**
   * Generate cage mesh with settings
   */
  async generate(
    mesh: BakeMesh,
    settings: CageGenerationSettings
  ): Promise<BakeMesh> {
    if (settings.adaptive) {
      const minExtrusion = settings.minExtrusion ?? settings.extrusion * 0.5;
      const maxExtrusion = settings.maxExtrusion ?? settings.extrusion * 1.5;
      return this.generateAdaptive(mesh, minExtrusion, maxExtrusion);
    } else {
      return this.generateUniform(mesh, settings.extrusion);
    }
  }

  /**
   * Validate cage mesh
   * 
   * Checks if the cage properly encloses the mesh without self-intersections
   */
  async validate(
    mesh: BakeMesh,
    cage: BakeMesh
  ): Promise<{ valid: boolean; issues: string[] }> {
    try {
      const result = await invoke<{ valid: boolean; issues: string[] }>(
        'validate_cage',
        {
          mesh: {
            positions: Array.from(mesh.positions),
            normals: Array.from(mesh.normals),
            tangents: Array.from(mesh.tangents),
            uvs: Array.from(mesh.uvs),
            indices: Array.from(mesh.indices)
          },
          cage: {
            positions: Array.from(cage.positions),
            normals: Array.from(cage.normals),
            tangents: Array.from(cage.tangents),
            uvs: Array.from(cage.uvs),
            indices: Array.from(cage.indices)
          }
        }
      );

      return result;
    } catch (error) {
      console.error('[CageGenerator] Failed to validate cage:', error);
      return {
        valid: false,
        issues: ['Validation failed: ' + String(error)]
      };
    }
  }

  /**
   * Calculate recommended extrusion distance
   * 
   * Analyzes mesh geometry to suggest appropriate extrusion distance
   */
  async calculateRecommendedExtrusion(mesh: BakeMesh): Promise<number> {
    try {
      const result = await invoke<number>('calculate_recommended_extrusion', {
        mesh: {
          positions: Array.from(mesh.positions),
          normals: Array.from(mesh.normals),
          tangents: Array.from(mesh.tangents),
          uvs: Array.from(mesh.uvs),
          indices: Array.from(mesh.indices)
        }
      });

      return result;
    } catch (error) {
      console.error('[CageGenerator] Failed to calculate recommended extrusion:', error);
      // Fallback to 10% of bounding box diagonal
      return this.calculateFallbackExtrusion(mesh);
    }
  }

  /**
   * Calculate fallback extrusion based on bounding box
   */
  private calculateFallbackExtrusion(mesh: BakeMesh): number {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (let i = 0; i < mesh.positions.length; i += 3) {
      const x = mesh.positions[i];
      const y = mesh.positions[i + 1];
      const z = mesh.positions[i + 2];

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
    }

    const dx = maxX - minX;
    const dy = maxY - minY;
    const dz = maxZ - minZ;
    const diagonal = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // 10% of diagonal as default extrusion
    return diagonal * 0.1;
  }
}

// Singleton instance
export const cageGenerator = new CageGenerator();
