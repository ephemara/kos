/**
 * ALPHA BRUSH SYSTEM
 * 
 * Manages alpha textures for brush intensity modulation.
 * Supports loading from files, generating procedurally, and GPU management.
 * 
 * Alpha textures are used to modulate brush intensity, creating:
 * - Stamp-based brushes (custom shapes)
 * - Textured brushes (scales, cracks, patterns)
 * - Procedural brushes (noise, cells, geometric shapes)
 * 
 * @module AlphaBrush
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  AlphaHandle,
  AlphaInfo,
  AlphaSource,
  ProceduralAlphaType,
} from './BrushTypes';

// ============================================================================
// ALPHA LOADING
// ============================================================================

/**
 * Load an alpha texture from a file path
 */
export async function loadAlphaFromFile(
  path: string,
  name?: string
): Promise<AlphaInfo> {
  const isTauri = typeof (window as any).__TAURI__ !== 'undefined';
  if (!isTauri) throw new Error('Alpha loading not available on web');
  return invoke<AlphaInfo>('load_alpha_from_file', { path, name });
}

/**
 * Load an alpha from base64-encoded image data
 */
export async function loadAlphaFromBase64(
  data: string,
  name: string
): Promise<AlphaInfo> {
  const isTauri = typeof (window as any).__TAURI__ !== 'undefined';
  if (!isTauri) throw new Error('Alpha loading not available on web');
  return invoke<AlphaInfo>('load_alpha_from_base64', { data, name });
}

/**
 * Load an alpha from a File object (browser API)
 */
export async function loadAlphaFromFile2(file: File): Promise<AlphaInfo> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        const info = await loadAlphaFromBase64(base64, file.name);
        resolve(info);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Load an alpha from a URL (fetches and uploads)
 */
export async function loadAlphaFromUrl(
  url: string,
  name?: string
): Promise<AlphaInfo> {
  const response = await fetch(url);
  const blob = await response.blob();
  const base64 = await blobToBase64(blob);
  return loadAlphaFromBase64(base64, name || url.split('/').pop() || 'url_alpha');
}

// ============================================================================
// PROCEDURAL GENERATION
// ============================================================================

/**
 * Generate a procedural alpha texture on the GPU
 */
export async function generateProceduralAlpha(
  type: ProceduralAlphaType,
  size: number = 256,
  params?: Record<string, number>
): Promise<AlphaInfo> {
  const isTauri = typeof (window as any).__TAURI__ !== 'undefined';
  if (!isTauri) throw new Error('Procedural alpha not available on web');
  return invoke<AlphaInfo>('generate_procedural_alpha', {
    procType: type,
    size,
    params,
  });
}

/**
 * Common procedural alpha presets
 */
export const PROCEDURAL_PRESETS = {
  // Soft standard brush
  softRound: () => generateProceduralAlpha('radial', 256, { falloff: 2.0 }),

  // Hard edge brush
  hardRound: () => generateProceduralAlpha('circle', 256, { softness: 0.02 }),

  // Square brush
  square: () => generateProceduralAlpha('square', 256, { softness: 0.02 }),

  // Diamond brush
  diamond: () => generateProceduralAlpha('diamond', 256, { softness: 0.05 }),

  // Organic noise
  perlinNoise: (scale = 4, octaves = 4) =>
    generateProceduralAlpha('perlin', 256, { scale, octaves }),

  // Scales/cells pattern
  voronoiCells: (cells = 16, edgeWidth = 0.1) =>
    generateProceduralAlpha('voronoi', 256, { cells, edge_width: edgeWidth }),

  // Brick/tile pattern
  bricks: (width = 0.25, height = 0.1) =>
    generateProceduralAlpha('bricks', 256, { width, height, mortar: 0.02 }),

  // Dot pattern
  dots: (dotSize = 0.08, spacing = 0.15) =>
    generateProceduralAlpha('dots', 256, { dot_size: dotSize, spacing }),

  // Fractional Brownian Motion
  fbm: (octaves = 6, lacunarity = 2.0, gain = 0.5) =>
    generateProceduralAlpha('fbm', 256, { octaves, lacunarity, gain }),

  // Turbulence
  turbulence: (octaves = 6, roughness = 0.5) =>
    generateProceduralAlpha('turbulence', 256, { octaves, roughness }),

  // Cellular/Worley noise
  cellular: (cells = 8, distance = 'euclidean') =>
    generateProceduralAlpha('cellular', 256, { cells, distance_type: distance === 'euclidean' ? 0 : 1 }),
};

