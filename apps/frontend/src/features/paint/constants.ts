/**
 * constants.ts - KPainter Configuration & Defaults
 * 
 * Central location for all brush types, channel definitions, mods, and defaults.
 * Keep this file clean and well-organized!
 */

// ============================================================================
// BRUSH TYPES
// ============================================================================

export const BRUSH_TYPES = [
    { id: 'standard', label: 'Standard', desc: 'Basic paint brush' },
    { id: 'INK', label: 'Ink', desc: 'Smooth ink strokes with flow dynamics' },
    { id: 'airbrush', label: 'Airbrush', desc: 'Soft spray gradient' },
    { id: 'smudge', label: 'Smudge', desc: 'Push and blend colors' },
    { id: 'clone', label: 'Clone', desc: 'Copy from source point' },
    { id: 'fill', label: 'Fill', desc: 'Flood fill area' },
] as const;

export type BrushTypeId = typeof BRUSH_TYPES[number]['id'];

// ============================================================================
// BRUSH DEFAULTS
// ============================================================================

export interface BrushState {
    size: number;
    opacity: number;
    hardness: number;
    color: string;
    roughness: number;
    metalness: number;
    emission: number;
    flow: number;
    alphaMap: any | null;
    smartMask: { edge: number; slope: number; height: number };
    spacing: number;
    distanceScale: boolean;
    isSeamless: boolean;
    isPicking: boolean;
    projectionMode: boolean;
    type: string;
    /** Blend mode for SVT painting */
    blendMode: BlendModeId;
    /** Emission color (RGB) */
    emissionColor: [number, number, number];
}

/** Blend modes for painting */
export const BLEND_MODES = [
    { id: 'normal', label: 'Normal', desc: 'Standard blend' },
    { id: 'multiply', label: 'Multiply', desc: 'Darken blend' },
    { id: 'add', label: 'Add', desc: 'Lighten/glow' },
    { id: 'overlay', label: 'Overlay', desc: 'Contrast blend' },
    { id: 'screen', label: 'Screen', desc: 'Light blend' },
] as const;

export type BlendModeId = typeof BLEND_MODES[number]['id'];

export const DEFAULT_BRUSH: BrushState = {
    size: 50,
    opacity: 1.0,
    hardness: 0.5,
    color: '#ffffff',
    roughness: 0.5,
    metalness: 0.0,
    emission: 0.0,
    flow: 0.5,
    alphaMap: null,
    smartMask: { edge: 0.0, slope: 0.0, height: 0.0 },
    spacing: 0.1,
    distanceScale: false,
    isSeamless: false,
    isPicking: false,
    projectionMode: true, // Rust BVH projection by default
    type: 'standard',
    blendMode: 'normal',
    emissionColor: [1.0, 0.5, 0.0], // Orange default
};


// ============================================================================
// PBR CHANNELS
// ============================================================================

export interface ChannelDefinition {
    id: string;
    label: string;
    color: string;
    defaultEnabled: boolean;
}

export const PBR_CHANNELS: ChannelDefinition[] = [
    { id: 'albedo', label: 'Albedo', color: '#f87171', defaultEnabled: true },
    { id: 'normal', label: 'Normal', color: '#60a5fa', defaultEnabled: true },
    { id: 'roughness', label: 'Roughness', color: '#a78bfa', defaultEnabled: true },
    { id: 'metalness', label: 'Metalness', color: '#fbbf24', defaultEnabled: true },
    { id: 'emission', label: 'Emission', color: '#34d399', defaultEnabled: true },
    { id: 'height', label: 'Height', color: '#94a3b8', defaultEnabled: false },
    { id: 'ao', label: 'AO', color: '#6b7280', defaultEnabled: false },
];

export const DEFAULT_ACTIVE_CHANNELS = {
    albedo: true,
    normal: true,
    roughness: true,
    metalness: true,
    emission: true,
    height: false,
    ao: false,
};

// ============================================================================
// BRUSH MODS (Simulation Effects)
// ============================================================================

export interface ModDefinition {
    id: string;
    label: string;
    desc: string;
    category: 'fluid' | 'physics' | 'procedural' | 'exotic';
    color: string;
}

