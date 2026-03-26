import React from 'react';
import type { TopologyStats } from '../engine/retopoEngine';

interface RightPanelProps {
  stats: TopologyStats;
}

export default function RightPanel({ stats }: RightPanelProps) {
  const statItems = [
    { label: 'Vertices', value: stats.vertices, color: 'text-blue-400' },
    { label: 'Edges', value: stats.edges, color: 'text-green-400' },
    { label: 'Faces', value: stats.faces, color: 'text-purple-400' },
    { label: 'Quads', value: stats.quads, color: 'text-yellow-400' },
    { label: 'Tris', value: stats.tris, color: 'text-orange-400' },
    { label: 'N-gons', value: stats.ngons, color: 'text-red-400' },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-3 space-y-4">
        {/* Topology Stats */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-zinc-200">Topology Stats</h3>
          
          <div className="space-y-2">
            {statItems.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between py-1.5 px-2 rounded bg-zinc-950 border border-zinc-800"
              >
                <span className="text-sm text-zinc-400">{item.label}</span>
                <span className={`text-sm font-mono font-medium ${item.color}`}>
                  {item.value.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Quality Indicators */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-zinc-200">Quality</h3>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between py-1.5 px-2 rounded bg-zinc-950 border border-zinc-800">
              <span className="text-sm text-zinc-400">Quad Ratio</span>
              <span className="text-sm font-mono font-medium text-green-400">
                {stats.faces > 0
                  ? `${((stats.quads / stats.faces) * 100).toFixed(1)}%`
                  : '0%'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1.5 px-2 rounded bg-zinc-950 border border-zinc-800">
              <span className="text-sm text-zinc-400">Manifold</span>
              <span className="text-sm font-mono font-medium text-green-400">
                {stats.ngons === 0 ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-zinc-200">Info</h3>
          
          <div className="text-xs text-zinc-500 space-y-1">
            <p>- Click to place points</p>
            <p>- 4 points create a quad</p>
            <p>- Enable symmetry for mirrored work</p>
            <p>- Use surface snapping for accuracy</p>
          </div>
        </div>

        {/* Warnings */}
        {stats.ngons > 0 && (
          <div className="p-3 rounded bg-red-900/20 border border-red-700">
            <p className="text-xs text-red-400">
              Mesh contains {stats.ngons} N-gons. Clean topology should use only quads and tris.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
