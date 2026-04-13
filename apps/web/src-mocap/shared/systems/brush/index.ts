/**
 * UNIVERSAL BRUSH SYSTEM
 * 
 * Unified brush system for 2D and 3D applications.
 * 
 * @module brush
 */

// Core types
export * from './BrushTypes';

// Alpha brush system
export * from './AlphaBrush';

// Procedural brush system
export * from './ProceduralBrush';

// Re-export the existing KBrushEngine for compatibility
export { brushEngine, useBrushEngine, DEFAULT_BRUSH_SETTINGS } from './KBrushEngine';
export type { BrushSettings } from './KBrushEngine';

// UI components
export * from './ui';
