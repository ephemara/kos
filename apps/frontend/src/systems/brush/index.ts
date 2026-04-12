/**
 * K_OS Universal Brush System
 * 
 * Shared brush infrastructure for all K_OS apps:
 * - KSculpt: Alpha modulates displacement intensity
 * - KPainter: Alpha modulates paint opacity  
 * - KGraphos: Alpha modulates stroke rendering
 */

// Core engine
export * from './KBrushEngine';
export { default as brushEngine } from './KBrushEngine';

// UI Components
export * from './ui';
