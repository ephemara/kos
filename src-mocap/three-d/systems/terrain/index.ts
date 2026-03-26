/**
 * TERRAIN SYSTEM
 * 
 * Universal terrain generation, simulation, and erosion system.
 * Extracted from Tecton feature for use across any terrain-based application.
 * 
 * @module terrain
 */

// Core classes
export { TerrainSimulation } from './TerrainSimulation';
export type { TerrainSimulationConfig, SimulationState } from './TerrainSimulation';

export { HeightmapGenerator, generateTerrainData } from './HeightmapGenerator';
export { ErosionSimulator } from './ErosionSimulator';

// React hook
export { useTerrain } from './useTerrain';
export type { TerrainState, TerrainActions, UseTerrainReturn } from './useTerrain';

// Types
export * from './TerrainTypes';
