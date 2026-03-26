/**
 * constants.ts - KSculpt Constants & Brush Definitions
 * 
 * All brush IDs map directly to Rust backend (sculpt.rs)
 */

import {
    Circle, Move, Activity, Square, Maximize, Paintbrush, MousePointer2,
    Minimize2, PenTool, Eraser, Archive, Waves, Mountain,
    Wind, ArrowDown, CloudRain, Layers, Tornado, Magnet, Sprout,
    Flame, Sun, Sparkles, Zap, Atom, Clock, Monitor, AlignCenterVertical,
    ScanLine, Shuffle, Globe, Scissors, RotateCw, Expand, Flower, Heart,
    Feather, Thermometer, Snowflake, Droplet
} from 'lucide-react';

// ============================================================================
// BRUSH CATEGORIES
// ============================================================================

export type BrushCategory = 'standard' | 'simulation' | 'procedural';

export interface BrushDefinition {
    id: string;
    label: string;
    icon: any;
    key?: string;
    desc?: string;
    category: BrushCategory;
}

// ============================================================================
// STANDARD BRUSHES (Classic sculpting)
// ============================================================================

export const STANDARD_BRUSHES: BrushDefinition[] = [
    { id: 'SELECT', icon: MousePointer2, label: 'SELECT', key: 'S', category: 'standard' },
    { id: 'CLAY', icon: Circle, label: 'CLAY', key: '1', category: 'standard' },
    { id: 'CLAY_STRIPS', icon: Layers, label: 'CLAY STRIPS', key: 'C', category: 'standard' },
    { id: 'DRAW', icon: PenTool, label: 'DRAW', key: 'D', category: 'standard' },
    { id: 'MOVE', icon: Move, label: 'MOVE', key: '2', category: 'standard' },
    { id: 'SMOOTH', icon: Activity, label: 'SMOOTH', key: '3', category: 'standard' },
    { id: 'FLATTEN', icon: Square, label: 'FLATTEN', key: '4', category: 'standard' },
    { id: 'INFLATE', icon: Maximize, label: 'INFLATE', key: '5', category: 'standard' },
    { id: 'PINCH', icon: Minimize2, label: 'PINCH', key: '6', category: 'standard' },
    { id: 'CREASE', icon: PenTool, label: 'CREASE', key: '7', category: 'standard' },
    { id: 'SCRAPE', icon: Eraser, label: 'SCRAPE', key: '8', category: 'standard' },
    { id: 'FILL', icon: Archive, label: 'FILL', key: '9', category: 'standard' },
    { id: 'PAINT', icon: Paintbrush, label: 'PAINT', key: '0', category: 'standard' },
    { id: 'MASK', icon: ScanLine, label: 'MASK', key: 'M', desc: 'Paint vertex mask', category: 'standard' },
    // New essential brushes
    { id: 'SNAKE_HOOK', icon: Wind, label: 'SNAKE HOOK', key: 'K', category: 'standard' },
    { id: 'LAYER', icon: Layers, label: 'LAYER', key: 'L', category: 'standard' },
    { id: 'DAM_STANDARD', icon: AlignCenterVertical, label: 'DAM', key: 'A', category: 'standard' },
    { id: 'HPOLISH', icon: Square, label: 'H-POLISH', key: 'H', category: 'standard' },
    { id: 'RAKE', icon: ScanLine, label: 'RAKE', key: 'R', category: 'standard' },
];

// ============================================================================
// SIMULATION BRUSHES (Physics-based)
// ============================================================================

