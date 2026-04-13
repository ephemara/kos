/**
 * UNIVERSAL BRUSH TYPES
 * 
 * Unified type definitions for all brush systems across 2D and 3D applications.
 * This is the single source of truth for brush interfaces, supporting:
 * - 3D sculpting brushes (mesh deformation)
 * - 2D painting brushes (canvas/texture painting)
 * - Terrain brushes (heightmap editing)
 * - Procedural brushes (noise-based, algorithmic)
 * - Alpha brushes (stamp-based with textures)
 * 
 * @module BrushTypes
 */

import * as THREE from 'three';

// ============================================================================
// CORE BRUSH TYPES
// ============================================================================

/**
 * Brush dimension - determines which engine handles the brush
 */
export type BrushDimension = '2d' | '3d' | 'terrain' | 'universal';

/**
 * Brush category for organization
 */
export type BrushCategory = 
  | 'standard'      // Classic brushes (clay, draw, smooth)
  | 'simulation'    // Physics-based (fluid, erosion, gravity)
  | 'procedural'    // Noise-based (perlin, voronoi, fbm)
  | 'alpha'         // Stamp-based with alpha textures
  | 'paint'         // Color painting brushes
  | 'sculpt'        // Mesh deformation brushes
  | 'terrain'       // Heightmap editing brushes
  | 'experimental'; // Cutting-edge experimental brushes

/**
 * Brush operation mode
 */
export type BrushMode =
  | 'add'           // Add material/height
  | 'subtract'      // Remove material/height
  | 'smooth'        // Smooth/relax
  | 'flatten'       // Flatten to plane
  | 'grab'          // Move/grab vertices
  | 'pinch'         // Pinch/pull
  | 'paint'         // Apply color/texture
  | 'smudge'        // Blend/smudge colors
  | 'clone'         // Clone from source
  | 'fill'          // Flood fill
  | 'noise'         // Add noise
  | 'custom';       // Custom operation

/**
 * Symmetry modes for brush strokes
 */
export type SymmetryMode = 
  | 'NONE'          // No symmetry
  | 'X'             // Mirror across X axis
  | 'Y'             // Mirror across Y axis
  | 'Z'             // Mirror across Z axis
  | 'RADIAL';       // Radial symmetry

/**
 * Blend modes for painting
 */
export type BlendMode =
  | 'normal'        // Standard alpha blend
  | 'multiply'      // Darken blend
  | 'add'           // Additive blend
  | 'overlay'       // Contrast blend
  | 'screen'        // Light blend
  | 'erase';        // Erase/subtract

// ============================================================================
// ALPHA TEXTURE SYSTEM
// ============================================================================

/**
 * Handle to a loaded alpha texture in the GPU pool
 */
export type AlphaHandle = number;

/**
 * Source of an alpha texture
 */
export type AlphaSource =
  | { File: { path: string } }
  | { Embedded: { id: string } }
  | { Procedural: { generator: string; params: Record<string, number> } };

/**
 * Alpha texture information
 */
export interface AlphaInfo {
  /** GPU handle for the alpha texture */
  handle: AlphaHandle;
  /** Display name */
  name: string;
  /** Texture width in pixels */
  width: number;
  /** Texture height in pixels */
  height: number;
  /** Source of the alpha texture */
  source: AlphaSource;
  /** Base64-encoded PNG preview thumbnail (data URI) */
  preview?: string;
}

/**
 * Types of procedural alphas
 */
export type ProceduralAlphaType =
  | 'radial'        // Soft brush falloff
  | 'circle'        // Hard circle
  | 'square'        // Square shape
  | 'diamond'       // Diamond shape
  | 'perlin'        // Perlin noise (organic)
  | 'voronoi'       // Voronoi cells (scales, cracks)
  | 'bricks'        // Brick/tile pattern
  | 'dots'          // Dot pattern
  | 'fbm'           // Fractional Brownian Motion
  | 'turbulence'    // Turbulence noise
  | 'cellular';     // Cellular/worley noise

/**
 * Alpha tiling mode
 */
export type AlphaTiling = 'none' | 'repeat' | 'mirror';

// ============================================================================
// CORE BRUSH PARAMETERS
// ============================================================================

/**
 * Universal brush parameters shared across all brush types
 */
export interface BaseBrushParams {
  // Core settings
  /** Brush size (world units or pixels depending on context) */
  size: number;
  /** Brush strength/intensity (0-1) */
  strength: number;
  /** Brush opacity (0-1) */
  opacity: number;
  /** Brush hardness/falloff (0-1) */
  hardness: number;
  /** Spacing between dabs as percentage of size (0-1) */
  spacing: number;
  /** Flow/accumulation rate (0-1) */
  flow: number;

