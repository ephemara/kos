/**
 * BrushPresetSelector Component
 * Data-driven brush preset selector for KGraphos
 */

import React, { useState, useEffect } from 'react';
import { configService, BrushConfig } from '@/services/configService';
import { Paintbrush, Droplet, Palette, Blend, PenTool } from 'lucide-react';

interface BrushPresetSelectorProps {
  category?: 'paint' | 'sculpt' | 'mask' | 'smooth';
  selectedBrushId?: string;
  onSelectBrush: (brush: BrushConfig) => void;
  className?: string;
}

const BRUSH_ICONS: Record<string, React.ComponentType<any>> = {
  'brush-ink': PenTool,
  'brush-watercolor': Droplet,
  'brush-oil': Paintbrush,
  'brush-smear': Blend,
  'brush-blend': Palette,
  'brush-paint': Paintbrush,
};

export function BrushPresetSelector({
  category = 'paint',
  selectedBrushId,
  onSelectBrush,
  className = '',
}: BrushPresetSelectorProps) {
  const [brushes, setBrushes] = useState<BrushConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBrushes();
  }, [category]);

  const loadBrushes = async () => {
    try {
      setLoading(true);
      setError(null);
      const allBrushes = await configService.getBrushesByCategory(category);
      setBrushes(allBrushes);
    } catch (err) {
      console.error('Failed to load brush presets:', err);
      setError('Failed to load brush presets');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <div className="text-gray-500 text-sm">Loading brushes...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <div className="text-red-500 text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2">
        Brush Presets
      </div>
      <div className="grid grid-cols-2 gap-2">
        {brushes.map((brush) => {
          const Icon = BRUSH_ICONS[brush.icon] || Paintbrush;
          const isSelected = selectedBrushId === brush.id;

          return (
            <button
              key={brush.id}
              onClick={() => onSelectBrush(brush)}
              className={`
                flex flex-col items-center justify-center gap-2 p-3 rounded-lg
                transition-all duration-200 border
                ${
                  isSelected
                    ? 'bg-rose-500/20 border-rose-500 text-rose-400'
                    : 'bg-gray-900/50 border-gray-800 text-gray-400 hover:bg-gray-800/50 hover:border-gray-700'
                }
              `}
              title={`${brush.name} - Size: ${brush.defaultSize}, Strength: ${brush.defaultStrength}`}
            >
              <Icon size={20} />
              <span className="text-xs font-medium">{brush.name}</span>
            </button>
          );
        })}
      </div>

      {/* Preset details */}
      {selectedBrushId && (
        <div className="mt-2 p-3 bg-gray-900/30 rounded-lg border border-gray-800">
          {brushes
            .filter((b) => b.id === selectedBrushId)
            .map((brush) => (
              <div key={brush.id} className="space-y-2">
                <div className="text-xs font-bold text-gray-300">{brush.name}</div>
                <div className="text-[10px] text-gray-500 space-y-1">
                  <div>Size: {brush.defaultSize.toFixed(3)}</div>
                  <div>Strength: {brush.defaultStrength.toFixed(2)}</div>
                  <div>Pressure: {brush.supportsPressure ? 'Yes' : 'No'}</div>
                  {brush.gpuShader && <div>Shader: {brush.gpuShader}</div>}
                </div>
                {brush.parameters && Object.keys(brush.parameters).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-800">
                    <div className="text-[10px] text-gray-400 font-bold mb-1">Parameters:</div>
                    <div className="text-[10px] text-gray-500 space-y-1">
                      {Object.entries(brush.parameters).map(([key, param]) => (
                        <div key={key}>
                          {key}: {JSON.stringify(param.default)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

/**
 * Compact horizontal brush preset selector
 */
export function BrushPresetSelectorCompact({
  category = 'paint',
  selectedBrushId,
  onSelectBrush,
  className = '',
}: BrushPresetSelectorProps) {
  const [brushes, setBrushes] = useState<BrushConfig[]>([]);

  useEffect(() => {
    configService.getBrushesByCategory(category).then(setBrushes);
  }, [category]);

  return (
    <div className={`flex items-center gap-2 overflow-x-auto ${className}`}>
      {brushes.map((brush) => {
        const Icon = BRUSH_ICONS[brush.icon] || Paintbrush;
        const isSelected = selectedBrushId === brush.id;

        return (
          <button
            key={brush.id}
            onClick={() => onSelectBrush(brush)}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap
              transition-all duration-200 border text-xs font-medium
              ${
                isSelected
                  ? 'bg-rose-500/20 border-rose-500 text-rose-400'
                  : 'bg-gray-900/50 border-gray-800 text-gray-400 hover:bg-gray-800/50'
              }
            `}
            title={brush.name}
          >
            <Icon size={14} />
            <span>{brush.name}</span>
          </button>
        );
      })}
    </div>
  );
}