// ============================================================================
// ALPHA MANAGEMENT
// ============================================================================

/**
 * List all loaded alpha textures
 */
export async function listAlphas(): Promise<AlphaInfo[]> {
  const isTauri = typeof (window as any).__TAURI__ !== 'undefined';
  if (!isTauri) return [];
  return invoke<AlphaInfo[]>('list_alphas');
}

/**
 * Get info for a specific alpha
 */
export async function getAlphaInfo(handle: AlphaHandle): Promise<AlphaInfo | null> {
  const isTauri = typeof (window as any).__TAURI__ !== 'undefined';
  if (!isTauri) return null;
  return invoke<AlphaInfo | null>('get_alpha_info', { handle });
}

/**
 * Dispose/unload an alpha texture
 */
export async function disposeAlpha(handle: AlphaHandle): Promise<boolean> {
  const isTauri = typeof (window as any).__TAURI__ !== 'undefined';
  if (!isTauri) return false;
  return invoke<boolean>('dispose_alpha', { handle });
}

// ============================================================================
// ALPHA MANAGER (SINGLETON)
// ============================================================================

/**
 * Alpha manager for centralized alpha texture management
 */
class AlphaManager {
  private loadedAlphas: Map<AlphaHandle, AlphaInfo> = new Map();
  private listeners: Set<() => void> = new Set();
  private currentAlpha: AlphaInfo | null = null;

  /**
   * Get current alpha
   */
  getCurrentAlpha(): AlphaInfo | null {
    return this.currentAlpha;
  }

  /**
   * Set current alpha by handle
   */
  async setCurrentAlpha(handle: AlphaHandle | null): Promise<void> {
    if (handle === null) {
      this.currentAlpha = null;
    } else {
      const info = await getAlphaInfo(handle);
      this.currentAlpha = info;
      if (info) {
        this.loadedAlphas.set(handle, info);
      }
    }
    this.notifyListeners();
  }

  /**
   * Load and set alpha from file
   */
  async loadAndSetAlpha(path: string, name?: string): Promise<AlphaInfo> {
    const info = await loadAlphaFromFile(path, name);
    this.loadedAlphas.set(info.handle, info);
    this.currentAlpha = info;
    this.notifyListeners();
    return info;
  }

  /**
   * Generate and set procedural alpha
   */
  async generateAndSetAlpha(
    type: ProceduralAlphaType,
    size?: number,
    params?: Record<string, number>
  ): Promise<AlphaInfo> {
    const info = await generateProceduralAlpha(type, size, params);
    this.loadedAlphas.set(info.handle, info);
    this.currentAlpha = info;
    this.notifyListeners();
    return info;
  }

  /**
   * Get all loaded alphas
   */
  getLoadedAlphas(): AlphaInfo[] {
    return Array.from(this.loadedAlphas.values());
  }

  /**
   * Refresh alphas from backend
   */
  async refreshAlphas(): Promise<AlphaInfo[]> {
    const alphas = await listAlphas();
    this.loadedAlphas.clear();
    alphas.forEach(a => this.loadedAlphas.set(a.handle, a));
    this.notifyListeners();
    return alphas;
  }

  /**
   * Dispose of an alpha
   */
  async disposeAlpha(handle: AlphaHandle): Promise<boolean> {
    const success = await disposeAlpha(handle);
    if (success) {
      this.loadedAlphas.delete(handle);
      if (this.currentAlpha?.handle === handle) {
        this.currentAlpha = null;
      }
      this.notifyListeners();
    }
    return success;
  }

  /**
   * Clear current alpha
   */
  clearCurrentAlpha(): void {
    this.currentAlpha = null;
    this.notifyListeners();
  }

