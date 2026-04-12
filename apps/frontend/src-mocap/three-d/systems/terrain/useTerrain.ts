/**
 * TERRAIN SYSTEM HOOK
 * 
 * React hook for easy integration of terrain generation and simulation.
 * Provides a clean API for terrain operations in React components.
 * 
 * @module useTerrain
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { TerrainSimulation, TerrainSimulationConfig } from './TerrainSimulation';
import { HeightmapGenerator } from './HeightmapGenerator';
import { ErosionSimulator } from './ErosionSimulator';
import {
  TerrainConfig,
  TerrainEffect,
  HeightmapData,
  NoiseParams,
  HydraulicErosionParams,
  ThermalErosionParams
} from './TerrainTypes';

/**
 * Terrain system state
 */
export interface TerrainState {
  /** Whether terrain is initialized */
  isInitialized: boolean;
  
  /** Whether simulation is running */
  isSimulating: boolean;
  
  /** Current active effect */
  activeEffect: TerrainEffect;
  
  /** Simulation speed multiplier */
  simSpeed: number;
  
  /** Current heightmap texture */
  heightmapTexture: THREE.Texture | null;
  
  /** Terrain resolution */
  resolution: number;
}

/**
 * Terrain system actions
 */
export interface TerrainActions {
  /** Initialize terrain system */
  initialize: (config: TerrainConfig, renderer: THREE.WebGLRenderer) => void;
  
  /** Generate new terrain using FBM noise */
  generateFBM: (params?: Partial<NoiseParams>) => void;
  
  /** Generate island terrain */
  generateIsland: (params?: Partial<NoiseParams>) => void;
  
  /** Generate ridged mountain terrain */
  generateRidged: (params?: Partial<NoiseParams>) => void;
  
  /** Generate flat terrain */
  generateFlat: (height?: number) => void;
  
  /** Apply hydraulic erosion */
  applyHydraulicErosion: (params: HydraulicErosionParams) => void;
  
  /** Apply thermal erosion */
  applyThermalErosion: (params: ThermalErosionParams) => void;
  
  /** Set active simulation effect */
  setActiveEffect: (effect: TerrainEffect) => void;
  
  /** Start/stop simulation */
  setSimulating: (simulating: boolean) => void;
  
  /** Set simulation speed */
  setSimSpeed: (speed: number) => void;
  
  /** Reset terrain to initial state */
  reset: () => void;
  
  /** Step simulation (call in animation loop) */
  step: () => void;
  
  /** Start recording simulation frames */
  startRecording: () => void;
  
  /** Stop recording simulation frames */
  stopRecording: () => void;
  
  /** Get history frame count */
  getHistoryLength: () => number;
  
  /** Get frame statistics */
  getFrameStats: () => number[];
  
  /** Dispose of terrain system */
  dispose: () => void;
}

/**
 * Terrain system hook return type
 */
export interface UseTerrainReturn {
  state: TerrainState;
  actions: TerrainActions;
}

/**
 * React hook for terrain generation and simulation
 * 
 * Provides a complete terrain system with generation, erosion, and GPU simulation.
 * 
 * @example
 * ```typescript
 * const { state, actions } = useTerrain();
 * 
 * // Initialize
 * useEffect(() => {
 *   if (renderer) {
 *     actions.initialize({
 *       resolution: 1024,
 *       sizeX: 10000,
 *       sizeZ: 10000,
 *       heightScale: 1200,
 *       seed: 12345
 *     }, renderer);
 *   }
 * }, [renderer]);
 * 
 * // Generate terrain
 * actions.generateIsland({ octaves: 6, scale: 3.0 });
 * 
 * // Start simulation
 * actions.setActiveEffect(TerrainEffect.HYDRAULIC);
 * actions.setSimulating(true);
 * 
 * // In animation loop
 * useFrame(() => {
 *   actions.step();
 * });
 * ```
 */