export const SIMULATION_BRUSHES: BrushDefinition[] = [
    { id: 'BLOB', label: 'BLOB', icon: CloudRain, desc: 'Volumetric Expansion', category: 'simulation' },
    { id: 'BLOOM', label: 'BLOOM', icon: Flower, desc: 'Radial Petal Expansion', category: 'simulation' },
    { id: 'CRYSTALLIZE', label: 'CRYSTAL', icon: Snowflake, desc: 'Grid Snap Struct', category: 'simulation' },
    { id: 'ERODE', label: 'ERODE', icon: Mountain, desc: 'Weathering & Decay', category: 'simulation' },
    { id: 'GLITCH', label: 'GLITCH', icon: Zap, desc: 'Digital Distortion', category: 'simulation' },
    { id: 'GRAVITY', label: 'GRAVITY', icon: ArrowDown, desc: 'Linear Downward Pull', category: 'simulation' },
    { id: 'GROWTH', label: 'GROWTH', icon: Sprout, desc: 'Recursive Branching', category: 'simulation' },
    { id: 'MAGMA', label: 'MAGMA', icon: Flame, desc: 'Fluid Viscosity Flow', category: 'simulation' },
    { id: 'MAGNET', label: 'MAGNET', icon: Magnet, desc: 'Magnetic Pull', category: 'simulation' },
    { id: 'MELT', label: 'MELT', icon: Droplet, desc: 'Viscous Gravity', category: 'simulation' },
    { id: 'ORBIT', label: 'ORBIT', icon: RotateCw, desc: 'Singularity Rotation', category: 'simulation' },
    { id: 'PULSE', label: 'PULSE', icon: Heart, desc: 'Rhythmic Inflation', category: 'simulation' },
    { id: 'REPEL', label: 'REPEL', icon: Expand, desc: 'Anti-Gravity Field', category: 'simulation' },
    { id: 'SHATTER', label: 'SHATTER', icon: Scissors, desc: 'Voronoi Fracture', category: 'simulation' },
    { id: 'SPIKE', label: 'SPIKE', icon: Mountain, desc: 'Normal Extrusion', category: 'simulation' },
    { id: 'TECTONIC', label: 'TECTONIC', icon: Activity, desc: 'Seismic Plate Shift', category: 'simulation' },
    { id: 'TERRA', label: 'TERRA', icon: Globe, desc: 'Planetary Uplift', category: 'simulation' },
    { id: 'TERRACE', label: 'TERRACE', icon: ScanLine, desc: 'Height Quantization', category: 'simulation' },
    { id: 'THERMAL', label: 'THERMAL', icon: Thermometer, desc: 'Heat Diffusion', category: 'simulation' },
    { id: 'TWIST', label: 'TWIST', icon: Move, desc: 'Axial Torque', category: 'simulation' },
    { id: 'VELVET', label: 'VELVET', icon: Feather, desc: 'Soft Noise Inflation', category: 'simulation' },
    { id: 'VOID', label: 'VOID', icon: Sun, desc: 'Singularity Collapse', category: 'simulation' },
    { id: 'VORTEX', label: 'VORTEX', icon: Tornado, desc: 'Fluid Swirl', category: 'simulation' },
    { id: 'WAVE', label: 'WAVE', icon: Waves, desc: 'Ripple Propagation', category: 'simulation' },
];

// ============================================================================
// PROCEDURAL BRUSHES (Noise-based)
// ============================================================================

export const PROCEDURAL_BRUSHES: BrushDefinition[] = [
    { id: 'NOISE', icon: Shuffle, label: 'NOISE', key: 'N', desc: 'Entropy & Chaos', category: 'procedural' },
    { id: 'TERRAIN', icon: Mountain, label: 'TERRAIN', key: 'T', desc: 'Terrain sculpting (fBm)', category: 'procedural' },
];

// ============================================================================
// EXPERIMENTAL BRUSHES (Groundbreaking - Flexing on ZBrush 🔥)
// ============================================================================

export const EXPERIMENTAL_BRUSHES: BrushDefinition[] = [
    { id: 'ELASTIC', icon: Expand, label: 'ELASTIC', desc: 'Rubber-band physics', category: 'simulation' },
    { id: 'VECTOR_FIELD', icon: Tornado, label: 'VECTOR FIELD', desc: 'Curl noise flow sculpting', category: 'simulation' },
    { id: 'HOLOGRAM', icon: Monitor, label: 'HOLOGRAM', desc: 'Wave interference patterns', category: 'simulation' },
    { id: 'ATTRACTOR', icon: Atom, label: 'ATTRACTOR', desc: 'Multi-point gravity wells', category: 'simulation' },
];

// ============================================================================
// COMBINED - All brushes
// ============================================================================

export const ALL_BRUSHES: BrushDefinition[] = [
    ...STANDARD_BRUSHES,
    ...PROCEDURAL_BRUSHES,
    ...SIMULATION_BRUSHES,
    ...EXPERIMENTAL_BRUSHES,
].sort((a, b) => a.label.localeCompare(b.label));

// Legacy export for compatibility
export const BRUSHES = STANDARD_BRUSHES;

// MATCAPS — re-exported from matcapSystem (procedural, no external files)
// ============================================================================

// Re-export the new procedural system under the old names so all existing
// imports of `MATCAPS` / `getMatCapTexture` from this file keep working.
export {
    MATCAP_IDS as MATCAPS,
    getProceduralMatcap as getMatCapTexture,
    getAllMatcapIds,
    getMatcapDef,
    MATCAP_LIBRARY,
    buildEnhancedMatcapMaterial,
    swapMatcapTexture,
} from './matcapSystem';

// Keep legacy type alias (now just string — any matcap id is valid)
export type MatCapId = string;

// ============================================================================
// OTHER CONSTANTS
// ============================================================================

export const MAX_HISTORY = 15;
export const HOVER_COLOR = 0x3daee9;