  // Alpha texture
  /** Alpha texture for intensity modulation */
  alpha: AlphaInfo | null;
  /** Alpha rotation in degrees */
  alphaRotation: number;
  /** Alpha scale multiplier */
  alphaScale: number;
  /** Alpha tiling mode */
  alphaTiling: AlphaTiling;

  // Dynamics (jitter/randomness)
  /** Size jitter (0-1) */
  sizeJitter: number;
  /** Rotation jitter (0-1) */
  rotationJitter: number;
  /** Position scatter amount (0-1) */
  scatterAmount: number;
  /** Strength jitter (0-1) */
  strengthJitter: number;

  // Symmetry
  /** Symmetry mode */
  symmetry: SymmetryMode;
  /** Number of radial segments (for RADIAL symmetry) */
  radialSegments?: number;

  // Blend mode
  /** Blend mode for painting operations */
  blendMode: BlendMode;
}

/**
 * Default brush parameters
 */
export const DEFAULT_BRUSH_PARAMS: BaseBrushParams = {
  size: 0.1,
  strength: 0.6,
  opacity: 1.0,
  hardness: 0.5,
  spacing: 0.25,
  flow: 1.0,
  alpha: null,
  alphaRotation: 0,
  alphaScale: 1.0,
  alphaTiling: 'none',
  sizeJitter: 0,
  rotationJitter: 0,
  scatterAmount: 0,
  strengthJitter: 0,
  symmetry: 'NONE',
  radialSegments: 4,
  blendMode: 'normal',
};

// ============================================================================
// 3D SCULPTING BRUSH PARAMETERS
// ============================================================================

/**
 * 3D sculpting-specific brush parameters
 */
export interface Sculpt3DBrushParams extends BaseBrushParams {
  /** Brush mode/operation */
  mode: BrushMode;
  /** Only affect front-facing polygons */
  frontFacesOnly: boolean;
  /** Accumulate strokes (vs. single application) */
  accumulate: boolean;
  /** Invert operation (e.g., subtract instead of add) */
  invert: boolean;
  /** Use GPU acceleration if available */
  useGpu: boolean;
  /** Flatten plane normal (for flatten brush) */
  flattenNormal?: THREE.Vector3;
  /** Flatten plane height (for flatten brush) */
  flattenHeight?: number;
}

// ============================================================================
// 2D PAINTING BRUSH PARAMETERS
// ============================================================================

/**
 * 2D painting-specific brush parameters
 */
export interface Paint2DBrushParams extends BaseBrushParams {
  /** Brush color (hex string) */
  color: string;
  /** Brush mode/operation */
  mode: BrushMode;
  /** Simulate pressure sensitivity */
  simulatePressure: boolean;
  /** Smoothing factor for stroke interpolation (0-1) */
  smoothing: number;
  /** Streamline factor for stroke stabilization (0-1) */
  streamline: number;
  /** Thinning factor for pressure response (0-1) */
  thinning: number;
  /** Clone source position (for clone brush) */
  cloneSource?: { x: number; y: number };
}

// ============================================================================
// TERRAIN BRUSH PARAMETERS
// ============================================================================

/**
 * Terrain sculpting-specific brush parameters
 */
export interface TerrainBrushParams extends BaseBrushParams {
  /** Brush position in UV space (0-1) */
  position: THREE.Vector2;
  /** Brush mode/operation */
  mode: BrushMode;
  /** Noise seed for procedural brushes */
  noiseSeed?: number;
  /** Noise scale for procedural brushes */
  noiseScale?: number;
  /** Noise octaves for procedural brushes */
  noiseOctaves?: number;
  /** Erosion type (for erosion brushes) */
  erosionType?: 'hydraulic' | 'thermal' | 'wind';
}

// ============================================================================
// PBR PAINTING PARAMETERS
// ============================================================================

/**
 * PBR channel painting parameters (for 3D texture painting)
 */
export interface PBRPaintParams extends BaseBrushParams {
  /** Base color (albedo) */
  color: string;
  /** Roughness value (0-1) */
  roughness: number;
  /** Metalness value (0-1) */
  metalness: number;
  /** Emission intensity (0-1) */
  emission: number;
  /** Emission color (RGB) */
  emissionColor: [number, number, number];
  /** Height/displacement value */
  height: number;
  /** Active PBR channels to paint */
  activeChannels: {
    albedo: boolean;
    normal: boolean;
    roughness: boolean;
    metalness: boolean;
    emission: boolean;
    height: boolean;
    ao: boolean;
  };
  /** Smart masking parameters */
  smartMask?: {
    edge: number;      // Edge detection strength (0-1)
    slope: number;     // Slope-based masking (0-1)
    height: number;    // Height-based masking (0-1)
    curvature: number; // Curvature-based masking (0-1)
  };
  /** Distance-based size scaling */
  distanceScale: boolean;
  /** Seamless painting mode */
  isSeamless: boolean;
  /** Projection mode (BVH raycasting) */
  projectionMode: boolean;
}

