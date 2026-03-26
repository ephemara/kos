/**
 * PBR Texture Generator Client
 * TypeScript bindings for Rust-accelerated PBR map generation
 * 
 * Two modes:
 * - CPU (Rust + Rayon): ~200-500ms for 2K textures
 * - GPU (WGPU Compute): ~10-20ms for 2K textures (50x faster!)
 */

import { invoke } from '@tauri-apps/api/core';

// ============================================================================
// TYPES - CPU (Rust + Rayon)
// ============================================================================

export interface PbrParams {
    // Normal map
    normal_strength: number;

    // Roughness
    roughness_brightness: number;
    roughness_contrast: number;
    roughness_invert: boolean;

    // Metallic
    metal_bias: number;
    metal_contrast: number;

    // Effects
    dust: number;
    grunge: number;
    scratches: number;
    noise: number;
    edge_wear: number;
    cavity_dirt: number;

    // Post-processing
    brightness: number;
    contrast: number;
    gamma: number;
    chromatic: number;
    make_seamless: boolean;
}

export interface PbrMapSet {
    base: string | null;
    normal: string | null;
    roughness: string | null;
    metallic: string | null;
    ao: string | null;
    height: string | null;
    emissive: string | null;
    time_ms: number;
}

// ============================================================================
// TYPES - GPU (WGPU Compute) 🚀
// ============================================================================

export interface GpuPbrParams {
    // Normal map
    normal_strength?: number;

    // Roughness
    roughness_base?: number;        // 0-1, base roughness value
    roughness_contrast?: number;
    roughness_invert?: boolean;

    // Metallic
    metallic_base?: number;         // 0-1, base metallic value
    metallic_contrast?: number;

    // Advanced effects (GPU-accelerated!)
    edge_wear?: number;             // 0-1, expose metal at edges
    cavity_dirt?: number;           // 0-1, darken cavities
    dust?: number;                  // 0-1, add dust to roughness
    grunge?: number;                // 0-1, procedural grunge

    // AO
    ao_intensity?: number;          // 0-1, AO strength
    ao_radius?: number;             // Pixel radius for AO sampling

    // Height
    height_contrast?: number;

    // Emissive
    emissive_threshold?: number;    // 0-1, brightness threshold for glow

    // Seamless
    make_seamless?: boolean;
    seamless_blend?: number;        // 0-1, edge blend size
}

export interface GpuPbrResult {
    base: string;           // Processed base (seamless if enabled)
    normal: string;
    roughness: string;
    metallic: string;
    ao: string;
    height: string;
    curvature: string;      // NEW: for edge wear visualization
    emissive: string | null;
    time_ms: number;
}

// ============================================================================
// DEFAULT PARAMS
// ============================================================================

export const DEFAULT_PBR_PARAMS: PbrParams = {
    normal_strength: 1.0,
    roughness_brightness: 0.0,
    roughness_contrast: 1.0,
    roughness_invert: false,
    metal_bias: 0.0,
    metal_contrast: 1.0,
    dust: 0.0,
    grunge: 0.0,
    scratches: 0.0,
    noise: 0.0,
    edge_wear: 0.0,
    cavity_dirt: 0.0,
    brightness: 1.0,
    contrast: 1.0,
    gamma: 1.0,
    chromatic: 0.0,
    make_seamless: false,
};

export const DEFAULT_GPU_PBR_PARAMS: GpuPbrParams = {
    normal_strength: 1.0,
    roughness_base: 0.5,
    roughness_contrast: 1.0,
    roughness_invert: false,
    metallic_base: 0.0,
    metallic_contrast: 1.0,
    edge_wear: 0.0,
    cavity_dirt: 0.0,
    dust: 0.0,
    grunge: 0.0,
    ao_intensity: 0.8,
    ao_radius: 8.0,
    height_contrast: 1.0,
    emissive_threshold: 0.0,
    make_seamless: false,
    seamless_blend: 0.15,
};

// ============================================================================
// CPU API (Rust + Rayon)
// ============================================================================

/**
 * Check if Rust PBR backend is available
 */
export async function isAvailable(): Promise<boolean> {
    try {
        await invoke('generate_normal_map', {
            imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            strength: 1.0
        });
        return true;
    } catch {
        return false;
    }
}

/**
 * Generate all PBR maps from a base image (CPU)
 * @param imageBase64 Base64-encoded source image (PNG or JPEG)
 * @param params PBR generation parameters
 * @returns PbrMapSet with all generated maps as base64 data URLs
 */
export async function generatePbrMaps(
    imageBase64: string,
    params: Partial<PbrParams> = {}
): Promise<PbrMapSet> {
    const fullParams: PbrParams = { ...DEFAULT_PBR_PARAMS, ...params };

    return await invoke<PbrMapSet>('generate_pbr_maps', {
        imageBase64,
        params: fullParams,
    });
}

/**
 * Generate just a normal map (faster for preview)
 * @param imageBase64 Base64-encoded source image
 * @param strength Normal map intensity
 * @returns Base64 data URL of the normal map
 */
export async function generateNormalMap(
    imageBase64: string,
    strength: number = 1.0
): Promise<string> {
    return await invoke<string>('generate_normal_map', {
        imageBase64,
        strength,
    });
}

// ============================================================================
// GPU API (WGPU Compute) 🚀 50x FASTER!
// ============================================================================

/**
 * Check if GPU PBR backend is available
 */
export async function isGpuAvailable(): Promise<boolean> {
    try {
        await invoke('gpu_pbr_benchmark', { width: 64, height: 64 });
        return true;
    } catch {
        return false;
    }
}

/**
 * Generate all PBR maps using GPU compute (50x faster!)
 * @param imageBase64 Base64-encoded source image (PNG or JPEG)
 * @param params GPU PBR generation parameters
 * @returns GpuPbrResult with all generated maps as base64 data URLs
 */
export async function generatePbrMapsGpu(
    imageBase64: string,
    params: GpuPbrParams = {}
): Promise<GpuPbrResult> {
    const fullParams: GpuPbrParams = { ...DEFAULT_GPU_PBR_PARAMS, ...params };

    return await invoke<GpuPbrResult>('gpu_pbr_generate', {
        imageBase64,
        params: fullParams,
    });
}

/**
 * Benchmark GPU PBR generation with synthetic test image
 * @param width Test image width (default 1024)
 * @param height Test image height (default 1024)
 * @returns GpuPbrResult with timing info
 */
export async function benchmarkGpuPbr(
    width: number = 1024,
    height: number = 1024
): Promise<GpuPbrResult> {
    return await invoke<GpuPbrResult>('gpu_pbr_benchmark', { width, height });
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export const rustPbr = {
    isAvailable,
    generatePbrMaps,
    generateNormalMap,
    DEFAULT_PARAMS: DEFAULT_PBR_PARAMS,
};

export const gpuPbr = {
    isAvailable: isGpuAvailable,
    generate: generatePbrMapsGpu,
    benchmark: benchmarkGpuPbr,
    DEFAULT_PARAMS: DEFAULT_GPU_PBR_PARAMS,
};

export default rustPbr;

