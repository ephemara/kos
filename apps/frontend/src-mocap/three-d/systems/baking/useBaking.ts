/**
 * useBaking.ts
 * 
 * React hook for the baking system.
 * Provides easy access to normal, curvature, and AO baking.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { NormalMapBaker } from './NormalMapBaker';
import { CurvatureBaker } from './CurvatureBaker';
import { AOBaker } from './AOBaker';
import {
  BakedMapSet,
  BakingResult,
  BakingOptions,
  BakingProgress,
  BakingCacheEntry,
  BakingResolution,
  NormalMapBakingParams,
  CurvatureMapBakingParams,
  AOBakingParams,
} from './BakingTypes';

/**
 * Options for the baking hook
 */
export interface UseBakingOptions {
  /** WebGL renderer (required) */
  renderer: THREE.WebGLRenderer;
  
  /** Whether to enable caching */
  enableCache?: boolean;
  
  /** Maximum cache size (number of entries) */
  maxCacheSize?: number;
  
  /** Default resolution for baking */
  defaultResolution?: BakingResolution;
}

/**
 * Baking hook state
 */
export interface UseBakingState {
  /** Whether a baking operation is in progress */
  isBaking: boolean;
  
  /** Current baking progress */
  progress: BakingProgress | null;
  
  /** Last baking error */
  error: Error | null;
  
  /** Last baking result */
  lastResult: BakingResult | null;
  
  /** Cached map sets */
  cache: Map<string, BakingCacheEntry>;
}

/**
 * Baking hook return type
 */
export interface UseBakingReturn extends UseBakingState {
  /** Bake a normal map */
  bakeNormalMap: (params: NormalMapBakingParams, options?: BakingOptions) => Promise<BakingResult>;
  
  /** Bake a curvature map */
  bakeCurvatureMap: (params: CurvatureMapBakingParams, options?: BakingOptions) => Promise<BakingResult>;
  
  /** Bake an ambient occlusion map */
  bakeAOMap: (params: AOBakingParams, options?: BakingOptions) => Promise<BakingResult>;
  
  /** Bake all maps for a mesh */
  bakeAllMaps: (
    mesh: THREE.Mesh,
    resolution?: BakingResolution,
    options?: BakingOptions
  ) => Promise<BakedMapSet>;
  
  /** Get cached maps for a mesh */
  getCachedMaps: (mesh: THREE.Mesh) => BakedMapSet | null;
  
  /** Clear cache for a specific mesh */
  clearCache: (mesh?: THREE.Mesh) => void;
  
  /** Dispose of all resources */
  dispose: () => void;
}

/**
 * React hook for baking system
 */
