/**
 * Default Assets Registration
 * 
 * Registers default brushes, materials, and HDR environments with the asset manager.
 * In production, these would be loaded from files, but for now we register them programmatically.
 */

import { assetManager } from './AssetManager';
import type { BrushAsset, MaterialAsset, HDRAsset } from './types';

const softRoundBrush: BrushAsset = {
  id: 'brush.soft_round',
  name: 'Soft Round',
  category: 'default',
  type: 'brush',
  brushType: 'paint',
  size: 36,
  hardness: 0.2,
  spacing: 0.08,
  opacity: 0.9,
  flow: 0.85,
};

const hardRoundBrush: BrushAsset = {
  id: 'brush.hard_round',
  name: 'Hard Round',
  category: 'default',
  type: 'brush',
  brushType: 'paint',
  size: 28,
  hardness: 0.92,
  spacing: 0.1,
  opacity: 1,
  flow: 1,
};

const inkBrush: BrushAsset = {
  id: 'brush.ink',
  name: 'Ink',
  category: 'default',
  type: 'brush',
  brushType: 'paint',
  size: 20,
  hardness: 0.85,
  spacing: 0.03,
  opacity: 1,
  flow: 0.98,
};

const eraserBrush: BrushAsset = {
  id: 'brush.eraser',
  name: 'Eraser',
  category: 'default',
  type: 'brush',
  brushType: 'erase',
  size: 34,
  hardness: 0.8,
  spacing: 0.12,
  opacity: 1,
  flow: 1,
};

const smudgeBrush: BrushAsset = {
  id: 'brush.smudge',
  name: 'Smudge',
  category: 'default',
  type: 'brush',
  brushType: 'smudge',
  size: 30,
  hardness: 0.55,
  spacing: 0.07,
  opacity: 0.75,
  flow: 0.7,
};

const brushedMetalMaterial: MaterialAsset = {
  id: 'material.brushed_metal',
  name: 'Brushed Metal',
  category: 'default',
  type: 'material',
  baseColor: [0.74, 0.75, 0.78],
  metallic: 1,
  roughness: 0.3,
  normalStrength: 1,
  aoStrength: 1,
  heightScale: 0.04,
};

const woodMaterial: MaterialAsset = {
  id: 'material.wood',
  name: 'Wood',
  category: 'default',
  type: 'material',
  baseColor: [0.48, 0.31, 0.18],
  metallic: 0,
  roughness: 0.62,
  normalStrength: 0.8,
  aoStrength: 0.9,
  heightScale: 0.05,
};

const plasticMaterial: MaterialAsset = {
  id: 'material.plastic',
  name: 'Plastic',
  category: 'default',
  type: 'material',
  baseColor: [0.22, 0.24, 0.27],
  metallic: 0.05,
  roughness: 0.42,
  normalStrength: 0.4,
  aoStrength: 0.8,
  heightScale: 0.02,
};

const stoneMaterial: MaterialAsset = {
  id: 'material.stone',
  name: 'Stone',
  category: 'default',
  type: 'material',
  baseColor: [0.42, 0.43, 0.45],
  metallic: 0,
  roughness: 0.85,
  normalStrength: 0.95,
  aoStrength: 1,
  heightScale: 0.07,
};

const fabricMaterial: MaterialAsset = {
  id: 'material.fabric',
  name: 'Fabric',
  category: 'default',
  type: 'material',
  baseColor: [0.18, 0.2, 0.22],
  metallic: 0,
  roughness: 0.78,
  normalStrength: 0.35,
  aoStrength: 0.85,
  heightScale: 0.02,
};

const studioHDR: HDRAsset = {
  id: 'hdr.studio',
  name: 'Studio',
  category: 'default',
  type: 'hdr',
  filePath: 'hdr/studio.hdr',
  format: 'equirectangular',
  defaultRotation: 0,
  defaultExposure: 0,
  resolution: { width: 2048, height: 1024 },
};

const outdoorHDR: HDRAsset = {
  id: 'hdr.outdoor',
  name: 'Outdoor',
  category: 'default',
  type: 'hdr',
  filePath: 'hdr/outdoor.hdr',
  format: 'equirectangular',
  defaultRotation: 25,
  defaultExposure: 0.35,
  resolution: { width: 2048, height: 1024 },
};

const sunsetHDR: HDRAsset = {
  id: 'hdr.sunset',
  name: 'Sunset',
  category: 'default',
  type: 'hdr',
  filePath: 'hdr/sunset.hdr',
  format: 'equirectangular',
  defaultRotation: 40,
  defaultExposure: 0.25,
  resolution: { width: 2048, height: 1024 },
};

/**
 * Register all default assets with the asset manager
 */
export function registerDefaultAssets(): void {
  console.log('[DefaultAssets] Registering default assets...');
  
  // Register brushes
  assetManager.registerAsset(softRoundBrush);
  assetManager.registerAsset(hardRoundBrush);
  assetManager.registerAsset(inkBrush);
  assetManager.registerAsset(eraserBrush);
  assetManager.registerAsset(smudgeBrush);
  
  // Register materials
  assetManager.registerAsset(brushedMetalMaterial);
  assetManager.registerAsset(woodMaterial);
  assetManager.registerAsset(plasticMaterial);
  assetManager.registerAsset(stoneMaterial);
  assetManager.registerAsset(fabricMaterial);
  
  // Register HDR environments
  assetManager.registerAsset(studioHDR);
  assetManager.registerAsset(outdoorHDR);
  assetManager.registerAsset(sunsetHDR);
  
  const stats = assetManager.getStats();
  console.log('[DefaultAssets] Registered:', stats);
}
