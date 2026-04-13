/**
 * React Hook for Masking System
 * 
 * Provides a reactive wrapper around the masking system for use in React components.
 * Manages mask generation, caching, and state updates for procedural masking.
 * 
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { generateMask, currentMask, isGenerating } = useMasking(renderer);
 * 
 *   const handleGenerateEdgeMask = async () => {
 *     const mask = await generateMask(mesh, {
 *       type: 'curvature',
 *       mode: 'edge',
 *       threshold: 0.5,
 *       strength: 1.0,
 *       invert: false,
 *       feather: 0.1,
 *     });
 *   };
 * 
 *   return (
 *     <div>
 *       <button onClick={handleGenerateEdgeMask} disabled={isGenerating}>
 *         Generate Edge Mask
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { SmartMaskSystem } from './SmartMask';
import { CurvatureMask } from './CurvatureMask';
import { HeightMask } from './HeightMask';
import { SlopeMask } from './SlopeMask';
import type {
  AnyMaskConfig,
  CombinedMaskConfig,
  BakedMaskMaps,
  MaskGenerationResult,
  CurvatureMaskConfig,
  HeightMaskConfig,
  SlopeMaskConfig,
} from './MaskTypes';

/**
 * Return type for the useMasking hook.
 */
export interface UseMaskingReturn {
  /** Generate a mask from configuration */
  generateMask: (
    mesh: THREE.Mesh,
    config: AnyMaskConfig | CombinedMaskConfig,
    resolution?: number
  ) => Promise<THREE.Texture>;
  
  /** Generate curvature-based edge mask */
  generateEdgeMask: (
    mesh: THREE.Mesh,
    config?: Partial<CurvatureMaskConfig>,
    resolution?: number
  ) => Promise<THREE.Texture>;
  
  /** Generate curvature-based cavity mask */
  generateCavityMask: (
    mesh: THREE.Mesh,
    config?: Partial<CurvatureMaskConfig>,
    resolution?: number
  ) => Promise<THREE.Texture>;
  
  /** Generate height-based mask */
  generateHeightMask: (
    mesh: THREE.Mesh,
    config?: Partial<HeightMaskConfig>,
    resolution?: number
  ) => Promise<THREE.Texture>;
  
  /** Generate slope-based mask */
  generateSlopeMask: (
    mesh: THREE.Mesh,
    config?: Partial<SlopeMaskConfig>,
    resolution?: number
  ) => Promise<THREE.Texture>;
  
  /** Bake maps for a mesh (cached) */
  bakeMaps: (mesh: THREE.Mesh, resolution?: number) => Promise<BakedMaskMaps>;
  
  /** Clear cached maps for a mesh */
  clearMapsCache: (mesh?: THREE.Mesh) => void;
  
  /** Currently generated mask texture */
  currentMask: THREE.Texture | null;
  
  /** Whether a mask is currently being generated */
  isGenerating: boolean;
  
  /** Last generation time in milliseconds */
  lastGenerationTime: number | null;
  
  /** Cached baked maps */
  cachedMaps: Map<string, BakedMaskMaps>;
}

/**
 * Options for configuring the useMasking hook.
 */
export interface UseMaskingOptions {
  /** Default resolution for mask generation */
  defaultResolution?: number;
  
  /** Whether to automatically cache baked maps */
  autoCache?: boolean;
  
  /** Maximum number of cached map sets */
  maxCacheSize?: number;
}

/**
 * React hook for procedural mask generation with reactive state updates.
 * 
 * Creates masking system instances and provides convenient methods for generating
 * various types of masks. Automatically manages caching and state updates.
 * 
 * @param renderer - WebGL renderer for GPU operations
 * @param options - Optional configuration for the masking system
 * @returns Object containing mask generation methods and reactive state
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const { generateMask, currentMask, isGenerating } = useMasking(renderer);
 * 
 * // Generate edge mask
 * const edgeMask = await generateEdgeMask(mesh, {
 *   threshold: 0.7,
 *   strength: 1.0,
 * });
 * 
 * // Generate combined mask
 * const combinedMask = await generateMask(mesh, {
 *   masks: [
 *     { type: 'curvature', mode: 'edge', threshold: 0.5, strength: 1.0, invert: false, feather: 0.1 },
 *     { type: 'height', minHeight: 0, maxHeight: 10, falloff: 1.0, strength: 1.0, invert: false, feather: 0.1 },
 *   ],
 *   blendMode: 'multiply',
 *   strength: 1.0,
 * });
 * ```
 */
