import React from 'react';
import { Scale, Monitor, Sparkles, Wand2, Palette, Activity, Plus } from 'lucide-react';

interface GeneratorPanelProps {
    sizeX: number; setSizeX: (v: number) => void;
    sizeZ: number; setSizeZ: (v: number) => void;
    heightScale: number; setHeightScale: (v: number) => void;
    resolution: number; setResolution: (v: number) => void;
    prompt: string; setPrompt: (v: string) => void;
    isProcessing: boolean;
    generateTerrain: () => void;
    generateTexture: () => void;
    handleGenerateRandom: () => void;
}

export function GeneratorPanel({
    sizeX, setSizeX,
    sizeZ, setSizeZ,
    heightScale, setHeightScale,
    resolution, setResolution,
    prompt, setPrompt,
    isProcessing,
    generateTerrain,
    generateTexture,
    handleGenerateRandom
}: GeneratorPanelProps) {
    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
            {/* WORLD DIMENSIONS */}
            <div className="space-y-3 bg-[#0a0a0a] p-4 rounded-lg border border-[#1a1a1a]">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Scale size={12} className="text-emerald-500" /> World Dimensions
                </div>
                <div className="space-y-3">
                    <div>
                        <div className="flex justify-between text-[10px] text-gray-500 mb-2 font-medium">
                            <span>Width (X)</span>
                            <span className="text-emerald-400 font-mono text-[9px]">{sizeX}m</span>
                        </div>
                        <input 
                            type="range" 
                            min="1024" 
                            max="16384" 
                            step="1024" 
                            value={sizeX} 
                            onChange={e => setSizeX(Number(e.target.value))} 
                            className="w-full h-1.5 bg-[#222] rounded appearance-none accent-emerald-500 cursor-pointer hover:accent-emerald-400 transition-all" 
                        />
                    </div>
                    <div>
                        <div className="flex justify-between text-[10px] text-gray-500 mb-2 font-medium">
                            <span>Depth (Z)</span>
                            <span className="text-emerald-400 font-mono text-[9px]">{sizeZ}m</span>
                        </div>
                        <input 
                            type="range" 
                            min="1024" 
                            max="16384" 
                            step="1024" 
                            value={sizeZ} 
                            onChange={e => setSizeZ(Number(e.target.value))} 
                            className="w-full h-1.5 bg-[#222] rounded appearance-none accent-emerald-500 cursor-pointer hover:accent-emerald-400 transition-all" 
                        />
                    </div>
                    <div>
                        <div className="flex justify-between text-[10px] text-gray-500 mb-2 font-medium">
                            <span>Amplitude (Y)</span>
                            <span className="text-lime-400 font-mono text-[9px]">{heightScale.toFixed(0)}m</span>
                        </div>
                        <input 
                            type="range" 
                            min="100" 
                            max="25000" 
                            step="100" 
                            value={heightScale} 
                            onChange={e => setHeightScale(parseFloat(e.target.value))} 
                            className="w-full h-1.5 bg-[#222] rounded appearance-none accent-lime-400 cursor-pointer hover:accent-lime-300 transition-all" 
                        />
                    </div>
                </div>
            </div>

            {/* RESOLUTION */}
            <div className="space-y-3">
                <div className="text-[10px] font-bold text-gray-400 flex items-center gap-2 uppercase tracking-widest">
                    <Monitor size={12} className="text-emerald-500" /> Grid Density
                </div>
                <div className="grid grid-cols-3 gap-2 p-1 bg-[#0a0a0a] rounded-lg border border-[#1a1a1a]">
                    {[512, 1024, 2048].map(r => (
                        <button
                            key={r}
                            onClick={() => setResolution(r)}
                            className={`py-2.5 rounded text-[10px] font-bold font-mono transition-all ${
                                resolution === r 
                                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50' 
                                    : 'text-gray-500 hover:text-gray-300 hover:bg-[#111]'
                            }`}
                        >
                            {r}
                        </button>
                    ))}
                </div>
            </div>

            {/* NEURAL FORGE */}
            <div className="space-y-3 pt-4 border-t border-[#1a1a1a]">
                <div className="text-[10px] font-bold text-gray-400 flex items-center gap-2 uppercase tracking-widest">
                    <Sparkles size={12} className="text-emerald-500" /> Neural Forge
                </div>
                <div className="bg-[#0a0a0a] p-3 rounded-lg border border-[#1a1a1a] focus-within:border-emerald-500/50 transition-colors">
                    <textarea
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        className="w-full bg-transparent text-[11px] text-gray-300 outline-none resize-none h-20 placeholder-gray-600 leading-relaxed"
                        placeholder="Describe terrain features (e.g., Eroded limestone canyon with deep valleys)..."
                    />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <button 
                        onClick={generateTerrain} 
                        disabled={isProcessing} 
                        className="py-3 bg-[#111] border border-[#222] hover:border-emerald-500 hover:bg-emerald-500/10 text-gray-400 hover:text-emerald-400 text-[10px] font-bold rounded flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isProcessing ? <Activity size={12} className="animate-spin" /> : <Wand2 size={12} />} 
                        GENERATE HEIGHT
                    </button>
                    <button 
                        onClick={generateTexture} 
                        disabled={isProcessing} 
                        className="py-3 bg-[#111] border border-[#222] hover:border-lime-500 hover:bg-lime-500/10 text-gray-400 hover:text-lime-400 text-[10px] font-bold rounded flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isProcessing ? <Activity size={12} className="animate-spin" /> : <Palette size={12} />} 
                        GENERATE ALBEDO
                    </button>
                </div>
            </div>

            {/* UTILS */}
            <div className="space-y-2 pt-4 border-t border-[#1a1a1a]">
                <button 
                    onClick={handleGenerateRandom} 
                    className="w-full py-3 bg-[#111] hover:bg-[#161616] text-gray-300 hover:text-white text-[10px] font-bold rounded flex items-center justify-center gap-2 transition-all border border-[#222] hover:border-gray-600"
                >
                    <Plus size={12} /> INJECT PERLIN NOISE
                </button>
            </div>
        </div>
    );
}
