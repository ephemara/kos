/**
 * Type definitions for configuration editor
 */

export interface BrushConfig {
  id: string;
  name: string;
  category: 'sculpt' | 'paint' | 'mask' | 'smooth';
  defaultSize: number;
  defaultStrength: number;
  supportsPressure: boolean;
  gpuShader?: string;
  icon: string;
  parameters?: Record<string, BrushParameter>;
}

export type BrushParameter =
  | { type: 'float'; default: number; min: number; max: number }
  | { type: 'int'; default: number; min: number; max: number }
  | { type: 'bool'; default: boolean }
  | { type: 'color'; default: [number, number, number, number] };

export interface ExportFormatConfig {
  id: string;
  name: string;
  extensions: string[];
  supportsMeshes: boolean;
  supportsTextures: boolean;
  supportsMaterials: boolean;
  options: ExportOption[];
}

export interface ExportOption {
  id: string;
  label: string;
  type: 'bool' | 'int' | 'float' | 'enum';
  default: boolean | number | string;
  min?: number;
  max?: number;
  values?: string[];
}

export interface ViewportPresetConfig {
  id: string;
  name: string;
  gridSize: number;
  gridDivisions: number;
  cameraDistance: number;
  cameraFov: number;
  lighting: LightingConfig;
}

export interface LightingConfig {
  ambient: number;
  directional: DirectionalLight;
}

export interface DirectionalLight {
  intensity: number;
  direction: [number, number, number];
}

export interface GreeblePatternConfig {
  id: string;
  name: string;
  category: string;
  primitives: GreeblePrimitive[];
}

export interface GreeblePrimitive {
  type: 'box' | 'cylinder' | 'sphere' | 'custom';
  probability: number;
  scaleRange: ScaleRange;
}

export interface ScaleRange {
  min: [number, number, number];
  max: [number, number, number];
}

export interface ShadingModeConfig {
  id: string;
  name: string;
  app: string;
  modeIndex: number;
  icon?: string;
  description?: string;
}

export interface ExportOptions {
  brushes: boolean;
  exportFormats: boolean;
  viewportPresets: boolean;
  greeblePatterns: boolean;
  shadingModes: boolean;
}

export interface ImportPreview {
  brushes: number;
  exportFormats: number;
  viewportPresets: number;
  greeblePatterns: number;
  shadingModes: number;
}
