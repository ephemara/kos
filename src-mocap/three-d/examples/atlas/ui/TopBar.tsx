/**
 * KAtlas TopBar - Layout controls, view modes, action buttons
 */

import { Share2, Grid, Mountain, Box, Columns, Maximize, Grid3X3, Image as ImageIcon, Cpu } from 'lucide-react';

interface TopBarProps {
    status: string;
    isProcessing: boolean;
    layoutMode: '3D' | 'SPLIT' | '2D';
    setLayoutMode: (mode: '3D' | 'SPLIT' | '2D') => void;
    uvViewMode: '2D' | 'HOLOGRAM';
    setUvViewMode: (mode: '2D' | 'HOLOGRAM') => void;
    viewMode: 'GRID' | 'MATERIAL';
    setViewMode: (mode: 'GRID' | 'MATERIAL') => void;
    uvStats: { verts?: number; meshes?: number } | null;
    onCommit: () => void;
    // GPU Compute
    useGpu?: boolean;
    setUseGpu?: (enabled: boolean) => void;
    gpuAvailable?: boolean;
}

export default function TopBar({
    status,
    isProcessing,
    layoutMode,
    setLayoutMode,
    uvViewMode,
    setUvViewMode,
    viewMode,
    setViewMode,
    uvStats,
    onCommit,
    useGpu = true,
    setUseGpu,
    gpuAvailable = false,
}: TopBarProps) {
    return (
        <div className="flex items-center justify-between px-4 py-2 bg-[#0a0a0a] border-b border-[#222]">
            {/* LEFT: Status */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-[10px] font-bold text-teal-400 bg-black/50 px-3 py-1.5 rounded border-l-2 border-teal-500">
                    <div className={`w-1.5 h-1.5 rounded-full ${isProcessing ? 'bg-yellow-400 animate-ping' : 'bg-teal-400'}`} />
                    <span className="font-mono tracking-wider">{status}</span>
                </div>

                {uvStats && (
                    <div className="flex items-center gap-3 text-[9px] text-gray-500">
                        <span><span className="text-teal-400">{uvStats.verts?.toLocaleString()}</span> verts</span>
                        <span><span className="text-teal-400">{uvStats.meshes}</span> meshes</span>
                    </div>
                )}

                {/* GPU Toggle */}
                {gpuAvailable && setUseGpu && (
                    <button
                        onClick={() => setUseGpu(!useGpu)}
                        title={useGpu ? 'GPU Compute Active (click to disable)' : 'Enable GPU Compute'}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[9px] font-bold tracking-wider transition-all ${useGpu
                                ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                                : 'text-gray-500 hover:text-white bg-[#111] border border-[#333]'
                            }`}
                    >
                        <Cpu size={12} className={useGpu ? 'animate-pulse' : ''} />
                        GPU {useGpu ? 'ON' : 'OFF'}
                    </button>
                )}
            </div>

            {/* CENTER: Layout Mode Toggle */}
            <div className="flex items-center gap-1 bg-[#111] border border-[#333] rounded-lg p-1">
                <button
                    onClick={() => setLayoutMode('3D')}
                    title="3D View Only"
                    className={`p-1.5 rounded transition-all ${layoutMode === '3D' ? 'bg-[#222] text-white shadow-sm' : 'text-gray-500 hover:text-white hover:bg-[#1a1a1a]'}`}
                >
                    <Box size={14} />
                </button>
                <button
                    onClick={() => setLayoutMode('SPLIT')}
                    title="Split Screen"
                    className={`p-1.5 rounded transition-all ${layoutMode === 'SPLIT' ? 'bg-teal-500/20 text-teal-400 shadow-sm' : 'text-gray-500 hover:text-white hover:bg-[#1a1a1a]'}`}
                >
                    <Columns size={14} />
                </button>
                <button
                    onClick={() => setLayoutMode('2D')}
                    title="UV Editor Fullscreen"
                    className={`p-1.5 rounded transition-all ${layoutMode === '2D' ? 'bg-[#222] text-white shadow-sm' : 'text-gray-500 hover:text-white hover:bg-[#1a1a1a]'}`}
                >
                    <Maximize size={14} />
                </button>

                <div className="w-px h-4 bg-[#333] mx-1" />

                {/* View Mode (Grid/Material) */}
                <button
                    onClick={() => setViewMode(viewMode === 'GRID' ? 'MATERIAL' : 'GRID')}
                    title={viewMode === 'GRID' ? 'Show Original Materials' : 'Show UV Grid'}
                    className={`p-1.5 rounded transition-all ${viewMode === 'GRID' ? 'text-orange-400' : 'text-purple-400'}`}
                >
                    {viewMode === 'GRID' ? <Grid3X3 size={14} /> : <ImageIcon size={14} />}
                </button>

                <div className="w-px h-4 bg-[#333] mx-1" />

                {/* UV View Mode (only when UV visible) */}
                {(layoutMode === 'SPLIT' || layoutMode === '2D') && (
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setUvViewMode('2D')}
                            className={`flex items-center gap-1 px-2 py-1 text-[9px] font-bold rounded transition-all ${uvViewMode === '2D' ? 'bg-white text-black' : 'text-gray-500 hover:text-white'}`}
                        >
                            <Grid size={10} /> 2D
                        </button>
                        <button
                            onClick={() => setUvViewMode('HOLOGRAM')}
                            className={`flex items-center gap-1 px-2 py-1 text-[9px] font-bold rounded transition-all ${uvViewMode === 'HOLOGRAM' ? 'bg-teal-500 text-black' : 'text-gray-500 hover:text-teal-400'}`}
                        >
                            <Mountain size={10} /> 3D
                        </button>
                    </div>
                )}
            </div>

            {/* RIGHT: Uplink Button */}
            <button
                onClick={onCommit}
                className="flex items-center gap-2 bg-teal-500/10 hover:bg-teal-500 border border-teal-500/50 hover:border-teal-400 text-teal-400 hover:text-black px-4 py-1.5 rounded-full text-[10px] font-bold tracking-wider transition-all"
            >
                <Share2 size={12} />
                UPLINK
            </button>
        </div>
    );
}

