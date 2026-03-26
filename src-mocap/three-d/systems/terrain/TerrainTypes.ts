/**
 * TERRAIN SYSTEM TYPES
 * 
 * Universal type definitions for terrain generation, simulation, and rendering.
 * Extracted from Tecton feature for use across any terrain-based application.
 * 
 * @module TerrainTypes
 */

import * as THREE from 'three';

/**
 * Core terrain configuration
 */
export interface TerrainConfig {
  /** Heightmap resolution (width and height in pixels) */
  resolution: number;
  /** Physical size in world units (X axis) */
  sizeX: number;
  /** Physical size in world units (Z axis) */
  sizeZ: number;
  /** Height multiplier for displacement */
  heightScale: number;
  /** Random seed for procedural generation */
  seed?: number;
}

/**
 * Heightmap data structure
 */
export interface HeightmapData {
  /** Float32Array containing RGBA heightmap data (R channel = height) */
  data: Float32Array;
  /** Width of heightmap in pixels */
  width: number;
  /** Height of heightmap in pixels */
  height: number;
  /** Minimum height value in the data */
  minHeight?: number;
  /** Maximum height value in the data */
  maxHeight?: number;
}

/**
 * Procedural noise generation parameters
 */
export interface NoiseParams {
  /** Number of noise octaves for detail */
  octaves: number;
  /** Amplitude decay per octave (0-1) */
  persistence: number;
  /** Frequency multiplier per octave */
  lacunarity: number;
  /** Overall noise scale/zoom */
  scale: number;
  /** Random seed for noise generation */
  seed: number;
}

/**
 * Hydraulic erosion simulation parameters
 */
export interface HydraulicErosionParams {
  /** Number of simulation steps */
  steps: number;
  /** Water flow speed multiplier */
  flowSpeed: number;
  /** Sediment capacity */
  sedimentCapacity: number;
  /** Erosion strength */
  erosionStrength: number;
  /** Deposition strength */
  depositionStrength: number;
  /** Evaporation rate */
  evaporationRate: number;
}

/**
 * Thermal erosion simulation parameters
 */
export interface ThermalErosionParams {
  /** Number of simulation steps */
  steps: number;
  /** Thermal diffusion rate */
  diffusionRate: number;
  /** Talus angle (slope threshold for erosion) */
  talusAngle: number;
  /** Erosion strength */
  strength: number;
}

/**
 * Magma/lava simulation parameters
 */
export interface MagmaParams {
  /** Flow viscosity (0-1, lower = more fluid) */
  viscosity: number;
  /** Temperature affecting flow */
  temperature: number;
  /** Cooling rate */
  coolingRate: number;
  /** Solidification threshold */
  solidificationThreshold: number;
}

/**
 * Tectonic plate simulation parameters
 */
export interface TectonicParams {
  /** Number of tectonic plates */
  plateCount: number;
  /** Collision strength */
  collisionStrength: number;
  /** Subduction rate */
  subductionRate: number;
  /** Uplift strength */
  upliftStrength: number;
}

/**
 * Combined erosion parameters for all simulation types
 */
export interface ErosionParams {
  /** Hydraulic (water) erosion settings */
  hydraulic?: HydraulicErosionParams;
  /** Thermal (temperature) erosion settings */
  thermal?: ThermalErosionParams;
  /** Magma/lava flow settings */
  magma?: MagmaParams;
  /** Tectonic plate settings */
  tectonic?: TectonicParams;
}

/**
 * Terrain simulation effect types
 */
export enum TerrainEffect {
  /** No effect / stable state */
  ZERO_POINT = 0,
  /** Thermal diffusion */
  THERMAL = 1,
  /** Hydraulic water erosion */
  HYDRAULIC = 2,
  /** Spatial warp distortion */
  WARP = 3,
  /** Tectonic seismic activity */
  TECTONIC = 4,
  /** Geological layering */
  STRATA = 5,
  /** Asteroid impact crater */
  ASTEROID = 6,
}

/**
 * Terrain material properties
 */
export interface TerrainMaterial {
  /** Base color/albedo texture */
  albedoMap?: THREE.Texture;
  /** Whether to use albedo map */
  useAlbedoMap: boolean;
  /** Detail texture scale */
  detailScale: number;
  /** Detail texture strength */
  detailStrength: number;
  /** Material roughness (PBR) */
  roughness: number;
  /** Material metalness (PBR) */
  metalness: number;
  /** Emissive color */
  emissive?: THREE.Color;
}

/**
 * Terrain rendering view modes
 */
export enum TerrainViewMode {
  /** Realistic PBR rendering */
  REALISTIC = 0,
  /** Neon/wireframe analysis */
  NEON = 1,
  /** Height-based heatmap */
  HEATMAP = 2,
  /** Contour lines */
  CONTOUR = 3,
}

/**
 * Terrain layer for multi-layer terrain systems
 */
export interface TerrainLayer {
  /** Unique layer identifier */
  id: string;
  /** Layer display name */
  name: string;
  /** Layer visibility */
  visible: boolean;
  /** Layer opacity (0-1) */
  opacity: number;
  /** Heightmap data for this layer */
  heightmap: HeightmapData;
  /** Blend mode with layers below */
  blendMode: 'normal' | 'add' | 'multiply' | 'overlay';
  /** Layer order (higher = on top) */
  order: number;
}

