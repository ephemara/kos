/**
 * MaskTypes.ts
 * 
 * Universal type definitions for the masking system.
 * Supports procedural masking based on curvature, height, slope, and custom criteria.
 */

import * as THREE from 'three';

/**
 * Base mask configuration interface
 */
export interface MaskConfig {
  /** Type of mask to generate */
  type: 'curvature' | 'height' | 'slope' | 'custom';
  
  /** Mask strength (0.0 to 1.0) */
  strength: number;
  
  /** Invert the mask */
  invert: boolean;
  
  /** Feather/blur amount (0.0 to 1.0) */
  feather: number;
}

/**
 * Curvature-based mask configuration
 * Masks based on surface curvature (edges vs cavities)
 */
export interface CurvatureMaskConfig extends MaskConfig {
  type: 'curvature';
  
  /** Curvature detection mode */
  mode: 'edge' | 'cavity';
  
  /** Curvature threshold (0.0 to 1.0) */
  threshold: number;
}

/**
 * Height-based mask configuration
 * Masks based on world-space Y position
 */
export interface HeightMaskConfig extends MaskConfig {
  type: 'height';
  
  /** Minimum height value */
  minHeight: number;
  
  /** Maximum height value */
  maxHeight: number;
  
  /** Gradient falloff at boundaries */
  falloff: number;
}

/**
 * Slope-based mask configuration
 * Masks based on surface normal direction
 */
export interface SlopeMaskConfig extends MaskConfig {
  type: 'slope';
  
  /** Slope direction to mask */
  direction: 'up' | 'down' | 'horizontal';
  
  /** Angle threshold in degrees (0-90) */
  angle: number;
  
  /** Angle tolerance/falloff */
  tolerance: number;
}

/**
 * Custom mask configuration
 * Allows for arbitrary mask generation via custom shader or function
 */
export interface CustomMaskConfig extends MaskConfig {
  type: 'custom';
  
  /** Custom shader code or function */
  generator: string | ((uv: THREE.Vector2, position: THREE.Vector3, normal: THREE.Vector3) => number);
  
  /** Custom uniforms for shader-based masks */
  uniforms?: Record<string, { value: any }>;
}

/**
 * Union type for all mask configurations
 */
export type AnyMaskConfig = CurvatureMaskConfig | HeightMaskConfig | SlopeMaskConfig | CustomMaskConfig;

/**
 * Mask blend operation
 */
export type MaskBlendMode = 'add' | 'multiply' | 'subtract' | 'screen' | 'overlay' | 'min' | 'max';

/**
 * Combined mask configuration
 * Allows combining multiple masks with blend operations
 */
export interface CombinedMaskConfig {
  /** Array of mask configurations to combine */
  masks: AnyMaskConfig[];
  
  /** Blend mode for combining masks */
  blendMode: MaskBlendMode;
  
  /** Overall strength multiplier */
  strength: number;
}

/**
 * Baked mask maps
 * Pre-computed maps used for mask generation
 */
export interface BakedMaskMaps {
  /** Curvature map (R=convex/edges, G=concave/cavities) */
  curvatureMap?: THREE.Texture;
  
  /** Normal map (world-space normals) */
  normalMap?: THREE.Texture;
  
  /** Position map (world-space positions) */
  positionMap?: THREE.Texture;
  
  /** Ambient occlusion map */
  aoMap?: THREE.Texture;
}

/**
 * Mask generation parameters
 */
export interface MaskGenerationParams {
  /** Mesh to generate mask for */
  mesh: THREE.Mesh;
  
  /** Mask configuration */
  config: AnyMaskConfig | CombinedMaskConfig;
  
  /** Pre-baked maps (optional, will be generated if not provided) */
  bakedMaps?: BakedMaskMaps;
  
  /** Resolution for generated mask texture */
  resolution?: number;
  
  /** WebGL renderer for GPU operations */
  renderer: THREE.WebGLRenderer;
}

/**
 * Mask generation result
 */
export interface MaskGenerationResult {
  /** Generated mask texture */
  maskTexture: THREE.Texture;
  
  /** Baked maps used for generation */
  bakedMaps: BakedMaskMaps;
  
  /** Generation time in milliseconds */
  timeMs: number;
}

/**
 * Mask paint parameters (for interactive masking)
 */
export interface MaskPaintParams {
  /** Brush center in world space */
  center: THREE.Vector3;
  
  /** Brush radius */
  radius: number;
  
  /** Paint intensity (-1.0 to remove, +1.0 to add) */
  intensity: number;
  
  /** Falloff curve (0.0 = hard, 1.0 = smooth) */
  falloff: number;
}

/**
 * Mask operation result
 */
export interface MaskOperationResult {
  /** Modified vertex indices */
  modifiedIndices: number[];
  
  /** New mask values */
  newValues: number[];
  
  /** Operation time in milliseconds */
  timeMs: number;
}
