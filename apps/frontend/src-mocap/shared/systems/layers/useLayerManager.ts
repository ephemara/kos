/**
 * React Hook for Layer Management
 * 
 * Provides a reactive wrapper around the LayerManager class for use in React components.
 * Automatically subscribes to layer events and triggers re-renders when layers change.
 * 
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { manager, layers, activeLayerId } = useLayerManager();
 * 
 *   const handleAddLayer = () => {
 *     manager.addLayer({ name: 'New Layer' });
 *   };
 * 
 *   return (
 *     <div>
 *       <button onClick={handleAddLayer}>Add Layer</button>
 *       {layers.map(layer => (
 *         <div key={layer.id}>{layer.name}</div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { LayerManager } from './LayerManager';
import type { Layer } from './LayerTypes';

/**
 * Return type for the useLayerManager hook.
 */
export interface UseLayerManagerReturn {
  /** The LayerManager instance for direct method calls */
  manager: LayerManager;
  
  /** Reactive array of all layers (bottom to top) */
  layers: Layer[];
  
  /** Reactive ID of the currently active layer, or null if none */
  activeLayerId: string | null;
  
  /** Reactive reference to the currently active layer, or null if none */
  activeLayer: Layer | null;
}

/**
 * Options for configuring the useLayerManager hook.
 */
export interface UseLayerManagerOptions {
  /** Optional initial layers to populate the manager with */
  initialLayers?: Layer[];
  
  /** Whether to automatically add a default layer if none exist (default: false) */
  autoAddDefaultLayer?: boolean;
  
  /** Name for the default layer if autoAddDefaultLayer is true */
  defaultLayerName?: string;
}

/**
 * React hook for managing layers with reactive state updates.
 * 
 * Creates a LayerManager instance and subscribes to its events, triggering
 * React re-renders when layers change. The manager instance is stable across
 * renders (created only once), while the layers and activeLayerId are reactive.
 * 
 * @param options - Optional configuration for the layer manager
 * @returns Object containing the manager instance and reactive state
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const { manager, layers, activeLayerId } = useLayerManager();
 * 
 * // With initial layers
 * const { manager, layers } = useLayerManager({
 *   initialLayers: [
 *     { id: 'bg', name: 'Background', visible: true, locked: false, solo: false, opacity: 1, blendMode: 'normal' }
 *   ]
 * });
 * 
 * // With auto-created default layer
 * const { manager, layers } = useLayerManager({
 *   autoAddDefaultLayer: true,
 *   defaultLayerName: 'Layer 1'
 * });
 * ```
 */
export function useLayerManager(options: UseLayerManagerOptions = {}): UseLayerManagerReturn {
  const {
    initialLayers,
    autoAddDefaultLayer = false,
    defaultLayerName = 'Layer 1'
  } = options;

  // Create manager instance once and keep it stable across renders
  const managerRef = useRef<LayerManager | null>(null);
  
  if (managerRef.current === null) {
    managerRef.current = new LayerManager(initialLayers);
    
    // Add default layer if requested and no initial layers provided
    if (autoAddDefaultLayer && (!initialLayers || initialLayers.length === 0)) {
      managerRef.current.addLayer({ name: defaultLayerName });
    }
  }

  const manager = managerRef.current;

  // Reactive state for layers and active layer ID
  const [layers, setLayers] = useState<Layer[]>(() => [...manager.layers]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(() => manager.activeLayerId);

  // Subscribe to layer events and update reactive state
  useEffect(() => {
    // Handler to update layers array on any layer change
    const handleLayerChange = () => {
      setLayers([...manager.layers]);
    };

    // Handler to update active layer ID
    const handleActiveLayerChange = () => {
      setActiveLayerId(manager.activeLayerId);
    };

    // Subscribe to all layer events
    const unsubscribeAdded = manager.on('layer-added', handleLayerChange);
    const unsubscribeRemoved = manager.on('layer-removed', handleLayerChange);
    const unsubscribeUpdated = manager.on('layer-updated', handleLayerChange);
    const unsubscribeReordered = manager.on('layer-reordered', handleLayerChange);
    const unsubscribeActiveChanged = manager.on('active-layer-changed', () => {
      handleActiveLayerChange();
      handleLayerChange(); // Also update layers in case of visual changes
    });

    // Cleanup: unsubscribe from all events on unmount
    return () => {
      unsubscribeAdded();
      unsubscribeRemoved();
      unsubscribeUpdated();
      unsubscribeReordered();
      unsubscribeActiveChanged();
    };
  }, [manager]);

  // Compute active layer from activeLayerId (memoized for performance)
  const activeLayer = useMemo(() => {
    if (!activeLayerId) return null;
    return layers.find(l => l.id === activeLayerId) || null;
  }, [layers, activeLayerId]);

  return {
    manager,
    layers,
    activeLayerId,
    activeLayer
  };
}

/**
 * Hook variant that returns only the manager instance without reactive state.
 * 
 * Useful when you need the manager for method calls but don't need reactive updates
 * in the component (e.g., when using the manager in callbacks or effects).
 * 
 * @param options - Optional configuration for the layer manager
 * @returns The LayerManager instance
 * 
 * @example
 * ```typescript
 * function MyComponent() {
 *   const manager = useLayerManagerInstance();
 * 
 *   const handleAddLayer = useCallback(() => {
 *     manager.addLayer({ name: 'New Layer' });
 *   }, [manager]);
 * 
 *   return <button onClick={handleAddLayer}>Add Layer</button>;
 * }
 * ```
 */
export function useLayerManagerInstance(options: UseLayerManagerOptions = {}): LayerManager {
  const { manager } = useLayerManager(options);
  return manager;
}