  /**
   * Subscribe to alpha changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(l => l());
  }
}

/** Global alpha manager instance */
export const alphaManager = new AlphaManager();

// ============================================================================
// REACT HOOK
// ============================================================================

import { useState, useEffect, useCallback } from 'react';

/**
 * React hook for accessing the alpha manager
 */
export function useAlphaManager() {
  const [currentAlpha, setCurrentAlpha] = useState(alphaManager.getCurrentAlpha());
  const [loadedAlphas, setLoadedAlphas] = useState(alphaManager.getLoadedAlphas());

  useEffect(() => {
    return alphaManager.subscribe(() => {
      setCurrentAlpha(alphaManager.getCurrentAlpha());
      setLoadedAlphas(alphaManager.getLoadedAlphas());
    });
  }, []);

  const loadAlpha = useCallback(async (path: string, name?: string) => {
    return alphaManager.loadAndSetAlpha(path, name);
  }, []);

  const generateAlpha = useCallback(async (
    type: ProceduralAlphaType,
    size?: number,
    params?: Record<string, number>
  ) => {
    return alphaManager.generateAndSetAlpha(type, size, params);
  }, []);

  const setAlpha = useCallback(async (handle: AlphaHandle | null) => {
    return alphaManager.setCurrentAlpha(handle);
  }, []);

  const clearAlpha = useCallback(() => {
    alphaManager.clearCurrentAlpha();
  }, []);

  const refreshAlphas = useCallback(async () => {
    return alphaManager.refreshAlphas();
  }, []);

  const disposeAlpha = useCallback(async (handle: AlphaHandle) => {
    return alphaManager.disposeAlpha(handle);
  }, []);

  return {
    currentAlpha,
    loadedAlphas,
    loadAlpha,
    generateAlpha,
    setAlpha,
    clearAlpha,
    refreshAlphas,
    disposeAlpha,
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Convert Blob to base64 string
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Create a canvas-based alpha texture (for web fallback)
 */
export function createCanvasAlpha(
  type: ProceduralAlphaType,
  size: number = 256,
  params?: Record<string, number>
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get 2D context');
  }

  // Generate procedural alpha on canvas
  switch (type) {
    case 'radial':
      drawRadialAlpha(ctx, size, params);
      break;
    case 'circle':
      drawCircleAlpha(ctx, size, params);
      break;
    case 'square':
      drawSquareAlpha(ctx, size, params);
      break;
    case 'diamond':
      drawDiamondAlpha(ctx, size, params);
      break;
    default:
      // Fallback to radial
      drawRadialAlpha(ctx, size, params);
  }

  return canvas;
}

function drawRadialAlpha(
  ctx: CanvasRenderingContext2D,
  size: number,
  params?: Record<string, number>
): void {
  const falloff = params?.falloff || 2.0;
  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2
  );

  gradient.addColorStop(0, 'white');
  gradient.addColorStop(Math.pow(0.5, 1 / falloff), 'gray');
  gradient.addColorStop(1, 'black');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
}

function drawCircleAlpha(
  ctx: CanvasRenderingContext2D,
  size: number,
  params?: Record<string, number>
): void {
  const softness = params?.softness || 0.02;
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, size, size);

  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, size / 2 * (1 - softness),
    size / 2, size / 2, size / 2
  );

  gradient.addColorStop(0, 'white');
  gradient.addColorStop(1, 'black');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawSquareAlpha(
  ctx: CanvasRenderingContext2D,
  size: number,
  params?: Record<string, number>
): void {
  const softness = params?.softness || 0.02;
  const margin = size * softness;

  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = 'white';
  ctx.fillRect(margin, margin, size - margin * 2, size - margin * 2);
}

function drawDiamondAlpha(
  ctx: CanvasRenderingContext2D,
  size: number,
  params?: Record<string, number>
): void {
  const softness = params?.softness || 0.05;

  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.moveTo(size / 2, size * softness);
  ctx.lineTo(size * (1 - softness), size / 2);
  ctx.lineTo(size / 2, size * (1 - softness));
  ctx.lineTo(size * softness, size / 2);
  ctx.closePath();
  ctx.fill();
}
