/**
 * Baking System
 * 
 * Real-time texture baking for 3D meshes.
 * Exports all baking components and types.
 */

// Types
export * from './BakingTypes';

// Bakers
export { NormalMapBaker } from './NormalMapBaker';
export { CurvatureBaker } from './CurvatureBaker';
export { AOBaker } from './AOBaker';

// Hooks
export { useBaking, useQuickBaking } from './useBaking';
export type { UseBakingOptions, UseBakingState, UseBakingReturn } from './useBaking';