// ============================================================================
// BRUSH STROKE DATA
// ============================================================================

/**
 * Single point in a brush stroke
 */
export interface BrushStrokePoint {
  /** Position (2D: x,y in canvas space; 3D: x,y,z in world space) */
  position: THREE.Vector2 | THREE.Vector3;
  /** Surface normal at this point (3D only) */
  normal?: THREE.Vector3;
  /** Pressure value (0-1) from input device */
  pressure: number;
  /** Timestamp of this point */
  timestamp: number;
  /** Tilt angle (for stylus input) */
  tilt?: number;
  /** Rotation angle (for stylus input) */
  rotation?: number;
}

/**
 * Complete brush stroke data
 */
export interface BrushStroke {
  /** Unique stroke identifier */
  id: string;
  /** Brush parameters used for this stroke */
  params: BaseBrushParams | Sculpt3DBrushParams | Paint2DBrushParams | TerrainBrushParams;
  /** Points in the stroke */
  points: BrushStrokePoint[];
  /** Stroke start time */
  startTime: number;
  /** Stroke end time */
  endTime?: number;
  /** Whether stroke is complete */
  isComplete: boolean;
}

// ============================================================================
// BRUSH DEFINITION
// ============================================================================

/**
 * Brush definition for brush library/presets
 */
export interface BrushDefinition {
  /** Unique brush identifier */
  id: string;
  /** Display name */
  name: string;
  /** Brush category */
  category: BrushCategory;
  /** Brush dimension */
  dimension: BrushDimension;
  /** Icon component (Lucide icon) */
  icon?: any;
  /** Keyboard shortcut */
  key?: string;
  /** Description */
  description?: string;
  /** Tags for search/filtering */
  tags: string[];
  /** Default parameters */
  defaultParams: Partial<BaseBrushParams>;
  /** Brush kernel/shader family (for GPU brushes) */
  kernel?: {
    family: string;
    shader: string;
  };
  /** Preview thumbnail URL */
  thumbnail?: string;
}

// ============================================================================
// BRUSH ENGINE INTERFACE
// ============================================================================

/**
 * Interface for brush engines (2D, 3D, terrain)
 */
export interface IBrushEngine {
  /** Initialize the brush engine */
  init(): Promise<void>;
  
  /** Start a new brush stroke */
  startStroke(params: BaseBrushParams, point: BrushStrokePoint): void;
  
  /** Continue brush stroke with new point */
  continueStroke(point: BrushStrokePoint): void;
  
  /** End current brush stroke */
  endStroke(): void;
  
  /** Apply a complete stroke */
  applyStroke(stroke: BrushStroke): Promise<void>;
  
  /** Get current brush parameters */
  getParams(): BaseBrushParams;
  
  /** Update brush parameters */
  setParams(params: Partial<BaseBrushParams>): void;
  
  /** Dispose of resources */
  dispose(): void;
}

// ============================================================================
// BRUSH RESULT
// ============================================================================

/**
 * Result of a brush operation
 */
export interface BrushResult {
  /** Modified vertex/pixel indices */
  modifiedIndices: Uint32Array | number[];
  /** New position/color data */
  newData: Float32Array | number[];
  /** New normals (3D only) */
  newNormals?: Float32Array | number[];
  /** Normal indices (3D only) */
  normalIndices?: Uint32Array | number[];
  /** Number of affected elements */
  affectedCount: number;
  /** Operation time in milliseconds */
  timeMs: number;
  /** Whether GPU was used */
  usedGpu: boolean;
  /** GPU fallback reason (if GPU failed) */
  gpuFallbackReason?: string;
}

// ============================================================================
// BRUSH CURSOR
// ============================================================================

/**
 * Brush cursor visualization parameters
 */
export interface BrushCursor {
  /** Cursor position */
  position: THREE.Vector2 | THREE.Vector3;
  /** Cursor radius */
  radius: number;
  /** Cursor color */
  color: THREE.Color;
  /** Cursor opacity */
  opacity: number;
  /** Whether cursor is visible */
  visible: boolean;
  /** Surface normal (3D only) */
  normal?: THREE.Vector3;
}
