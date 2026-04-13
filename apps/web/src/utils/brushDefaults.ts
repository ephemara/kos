/**
 * brushDefaults.ts - Centralized brush parameter defaults from ConfigRegistry
 * 
 * Provides default brush parameters (size, strength, etc.) from the ConfigRegistry
 * to eliminate hardcoded values across KSculpt, KPainter, and KGraphos.
 */

import { listBrushes, type BrushConfig } from '@/services/configClient';

/**
 * Brush defaults cache
 */
let brushDefaultsCache: Map<string, BrushConfig> | null = null;

/**
 * Load brush defaults from ConfigRegistry
 */
export async function loadBrushDefaults(): Promise<Map<string, BrushConfig>> {
  if (brushDefaultsCache) {
    return brushDefaultsCache;
  }
  
  try {
    const brushes = await listBrushes();
    brushDefaultsCache = new Map(brushes.map(b => [b.id, b]));
    console.log(`[BrushDefaults] Loaded ${brushes.length} brush configurations from registry`);
    return brushDefaultsCache;
  } catch (error) {
    console.error('[BrushDefaults] Failed to load from ConfigRegistry:', error);
    // Return empty map on error
    brushDefaultsCache = new Map();
    return brushDefaultsCache;
  }
}

/**
 * Get default parameters for a brush by ID
 */
export async function getBrushDefaults(brushId: string): Promise<BrushConfig | null> {
  const defaults = await loadBrushDefaults();
  return defaults.get(brushId) || null;
}

/**
 * Get default size for a brush (fallback to 0.1 for sculpting, 50 for painting)
 */
export async function getDefaultBrushSize(brushId: string, fallback: number = 0.1): Promise<number> {
  const config = await getBrushDefaults(brushId);
  return config?.defaultSize ?? fallback;
}

/**
 * Get default strength for a brush (fallback to 0.5)
 */
export async function getDefaultBrushStrength(brushId: string, fallback: number = 0.5): Promise<number> {
  const config = await getBrushDefaults(brushId);
  return config?.defaultStrength ?? fallback;
}

/**
 * Get brush parameter value with fallback
 */
export async function getBrushParameter(
  brushId: string,
  paramName: string,
  fallback: any = null
): Promise<any> {
  const config = await getBrushDefaults(brushId);
  if (!config?.parameters) return fallback;
  
  const param = config.parameters[paramName];
  if (!param) return fallback;
  
  // Extract default value based on parameter type
  if ('default' in param) {
    return param.default;
  }
  
  return fallback;
}

/**
 * Clear the cache (useful for hot-reload during development)
 */
export function clearBrushDefaultsCache(): void {
  brushDefaultsCache = null;
}
