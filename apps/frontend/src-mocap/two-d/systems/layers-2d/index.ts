/**
 * 2D Layer System
 * 
 * Layer management components optimized for 2D canvas and painting applications.
 * Built on top of the universal layer system from shared/systems/layers.
 */

export { LayerPanel2D } from './LayerPanel2D';
export type { LayerPanel2DProps } from './LayerPanel2D';

// Re-export universal layer types and utilities for convenience
export type {
  Layer,
  LayerManager,
  BlendMode,
  LayerEvent,
  LayerEventType,
  LayerEventListener
} from '@mocap/shared/systems/layers/LayerTypes';

export { LayerManager as LayerManagerClass } from '@mocap/shared/systems/layers/LayerManager';
export { useLayerManager, useLayerManagerInstance } from '@mocap/shared/systems/layers/useLayerManager';
export type { UseLayerManagerReturn, UseLayerManagerOptions } from '@mocap/shared/systems/layers/useLayerManager';