export const BRUSH_MODS: ModDefinition[] = [
    // Fluid dynamics
    { id: 'hydro', label: 'Hydro', desc: 'Water-like flow', category: 'fluid', color: '#3b82f6' },
    { id: 'drip', label: 'Drip', desc: 'Gravity dripping', category: 'fluid', color: '#60a5fa' },
    { id: 'flow', label: 'Flow', desc: 'Directional flow', category: 'fluid', color: '#2563eb' },
    { id: 'vortex', label: 'Vortex', desc: 'Spiral motion', category: 'fluid', color: '#7c3aed' },

    // Physics
    { id: 'particulate', label: 'Particulate', desc: 'Particle spray', category: 'physics', color: '#f59e0b' },
    { id: 'inertia', label: 'Inertia', desc: 'Momentum effects', category: 'physics', color: '#eab308' },
    { id: 'ferro', label: 'Ferro', desc: 'Magnetic effects', category: 'physics', color: '#ef4444' },

    // Procedural
    { id: 'entropy', label: 'Entropy', desc: 'Noise/chaos', category: 'procedural', color: '#8b5cf6' },
    { id: 'growth', label: 'Growth', desc: 'Crystal growth', category: 'procedural', color: '#10b981' },
    { id: 'reaction', label: 'Reaction', desc: 'Chemical diffusion', category: 'procedural', color: '#ec4899' },
    { id: 'vector', label: 'Vector', desc: 'Vector field', category: 'procedural', color: '#14b8a6' },

    // Exotic
    { id: 'quantum', label: 'Quantum', desc: 'Probability clouds', category: 'exotic', color: '#06b6d4' },
    { id: 'chronos', label: 'Chronos', desc: 'Time-based effects', category: 'exotic', color: '#a855f7' },
];

export const DEFAULT_ACTIVE_MODS: Record<string, boolean> = Object.fromEntries(
    BRUSH_MODS.map(m => [m.id, false])
);

export const DEFAULT_MOD_PARAMS = {
    speed: 0.3,
    chaos: 0.5,
    intensity: 1.0,
};

// ============================================================================
// SYMMETRY
// ============================================================================

export const DEFAULT_SYMMETRY = {
    x: false,
    y: false,
    z: false,
    radial: false,
    radialCount: 4,
};

// ============================================================================
// BLACK HOLE (KERR) BRUSH MOD
// ============================================================================

export const DEFAULT_BLACK_HOLE = {
    active: false,
    strength: 2.0,
    spin: 5.0,
    radius: 0.1,
    decay: 0.95,
    infinite: false,
};

// ============================================================================
// VIEW MODES
// ============================================================================

export const VIEW_CHANNELS = [
    { id: 'MATERIAL', label: 'Material', desc: 'Full PBR render' },
    { id: 'ALBEDO', label: 'Albedo', desc: 'Base color only' },
    { id: 'NORMAL', label: 'Normal', desc: 'Normal map visualization' },
    { id: 'ROUGHNESS', label: 'Roughness', desc: 'Roughness channel' },
    { id: 'METALNESS', label: 'Metalness', desc: 'Metalness channel' },
    { id: 'EMISSION', label: 'Emission', desc: 'Emission channel' },
    { id: 'UV', label: 'UV', desc: 'UV checker pattern' },
] as const;

export type ViewChannelId = typeof VIEW_CHANNELS[number]['id'];

export const VIEW_MODES = ['3D', '2D'] as const;
export type ViewModeId = typeof VIEW_MODES[number];

// ============================================================================
// TEXTURE SETTINGS
// ============================================================================

export const TEXTURE_RESOLUTIONS = [512, 1024, 2048, 4096, 8192, 16384] as const;
export const DEFAULT_TEXTURE_SIZE = 2048;

// ============================================================================
// LIGHTING PRESETS
// ============================================================================

export const LIGHTING_PRESETS = [
    { id: 'studio', label: 'Studio', intensity: 1.0 },
    { id: 'outdoor', label: 'Outdoor', intensity: 1.2 },
    { id: 'dramatic', label: 'Dramatic', intensity: 0.8 },
    { id: 'dawn', label: 'Dawn', intensity: 1.1 },
    { id: 'night', label: 'Night', intensity: 0.4 },
] as const;

export const DEFAULT_LIGHTING = {
    preset: 'studio',
    intensity: 1.0,
};

// ============================================================================
// KEYBOARD SHORTCUTS
// ============================================================================

export const HOTKEYS = {
    quickMenu: 'q',
    export: 'ctrl+s,command+s',
    undo: 'ctrl+z,command+z',
    redo: 'ctrl+shift+z,command+shift+z',
    toggleSVT: 'g',
    toggleViewMode: 'tab',
    brushSizeUp: ']',
    brushSizeDown: '[',
    colorPicker: 'alt+click',
};