export function useBaking(options: UseBakingOptions): UseBakingReturn {
  const {
    renderer,
    enableCache = true,
    maxCacheSize = 10,
    defaultResolution = 1024,
  } = options;

  // State
  const [isBaking, setIsBaking] = useState(false);
  const [progress, setProgress] = useState<BakingProgress | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [lastResult, setLastResult] = useState<BakingResult | null>(null);
  const [cache, setCache] = useState<Map<string, BakingCacheEntry>>(new Map());

  // Refs for bakers
  const normalBakerRef = useRef<NormalMapBaker | null>(null);
  const curvatureBakerRef = useRef<CurvatureBaker | null>(null);
  const aoBakerRef = useRef<AOBaker | null>(null);

  // Initialize bakers
  useEffect(() => {
    normalBakerRef.current = new NormalMapBaker(renderer);
    curvatureBakerRef.current = new CurvatureBaker(renderer);
    aoBakerRef.current = new AOBaker(renderer);

    return () => {
      normalBakerRef.current?.dispose();
      curvatureBakerRef.current?.dispose();
      aoBakerRef.current?.dispose();
    };
  }, [renderer]);

  // Get mesh ID for caching
  const getMeshId = useCallback((mesh: THREE.Mesh): string => {
    return (mesh as any).uuid || mesh.id.toString();
  }, []);

  // Bake normal map
  const bakeNormalMap = useCallback(async (
    params: NormalMapBakingParams,
    options?: BakingOptions
  ): Promise<BakingResult> => {
    if (!normalBakerRef.current) {
      throw new Error('[useBaking] Normal baker not initialized');
    }

    setIsBaking(true);
    setError(null);
    setProgress(null);

    try {
      const result = await normalBakerRef.current.bake(params, {
        ...options,
        onProgress: (p) => {
          setProgress(p);
          options?.onProgress?.(p);
        },
      });

      setLastResult(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setIsBaking(false);
      setProgress(null);
    }
  }, []);

  // Bake curvature map
  const bakeCurvatureMap = useCallback(async (
    params: CurvatureMapBakingParams,
    options?: BakingOptions
  ): Promise<BakingResult> => {
    if (!curvatureBakerRef.current) {
      throw new Error('[useBaking] Curvature baker not initialized');
    }

    setIsBaking(true);
    setError(null);
    setProgress(null);

    try {
      const result = await curvatureBakerRef.current.bake(params, {
        ...options,
        onProgress: (p) => {
          setProgress(p);
          options?.onProgress?.(p);
        },
      });

      setLastResult(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setIsBaking(false);
      setProgress(null);
    }
  }, []);

  // Bake AO map
  const bakeAOMap = useCallback(async (
    params: AOBakingParams,
    options?: BakingOptions
  ): Promise<BakingResult> => {
    if (!aoBakerRef.current) {
      throw new Error('[useBaking] AO baker not initialized');
    }

    setIsBaking(true);
    setError(null);
    setProgress(null);

    try {
      const result = await aoBakerRef.current.bake(params, {
        ...options,
        onProgress: (p) => {
          setProgress(p);
          options?.onProgress?.(p);
        },
      });

      setLastResult(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setIsBaking(false);
      setProgress(null);
    }
  }, []);

  // Bake all maps
  const bakeAllMaps = useCallback(async (
    mesh: THREE.Mesh,
    resolution: BakingResolution = defaultResolution,
    options?: BakingOptions
  ): Promise<BakedMapSet> => {
    const meshId = getMeshId(mesh);

    // Check cache first
    if (enableCache && cache.has(meshId)) {
      const cached = cache.get(meshId)!;
      console.log(`[useBaking] Using cached maps for mesh ${meshId}`);
      return cached.maps;
    }

    setIsBaking(true);
    setError(null);

    try {
      // Bake all maps in parallel
      const [normalResult, curvatureResult, aoResult] = await Promise.all([
        bakeNormalMap({
          mesh,
          resolution,
          tangentSpace: false,
        }, options),
        bakeCurvatureMap({
          mesh,
          resolution,
          sensitivity: 1.0,
          separateChannels: true,
        }, options),
        bakeAOMap({
          mesh,
          resolution,
          samples: 32,
          distance: 0.5,
          bias: 0.01,
          intensity: 1.0,
          useGPU: true,
        }, options),
      ]);

      const mapSet: BakedMapSet = {
        normalMap: normalResult.texture,
        curvatureMap: curvatureResult.texture,
        aoMap: aoResult.texture,
        metadata: {
          resolution,
          quality: 'production',
          timestamp: Date.now(),
        },
      };

      // Cache the result
      if (enableCache) {
        const newCache = new Map(cache);
        
        // Enforce cache size limit
        if (newCache.size >= maxCacheSize) {
          const firstKey = newCache.keys().next().value;
          const oldEntry = newCache.get(firstKey);
          if (oldEntry) {
            // Dispose old textures
            oldEntry.maps.normalMap?.dispose();
            oldEntry.maps.curvatureMap?.dispose();
            oldEntry.maps.aoMap?.dispose();
          }
          newCache.delete(firstKey);
        }

        newCache.set(meshId, {
          maps: mapSet,
          meshId,
          timestamp: Date.now(),
          config: {
            resolution,
            quality: 'production',
            useGPU: true,
          },
        });

        setCache(newCache);
      }

      return mapSet;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setIsBaking(false);
    }
  }, [
    defaultResolution,
    enableCache,
    maxCacheSize,
    cache,
    getMeshId,
    bakeNormalMap,
    bakeCurvatureMap,
    bakeAOMap,
  ]);

  // Get cached maps
  const getCachedMaps = useCallback((mesh: THREE.Mesh): BakedMapSet | null => {
    const meshId = getMeshId(mesh);
    const entry = cache.get(meshId);
    return entry ? entry.maps : null;
  }, [cache, getMeshId]);

  // Clear cache
  const clearCache = useCallback((mesh?: THREE.Mesh) => {
    if (mesh) {
      const meshId = getMeshId(mesh);
      const entry = cache.get(meshId);
      if (entry) {
        // Dispose textures
        entry.maps.normalMap?.dispose();
        entry.maps.curvatureMap?.dispose();
        entry.maps.aoMap?.dispose();
      }
      const newCache = new Map(cache);
      newCache.delete(meshId);
      setCache(newCache);
    } else {
      // Clear all cache
      cache.forEach(entry => {
        entry.maps.normalMap?.dispose();
        entry.maps.curvatureMap?.dispose();
        entry.maps.aoMap?.dispose();
      });
      setCache(new Map());
    }
  }, [cache, getMeshId]);

  // Dispose
  const dispose = useCallback(() => {
    normalBakerRef.current?.dispose();
    curvatureBakerRef.current?.dispose();
    aoBakerRef.current?.dispose();
    clearCache();
  }, [clearCache]);

  return {
    isBaking,
    progress,
    error,
    lastResult,
    cache,
    bakeNormalMap,
    bakeCurvatureMap,
    bakeAOMap,
    bakeAllMaps,
    getCachedMaps,
    clearCache,
    dispose,
  };
}

/**
 * Simplified hook for quick baking
 */
export function useQuickBaking(renderer: THREE.WebGLRenderer) {
  const baking = useBaking({ renderer });

  const quickBake = useCallback(async (mesh: THREE.Mesh) => {
    return baking.bakeAllMaps(mesh, 1024);
  }, [baking]);

  return {
    ...baking,
    quickBake,
  };
}
