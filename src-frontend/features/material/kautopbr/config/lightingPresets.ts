/**
 * Lighting Presets Configuration Loader
 * 
 * Data-driven lighting preset system for KAutoPBR preview renderer.
 * Presets are loaded from config/autopbr/lighting_presets.json
 */

export interface LightConfig {
  type: 'point' | 'directional' | 'ambient' | 'spot';
  name?: string;
  position?: [number, number, number];
  intensity: number;
  color: string;
  castShadow?: boolean;
}

export interface LightingPresetConfig {
  name: string;
  description?: string;
  intensity: number;
  background: string;
  useHDR?: boolean;
  hdrPath?: string;
  lights?: LightConfig[];
}

export type LightingPresetMap = Record<string, LightingPresetConfig>;

// Default fallback presets (in case config file fails to load)
const DEFAULT_PRESETS: LightingPresetMap = {
  studio: {
    name: 'Studio',
    description: 'Professional studio lighting',
    intensity: 1.0,
    background: '#1a1a1a',
    lights: [
      { type: 'directional', position: [5, 5, 5], intensity: 1.0, color: '#ffffff' },
      { type: 'directional', position: [-5, 3, -5], intensity: 0.5, color: '#ffffff' },
      { type: 'ambient', intensity: 0.3, color: '#ffffff' },
    ],
  },
  outdoor: {
    name: 'Outdoor',
    intensity: 1.2,
    background: '#87CEEB',
    lights: [
      { type: 'directional', position: [10, 10, 5], intensity: 1.5, color: '#ffffee' },
      { type: 'ambient', intensity: 0.5, color: '#87CEEB' },
    ],
  },
  indoor: {
    name: 'Indoor',
    intensity: 0.8,
    background: '#2a2a2a',
    lights: [
      { type: 'point', position: [0, 5, 0], intensity: 1.0, color: '#fff5e6' },
      { type: 'ambient', intensity: 0.4, color: '#ffffff' },
    ],
  },
  sunset: {
    name: 'Sunset',
    intensity: 1.0,
    background: '#ff6b35',
    lights: [
      { type: 'directional', position: [-10, 2, 0], intensity: 1.2, color: '#ff6b35' },
      { type: 'ambient', intensity: 0.3, color: '#ff8c42' },
    ],
  },
  night: {
    name: 'Night',
    intensity: 0.5,
    background: '#0a0a1a',
    lights: [
      { type: 'point', position: [0, 10, 0], intensity: 0.5, color: '#4a5f8f' },
      { type: 'ambient', intensity: 0.2, color: '#1a1a2e' },
    ],
  },
  custom: {
    name: 'Custom HDR',
    intensity: 1.0,
    background: '#000000',
    useHDR: true,
  },
};

let cachedPresets: LightingPresetMap | null = null;

/**
 * Load lighting presets from config file
 * Falls back to default presets if loading fails
 */
export async function loadLightingPresets(): Promise<LightingPresetMap> {
  if (cachedPresets) {
    return cachedPresets;
  }

  try {
    // In Tauri, we can read the config file from the app's config directory
    const response = await fetch('/config/autopbr/lighting_presets.json');
    
    if (!response.ok) {
      console.warn('Failed to load lighting presets config, using defaults');
      cachedPresets = DEFAULT_PRESETS;
      return DEFAULT_PRESETS;
    }

    const data = await response.json();
    cachedPresets = data.presets || DEFAULT_PRESETS;
    
    console.log(`Loaded ${Object.keys(cachedPresets).length} lighting presets from config`);
    return cachedPresets;
  } catch (error) {
    console.error('Error loading lighting presets:', error);
    cachedPresets = DEFAULT_PRESETS;
    return DEFAULT_PRESETS;
  }
}

/**
 * Get a specific lighting preset by key
 */
export async function getLightingPreset(key: string): Promise<LightingPresetConfig | null> {
  const presets = await loadLightingPresets();
  return presets[key] || null;
}

/**
 * Get all available preset keys
 */
export async function getLightingPresetKeys(): Promise<string[]> {
  const presets = await loadLightingPresets();
  return Object.keys(presets);
}

/**
 * Reload presets from config (useful for hot-reloading during development)
 */
export function reloadLightingPresets(): void {
  cachedPresets = null;
}

/**
 * Get default presets (synchronous, no config loading)
 */
export function getDefaultPresets(): LightingPresetMap {
  return DEFAULT_PRESETS;
}