/**
 * Terrain sculpting brush parameters
 */
export interface TerrainBrushParams {
  /** Brush position in UV space (0-1) */
  position: THREE.Vector2;
  /** Brush radius in UV space */
  radius: number;
  /** Brush strength/intensity */
  strength: number;
  /** Sculpt mode/operation */
  mode: TerrainSculptMode;
  /** Random noise seed for procedural brushes */
  noiseSeed?: number;
}

/**
 * Terrain sculpting modes
 */
export enum TerrainSculptMode {
  /** Raise terrain */
  RAISE = 0,
  /** Lower terrain */
  LOWER = 1,
  /** Smooth terrain */
  SMOOTH = 2,
  /** Flatten terrain */
  FLATTEN = 3,
  /** Add noise */
  NOISE = 4,
  /** Pinch/pull */
  PINCH = 5,
  /** Crater/asteroid impact */
  CRATER = 6,
  /** Twist/rotate */
  TWIST = 7,
}

/**
 * Lighting configuration for terrain
 */
export interface TerrainLighting {
  /** Sun direction vector */
  sunDirection: THREE.Vector3;
  /** Sun intensity */
  sunIntensity: number;
  /** Sun azimuth angle (degrees) */
  sunAzimuth: number;
  /** Sun elevation angle (degrees) */
  sunElevation: number;
  /** Ambient light intensity */
  ambientIntensity: number;
  /** Hemisphere light sky color */
  skyColor?: THREE.Color;
  /** Hemisphere light ground color */
  groundColor?: THREE.Color;
  /** Enable shadows */
  castShadows: boolean;
  /** Shadow map resolution */
  shadowMapSize?: number;
}

/**
 * Terrain simulation state
 */
export interface TerrainSimulationState {
  /** Currently active effect */
  activeEffect: TerrainEffect;
  /** Simulation speed multiplier */
  simSpeed: number;
  /** Whether simulation is running */
  isSimulating: boolean;
  /** Current simulation time */
  time: number;
  /** Simulation frame count */
  frameCount: number;
}

/**
 * Terrain history frame for timeline/sequencer
 */
export interface TerrainHistoryFrame {
  /** Frame index */
  index: number;
  /** Heightmap snapshot */
  heightmap: THREE.WebGLRenderTarget;
  /** Active effect at this frame */
  effect: TerrainEffect;
  /** Timestamp */
  timestamp: number;
}

/**
 * Terrain export options
 */
export interface TerrainExportOptions {
  /** Export format */
  format: 'glb' | 'obj' | 'fbx' | 'png' | 'exr';
  /** Include textures */
  includeTextures: boolean;
  /** Include normal map */
  includeNormalMap: boolean;
  /** Mesh resolution (can differ from heightmap) */
  meshResolution?: number;
  /** Texture resolution */
  textureResolution?: number;
  /** Compression quality (0-1) */
  quality?: number;
}

/**
 * Terrain import options
 */
export interface TerrainImportOptions {
  /** Source format */
  format: 'png' | 'jpg' | 'exr' | 'raw';
  /** Target resolution (will resize if needed) */
  targetResolution?: number;
  /** Height scale multiplier */
  heightScale?: number;
  /** Invert height values */
  invert?: boolean;
}

/**
 * Fluid simulation integration parameters
 */
export interface FluidSimulationParams {
  /** Fluid simulation resolution */
  resolution: number;
  /** Velocity decay rate */
  velocityDecay: number;
  /** Pressure iterations */
  pressureIterations: number;
  /** Curl strength (vorticity) */
  curlStrength: number;
  /** Splat radius */
  splatRadius: number;
}

/**
 * Complete terrain system configuration
 */
export interface TerrainSystemConfig {
  /** Core terrain settings */
  terrain: TerrainConfig;
  /** Material properties */
  material: TerrainMaterial;
  /** Lighting setup */
  lighting: TerrainLighting;
  /** Simulation parameters */
  simulation: TerrainSimulationState;
  /** Erosion settings */
  erosion?: ErosionParams;
  /** Fluid simulation settings */
  fluid?: FluidSimulationParams;
  /** View mode */
  viewMode: TerrainViewMode;
}

/**
 * Terrain generation result
 */
export interface TerrainGenerationResult {
  /** Generated heightmap data */
  heightmap: HeightmapData;
  /** Optional albedo/color texture */
  albedoTexture?: THREE.Texture;
  /** Optional normal map */
  normalMap?: THREE.Texture;
  /** Generation metadata */
  metadata: {
    /** Generation method used */
    method: 'procedural' | 'ai' | 'imported';
    /** Generation parameters */
    params: any;
    /** Generation timestamp */
    timestamp: number;
    /** Generation duration (ms) */
    duration?: number;
  };
}

/**
 * Asteroid impact parameters
 */
export interface AsteroidParams {
  /** Impact radius in UV space */
  radius: number;
  /** Impact strength/depth */
  strength: number;
  /** Impact position (auto-generated if not provided) */
  position?: THREE.Vector2;
  /** Ejecta pattern */
  ejectaPattern?: 'radial' | 'directional';
}
