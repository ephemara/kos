/**
 * KAtlas RightPanel - Meshes/Layers, UV Stats
 * Meshes on the right like other K_OS apps layer systems
 */

import React from 'react';
import { Eye, EyeOff, Layers, Grid3X3, Image as ImageIcon } from 'lucide-react';

interface RightPanelProps {
    mode: 'meshes' | 'stats';
    // Hierarchy
    hierarchy: any[];
    selectedIds: string[];
    onSelect: (id: string, multi: boolean) => void;
    onSelectAll: () => void;
    onToggleVis: (id: string, e: React.MouseEvent) => void;
    // View toggles
    viewMode: 'GRID' | 'MATERIAL';
    setViewMode: (m: 'GRID' | 'MATERIAL') => void;
    // Stats
    uvStats: any;
}

export default function RightPanel({
    mode,
    hierarchy,
    selectedIds,
    onSelect,
    onSelectAll,
    onToggleVis,
    viewMode,
    setViewMode,
    uvStats,
}: RightPanelProps) {
    // MESHES TAB - Layer-like hierarchy
    if (mode === 'meshes') {
        return (
            <div className="p-3 space-y-4">
                {/* VIEW TOGGLE */}
                <div className="flex bg-[#161616] p-0.5 rounded border border-[#222]">
                    <button
                        onClick={() => setViewMode('GRID')}
                        className={`flex-1 py-1 text-[9px] font-bold flex items-center justify-center gap-1 rounded transition-all ${viewMode === 'GRID' ? 'bg-teal-900/30 text-teal-400' : 'text-gray-500'}`}
                    >
                        <Grid3X3 size={10} /> UV GRID
                    </button>
                    <button
                        onClick={() => setViewMode('MATERIAL')}
                        className={`flex-1 py-1 text-[9px] font-bold flex items-center justify-center gap-1 rounded transition-all ${viewMode === 'MATERIAL' ? 'bg-teal-900/30 text-teal-400' : 'text-gray-500'}`}
                    >
                        <ImageIcon size={10} /> MATERIAL
                    </button>
                </div>

                {/* SCENE HIERARCHY */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center text-[9px] font-bold text-gray-600 uppercase tracking-widest">
                        <div className="flex items-center gap-2"><Layers size={10} /> SCENE MESHES</div>
                        <button onClick={onSelectAll} className="text-teal-500 hover:text-white">SELECT ALL</button>
                    </div>

                    <div className="bg-[#0e0e0e] border border-[#1a1a1a] rounded-sm max-h-64 overflow-y-auto custom-scrollbar">
                        {hierarchy.length === 0 && <div className="p-2 text-[9px] text-gray-600 italic">No Meshes Loaded</div>}
                        {hierarchy.map((item) => {
                            const isSel = selectedIds.includes(item.id);
                            return (
                                <div
                                    key={item.id}
                                    onClick={(e) => onSelect(item.id, e.ctrlKey || e.metaKey)}
                                    className={`flex items-center gap-2 p-2 cursor-pointer border-l-2 transition-colors ${isSel ? 'bg-teal-900/20 border-teal-500 text-teal-100' : 'border-transparent hover:bg-[#161616]'}`}
                                >
                                    <button onClick={(e) => onToggleVis(item.id, e)} className="text-gray-600 hover:text-gray-300">
                                        {item.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                                    </button>
                                    <span className="text-[10px] truncate flex-1">{item.name}</span>
                                    <span className="text-[8px] text-gray-600 font-mono">{item.verts?.toLocaleString()}v</span>
                                </div>
                            );
                        })}
                    </div>

                    <div className="text-[9px] text-gray-500 flex justify-between">
                        <span>{selectedIds.length} Objects Selected</span>
                        <span className="text-teal-600">CTRL+CLICK to Multi</span>
                    </div>
                </div>

                {/* Stats */}
                {uvStats && (
                    <div className="p-3 bg-[#0e0e0e] rounded-sm border border-[#1a1a1a] space-y-1 mt-4">
                        <div className="flex justify-between text-[10px] text-gray-400 font-mono"><span>Objects</span><span className="text-gray-200">{uvStats.meshes}</span></div>
                        <div className="flex justify-between text-[10px] text-gray-400 font-mono"><span>Total Verts</span><span className="text-gray-200">{uvStats.verts?.toLocaleString()}</span></div>
                    </div>
                )}
            </div>
        );
    }

    // STATS TAB
    return (
        <div className="p-3 space-y-4">
            <div className="text-[9px] font-bold text-gray-600 uppercase tracking-widest flex items-center gap-2">
                <Layers size={10} /> UV Statistics
            </div>

            {uvStats ? (
                <div className="space-y-2">
                    <div className="p-3 bg-[#0e0e0e] rounded-sm border border-[#1a1a1a] space-y-2">
                        <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                            <span>Objects</span>
                            <span className="text-teal-400 font-bold">{uvStats.meshes}</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                            <span>Total Vertices</span>
                            <span className="text-teal-400 font-bold">{uvStats.verts?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                            <span>Last Updated</span>
                            <span className="text-gray-500">{new Date().toLocaleTimeString()}</span>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="p-3 bg-[#0e0e0e] rounded-sm border border-[#1a1a1a] text-[10px] text-gray-500 italic">
                    No UV data available. Run an unwrap operation.
                </div>
            )}
        </div>
    );
}
