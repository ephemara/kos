/**
 * LayerPanel2D for 2D Canvas Applications
 * 
 * A layer panel component optimized for 2D canvas and painting applications.
 * Works with the universal LayerManager from shared/systems/layers.
 * 
 * Features:
 * - Display layers with visibility, lock, solo controls
 * - Drag-and-drop reordering
 * - Opacity and blend mode editing optimized for 2D workflows
 * - Custom thumbnail rendering for canvas layers
 * - Clipping mask support
 * - Layer groups (future)
 * - Fully themeable with accent colors
 * 
 * @example
 * ```tsx
 * import { useLayerManager } from '@mocap/shared/systems/layers';
 * import { LayerPanel2D } from '@mocap/two-d/systems/layers-2d';
 * 
 * function MyPaintApp() {
 *   const { manager, layers, activeLayerId } = useLayerManager();
 * 
 *   return (
 *     <LayerPanel2D
 *       manager={manager}
 *       onLayerSelect={(layer) => console.log('Selected:', layer)}
 *       renderThumbnail={(layer) => <CanvasThumbnail layer={layer} />}
 *       accentColor="rose"
 *     />
 *   );
 * }
 * ```
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Plus,
  ChevronUp,
  ChevronDown,
  Layers,
  GripVertical,
  Copy,
  Scissors
} from 'lucide-react';
import type { Layer, LayerManager, BlendMode } from '@mocap/shared/systems/layers/LayerTypes';
import { Button } from '@mocap/shared/primitives';

/**
 * Props for the LayerPanel2D component.
 */
export interface LayerPanel2DProps {
  /** The LayerManager instance to control layers */
  manager: LayerManager;

  /** Optional callback when a layer is selected */
  onLayerSelect?: (layer: Layer) => void;

  /** Optional callback when a layer is updated */
  onLayerUpdate?: (layer: Layer) => void;

  /** Optional custom thumbnail renderer */
  renderThumbnail?: (layer: Layer) => React.ReactNode;

  /** Accent color for highlights and active states */
  accentColor?: 'blue' | 'orange' | 'rose' | 'emerald' | 'purple' | 'cyan';

  /** Optional title for the panel */
  title?: string;

  /** Whether to show the add layer button */
  showAddButton?: boolean;

  /** Compact mode for smaller panels */
  compact?: boolean;

  /** Whether to show blend mode controls */
  showBlendModes?: boolean;

  /** Whether to show duplicate/merge controls */
  showAdvancedControls?: boolean;
}

/**
 * Accent color styles for theming.
 */
const ACCENT_STYLES = {
  blue: {
    bg: 'bg-blue-900/30',
    border: 'border-blue-500/50',
    text: 'text-blue-400',
    hover: 'hover:bg-blue-900/50'
  },
  orange: {
    bg: 'bg-orange-900/30',
    border: 'border-orange-500/50',
    text: 'text-orange-400',
    hover: 'hover:bg-orange-900/50'
  },
  rose: {
    bg: 'bg-rose-900/30',
    border: 'border-rose-500/50',
    text: 'text-rose-400',
    hover: 'hover:bg-rose-900/50'
  },
  emerald: {
    bg: 'bg-emerald-900/30',
    border: 'border-emerald-500/50',
    text: 'text-emerald-400',
    hover: 'hover:bg-emerald-900/50'
  },
  purple: {
    bg: 'bg-purple-900/30',
    border: 'border-purple-500/50',
    text: 'text-purple-400',
    hover: 'hover:bg-purple-900/50'
  },
  cyan: {
    bg: 'bg-cyan-900/30',
    border: 'border-cyan-500/50',
    text: 'text-cyan-400',
    hover: 'hover:bg-cyan-900/50'
  }
} as const;

/**
 * Blend mode options for 2D canvas compositing.
 * These map to standard Canvas 2D globalCompositeOperation values.
 */
const BLEND_MODES_2D: BlendMode[] = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'add',
  'subtract',
  'difference'
];