export function useMasking(
  renderer: THREE.WebGLRenderer,
  options: UseMaskingOptions = {}
): UseMaskingReturn {
  const {
    defaultResolution = 1024,
    autoCache = true,
    maxCacheSize = 10,
  } = options;

  // Create masking system instances once and keep them stable
  const smartMaskRef = useRef<SmartMaskSystem | null>(null);
  const curvatureMaskRef = useRef<CurvatureMask | null>(null);
  const heightMaskRef = useRef<HeightMask | null>(null);
  const slopeMaskRef = useRef<SlopeMask | null>(null);
  
  if (smartMaskRef.current === null) {
    smartMaskRef.current = new SmartMaskSystem(renderer);
    curvatureMaskRef.current = new CurvatureMask(renderer);
    heightMaskRef.current = new HeightMask(renderer);
    slopeMaskRef.current = new SlopeMask(renderer);
  }

  const smartMask = smartMaskRef.current;
  const curvatureMask = curvatureMaskRef.current;
  const heightMask = heightMaskRef.current;
  const slopeMask = slopeMaskRef.current;

  // Reactive state
  const [currentMask, setCurrentMask] = useState<THREE.Texture | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastGenerationTime, setLastGenerationTime] = useState<number | null>(null);
  const [cachedMaps, setCachedMaps] = useState<Map<string, BakedMaskMaps>>(new Map());

  // Get mesh ID for caching
  const getMeshId = useCallback((mesh: THREE.Mesh): string => {
    return (mesh as any).uuid || mesh.id.toString();
  }, []);

  // Bake maps for a mesh
  const bakeMaps = useCallback(async (
    mesh: THREE.Mesh,
    resolution: number = defaultResolution
  ): Promise<BakedMaskMaps> => {
    const meshId = getMeshId(mesh);
    
    // Check cache first
    if (autoCache && cachedMaps.has(meshId)) {
      return cachedMaps.get(meshId)!;
    }

    // Bake new maps
    const maps = await smartMask.bakeMaps(mesh, resolution);

    // Cache if enabled
    if (autoCache) {
      setCachedMaps(prev => {
        const newCache = new Map(prev);
        
        // Enforce max cache size (LRU-style)
        if (newCache.size >= maxCacheSize) {
          const firstKey = newCache.keys().next().value;
          const oldMaps = newCache.get(firstKey);
          if (oldMaps) {
            // Dispose old maps
            oldMaps.curvatureMap?.dispose();
            oldMaps.normalMap?.dispose();
            oldMaps.positionMap?.dispose();
            oldMaps.aoMap?.dispose();
          }
          newCache.delete(firstKey);
        }
        
        newCache.set(meshId, maps);
        return newCache;
      });
    }

    return maps;
  }, [smartMask, getMeshId, autoCache, cachedMaps, maxCacheSize, defaultResolution]);

  // Clear cached maps
  const clearMapsCache = useCallback((mesh?: THREE.Mesh) => {
    if (mesh) {
      const meshId = getMeshId(mesh);
      setCachedMaps(prev => {
        const newCache = new Map(prev);
        const maps = newCache.get(meshId);
        if (maps) {
          maps.curvatureMap?.dispose();
          maps.normalMap?.dispose();
          maps.positionMap?.dispose();
          maps.aoMap?.dispose();
        }
        newCache.delete(meshId);
        return newCache;
      });
    } else {
      // Clear all cached maps
      cachedMaps.forEach(maps => {
        maps.curvatureMap?.dispose();
        maps.normalMap?.dispose();
        maps.positionMap?.dispose();
        maps.aoMap?.dispose();
      });
      setCachedMaps(new Map());
    }
  }, [getMeshId, cachedMaps]);

  // Generate mask from configuration
  const generateMask = useCallback(async (
    mesh: THREE.Mesh,
    config: AnyMaskConfig | CombinedMaskConfig,
    resolution: number = defaultResolution
  ): Promise<THREE.Texture> => {
    setIsGenerating(true);
    
    try {
      // Bake maps if needed
      const maps = await bakeMaps(mesh, resolution);

      // Generate mask
      const result: MaskGenerationResult = smartMask.generateMask({
        mesh,
        config,
        bakedMaps: maps,
        resolution,
        renderer,
      });

      setCurrentMask(result.maskTexture);
      setLastGenerationTime(result.timeMs);

      return result.maskTexture;
    } finally {
      setIsGenerating(false);
    }
  }, [smartMask, bakeMaps, renderer, defaultResolution]);

  // Generate edge mask
  const generateEdgeMask = useCallback(async (
    mesh: THREE.Mesh,
    config: Partial<CurvatureMaskConfig> = {},
    resolution: number = defaultResolution
  ): Promise<THREE.Texture> => {
    setIsGenerating(true);
    
    try {
      const startTime = performance.now();
      const mask = curvatureMask.generateEdgeMask(mesh, config, resolution);
      const timeMs = performance.now() - startTime;

      setCurrentMask(mask);
      setLastGenerationTime(timeMs);

      return mask;
    } finally {
      setIsGenerating(false);
    }
  }, [curvatureMask, defaultResolution]);

  // Generate cavity mask
  const generateCavityMask = useCallback(async (
    mesh: THREE.Mesh,
    config: Partial<CurvatureMaskConfig> = {},
    resolution: number = defaultResolution
  ): Promise<THREE.Texture> => {
    setIsGenerating(true);
    
    try {
      const startTime = performance.now();
      const mask = curvatureMask.generateCavityMask(mesh, config, resolution);
      const timeMs = performance.now() - startTime;

      setCurrentMask(mask);
      setLastGenerationTime(timeMs);

      return mask;
    } finally {
      setIsGenerating(false);
    }
  }, [curvatureMask, defaultResolution]);

  // Generate height mask
  const generateHeightMask = useCallback(async (
    mesh: THREE.Mesh,
    config: Partial<HeightMaskConfig> = {},
    resolution: number = defaultResolution
  ): Promise<THREE.Texture> => {
    setIsGenerating(true);
    
    try {
      const startTime = performance.now();
      const mask = heightMask.generateHeightMask(mesh, config, resolution);
      const timeMs = performance.now() - startTime;

      setCurrentMask(mask);
      setLastGenerationTime(timeMs);

      return mask;
    } finally {
      setIsGenerating(false);
    }
  }, [heightMask, defaultResolution]);

  // Generate slope mask
  const generateSlopeMask = useCallback(async (
    mesh: THREE.Mesh,
    config: Partial<SlopeMaskConfig> = {},
    resolution: number = defaultResolution
  ): Promise<THREE.Texture> => {
    setIsGenerating(true);
    
    try {
      const startTime = performance.now();
      const mask = slopeMask.generateSlopeMask(mesh, config, resolution);
      const timeMs = performance.now() - startTime;

      setCurrentMask(mask);
      setLastGenerationTime(timeMs);

      return mask;
    } finally {
      setIsGenerating(false);
    }
  }, [slopeMask, defaultResolution]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Dispose current mask
      if (currentMask) {
        currentMask.dispose();
      }
      
      // Dispose cached maps
      cachedMaps.forEach(maps => {
        maps.curvatureMap?.dispose();
        maps.normalMap?.dispose();
        maps.positionMap?.dispose();
        maps.aoMap?.dispose();
      });
      
      // Dispose masking systems
      smartMask.dispose();
    };
  }, []);

  return {
    generateMask,
    generateEdgeMask,
    generateCavityMask,
    generateHeightMask,
    generateSlopeMask,
    bakeMaps,
    clearMapsCache,
    currentMask,
    isGenerating,
    lastGenerationTime,
    cachedMaps,
  };
}

/**
 * Hook variant that provides only mask generation methods without reactive state.
 * 
 * Useful when you need mask generation but don't need reactive updates in the component.
 * 
 * @param renderer - WebGL renderer for GPU operations
 * @param options - Optional configuration for the masking system
 * @returns Object containing mask generation methods
 * 
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { generateEdgeMask } = useMaskingMethods(renderer);
 * 
 *   const handleGenerateMask = useCallback(async () => {
 *     const mask = await generateEdgeMask(mesh, { threshold: 0.7 });
 *     // Use mask...
 *   }, [generateEdgeMask, mesh]);
 * 
 *   return <button onClick={handleGenerateMask}>Generate Mask</button>;
 * }
 * ```
 */
export function useMaskingMethods(
  renderer: THREE.WebGLRenderer,
  options: UseMaskingOptions = {}
) {
  const {
    generateMask,
    generateEdgeMask,
    generateCavityMask,
    generateHeightMask,
    generateSlopeMask,
    bakeMaps,
    clearMapsCache,
  } = useMasking(renderer, options);

  return {
    generateMask,
    generateEdgeMask,
    generateCavityMask,
    generateHeightMask,
    generateSlopeMask,
    bakeMaps,
    clearMapsCache,
  };
}
