/**
 * useBrushConfig - React hook for loading brushes from ConfigRegistry
 * 
 * Provides data-driven brush loading for KSculpt, KPainter, and KGraphos.
 */

import { useState, useEffect } from 'react';
import { listBrushes, listBrushesByCategory, type BrushConfig } from '@/services/configClient';

export interface UseBrushConfigOptions {
  /** Filter by category (optional) */
  category?: 'sculpt' | 'paint' | 'mask' | 'smooth';
  /** Auto-load on mount */
  autoLoad?: boolean;
}

export interface UseBrushConfigResult {
  brushes: BrushConfig[];
  loading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
  getBrushById: (id: string) => BrushConfig | undefined;
}

/**
 * Load brushes from the ConfigRegistry
 * 
 * @example
 * // Load all brushes
 * const { brushes, loading } = useBrushConfig();
 * 
 * @example
 * // Load only sculpting brushes
 * const { brushes } = useBrushConfig({ category: 'sculpt' });
 * 
 * @example
 * // Load only painting brushes
 * const { brushes } = useBrushConfig({ category: 'paint' });
 */
export function useBrushConfig(options: UseBrushConfigOptions = {}): UseBrushConfigResult {
  const { category, autoLoad = true } = options;
  
  const [brushes, setBrushes] = useState<BrushConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const loadBrushes = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const loadedBrushes = category 
        ? await listBrushesByCategory(category)
        : await listBrushes();
      
      setBrushes(loadedBrushes);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      console.error('[useBrushConfig] Failed to load brushes:', error);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    if (autoLoad) {
      loadBrushes();
    }
  }, [category, autoLoad]);
  
  const getBrushById = (id: string): BrushConfig | undefined => {
    return brushes.find(b => b.id === id);
  };
  
  return {
    brushes,
    loading,
    error,
    reload: loadBrushes,
    getBrushById,
  };
}
