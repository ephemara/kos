/**
 * Masking System
 * 
 * Universal masking system for procedural mask generation in 3D applications.
 * Supports curvature, height, slope-based masking with GPU acceleration.
 */

// Type definitions
export * from './MaskTypes';

// Core masking systems
export { SmartMaskSystem } from './SmartMask';
export { CurvatureMask } from './CurvatureMask';
export { HeightMask } from './HeightMask';
export { SlopeMask } from './SlopeMask';

// React hooks
export { useMasking, useMaskingMethods } from './useMasking';
export type { UseMaskingReturn, UseMaskingOptions } from './useMasking';
