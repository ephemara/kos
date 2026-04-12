/**
 * Asset System Types
 * 
 * Defines interfaces for all loadable asset types in the ZenMocap system.
 * ALL content is defined in loadable asset files (data-driven, no hardcoded paths).
 */

/**
 * Base interface for all asset types
 */
export interface AssetMetadata {
  /** Unique identifier for the asset */
  id: string;
  /** Display name */
  name: string;
  /** Asset category for organization */
  category: string;
  /** Optional tags for search and filtering */
  tags?: string[];
  /** Optional description */
  description?: string;
  /** Path to thumbnail image */
  thumbnail?: string;
  /** Author information */
  author?: string;
  /** Version string */
  version?: string;
  /** Creation/modification timestamp */
  timestamp?: number;
}

/**
 * Brush dynamics configuration
 */
export interface BrushDynamics {
  /** Size variation based on pressure (0-1) */
  sizePressure?: number;
  /** Opacity variation based on pressure (0-1) */
  opacityPressure?: number;
  /** Flow variation based on pressure (0-1) */
  flowPressure?: number;
  /** Size variation based on velocity (0-1) */
  sizeVelocity?: number;
  /** Opacity jitter (0-1) */
  opacityJitter?: number;
  /** Size jitter (0-1) */
  sizeJitter?: number;
  /** Rotation jitter (0-360) */
  rotationJitter?: number;
}

/**
 * Brush asset definition (analogous to ZBrush's ZBrushes)
 */
export interface BrushAsset extends AssetMetadata {
  type: 'brush';
  /** Brush type: paint, erase, smudge, blend */
  brushType: 'paint' | 'erase' | 'smudge' | 'blend';
  /** Base size in pixels */
  size: number;
  /** Hardness (0-1, 0=soft, 1=hard) */
  hardness: number;
  /** Spacing between stamps (0-1) */
  spacing: number;
  /** Base opacity (0-1) */
  opacity: number;
  /** Flow rate (0-1) */
  flow: number;
  /** Path to alpha texture or embedded data */
  alphaTexture?: string;
  /** Path to brush texture or embedded data */
  brushTexture?: string;
  /** Brush dynamics configuration */
  dynamics?: BrushDynamics;
  /** Custom parameters for specialized brushes */
  customParams?: Record<string, any>;
}

/**
 * Alpha/texture asset definition (analogous to ZBrush's ZAlphas)
 */
export interface AlphaAsset extends AssetMetadata {
  type: 'alpha';
  /** Path to texture file */
  filePath: string;
  /** Texture resolution */
  resolution: { width: number; height: number };
  /** Texture format */
  format: 'grayscale' | 'rgb' | 'rgba';
  /** Whether texture is tileable */
  tileable: boolean;
  /** Embedded texture data (base64 or binary) */
  embeddedData?: string;
}

/**
 * PBR channel map definition
 */
export interface PBRChannelMap {
  /** Path to texture file or embedded data */
  texture?: string;
  /** Constant value if no texture */
  value?: number | [number, number, number] | [number, number, number, number];
  /** Texture scale/tiling */
  scale?: number;
  /** Texture offset */
  offset?: [number, number];
}

/**
 * Material asset definition (analogous to ZBrush's MatCaps)
 */
export interface MaterialAsset extends AssetMetadata {
  type: 'material';
  /** Base color (RGB) */
  baseColor: [number, number, number];
  /** Metallic value (0-1) */
  metallic: number;
  /** Roughness value (0-1) */
  roughness: number;
  /** Normal map strength (0-2) */
  normalStrength: number;
  /** Ambient occlusion strength (0-1) */
  aoStrength: number;
  /** Height/displacement scale */
  heightScale: number;
  /** PBR channel maps */
  maps?: {
    albedo?: PBRChannelMap;
    normal?: PBRChannelMap;
    roughness?: PBRChannelMap;
    metallic?: PBRChannelMap;
    ao?: PBRChannelMap;
    height?: PBRChannelMap;
  };
  /** Procedural generation parameters */
  procedural?: {
    type: string;
    seed: number;
    params: Record<string, any>;
  };
}

/**
 * HDR environment asset definition (analogous to ZBrush's ZLightroom)
 */
export interface HDRAsset extends AssetMetadata {
  type: 'hdr';
  /** Path to HDR file (.hdr, .exr, .png) */
  filePath: string;
  /** HDR format */
  format: 'equirectangular' | 'cubemap';
  /** Default rotation in degrees (0-360) */
  defaultRotation: number;
  /** Default exposure in stops (-5 to +5) */
  defaultExposure: number;
  /** Resolution */
  resolution: { width: number; height: number };
  /** Embedded HDR data */
  embeddedData?: string;
}

/**
 * Union type for all asset types
 */
export type Asset = BrushAsset | AlphaAsset | MaterialAsset | HDRAsset;

/**
 * Asset type discriminator
 */
export type AssetType = Asset['type'];

/**
 * Asset loading result
 */
export interface AssetLoadResult<T extends Asset = Asset> {
  success: boolean;
  asset?: T;
  error?: string;
  filePath: string;
}

/**
 * Asset change event
 */
export interface AssetChangeEvent {
  type: 'added' | 'modified' | 'removed';
  assetType: AssetType;
  assetId: string;
  asset?: Asset;
}

/**
 * Asset validation result
 */
export interface AssetValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Asset directory configuration
 */
export interface AssetDirectoryConfig {
  brushes: string;
  alphas: string;
  materials: string;
  hdr: string;
  thumbnails: string;
}

/**
 * Asset manager configuration
 */
export interface AssetManagerConfig {
  directories: AssetDirectoryConfig;
  enableHotReload: boolean;
  generateThumbnails: boolean;
  thumbnailSize: number;
  validateOnLoad: boolean;
}
