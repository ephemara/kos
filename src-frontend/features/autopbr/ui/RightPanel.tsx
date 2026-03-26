import React from 'react';
import {
    Sliders, Zap, Mountain, Aperture, Globe,
    Stethoscope, Crosshair, Trash2, DownloadCloud,
    Download, Upload, Lightbulb, Sun, Layers, Image as ImageIcon
} from 'lucide-react';
import KAutopbrHDR from '../KAutopbrHDR';
import KAutopbrlighting from '../KAutopbrlighting';

interface RightPanelProps {
    tab: 'props' | 'light' | 'scene' | 'maps';
    // Props
    params: any;
    setParams: (p: any) => void;
    materialMode: 'matte' | 'glossy';
    setMaterialMode: (mode: 'matte' | 'glossy') => void;
    // Light
    envMode: string;
    onEnvChange: (mode: string, path?: string) => void;
    lighting: any;
    setLighting: (l: any) => void;
    // Scene
    sceneMaterials: any[];
    activeMaterialId: string | null;
    setActiveMaterialId: (id: string) => void;
    resetTargetMaterial: () => void;
    viewShape: string;
    handleExtractFromMesh: () => void;
    // Maps
    maps: any;
    handleMapOverride: (type: string, e: any) => void;
    downloadMap: (url: string, name: string) => void;
    downloadAll: () => void;
}