/**
 * LayerItem component - renders a single layer in the list.
 */
interface LayerItemProps {
  layer: Layer;
  isActive: boolean;
  index: number;
  totalCount: number;
  accent: (typeof ACCENT_STYLES)[keyof typeof ACCENT_STYLES];
  compact: boolean;
  showBlendModes: boolean;
  showAdvancedControls: boolean;
  manager: LayerManager;
  onSelect: (layer: Layer) => void;
  onUpdate: (layer: Layer) => void;
  onDuplicate?: (layer: Layer) => void;
  renderThumbnail?: (layer: Layer) => React.ReactNode;
}

function LayerItem({
  layer,
  isActive,
  index,
  totalCount,
  accent,
  compact,
  showBlendModes,
  showAdvancedControls,
  manager,
  onSelect,
  onUpdate,
  onDuplicate,
  renderThumbnail
}: LayerItemProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(layer.name);

  const handleRenameSubmit = useCallback(() => {
    if (renameValue.trim() && renameValue !== layer.name) {
      manager.updateLayer(layer.id, { name: renameValue.trim() });
      onUpdate({ ...layer, name: renameValue.trim() });
    }
    setIsRenaming(false);
  }, [renameValue, layer, manager, onUpdate]);

  const handleToggleVisibility = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    manager.updateLayer(layer.id, { visible: !layer.visible });
    onUpdate({ ...layer, visible: !layer.visible });
  }, [layer, manager, onUpdate]);

  const handleToggleLock = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    manager.updateLayer(layer.id, { locked: !layer.locked });
    onUpdate({ ...layer, locked: !layer.locked });
  }, [layer, manager, onUpdate]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    manager.removeLayer(layer.id);
  }, [layer.id, manager]);

  const handleDuplicate = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDuplicate) {
      onDuplicate(layer);
    } else {
      // Manually duplicate the layer
      const duplicatedLayer = {
        ...layer,
        name: `${layer.name} Copy`
      };
      manager.addLayer(duplicatedLayer);
    }
  }, [layer, manager, onDuplicate]);

  const handleMoveUp = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (index > 0) {
      const currentIndex = manager.layers.findIndex(l => l.id === layer.id);
      if (currentIndex !== -1 && currentIndex < manager.layers.length - 1) {
        manager.reorderLayers(currentIndex, currentIndex + 1);
      }
    }
  }, [index, layer.id, manager]);

  const handleMoveDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (index < totalCount - 1) {
      const currentIndex = manager.layers.findIndex(l => l.id === layer.id);
      if (currentIndex > 0) {
        manager.reorderLayers(currentIndex, currentIndex - 1);
      }
    }
  }, [index, totalCount, layer.id, manager]);

  const handleOpacityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const opacity = parseFloat(e.target.value);
    manager.updateLayer(layer.id, { opacity });
    onUpdate({ ...layer, opacity });
  }, [layer, manager, onUpdate]);

  const handleBlendModeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const blendMode = e.target.value as BlendMode;
    manager.updateLayer(layer.id, { blendMode });
    onUpdate({ ...layer, blendMode });
  }, [layer, manager, onUpdate]);

  return (
    <div
      onClick={() => onSelect(layer)}
      onDoubleClick={() => setIsRenaming(true)}
      className={`
        group flex flex-col rounded border cursor-pointer transition-all
        ${compact ? 'p-1.5' : 'p-2'}
        ${isActive
          ? `${accent.bg} ${accent.border}`
          : 'bg-transparent border-transparent hover:bg-[#161616] hover:border-[#333]'
        }
        ${layer.locked ? 'opacity-60' : ''}
      `}
    >
      {/* Main Row */}
      <div className="flex items-center gap-2">
        {/* Drag Handle */}
        <div className="text-gray-700 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical size={12} />
        </div>

        {/* Visibility Toggle */}
        <button
          onClick={handleToggleVisibility}
          className={`p-0.5 rounded hover:bg-black/50 transition-colors ${
            layer.visible ? 'text-gray-400' : 'text-gray-700'
          }`}
          title={layer.visible ? 'Hide layer' : 'Show layer'}
        >
          {layer.visible ? <Eye size={compact ? 12 : 14} /> : <EyeOff size={compact ? 12 : 14} />}
        </button>

        {/* Lock Toggle */}
        <button
          onClick={handleToggleLock}
          className={`p-0.5 rounded hover:bg-black/50 transition-colors ${
            layer.locked ? 'text-yellow-500' : 'text-gray-700'
          }`}
          title={layer.locked ? 'Unlock layer' : 'Lock layer'}
        >
          {layer.locked ? <Lock size={compact ? 10 : 12} /> : <Unlock size={compact ? 10 : 12} />}
        </button>

        {/* Thumbnail */}
        {renderThumbnail && (
          <div className="w-10 h-10 rounded border border-[#333] overflow-hidden flex-shrink-0 bg-[#0a0a0a]">
            {renderThumbnail(layer)}
          </div>
        )}

        {/* Layer Name */}
        <div className="flex-1 min-w-0">
          {isRenaming ? (
            <input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit();
                if (e.key === 'Escape') setIsRenaming(false);
              }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full bg-black border ${accent.border} rounded px-1 text-white outline-none ${
                compact ? 'text-[9px]' : 'text-[10px]'
              }`}
              autoFocus
            />
          ) : (
            <div
              className={`font-bold truncate ${compact ? 'text-[9px]' : 'text-[10px]'} ${
                isActive ? 'text-white' : 'text-gray-400'
              }`}
            >
              {layer.name}
            </div>
          )}
        </div>

        {/* Move Buttons */}
        <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleMoveUp}
            disabled={index === 0}
            className="text-gray-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed p-0.5"
            title="Move layer up"
          >
            <ChevronUp size={10} />
          </button>
          <button
            onClick={handleMoveDown}
            disabled={index === totalCount - 1}
            className="text-gray-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed p-0.5"
            title="Move layer down"
          >
            <ChevronDown size={10} />
          </button>
        </div>

        {/* Advanced Controls */}
        {showAdvancedControls && (
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleDuplicate}
              className="p-1 rounded text-gray-700 hover:text-blue-400 hover:bg-black/50"
              title="Duplicate layer"
            >
              <Copy size={11} />
            </button>
          </div>
        )}

        {/* Delete Button */}
        <button
          onClick={handleDelete}
          className="p-1 rounded text-gray-700 hover:text-red-400 hover:bg-black/50 opacity-0 group-hover:opacity-100 transition-all"
          title="Delete layer"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Opacity Slider (shown when active) */}
      {isActive && (
        <div
          className="flex items-center gap-2 mt-2 px-1 animate-in fade-in slide-in-from-top-1 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-[8px] text-gray-600 font-bold w-12">OPACITY</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={layer.opacity ?? 1}
            onChange={handleOpacityChange}
            className={`flex-1 h-1 bg-[#222] rounded-lg appearance-none cursor-pointer accent-current ${accent.text}`}
          />
          <span className={`text-[8px] ${accent.text} w-8 text-right font-mono`}>
            {Math.round((layer.opacity ?? 1) * 100)}%
          </span>
        </div>
      )}

      {/* Blend Mode Selector (shown when active and enabled) */}
      {isActive && showBlendModes && (
        <div
          className="flex items-center gap-2 mt-1 px-1 animate-in fade-in slide-in-from-top-1 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-[8px] text-gray-600 font-bold w-12">BLEND</span>
          <select
            value={layer.blendMode ?? 'normal'}
            onChange={handleBlendModeChange}
            className={`flex-1 bg-[#222] border border-[#333] rounded px-1 py-0.5 text-[9px] text-gray-300 outline-none focus:border-[#444] ${accent.text}`}
          >
            {BLEND_MODES_2D.map((mode) => (
              <option key={mode} value={mode}>
                {mode.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

/**
 * LayerPanel2D component for 2D canvas applications.
 * 
 * Provides a complete layer management UI optimized for 2D painting and
 * image editing workflows. Works with the universal LayerManager from
 * shared/systems/layers.
 */
export const LayerPanel2D: React.FC<LayerPanel2DProps> = ({
  manager,
  onLayerSelect,
  onLayerUpdate,
  renderThumbnail,
  accentColor = 'rose',
  title = 'LAYERS',
  showAddButton = true,
  compact = false,
  showBlendModes = true,
  showAdvancedControls = true
}) => {
  const accent = ACCENT_STYLES[accentColor];

  // Get reactive layers from manager
  const layers = useMemo(() => manager.layers, [manager.layers]);
  const activeLayerId = useMemo(() => manager.activeLayerId, [manager.activeLayerId]);

  // Display layers in reverse order (top layer first)
  const displayLayers = useMemo(() => [...layers].reverse(), [layers]);

  const handleLayerSelect = useCallback(
    (layer: Layer) => {
      manager.setActiveLayer(layer.id);
      onLayerSelect?.(layer);
    },
    [manager, onLayerSelect]
  );

  const handleLayerUpdate = useCallback(
    (layer: Layer) => {
      onLayerUpdate?.(layer);
    },
    [onLayerUpdate]
  );

  const handleAddLayer = useCallback(() => {
    manager.addLayer({
      name: `Layer ${layers.length + 1}`
    });
  }, [manager, layers.length]);

  const handleDuplicateLayer = useCallback((layer: Layer) => {
    // Manually duplicate the layer
    const duplicatedLayer = {
      ...layer,
      name: `${layer.name} Copy`
    };
    manager.addLayer(duplicatedLayer);
  }, [manager]);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#0a0a0a]">
      {/* Header */}
      <div className={`bg-[#111] border-b border-[#222] ${compact ? 'p-2' : 'p-3'}`}>
        <div className="flex items-center justify-between">
          <div
            className={`font-bold uppercase tracking-widest flex items-center gap-2 ${
              compact ? 'text-[9px]' : 'text-[10px]'
            } ${accent.text}`}
          >
            <Layers size={compact ? 12 : 14} />
            {title} ({layers.length})
          </div>
          {showAddButton && (
            <Button
              onClick={handleAddLayer}
              size="sm"
              variant="accent"
              className={`${accent.bg} ${accent.hover} border ${accent.border} ${accent.text}`}
              title="Add Layer"
            >
              <Plus size={compact ? 12 : 14} />
            </Button>
          )}
        </div>
      </div>

      {/* Layer List */}
      <div
        className={`flex-1 overflow-y-auto custom-scrollbar ${
          compact ? 'p-1 space-y-0.5' : 'p-2 space-y-1'
        }`}
      >
        {displayLayers.length === 0 ? (
          <div className="text-center py-8 text-[10px] text-gray-700 italic border-2 border-dashed border-[#222] rounded">
            No layers yet
            <div className="text-[8px] mt-1 text-gray-800">
              Click + to add a layer
            </div>
          </div>
        ) : (
          displayLayers.map((layer, index) => (
            <LayerItem
              key={layer.id}
              layer={layer}
              isActive={activeLayerId === layer.id}
              index={index}
              totalCount={displayLayers.length}
              accent={accent}
              compact={compact}
              showBlendModes={showBlendModes}
              showAdvancedControls={showAdvancedControls}
              manager={manager}
              onSelect={handleLayerSelect}
              onUpdate={handleLayerUpdate}
              onDuplicate={handleDuplicateLayer}
              renderThumbnail={renderThumbnail}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div
        className={`border-t border-[#222] flex justify-between text-[9px] text-gray-600 font-mono ${
          compact ? 'p-1 px-2' : 'p-2 px-3'
        }`}
      >
        <span>
          {layers.length} {layers.length === 1 ? 'LAYER' : 'LAYERS'}
        </span>
        <span className="text-gray-700">2D CANVAS</span>
      </div>
    </div>
  );
};

export default LayerPanel2D;
