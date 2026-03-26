/**
 * Configuration Registry Client
 * 
 * TypeScript client for accessing the data-driven configuration registry.
 */

import { invoke } from '@tauri-apps/api/core';

// ============================================================================
// TYPES
// ============================================================================

export interface BrushConfig {
  id: string;
  name: string;
  category: 'sculpt' | 'paint' | 'mask' | 'smooth';
  defaultSize: number;
  defaultStrength: number;
  supportsPressure: boolean;
  gpuShader?: string;
  icon: string;
  parameters?: Record<string, any>;
}

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
  default: any;
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
  lighting: {
    ambient: number;
    directional: {
      intensity: number;
      direction: [number, number, number];
    };
  };
}

export interface ShadingModeConfig {
  id: string;
  name: string;
  app: string;
  modeIndex: number;
  icon?: string;
  description?: string;
}

// ============================================================================
// BRUSH REGISTRY
// ============================================================================

export async function listBrushes(): Promise<BrushConfig[]> {
  return invoke('list_config_brushes');
}

export async function getBrush(id: string): Promise<BrushConfig | null> {
  return invoke('get_config_brush', { id });
}

export async function listBrushesByCategory(category: 'sculpt' | 'paint' | 'mask' | 'smooth'): Promise<BrushConfig[]> {
  const allBrushes = await listBrushes();
  return allBrushes.filter(b => b.category === category);
}

// ============================================================================
// EXPORT FORMAT REGISTRY
// ============================================================================

export async function listExportFormats(): Promise<ExportFormatConfig[]> {
  return invoke('list_config_export_formats');
}

export async function getExportFormat(id: string): Promise<ExportFormatConfig | null> {
  return invoke('get_config_export_format', { id });
}

// ============================================================================
// VIEWPORT PRESET REGISTRY
// ============================================================================

export async function listViewportPresets(): Promise<ViewportPresetConfig[]> {
  return invoke('list_config_viewport_presets');
}

export async function getViewportPreset(id: string): Promise<ViewportPresetConfig | null> {
  return invoke('get_config_viewport_preset', { id });
}

// ============================================================================
// SHADING MODE REGISTRY
// ============================================================================

export async function listShadingModes(): Promise<ShadingModeConfig[]> {
  return invoke('list_config_shading_modes');
}

export async function listShadingModesByApp(app: string): Promise<ShadingModeConfig[]> {
  return invoke('list_config_shading_modes_by_app', { app });
}

export async function getShadingMode(id: string): Promise<ShadingModeConfig | null> {
  return invoke('get_config_shading_mode', { id });
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export const configClient = {
  // Brushes
  listBrushes,
  getBrush,
  listBrushesByCategory,
  
  // Export Formats
  listExportFormats,
  getExportFormat,
  
  // Viewport Presets
  listViewportPresets,
  getViewportPreset,
  
  // Shading Modes
  listShadingModes,
  listShadingModesByApp,
  getShadingMode,
};

export default configClient;