export default function RightPanel({
    tab, params, setParams, materialMode, setMaterialMode,
    envMode, onEnvChange, lighting, setLighting,
    sceneMaterials, activeMaterialId, setActiveMaterialId, resetTargetMaterial,
    viewShape, handleExtractFromMesh,
    maps, handleMapOverride, downloadMap, downloadAll
}: RightPanelProps) {

    const mapSlots = [
        { id: 'base', l: 'ALB', c: 'blue' },
        { id: 'normal', l: 'NRM', c: 'purple' },
        { id: 'roughness', l: 'RGH', c: 'orange' },
        { id: 'metallic', l: 'MET', c: 'gray' },
        { id: 'ao', l: 'OCC', c: 'emerald' },
        { id: 'height', l: 'DIS', c: 'pink' },
        { id: 'emissive', l: 'EMS', c: 'cyan' }
    ];

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a]">
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">

                {tab === 'props' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        {/* 🎨 MATERIAL MODE TOGGLE - Like Substance Sampler */}
                        <div className="p-3 bg-gradient-to-r from-[#111] to-[#0a0a0a] rounded-lg border border-[#333] space-y-3">
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><Aperture size={12} /> Material Mode</div>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => {
                                        setMaterialMode('matte');
                                        setParams({ ...params, roughnessBase: 0.8, metallicBase: 0.0 });
                                    }}
                                    className={`py-2.5 rounded-lg text-[11px] font-bold border-2 transition-all flex items-center justify-center gap-2 ${materialMode === 'matte'
                                        ? 'bg-orange-900/30 border-orange-500 text-orange-300 shadow-[0_0_15px_rgba(249,115,22,0.2)]'
                                        : 'bg-[#161616] border-[#333] text-gray-500 hover:text-white hover:border-[#444]'
                                        }`}
                                >
                                    <div className="w-3 h-3 rounded-full bg-gradient-to-br from-gray-400 to-gray-600"></div>
                                    MATTE
                                </button>
                                <button
                                    onClick={() => {
                                        setMaterialMode('glossy');
                                        setParams({ ...params, roughnessBase: 0.2, metallicBase: 0.0 });
                                    }}
                                    className={`py-2.5 rounded-lg text-[11px] font-bold border-2 transition-all flex items-center justify-center gap-2 ${materialMode === 'glossy'
                                        ? 'bg-cyan-900/30 border-cyan-500 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                                        : 'bg-[#161616] border-[#333] text-gray-500 hover:text-white hover:border-[#444]'
                                        }`}
                                >
                                    <div className="w-3 h-3 rounded-full bg-gradient-to-br from-white to-gray-300 shadow-lg"></div>
                                    GLOSSY
                                </button>
                            </div>
                        </div>

                        {/* Geometry Controls */}
                        <div className="p-3 bg-[#111] rounded border border-[#222] space-y-3">
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Mountain size={12} /> Geometry</div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="flex justify-between text-[9px] text-gray-500 font-bold mb-1"><span>NORMAL</span> <span className="text-blue-400">{(params.normalStrength * 100).toFixed(0)}%</span></div>
                                    <input type="range" min="0.001" max="0.1" step="0.001" value={params.normalStrength} onChange={e => setParams({ ...params, normalStrength: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-blue-500" />
                                </div>
                                <div>
                                    <div className="flex justify-between text-[9px] text-gray-500 font-bold mb-1"><span>HEIGHT</span> <span className="text-blue-400">{(params.displacementScale * 100).toFixed(0)}%</span></div>
                                    <input type="range" min="0" max="0.2" step="0.001" value={params.displacementScale} onChange={e => setParams({ ...params, displacementScale: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-blue-500" />
                                </div>
                            </div>
                        </div>

                        {/* Material Controls */}
                        <div className="p-3 bg-[#111] rounded border border-[#222] space-y-3">
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Aperture size={12} /> Material</div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="flex justify-between text-[9px] text-gray-500 font-bold mb-1"><span>ROUGHNESS</span> <span className="text-orange-400">{((params.roughnessBase || 0.7) * 100).toFixed(0)}%</span></div>
                                    <input type="range" min="0" max="1" step="0.01" value={params.roughnessBase || 0.7} onChange={e => setParams({ ...params, roughnessBase: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-orange-500" />
                                </div>
                                <div>
                                    <div className="flex justify-between text-[9px] text-gray-500 font-bold mb-1"><span>METALLIC</span> <span className="text-gray-300">{((params.metallicBase || 0) * 100).toFixed(0)}%</span></div>
                                    <input type="range" min="0" max="1" step="0.01" value={params.metallicBase || 0} onChange={e => setParams({ ...params, metallicBase: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-gray-400" />
                                </div>
                                <div className="col-span-2">
                                    <div className="flex justify-between text-[9px] text-gray-500 font-bold mb-1"><span>AO INTENSITY</span> <span className="text-blue-400">{(params.aoIntensity * 100).toFixed(0)}%</span></div>
                                    <input type="range" min="0" max="2" step="0.1" value={params.aoIntensity} onChange={e => setParams({ ...params, aoIntensity: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-blue-500" />
                                </div>
                            </div>
                        </div>

                        {/* Surface Wear */}
                        <div className="space-y-3 bg-[#111] p-3 rounded border border-[#222]">
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Zap size={12} /> Surface Wear</div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1"><span>SCRATCH</span></div>
                                    <input type="range" min="0" max="1.0" step="0.01" value={params.scratches} onChange={e => setParams({ ...params, scratches: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-blue-500" />
                                </div>
                                <div>
                                    <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1"><span>DUST</span></div>
                                    <input type="range" min="0" max="1.0" step="0.01" value={params.dust} onChange={e => setParams({ ...params, dust: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-blue-500" />
                                </div>
                                <div>
                                    <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1"><span>GRUNGE</span></div>
                                    <input type="range" min="0" max="1.0" step="0.01" value={params.grunge} onChange={e => setParams({ ...params, grunge: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-blue-500" />
                                </div>
                            </div>
                        </div>

                        {/* Distortion */}
                        <div className="space-y-3 bg-[#111] p-3 rounded border border-[#222]">
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Zap size={12} /> Distortion</div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1"><span>BITCRUSH</span> <span className="text-yellow-400">{(params.pixelate * 100).toFixed(0)}%</span></div>
                                    <input type="range" min="0" max="1.0" step="0.01" value={params.pixelate} onChange={e => setParams({ ...params, pixelate: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-yellow-500" />
                                </div>
                                <div>
                                    <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1"><span>CRT RASTER</span> <span className="text-green-400">{(params.scanlines * 100).toFixed(0)}%</span></div>
                                    <input type="range" min="0" max="1.0" step="0.01" value={params.scanlines} onChange={e => setParams({ ...params, scanlines: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-green-500" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'light' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="p-3 bg-[#111] rounded border border-[#222] space-y-3">
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Globe size={12} /> Environment</div>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => onEnvChange('studio')} className={`py-2 rounded text-[10px] font-bold border transition ${envMode === 'studio' ? 'bg-blue-900/20 border-blue-500 text-blue-400' : 'bg-[#161616] border-[#222] text-gray-500 hover:text-white'}`}>STUDIO (DEFAULT)</button>
                                <label className={`py-2 rounded text-[10px] font-bold border transition text-center cursor-pointer ${envMode === 'custom' ? 'bg-purple-900/20 border-purple-500 text-purple-400' : 'bg-[#161616] border-[#222] text-gray-500 hover:text-white'}`}>
                                    CUSTOM HDR
                                    <input type="file" accept=".hdr" className="hidden" onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            const url = URL.createObjectURL(file);
                                            onEnvChange('custom', url);
                                        }
                                    }} />
                                </label>
                            </div>
                        </div>
                        <KAutopbrlighting lighting={lighting} setLighting={setLighting} />
                        <KAutopbrHDR onApply={(url) => onEnvChange('custom', url)} />
                    </div>
                )}

                {tab === 'scene' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Stethoscope size={14} /> Material Surgery</div>
                        <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar border border-[#222] rounded bg-[#111] p-1">
                            {sceneMaterials.map((mat, i) => (
                                <div key={mat.uuid} onClick={() => setActiveMaterialId(mat.uuid)} className={`p-2 rounded flex items-center gap-3 cursor-pointer border ${activeMaterialId === mat.uuid ? 'bg-blue-900/20 border-blue-500/50 text-white' : 'bg-[#161616] border-transparent text-gray-400 hover:bg-[#222]'}`}>
                                    <div className="w-3 h-3 rounded-full border border-gray-600" style={{ backgroundColor: `#${mat.color.getHexString()}` }}></div>
                                    <span className="flex-1 text-[10px] font-bold truncate">{mat.name || `Material_Slot_${i}`}</span>
                                    {activeMaterialId === mat.uuid && <Crosshair size={10} className="text-blue-400" />}
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            {activeMaterialId && viewShape === 'artifact' && (
                                <button onClick={handleExtractFromMesh} className="py-2 bg-emerald-900/20 hover:bg-emerald-900/40 text-emerald-400 border border-emerald-900/50 rounded flex items-center justify-center gap-2 text-[10px] font-bold transition-all"><DownloadCloud size={14} /> EXTRACT TEXTURE</button>
                            )}
                            <button onClick={resetTargetMaterial} className={`py-1.5 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 rounded flex items-center justify-center gap-2 text-[9px] font-bold transition-all ${!activeMaterialId || viewShape !== 'artifact' ? 'col-span-2' : ''}`}><Trash2 size={10} /> RESET ACTIVE</button>
                        </div>
                    </div>
                )}

                {tab === 'maps' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300 pb-10">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><ImageIcon size={14} /> Map Output</div>

                        <div className="grid grid-cols-2 gap-3 pb-2">
                            {mapSlots.map(m => (
                                <div key={m.id} className={`relative aspect-square bg-[#050505] rounded-md border border-${m.c}-900/30 overflow-hidden group`}>
                                    {maps[m.id] ? (
                                        <img src={maps[m.id]} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-[#222] font-bold text-[9px]">{m.l} EMPTY</div>
                                    )}
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                                        <button onClick={() => downloadMap(maps[m.id], m.id)} className="p-1.5 bg-[#222] hover:bg-white hover:text-black rounded-full transition" title="Download"><Download size={10} /></button>
                                        <label className="p-1.5 bg-[#222] hover:bg-white hover:text-black rounded-full transition cursor-pointer" title="Replace">
                                            <Upload size={10} />
                                            <input type="file" className="hidden" onChange={(e) => handleMapOverride(m.id, e)} accept="image/*" />
                                        </label>
                                    </div>
                                    <div className={`absolute bottom-0 left-0 w-full bg-${m.c}-900/80 text-${m.c}-200 text-[9px] text-center font-bold py-1 backdrop-blur-sm border-t border-${m.c}-500/50`}>{m.l}</div>
                                </div>
                            ))}
                        </div>

                        <button onClick={downloadAll} className="w-full py-3 bg-[#161616] hover:bg-[#222] border border-[#222] rounded text-[10px] font-bold transition text-gray-400 hover:text-white flex items-center justify-center gap-2 uppercase"><Download size={12} /> Download All Maps</button>
                    </div>
                )}
            </div>
        </div >
    );
}
