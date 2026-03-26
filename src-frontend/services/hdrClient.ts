// HDR Capture Service Client
// TypeScript interface for HDR operations via Tauri IPC

import { invoke } from '@tauri-apps/api/core';

export interface LightData {
  lightType: 'point' | 'directional' | 'area';
  position: [number, number, number];
  direction: [number, number, number];
  intensity: number;
  colorTemperature: number;
  areaWidth?: number;
  areaHeight?: number;
}

export interface ExposureData {
  imageData: Uint8Array;
  exposureValue: number;
}

export interface HDRMergeRequest {
  exposures: ExposureData[];
  width: number;
  height: number;
}

export interface HDRImageData {
  width: number;
  height: number;
  format: 'rgbe' | 'exr';
}

export type ToneMappingMethod = 'reinhard' | 'filmic' | 'aces' | 'uncharted2';

/**
 * HDR Capture Client
 * Provides interface to HDR capture, merging, tone mapping, and light authoring
 */
export class HDRClient {
  /**
   * Merge multiple exposures into HDR image
   * @param request - Merge request with exposures and dimensions
   * @returns Path to saved HDR file
   */
  async mergeExposures(request: HDRMergeRequest): Promise<string> {
    try {
      // Convert Uint8Arrays to regular arrays for IPC
      const serializedRequest = {
        exposures: request.exposures.map(e => ({
          image_data: Array.from(e.imageData),
          exposure_value: e.exposureValue,
        })),
        width: request.width,
        height: request.height,
      };

      const path = await invoke<string>('hdr_merge_exposures', {
        request: serializedRequest,
      });

      return path;
    } catch (error) {
      throw new Error(`HDR merge failed: ${error}`);
    }
  }

  /**
   * Apply tone mapping to HDR image for display
   * @param hdrPath - Path to HDR file
   * @param method - Tone mapping method
   * @returns LDR image data (RGB, 8-bit per channel)
   */
  async toneMap(hdrPath: string, method: ToneMappingMethod): Promise<Uint8Array> {
    try {
      const data = await invoke<number[]>('hdr_tone_map', {
        hdrPath,
        method,
      });

      return new Uint8Array(data);
    } catch (error) {
      throw new Error(`Tone mapping failed: ${error}`);
    }
  }

  /**
   * Add light to HDR environment
   * @param hdrPath - Path to HDR file
   * @param light - Light configuration
   * @returns Path to modified HDR file
   */
  async addLight(hdrPath: string, light: LightData): Promise<string> {
    try {
      // Convert to snake_case for Rust
      const lightData = {
        light_type: light.lightType,
        position: light.position,
        direction: light.direction,
        intensity: light.intensity,
        color_temperature: light.colorTemperature,
        area_width: light.areaWidth,
        area_height: light.areaHeight,
      };

      const path = await invoke<string>('hdr_add_light', {
        hdrPath,
        lightData,
      });

      return path;
    } catch (error) {
      throw new Error(`Add light failed: ${error}`);
    }
  }

  /**
   * Convert 360° panorama to HDR
   * @param imageData - LDR panorama image data
   * @param width - Image width
   * @param height - Image height
   * @returns Path to HDR file
   */
  async panoramaToHDR(
    imageData: Uint8Array,
    width: number,
    height: number
  ): Promise<string> {
    try {
      const path = await invoke<string>('hdr_panorama_to_hdr', {
        imageData: Array.from(imageData),
        width,
        height,
      });

      return path;
    } catch (error) {
      throw new Error(`Panorama conversion failed: ${error}`);
    }
  }

  /**
   * Save HDR image to file
   * @param hdrPath - Source HDR path
   * @param outputPath - Destination path (.hdr or .exr)
   */
  async save(hdrPath: string, outputPath: string): Promise<void> {
    try {
      await invoke('hdr_save', {
        hdrPath,
        outputPath,
      });
    } catch (error) {
      throw new Error(`HDR save failed: ${error}`);
    }
  }

  /**
   * Load HDR image metadata
   * @param path - Path to HDR file
   * @returns HDR image metadata
   */
  async load(path: string): Promise<HDRImageData> {
    try {
      const data = await invoke<HDRImageData>('hdr_load', { path });
      return data;
    } catch (error) {
      throw new Error(`HDR load failed: ${error}`);
    }
  }

  /**
   * Create point light
   */
  createPointLight(
    position: [number, number, number],
    intensity: number,
    colorTemperature: number = 6500
  ): LightData {
    return {
      lightType: 'point',
      position,
      direction: [0, 0, 0],
      intensity,
      colorTemperature,
    };
  }

  /**
   * Create directional light (sun)
   */
  createDirectionalLight(
    direction: [number, number, number],
    intensity: number,
    colorTemperature: number = 6500
  ): LightData {
    return {
      lightType: 'directional',
      position: [0, 0, 0],
      direction,
      intensity,
      colorTemperature,
    };
  }

  /**
   * Create area light
   */
  createAreaLight(
    position: [number, number, number],
    direction: [number, number, number],
    width: number,
    height: number,
    intensity: number,
    colorTemperature: number = 6500
  ): LightData {
    return {
      lightType: 'area',
      position,
      direction,
      intensity,
      colorTemperature,
      areaWidth: width,
      areaHeight: height,
    };
  }
}

// Singleton instance
export const hdrClient = new HDRClient();

// Helper functions for common operations

/**
 * Merge bracketed exposures with standard EV spacing
 * @param images - Array of image data (LDR)
 * @param baseEV - Base exposure value
 * @param evStep - EV step between exposures
 * @param width - Image width
 * @param height - Image height
 */
export async function mergeBracketedExposures(
  images: Uint8Array[],
  baseEV: number,
  evStep: number,
  width: number,
  height: number
): Promise<string> {
  const exposures: ExposureData[] = images.map((imageData, index) => ({
    imageData,
    exposureValue: baseEV + (index - Math.floor(images.length / 2)) * evStep,
  }));

  return hdrClient.mergeExposures({
    exposures,
    width,
    height,
  });
}

/**
 * Create studio lighting setup
 * @param hdrPath - Path to HDR environment
 * @returns Path to lit HDR
 */
export async function createStudioLighting(hdrPath: string): Promise<string> {
  // Key light (main light)
  const keyLight = hdrClient.createAreaLight(
    [2, 3, 2],
    [-1, -1, -1],
    2.0,
    2.0,
    5000,
    5500
  );

  let litPath = await hdrClient.addLight(hdrPath, keyLight);

  // Fill light (softer, opposite side)
  const fillLight = hdrClient.createAreaLight(
    [-2, 2, 2],
    [1, -1, -1],
    3.0,
    3.0,
    2000,
    6500
  );

  litPath = await hdrClient.addLight(litPath, fillLight);

  // Rim light (back light for edge definition)
  const rimLight = hdrClient.createPointLight([0, 2, -3], 3000, 7000);

  litPath = await hdrClient.addLight(litPath, rimLight);

  return litPath;
}

/**
 * Create outdoor lighting (sun + sky)
 * @param hdrPath - Path to HDR environment
 * @param sunDirection - Sun direction vector
 * @returns Path to lit HDR
 */
export async function createOutdoorLighting(
  hdrPath: string,
  sunDirection: [number, number, number] = [0.3, -0.8, 0.5]
): Promise<string> {
  // Sun (directional light)
  const sun = hdrClient.createDirectionalLight(sunDirection, 100000, 5800);

  return hdrClient.addLight(hdrPath, sun);
}
