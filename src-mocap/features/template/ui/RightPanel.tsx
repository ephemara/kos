/**
 * RightPanel - Layers & Assets
 * 
 * Uses UniversalLayerPanel for professional layer management.
 * Shows pattern for asset grids (primitives, materials, etc.)
 */

import React from 'react';
import { Layers, Box, HardDrive } from 'lucide-react';
import { UniversalLayerPanel, UniversalLayer } from '@mocap/shared/systems/layers';

interface RightPanelProps {
    layers: any[];
    activeLayerId: string | null;
    onLayerSelect: (id: string) => void;
}

export default function RightPanel({ layers, activeLayerId, onLayerSelect }: RightPanelProps) {
    const [assetMode, setAssetMode] = React.useState<'ASSETS' | 'LIBRARY'>('ASSETS');

    // Convert to UniversalLayer format
    const universalLayers: UniversalLayer[] = layers.map(l => ({
        id: l.id,
        name: l.name || 'Untitled',
        visible: l.visible !== false,
        locked: false,
    }));

    return (
        <div className="flex flex-col h-full w-full bg-[#0f0f0f] overflow-hidden">

            {/* LAYERS */}
            <div className="flex-1 min-h-0 overflow-hidden">
                <UniversalLayerPanel
                    layers={universalLayers}
                    activeLayerId={activeLayerId}
                    selectedLayerIds={new Set(activeLayerId ? [activeLayerId] : [])}
                    onSelect={(id) => onLayerSelect(id)}
                    onToggleVisibility={(id) => console.log('Toggle visibility:', id)}
                    onDelete={(id) => console.log('Delete layer:', id)}
                    features={{
                        add: true,
                        visibility: true,
                        delete: true,
                        rename: false,
                        lock: false,
                        solo: false,
                        reorder: false,
                        duplicate: false,
                        colorLabels: false,
                        contextMenu: false,
                    }}
                    accentColor="cyan"
                    title="LAYERS"
                    emptyMessage="No layers yet - add your first layer"
                    compact={false}
                />
            </div>

            {/* ASSETS */}
            <div className="border-t border-[#333] p-3 shrink-0 bg-[#0a0a0a]">
                <div className="flex items-center gap-1 mb-2 bg-[#161616] p-0.5 rounded border border-[#222]">
                    <button
                        onClick={() => setAssetMode('ASSETS')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[9px] font-bold rounded transition-all ${assetMode === 'ASSETS'
                                ? 'bg-[#333] text-cyan-500'
                                : 'text-gray-500 hover:text-gray-300'
                            }`}
                    >
                        <Box size={10} /> ASSETS
                    </button>
                    <div className="w-px h-4 bg-[#333]" />
                    <button
                        onClick={() => setAssetMode('LIBRARY')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[9px] font-bold rounded transition-all ${assetMode === 'LIBRARY'
                                ? 'bg-[#333] text-purple-500'
                                : 'text-gray-500 hover:text-gray-300'
                            }`}
                    >
                        <HardDrive size={10} /> LIBRARY
                    </button>
                </div>

                <div className="h-32 overflow-y-auto custom-scrollbar bg-[#111] rounded border border-[#222] p-2">
                    {assetMode === 'ASSETS' ? (
                        <div className="grid grid-cols-4 gap-1.5">
                            {/* Example asset grid */}
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                                <button
                                    key={i}
                                    onClick={() => console.log(`Asset ${i} clicked`)}
                                    className="aspect-square flex items-center justify-center bg-[#161616] border border-[#222] hover:border-cyan-500/50 hover:bg-[#222] rounded transition-all text-gray-500 hover:text-cyan-100 group"
                                >
                                    <Box size={14} className="group-hover:scale-110 transition-transform" />
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center text-[9px] text-gray-600 italic px-4">
                            <HardDrive size={16} className="mb-2 opacity-20" />
                            Library empty
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
}
