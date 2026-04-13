/**
 * BakingTypes.ts
 * 
 * Type definitions for the real-time baking system.
 * Supports normal maps, curvature maps, AO, and position maps.
 */

import * as THREE from 'three';

/**
 * Baking resolution presets
 * Accepts any number, but common presets are 256, 512, 1024, 2048, 4096
 */
export type BakingResolution = number;

/**
 * Baking quality settings
 */
export type BakingQuality = 'draft' | 'preview' | 'production';

/**
 * Map types that can be baked
 */
export type BakingMapType = 'normal' | 'curvature' | 'ao' | 'position' | 'height' | 'thickness';

/**
 * Configuration for baking operations
 */
export interface BakingConfig {
  /** Resolution of the baked texture */
  resolution: BakingResolution;
  
  /** Quality preset */
  quality: BakingQuality;
  
  /** Whether to use GPU acceleration */
  useGPU: boolean;
  
  /** Number of samples for AO (higher = better quality, slower) */
  aoSamples?: number;
  
  /** AO ray distance */
  aoDistance?: number;
  
  /** Curvature detection sensitivity */
  curvatureSensitivity?: number;
  
  /** Whether to normalize output values */
  normalize?: boolean;
}

/**
 * Result of a baking operation
 */
export interface BakingResult {
  /** The baked texture */
  texture: THREE.Texture;
  
  /** Type of map that was baked */
  mapType: BakingMapType;
  
  /** Resolution of the baked texture */
  resolution: number;
  
  /** Time taken to bake (milliseconds) */
  timeMs: number;
  
  /** Metadata about the baking process */
  metadata: {
    quality: BakingQuality;
    samples?: number;
    gpuAccelerated: boolean;
  };
}

/**
 * Collection of baked maps for a mesh
 */
export interface BakedMapSet {
  /** Normal map (world-space or tangent-space) */
  normalMap?: THREE.Texture;
  
  /** Curvature map (R=convex/edges, G=concave/cavities) */
  curvatureMap?: THREE.Texture;
  
  /** Ambient occlusion map */
  aoMap?: THREE.Texture;
  
  /** Position map (world-space positions) */
  positionMap?: THREE.Texture;
  
  /** Height map */
  heightMap?: THREE.Texture;
  
  /** Thickness map */
  thicknessMap?: THREE.Texture;
  
  /** Metadata */
  metadata: {
    resolution: number;
    quality: BakingQuality;
    timestamp: number;
  };
}

/**
 * Parameters for normal map baking
 */
export interface NormalMapBakingParams {
  /** Target mesh to bake */
  mesh: THREE.Mesh;
  
  /** Resolution of the output texture */
  resolution: BakingResolution;
  
  /** Whether to bake in tangent space (true) or world space (false) */
  tangentSpace: boolean;
  
  /** Optional high-poly mesh for baking from */
  highPolyMesh?: THREE.Mesh;
  
  /** Ray distance for high-to-low baking */
  rayDistance?: number;
}

/**
 * Parameters for curvature map baking
 */
export interface CurvatureMapBakingParams {
  /** Target mesh to bake */
  mesh: THREE.Mesh;
  
  /** Resolution of the output texture */
  resolution: BakingResolution;
  
  /** Sensitivity for edge detection (0-1) */
  sensitivity: number;
  
  /** Whether to separate convex (R) and concave (G) channels */
  separateChannels: boolean;
  
  /** Blur radius for smoothing */
  blurRadius?: number;
}

/**
 * Parameters for ambient occlusion baking
 */
export interface AOBakingParams {
  /** Target mesh to bake */
  mesh: THREE.Mesh;
  
  /** Resolution of the output texture */
  resolution: BakingResolution;
  
  /** Number of samples per pixel */
  samples: number;
  
  /** Maximum ray distance */
  distance: number;
  
  /** Bias to prevent self-shadowing */
  bias: number;
  
  /** Intensity multiplier */
  intensity: number;
  
  /** Whether to use GPU acceleration */
  useGPU: boolean;
}

/**
 * Parameters for position map baking
 */
export interface PositionMapBakingParams {
  /** Target mesh to bake */
  mesh: THREE.Mesh;
  
  /** Resolution of the output texture */
  resolution: BakingResolution;
  
  /** Coordinate space (world or object) */
  space: 'world' | 'object';
  
  /** Whether to normalize positions to [0,1] range */
  normalize: boolean;
}

/**
 * Baking progress callback
 */
export interface BakingProgress {
  /** Current step (e.g., "Preparing geometry", "Sampling", "Finalizing") */
  step: string;
  
  /** Progress percentage (0-100) */
  progress: number;
  
  /** Estimated time remaining (milliseconds) */
  estimatedTimeMs?: number;
}

/**
 * Baking options
 */
export interface BakingOptions {
  /** Progress callback */
  onProgress?: (progress: BakingProgress) => void;
  
  /** Whether to cache the result */
  cache?: boolean;
  
  /** Custom renderer (if not provided, uses default) */
  renderer?: THREE.WebGLRenderer;
  
  /** Whether to dispose intermediate resources */
  autoDispose?: boolean;
}

/**
 * Baking cache entry
 */
export interface BakingCacheEntry {
  /** Cached baked maps */
  maps: BakedMapSet;
  
  /** Mesh UUID */
  meshId: string;
  
  /** Timestamp of when it was cached */
  timestamp: number;
  
  /** Configuration used for baking */
  config: BakingConfig;
}
