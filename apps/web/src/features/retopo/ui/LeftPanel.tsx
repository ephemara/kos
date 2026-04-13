import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface LeftPanelProps {
  surfaceSnapping: boolean;
  onSurfaceSnappingChange: (enabled: boolean) => void;
  snapDistance: number;
  onSnapDistanceChange: (distance: number) => void;
  symmetryEnabled: boolean;
  onSymmetryEnabledChange: (enabled: boolean) => void;
  symmetryAxis: 'x' | 'y' | 'z';
  onSymmetryAxisChange: (axis: 'x' | 'y' | 'z') => void;
  onAutoRetopo: (targetPolyCount: number) => void;
}

export default function LeftPanel({
  surfaceSnapping,
  onSurfaceSnappingChange,
  snapDistance,
  onSnapDistanceChange,
  symmetryEnabled,
  onSymmetryEnabledChange,
  symmetryAxis,
  onSymmetryAxisChange,
  onAutoRetopo,
}: LeftPanelProps) {
  const [drawingExpanded, setDrawingExpanded] = useState(true);
  const [snappingExpanded, setSnappingExpanded] = useState(true);
  const [symmetryExpanded, setSymmetryExpanded] = useState(true);
  const [autoRetopoExpanded, setAutoRetopoExpanded] = useState(false);
  const [targetPolyCount, setTargetPolyCount] = useState(5000);
  const [drawMode, setDrawMode] = useState<'quad' | 'strip' | 'fill'>('quad');

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-3 space-y-4">
        {/* Drawing Mode Section */}
        <div className="space-y-2">
          <button
            onClick={() => setDrawingExpanded(!drawingExpanded)}
            className="flex items-center justify-between w-full text-sm font-medium text-zinc-200 hover:text-white"
          >
            <span>Drawing Mode</span>
            {drawingExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>

          {drawingExpanded && (
            <div className="space-y-2 pl-2">
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Mode</label>
                <div className="flex flex-col gap-2">
                  {[
                    { id: 'quad', label: 'Quad Drawing', desc: 'Click 4 points to create a quad' },
                    { id: 'strip', label: 'Quad Strip', desc: 'Create connected quads from pairs' },
                    { id: 'fill', label: 'Hole Fill', desc: 'Fill holes with boundary points' },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setDrawMode(mode.id as any)}
                    className={`
                        px-3 py-2 rounded text-left transition-colors
                        ${
                          drawMode === mode.id
                            ? 'bg-orange-500/20 text-orange-200 border border-orange-500/40'
                            : 'bg-zinc-900 text-zinc-300 border border-zinc-700 hover:bg-zinc-800'
                        }
                      `}
                    >
                      <div className="text-sm font-medium">{mode.label}</div>
                      <div className="text-xs opacity-75">{mode.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-xs text-zinc-500 bg-zinc-950 border border-zinc-800 p-2 rounded">
                <strong>Tip:</strong> Right-click to cancel current drawing
              </div>
            </div>
          )}
        </div>

        {/* Snapping Section */}
        <div className="space-y-2">
          <button
            onClick={() => setSnappingExpanded(!snappingExpanded)}
            className="flex items-center justify-between w-full text-sm font-medium text-zinc-200 hover:text-white"
          >
            <span>Surface Snapping</span>
            {snappingExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>

          {snappingExpanded && (
            <div className="space-y-3 pl-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={surfaceSnapping}
                  onChange={(e) => onSurfaceSnappingChange(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-orange-500 focus:ring-orange-500"
                />
                <span className="text-sm text-zinc-300">Enable Snapping</span>
              </label>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Snap Distance</label>
                <input
                  type="range"
                  min="0.01"
                  max="1.0"
                  step="0.01"
                  value={snapDistance}
                  onChange={(e) => onSnapDistanceChange(parseFloat(e.target.value))}
                  disabled={!surfaceSnapping}
                  className="w-full accent-orange-500"
                />
                <div className="text-xs text-zinc-500 text-right">
                  {snapDistance.toFixed(2)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Symmetry Section */}
        <div className="space-y-2">
          <button
            onClick={() => setSymmetryExpanded(!symmetryExpanded)}
            className="flex items-center justify-between w-full text-sm font-medium text-zinc-200 hover:text-white"
          >
            <span>Symmetry</span>
            {symmetryExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>

          {symmetryExpanded && (
            <div className="space-y-3 pl-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={symmetryEnabled}
                  onChange={(e) => onSymmetryEnabledChange(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-orange-500 focus:ring-orange-500"
                />
                <span className="text-sm text-zinc-300">Enable Symmetry</span>
              </label>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Axis</label>
                <div className="flex gap-2">
                  {(['x', 'y', 'z'] as const).map((axis) => (
                    <button
                      key={axis}
                      onClick={() => onSymmetryAxisChange(axis)}
                      disabled={!symmetryEnabled}
                      className={`
                        flex-1 px-3 py-1.5 rounded text-sm font-medium
                        transition-colors
                        ${
                          symmetryAxis === axis && symmetryEnabled
                            ? 'bg-orange-500/20 text-orange-200 border border-orange-500/40'
                            : 'bg-zinc-900 text-zinc-400 border border-zinc-700 hover:bg-zinc-800'
                        }
                        ${!symmetryEnabled ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                    >
                      {axis.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Auto-Retopo Section */}
        <div className="space-y-2">
          <button
            onClick={() => setAutoRetopoExpanded(!autoRetopoExpanded)}
            className="flex items-center justify-between w-full text-sm font-medium text-zinc-200 hover:text-white"
          >
            <span>Auto-Retopo</span>
            {autoRetopoExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>

          {autoRetopoExpanded && (
            <div className="space-y-3 pl-2">
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Target Poly Count</label>
                <input
                  type="number"
                  min="100"
                  max="100000"
                  step="100"
                  value={targetPolyCount}
                  onChange={(e) => setTargetPolyCount(parseInt(e.target.value))}
                  className="w-full px-3 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-200 text-sm focus:outline-none focus:border-orange-500"
                />
              </div>

              <button
                onClick={() => onAutoRetopo(targetPolyCount)}
                className="w-full px-3 py-2 rounded bg-orange-500/20 border border-orange-500/40 text-orange-200 text-sm font-medium hover:bg-orange-500/30 transition-colors"
              >
                Run Auto-Retopo
              </button>

              <p className="text-xs text-zinc-500">
                Automatically generates clean quad topology from the reference mesh.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
