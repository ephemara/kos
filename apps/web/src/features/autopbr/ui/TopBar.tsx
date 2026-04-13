import React from 'react';
import {
    Globe, Cuboid, Package, Sparkles, Wand2, UploadCloud,
    Share2, Box, RotateCcw, Loader2, Monitor, RefreshCw
} from 'lucide-react';

interface TopBarProps {
    viewShape: string;
    setViewShape: (shape: string) => void;
    sharedState: any;
    aiBakeMode: boolean;
    setAiBakeMode: (mode: boolean) => void;
    aiBakeOptions: { upscale: boolean; tile: boolean; delight: boolean };
    setAiBakeOptions: (opts: any) => void;
    isBaking: boolean;
    handleUpload: (e: any) => void;
    handleLocalAiGenerate: () => void;
    isGenerating: boolean;
    aiPrompt: string;
    setAiPrompt: (prompt: string) => void;
    handleAiGenerate: () => void;
    handleReset: () => void;
    handleSendToKernel: () => void;
    handleArtifactUplink: () => void;
    exportGLB: () => void;
    sourceImage: any;
    autoRotate: boolean;
    setAutoRotate: (v: boolean) => void;
}

export default function TopBar({
    viewShape, setViewShape, sharedState,
    aiBakeMode, setAiBakeMode, aiBakeOptions, setAiBakeOptions,
    isBaking, handleUpload,
    handleLocalAiGenerate, isGenerating, aiPrompt, setAiPrompt, handleAiGenerate,
    handleReset, handleSendToKernel, handleArtifactUplink, exportGLB, sourceImage,
    autoRotate, setAutoRotate,
}: TopBarProps) {
    return (
        <div className="h-10 flex items-center justify-between px-3 bg-[#0a0a0a] border-b border-[#222]">
            {/* LEFT: View Controls */}
            <div className="flex items-center gap-2">
                <div className="flex bg-[#111] rounded border border-[#222] p-0.5">
                    <button
                        onClick={() => setViewShape('sphere')}
                        className={`p-1.5 rounded transition ${viewShape === 'sphere' ? 'bg-blue-900/30 text-blue-400' : 'text-gray-500 hover:text-white'}`}
                        title="Sphere View"
                    >
                        <Globe size={14} />
                    </button>
                    <button
                        onClick={() => setViewShape('cube')}
                        className={`p-1.5 rounded transition ${viewShape === 'cube' ? 'bg-blue-900/30 text-blue-400' : 'text-gray-500 hover:text-white'}`}
                        title="Cube View"
                    >
                        <Cuboid size={14} />
                    </button>
                    {sharedState?.artifact && (
                        <button
                            onClick={() => setViewShape('artifact')}
                            className={`p-1.5 rounded transition ${viewShape === 'artifact' ? 'bg-purple-900/30 text-purple-400' : 'text-gray-500 hover:text-white'}`}
                            title="Artifact View"
                        >
                            <Package size={14} />
                        </button>
                    )}
                </div>

                {/* Auto-rotate toggle */}
                <button
                    onClick={() => setAutoRotate(!autoRotate)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-bold transition-all border ${autoRotate
                            ? 'bg-orange-900/30 border-orange-500/40 text-orange-400'
                            : 'bg-[#111] border-[#222] text-gray-600 hover:text-gray-300'
                        }`}
                    title={autoRotate ? 'Stop auto-rotate' : 'Enable auto-rotate'}
                >
                    <RefreshCw size={11} className={autoRotate ? 'animate-spin' : ''} />
                    SPIN
                </button>
            </div>

            {/* CENTER: AI Controls */}
            <div className="flex items-center gap-3">
                {/* AI Bake Toggle */}
                <button
                    onClick={() => setAiBakeMode(!aiBakeMode)}
                    className={`flex items-center gap-2 px-3 py-1 rounded font-bold text-[10px] transition-all border ${aiBakeMode
                        ? 'bg-gradient-to-r from-purple-900/40 to-blue-900/40 border-purple-500/50 text-purple-300'
                        : 'bg-[#1a1a1a] hover:bg-[#222] border-[#333] text-gray-400 hover:text-white'
                        }`}
                    title="Toggle AI Bake Mode"
                >
                    <Sparkles size={12} className={aiBakeMode ? 'animate-pulse' : ''} />
                    {aiBakeMode ? 'AI BAKE: ON' : 'AI BAKE: OFF'}
                </button>

                {/* AI Bake Options */}
                {aiBakeMode && (
                    <div className="flex items-center gap-0.5 bg-[#0a0a0a] rounded border border-purple-900/30 p-0.5 animate-in fade-in zoom-in-95 duration-200">
                        <button
                            onClick={() => setAiBakeOptions({ ...aiBakeOptions, delight: !aiBakeOptions.delight })}
                            className={`px-2 py-1 text-[9px] font-bold rounded flex items-center gap-1 transition-all ${aiBakeOptions.delight ? 'bg-purple-900/40 text-purple-300 border border-purple-500/30' : 'text-gray-600 hover:text-gray-300'}`}
                            title="Remove shadows/lighting"
                        >
                            <div className={`w-1.5 h-1.5 rounded-full ${aiBakeOptions.delight ? 'bg-purple-400' : 'bg-gray-700'}`} />
                            DELIGHT
                        </button>
                        <button
                            onClick={() => setAiBakeOptions({ ...aiBakeOptions, upscale: !aiBakeOptions.upscale })}
                            className={`px-2 py-1 text-[9px] font-bold rounded flex items-center gap-1 transition-all ${aiBakeOptions.upscale ? 'bg-blue-900/40 text-blue-300 border border-blue-500/30' : 'text-gray-600 hover:text-gray-300'}`}
                            title="4x AI Upscale (Slow)"
                        >
                            <div className={`w-1.5 h-1.5 rounded-full ${aiBakeOptions.upscale ? 'bg-blue-400' : 'bg-gray-700'}`} />
                            UPSCALE
                        </button>
                        <button
                            onClick={() => setAiBakeOptions({ ...aiBakeOptions, tile: !aiBakeOptions.tile })}
                            className={`px-2 py-1 text-[9px] font-bold rounded flex items-center gap-1 transition-all ${aiBakeOptions.tile ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-500/30' : 'text-gray-600 hover:text-gray-300'}`}
                            title="AI Seamless Tiling"
                        >
                            <div className={`w-1.5 h-1.5 rounded-full ${aiBakeOptions.tile ? 'bg-emerald-400' : 'bg-gray-700'}`} />
                            TILE
                        </button>
                    </div>
                )}

                <div className="w-px h-4 bg-[#222]" />

                {/* Local SD */}
                <button
                    onClick={handleLocalAiGenerate}
                    disabled={isGenerating || !aiPrompt}
                    className={`flex items-center gap-2 px-3 py-1 rounded font-bold text-[10px] transition-all border ${isGenerating
                        ? 'bg-yellow-900/20 border-yellow-500/30 text-yellow-500 cursor-wait'
                        : 'bg-[#1a1a1a] hover:bg-green-900/20 border-[#333] hover:border-green-500/30 text-gray-400 hover:text-green-400'
                        }`}
                    title="Generate texture using Local Stable Diffusion"
                >
                    {isGenerating ? <Loader2 className="animate-spin" size={12} /> : <Monitor size={12} />}
                    LOCAL SD
                </button>

                {/* Prompt Input */}
                <div className="flex items-center gap-2 group">
                    <div className="relative">
                        <Wand2 size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-blue-500" />
                        <input
                            type="text"
                            placeholder="Generate texture..."
                            className="bg-[#050505] border border-[#333] text-gray-400 text-[10px] rounded pl-7 pr-2 py-1 w-48 focus:border-blue-500 focus:text-white transition-all outline-none"
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAiGenerate()}
                        />
                    </div>
                    <button
                        onClick={handleAiGenerate}
                        disabled={isGenerating || !aiPrompt}
                        className="bg-[#1a1a1a] hover:bg-blue-900/30 text-gray-400 hover:text-blue-400 border border-[#333] hover:border-blue-500/50 p-1 rounded transition-all disabled:opacity-50"
                    >
                        {isGenerating ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />}
                    </button>
                </div>
            </div>

            {/* RIGHT: Actions */}
            <div className="flex items-center gap-2">
                <button
                    onClick={handleReset}
                    className="bg-[#1a1a1a] hover:bg-red-900/20 text-gray-400 hover:text-red-400 border border-[#333] hover:border-red-500/30 p-1.5 rounded transition-all"
                    title="Reset All"
                >
                    <RotateCcw size={12} />
                </button>

                <div className="w-px h-4 bg-[#222]" />

                <label className={`flex items-center gap-2 px-3 py-1 rounded cursor-pointer font-bold text-[10px] transition-all border ${isBaking ? 'opacity-50 cursor-not-allowed' : 'bg-[#1a1a1a] hover:bg-[#222] border-[#333] text-gray-300 hover:text-white'
                    }`}>
                    {isBaking ? <Loader2 className="animate-spin" size={12} /> : <UploadCloud size={12} />}
                    <span>{isBaking ? 'BAKING...' : 'UPLOAD'}</span>
                    <input type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={isBaking} />
                </label>

                <button
                    onClick={handleSendToKernel}
                    disabled={!sourceImage}
                    className="flex items-center gap-2 bg-[#1a1a1a] hover:bg-[#222] text-gray-300 hover:text-white border border-[#333] px-3 py-1 rounded font-bold text-[10px] transition"
                >
                    <Share2 size={12} /> SAVE
                </button>

                {viewShape === 'artifact' && (
                    <button
                        onClick={handleArtifactUplink}
                        className="flex items-center gap-2 bg-purple-900/20 hover:bg-purple-900/40 text-purple-400 border border-purple-900/50 px-3 py-1 rounded font-bold text-[10px] transition"
                    >
                        <UploadCloud size={12} /> UPLINK
                    </button>
                )}

                <button
                    onClick={exportGLB}
                    disabled={!sourceImage}
                    className="flex items-center gap-2 bg-[#1a1a1a] hover:bg-[#222] text-gray-300 hover:text-white border border-[#333] px-3 py-1 rounded font-bold text-[10px] transition"
                >
                    <Box size={12} /> EXPORT
                </button>
            </div>
        </div>
    );
}
