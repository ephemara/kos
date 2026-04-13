/**
 * Bake Client - Typed service client for texture baking operations
 * 
 * Wraps Tauri IPC calls to the baking backend with TypeScript types.
 */

import { invoke } from '@tauri-apps/api/core';

export interface BakeMeshData {
  positions: number[];
  normals: number[];
  tangents: number[];
  uvs: number[];
  indices: number[];
}

export interface BakeSettingsData {
  resolution: number;
  samples: number;
  maxDistance: number;
  cageExtrusion: number | null;
  normalSpace: 'tangent' | 'object' | 'world';
  dilationIterations: number;
  enableAntialiasing: boolean;
}

export interface BakeResultData {
  width: number;
  height: number;
  data: number[];
}

export class BakeClient {
  /**
   * Initialize the baking system
   */
  async initialize(): Promise<void> {
    await invoke('init_baking_system');
  }

  /**
   * Check if GPU acceleration is available
   */
  async hasGPU(): Promise<boolean> {
    return await invoke('baking_has_gpu');
  }

  /**
   * Bake normal map from high-poly to low-poly mesh
   */
  async bakeNormalMap(
    highPoly: BakeMeshData,
    lowPoly: BakeMeshData,
    settings: BakeSettingsData
  ): Promise<BakeResultData> {
    return await invoke('bake_normal_map', {
      highPoly,
      lowPoly,
      settings
    });
  }

  /**
   * Bake ambient occlusion map
   */
  async bakeAOMap(
    mesh: BakeMeshData,
    settings: BakeSettingsData
  ): Promise<BakeResultData> {
    return await invoke('bake_ao_map', {
      mesh,
      settings
    });
  }

  /**
   * Bake curvature map
   */
  async bakeCurvatureMap(
    mesh: BakeMeshData,
    settings: BakeSettingsData
  ): Promise<BakeResultData> {
    return await invoke('bake_curvature_map', {
      mesh,
      settings
    });
  }

  /**
   * Bake thickness map
   */
  async bakeThicknessMap(
    mesh: BakeMeshData,
    settings: BakeSettingsData
  ): Promise<BakeResultData> {
    return await invoke('bake_thickness_map', {
      mesh,
      settings
    });
  }

  /**
   * Bake position map
   */
  async bakePositionMap(
    mesh: BakeMeshData,
    settings: BakeSettingsData
  ): Promise<BakeResultData> {
    return await invoke('bake_position_map', {
      mesh,
      settings
    });
  }

  /**
   * Bake material ID map
   */
  async bakeIDMap(
    mesh: BakeMeshData,
    materialIds: number[],
    settings: BakeSettingsData
  ): Promise<BakeResultData> {
    return await invoke('bake_id_map', {
      mesh,
      materialIds,
      settings
    });
  }

  /**
   * Batch bake multiple map types
   */
  async bakeBatch(
    highPoly: BakeMeshData | null,
    lowPoly: BakeMeshData,
    mapTypes: string[],
    settings: BakeSettingsData
  ): Promise<Array<[string, BakeResultData]>> {
    return await invoke('bake_batch', {
      highPoly,
      lowPoly,
      mapTypes,
      settings
    });
  }

  /**
   * Generate cage mesh with uniform extrusion
   */
  async generateCage(
    mesh: BakeMeshData,
    extrusion: number
  ): Promise<BakeMeshData> {
    return await invoke('generate_cage', {
      mesh,
      extrusion
    });
  }

  /**
   * Generate cage mesh with adaptive extrusion
   */
  async generateCageAdaptive(
    mesh: BakeMeshData,
    minExtrusion: number,
    maxExtrusion: number
  ): Promise<BakeMeshData> {
    return await invoke('generate_cage_adaptive', {
      mesh,
      minExtrusion,
      maxExtrusion
    });
  }

  /**
   * Validate cage mesh
   */
  async validateCage(
    mesh: BakeMeshData,
    cage: BakeMeshData
  ): Promise<{ valid: boolean; issues: string[] }> {
    const [valid, issues] = await invoke<[boolean, string[]]>('validate_cage', {
      mesh,
      cage
    });
    return { valid, issues };
  }

  /**
   * Calculate recommended extrusion distance
   */
  async calculateRecommendedExtrusion(
    mesh: BakeMeshData
  ): Promise<number> {
    return await invoke('calculate_recommended_extrusion', {
      mesh
    });
  }
}

// Singleton instance
export const bakeClient = new BakeClient();
