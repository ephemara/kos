import React from 'react';
import {
    Monitor, Library, BookTemplate, Palette, Sparkles,
    Sticker, Zap
} from 'lucide-react';
import { MATERIAL_CATEGORIES } from '../KAutopbrpresets';
import KAutopbrdecals from '../KAutopbrdecals';
import { rustProcedural } from '@/services/proceduralClient';

interface LeftPanelProps {
    tab: 'source' | 'library';
    // State
    sourceImage: any;
    setSourceImage: (img: any) => void;
    params: any;
    setParams: (p: any) => void;
    decalImage: any;
    handleDecalUpload: (e: any) => void;
    sharedState: any;
    loadMaterialFromLibrary: (mat: any) => void;
    applyPreset: (preset: any) => void;
}

export default function LeftPanel({
    tab, sourceImage, setSourceImage, params, setParams,
    decalImage, handleDecalUpload, sharedState,
    loadMaterialFromLibrary, applyPreset
}: LeftPanelProps) {

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a]">
            {/* HEADER */}
            <div className="p-4 border-b border-[#222] bg-[#111] shrink-0">
                <div className="flex items-center gap-2 text-cyan-500 mb-1">
                    <Monitor size={16} />
                    <span className="font-black tracking-[0.2em] text-xs">K-SAMPLE</span>
                </div>
                <div className="text-[9px] text-gray-600 uppercase tracking-widest">Material sampler</div>
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {tab === 'source' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">

                        {/* Generators */}
                        <div className="space-y-3 bg-[#111] p-3 rounded border border-[#222]">
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                <Sparkles size={12} /> Generators (Rust)
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <button onClick={async () => { const img = await rustProcedural.generateChecker(1024); setSourceImage(img); }} className="py-2 bg-[#222] hover:bg-blue-900/30 hover:text-blue-400 text-gray-400 rounded text-[9px] font-bold transition-all border border-transparent hover:border-blue-500/50">CHECKER</button>
                                <button onClick={async () => { const img = await rustProcedural.generateNoise(1024, 'fbm'); setSourceImage(img); }} className="py-2 bg-[#222] hover:bg-blue-900/30 hover:text-blue-400 text-gray-400 rounded text-[9px] font-bold transition-all border border-transparent hover:border-blue-500/50">NOISE</button>
                                <button onClick={async () => { const img = await rustProcedural.generateBricks(1024); setSourceImage(img); }} className="py-2 bg-[#222] hover:bg-blue-900/30 hover:text-blue-400 text-gray-400 rounded text-[9px] font-bold transition-all border border-transparent hover:border-blue-500/50">BRICKS</button>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <button onClick={async () => { const r = await rustProcedural.generateProceduralTexture({ noise_type: 'perlin', width: 1024, height: 1024, scale: 4 }); setSourceImage(r.image); }} className="py-2 bg-[#161616] hover:bg-purple-900/30 hover:text-purple-400 text-gray-500 rounded text-[8px] font-bold transition-all border border-transparent hover:border-purple-500/50">PERLIN</button>
                                <button onClick={async () => { const r = await rustProcedural.generateProceduralTexture({ noise_type: 'ridged', width: 1024, height: 1024, scale: 3, octaves: 6 }); setSourceImage(r.image); }} className="py-2 bg-[#161616] hover:bg-purple-900/30 hover:text-purple-400 text-gray-500 rounded text-[8px] font-bold transition-all border border-transparent hover:border-purple-500/50">RIDGED</button>
                                <button onClick={async () => { const r = await rustProcedural.generateVoronoiTexture({ width: 1024, height: 1024, cell_count: 40, output_type: 'cell_value' }); setSourceImage(r.image); }} className="py-2 bg-[#161616] hover:bg-purple-900/30 hover:text-purple-400 text-gray-500 rounded text-[8px] font-bold transition-all border border-transparent hover:border-purple-500/50">CELLS</button>
                            </div>
                        </div>

                        {/* Color Grading */}
                        <div className="space-y-3 bg-[#111] p-3 rounded border border-[#222]">
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                <Palette size={12} /> Color Grading
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1"><span>BRIGHTNESS</span> <span className="text-blue-400">{params.brightness || 1.0}x</span></div>
                                    <input type="range" min="0" max="2" step="0.01" value={params.brightness || 1.0} onChange={e => setParams({ ...params, brightness: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-blue-500" />
                                </div>
                                <div>
                                    <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1"><span>CONTRAST</span> <span className="text-blue-400">{params.contrast || 1.0}x</span></div>
                                    <input type="range" min="0" max="2" step="0.01" value={params.contrast || 1.0} onChange={e => setParams({ ...params, contrast: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-blue-500" />
                                </div>
                                <div>
                                    <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1"><span>GAMMA</span> <span className="text-blue-400">{params.gamma || 1.0}</span></div>
                                    <input type="range" min="0.1" max="3.0" step="0.1" value={params.gamma || 1.0} onChange={e => setParams({ ...params, gamma: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-blue-500" />
                                </div>
                                <div>
                                    <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1"><span>HUE SHIFT</span> <span className="text-blue-400">{params.hue}°</span></div>
                                    <input type="range" min="0" max="360" step="1" value={params.hue} onChange={e => setParams({ ...params, hue: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-blue-500" />
                                </div>
                            </div>
                            <button onClick={() => setParams({ ...params, invert: !params.invert })} className={`w-full py-2 rounded text-[10px] font-bold border transition ${params.invert ? 'bg-white text-black border-white' : 'bg-[#161616] border-[#222] text-gray-500 hover:text-white'}`}>INVERT COLORS</button>
                        </div>

                        {/* Decals */}
                        {sourceImage && (
                            <KAutopbrdecals
                                decalImage={decalImage}
                                handleDecalUpload={handleDecalUpload}
                                params={params}
                                setParams={setParams}
                                sourceImage={sourceImage}
                            />
                        )}
                    </div>
                )}

                {tab === 'library' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                        {/* Project Library */}
                        <div className="pt-4 mt-4 border-b border-[#222] pb-6">
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-3"><Library size={14} /> Project Library</div>
                            <div className="grid grid-cols-3 gap-3">
                                {sharedState?.materials?.length > 0 ? sharedState.materials.map((mat: any) => (
                                    <div key={mat.id} onClick={() => loadMaterialFromLibrary(mat)} className="cursor-pointer group relative aspect-square rounded border border-[#222] hover:border-blue-500 transition-all overflow-hidden bg-[#111]">
                                        <img src={mat.preview} className="w-full h-full object-cover opacity-70 group-hover:opacity-100" />
                                        <div className="absolute bottom-0 w-full bg-black/80 text-[8px] text-center py-1 truncate text-gray-300">{mat.name}</div>
                                    </div>
                                )) : (
                                    <div className="col-span-3 text-[10px] text-gray-600 text-center italic py-6 border border-dashed border-[#222] rounded">No stored materials</div>
                                )}
                            </div>
                        </div>

                        {/* Presets */}
                        {sourceImage && (
                            <div className="space-y-6">
                                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><BookTemplate size={14} /> Material Presets</div>
                                {Object.values(MATERIAL_CATEGORIES).map((category: any) => (
                                    <div key={category.id} className="space-y-3">
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-blue-400 uppercase tracking-wider border-b border-[#222] pb-1">
                                            <category.icon size={12} />
                                            {category.label}
                                        </div>
                                        <div className="grid grid-cols-3 gap-3">
                                            {category.presets.map((preset: any) => (
                                                <button
                                                    key={preset.id}
                                                    onClick={() => applyPreset(preset)}
                                                    className="p-3 bg-[#111] hover:bg-[#1a1a1a] border border-[#222] hover:border-blue-500/50 rounded flex flex-col items-center justify-center gap-2 transition-all group"
                                                >
                                                    <preset.icon size={18} className="text-gray-500 group-hover:text-blue-400 transition-colors" />
                                                    <span className="text-[9px] font-bold text-gray-400 group-hover:text-white text-center">{preset.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