export function useTerrain(): UseTerrainReturn {
  // Refs for non-reactive objects
  const simulationRef = useRef<TerrainSimulation | null>(null);
  const generatorRef = useRef<HeightmapGenerator | null>(null);
  const erosionSimRef = useRef<ErosionSimulator | null>(null);
  const configRef = useRef<TerrainConfig | null>(null);
  
  // State
  const [state, setState] = useState<TerrainState>({
    isInitialized: false,
    isSimulating: false,
    activeEffect: TerrainEffect.ZERO_POINT,
    simSpeed: 1.0,
    heightmapTexture: null,
    resolution: 1024
  });
  
  /**
   * Initialize terrain system
   */
  const initialize = useCallback((config: TerrainConfig, renderer: THREE.WebGLRenderer) => {
    // Dispose existing
    if (simulationRef.current) {
      simulationRef.current.dispose();
    }
    
    // Create new instances
    const simConfig: TerrainSimulationConfig = {
      resolution: config.resolution,
      renderer,
      seed: config.seed
    };
    
    simulationRef.current = new TerrainSimulation(simConfig);
    generatorRef.current = new HeightmapGenerator(config.seed);
    erosionSimRef.current = new ErosionSimulator();
    configRef.current = config;
    
    setState(prev => ({
      ...prev,
      isInitialized: true,
      resolution: config.resolution,
      heightmapTexture: simulationRef.current!.getCurrentHeightmap()
    }));
  }, []);
  
  /**
   * Generate FBM terrain
   */
  const generateFBM = useCallback((params?: Partial<NoiseParams>) => {
    if (!generatorRef.current || !simulationRef.current) return;
    
    const heightmap = generatorRef.current.generateFBM(
      state.resolution,
      state.resolution,
      params
    );
    
    simulationRef.current.resetWithData(heightmap.data);
    
    setState(prev => ({
      ...prev,
      heightmapTexture: simulationRef.current!.getCurrentHeightmap()
    }));
  }, [state.resolution]);
  
  /**
   * Generate island terrain
   */
  const generateIsland = useCallback((params?: Partial<NoiseParams>) => {
    if (!generatorRef.current || !simulationRef.current) return;
    
    const heightmap = generatorRef.current.generateIsland(
      state.resolution,
      state.resolution,
      params
    );
    
    simulationRef.current.resetWithData(heightmap.data);
    
    setState(prev => ({
      ...prev,
      heightmapTexture: simulationRef.current!.getCurrentHeightmap()
    }));
  }, [state.resolution]);
  
  /**
   * Generate ridged terrain
   */
  const generateRidged = useCallback((params?: Partial<NoiseParams>) => {
    if (!generatorRef.current || !simulationRef.current) return;
    
    const heightmap = generatorRef.current.generateRidged(
      state.resolution,
      state.resolution,
      params
    );
    
    simulationRef.current.resetWithData(heightmap.data);
    
    setState(prev => ({
      ...prev,
      heightmapTexture: simulationRef.current!.getCurrentHeightmap()
    }));
  }, [state.resolution]);
  
  /**
   * Generate flat terrain
   */
  const generateFlat = useCallback((height: number = 0.5) => {
    if (!generatorRef.current || !simulationRef.current) return;
    
    const heightmap = generatorRef.current.generateFlat(
      state.resolution,
      state.resolution,
      height
    );
    
    simulationRef.current.resetWithData(heightmap.data);
    
    setState(prev => ({
      ...prev,
      heightmapTexture: simulationRef.current!.getCurrentHeightmap()
    }));
  }, [state.resolution]);
  
  /**
   * Apply hydraulic erosion (CPU-based)
   */
  const applyHydraulicErosion = useCallback(async (params: HydraulicErosionParams) => {
    if (!erosionSimRef.current || !simulationRef.current) return;
    
    // Read current heightmap from GPU
    const currentData = await simulationRef.current.readHeightmapData();
    
    const heightmap: HeightmapData = {
      data: currentData,
      width: state.resolution,
      height: state.resolution
    };
    
    // Apply erosion on CPU
    const eroded = erosionSimRef.current.hydraulicErosion(heightmap, params);
    
    // Upload back to GPU
    simulationRef.current.resetWithData(eroded.data);
    
    setState(prev => ({
      ...prev,
      heightmapTexture: simulationRef.current!.getCurrentHeightmap()
    }));
  }, [state.resolution]);
  
  /**
   * Apply thermal erosion (CPU-based)
   */
  const applyThermalErosion = useCallback(async (params: ThermalErosionParams) => {
    if (!erosionSimRef.current || !simulationRef.current) return;
    
    // Read current heightmap from GPU
    const currentData = await simulationRef.current.readHeightmapData();
    
    const heightmap: HeightmapData = {
      data: currentData,
      width: state.resolution,
      height: state.resolution
    };
    
    // Apply erosion on CPU
    const eroded = erosionSimRef.current.thermalErosion(heightmap, params);
    
    // Upload back to GPU
    simulationRef.current.resetWithData(eroded.data);
    
    setState(prev => ({
      ...prev,
      heightmapTexture: simulationRef.current!.getCurrentHeightmap()
    }));
  }, [state.resolution]);
  
  /**
   * Set active simulation effect
   */
  const setActiveEffect = useCallback((effect: TerrainEffect) => {
    if (!simulationRef.current) return;
    
    simulationRef.current.setActiveEffect(effect);
    
    setState(prev => ({
      ...prev,
      activeEffect: effect
    }));
  }, []);
  
  /**
   * Start/stop simulation
   */
  const setSimulating = useCallback((simulating: boolean) => {
    if (!simulationRef.current) return;
    
    simulationRef.current.setSimulating(simulating);
    
    setState(prev => ({
      ...prev,
      isSimulating: simulating
    }));
  }, []);
  
  /**
   * Set simulation speed
   */
  const setSimSpeed = useCallback((speed: number) => {
    if (!simulationRef.current) return;
    
    simulationRef.current.setSimSpeed(speed);
    
    setState(prev => ({
      ...prev,
      simSpeed: speed
    }));
  }, []);
  
  /**
   * Reset terrain
   */
  const reset = useCallback(() => {
    if (!simulationRef.current) return;
    
    simulationRef.current.reset();
    
    setState(prev => ({
      ...prev,
      heightmapTexture: simulationRef.current!.getCurrentHeightmap()
    }));
  }, []);
  
  /**
   * Step simulation
   */
  const step = useCallback(() => {
    if (!simulationRef.current) return;
    
    simulationRef.current.step();
    
    // Update texture reference if needed
    setState(prev => ({
      ...prev,
      heightmapTexture: simulationRef.current!.getCurrentHeightmap()
    }));
  }, []);
  
  /**
   * Start recording
   */
  const startRecording = useCallback(() => {
    if (!simulationRef.current) return;
    simulationRef.current.startRecording();
  }, []);
  
  /**
   * Stop recording
   */
  const stopRecording = useCallback(() => {
    if (!simulationRef.current) return;
    simulationRef.current.stopRecording();
  }, []);
  
  /**
   * Get history length
   */
  const getHistoryLength = useCallback(() => {
    if (!simulationRef.current) return 0;
    return simulationRef.current.getHistoryLength();
  }, []);
  
  /**
   * Get frame stats
   */
  const getFrameStats = useCallback(() => {
    if (!simulationRef.current) return [];
    return simulationRef.current.getFrameStats();
  }, []);
  
  /**
   * Dispose terrain system
   */
  const dispose = useCallback(() => {
    if (simulationRef.current) {
      simulationRef.current.dispose();
      simulationRef.current = null;
    }
    
    generatorRef.current = null;
    erosionSimRef.current = null;
    configRef.current = null;
    
    setState({
      isInitialized: false,
      isSimulating: false,
      activeEffect: TerrainEffect.ZERO_POINT,
      simSpeed: 1.0,
      heightmapTexture: null,
      resolution: 1024
    });
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      dispose();
    };
  }, [dispose]);
  
  return {
    state,
    actions: {
      initialize,
      generateFBM,
      generateIsland,
      generateRidged,
      generateFlat,
      applyHydraulicErosion,
      applyThermalErosion,
      setActiveEffect,
      setSimulating,
      setSimSpeed,
      reset,
      step,
      startRecording,
      stopRecording,
      getHistoryLength,
      getFrameStats,
      dispose
    }
  };
}
