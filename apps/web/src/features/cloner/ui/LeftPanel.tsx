import React, { useState } from 'react';
import { Grid as GridIcon, Maximize, Diamond, Database, Activity, Zap, Spline, Tornado as TornadoIcon, Terminal } from 'lucide-react';
import * as Slider from '@radix-ui/react-slider';
import { MODIFIERS } from '../KClonerUtils';

interface LeftPanelProps {
    clonerMode: string; setClonerMode: (v: string) => void;
    distributionMode: string; setDistributionMode: (v: string) => void;
    clonerCount: any; setClonerCount: (v: any) => void;
    clonerSpacing: any; setClonerSpacing: (v: any) => void;
    radialCount: number; setRadialCount: (v: number) => void;
    radialRadius: number; setRadialRadius: (v: number) => void;
    normalizeScale: boolean; setNormalizeScale: (v: boolean) => void;
    onAddModifier: (key: string) => void;
    // Keyframe system integration
    keyframes: Record<string, any[]>;
    toggleKey: (id: string, val: any) => void;
    currentTime: number;
}

export function LeftPanel({
    clonerMode, setClonerMode,
    distributionMode, setDistributionMode,
    clonerCount, setClonerCount,
    clonerSpacing, setClonerSpacing,
    radialCount, setRadialCount,
    radialRadius, setRadialRadius,
    normalizeScale, setNormalizeScale,
    onAddModifier,
    keyframes, toggleKey, currentTime
}: LeftPanelProps) {
    const [activeTab, setActiveTab] = useState<'GENERATOR' | 'LIBRARY'>('GENERATOR');

    const isKeyed = (id: string, val: any) => {
        // Simple check if key exists near current time
        const track = keyframes[id];
        if (!track) return false;
        return track.some(k => Math.abs(k.t - currentTime) < 0.1);
    };

    return (
        <div className="flex flex-col h-full bg-[#0e0e0e] text-gray-300 select-none">
            {/* TABS */}
            <div className="flex border-b border-[#222]">
                <button
                    onClick={() => setActiveTab('GENERATOR')}
                    className={`flex-1 py-2 text-[10px] font-bold border-b-2 transition-colors ${activeTab === 'GENERATOR' ? 'border-cyan-500 text-cyan-400 bg-[#161616]' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                >
                    GENERATOR
                </button>
                <button
                    onClick={() => setActiveTab('LIBRARY')}
                    className={`flex-1 py-2 text-[10px] font-bold border-b-2 transition-colors ${activeTab === 'LIBRARY' ? 'border-cyan-500 text-cyan-400 bg-[#161616]' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                >
                    LIBRARY
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">

                {/* GENERATOR TAB */}
                {activeTab === 'GENERATOR' && (
                    <div className="space-y-6 animate-in slide-in-from-left-2 duration-200">
                        {/* MODE SELECTOR */}
                        <div className="bg-[#131313] rounded border border-[#222] p-3">
                            <div className="text-[10px] font-bold text-gray-500 uppercase mb-3 flex items-center gap-2 tracking-wider">
                                <GridIcon size={10} /> Structure
                            </div>
                            <div className="flex bg-[#0a0a0a] p-1 rounded border border-[#333] mb-4">
                                {['SINGLE', 'GRID', 'RADIAL', 'LINEAR'].map(m => (
                                    <button
                                        key={m}
                                        onClick={() => setClonerMode(m)}
                                        className={`flex-1 py-1.5 text-[9px] font-bold rounded transition-all ${clonerMode === m ? 'bg-cyan-900 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>

                            {/* DISTRIBUTION & SCALE */}
                            <div className="space-y-2 mb-4 p-2 bg-[#0a0a0a] rounded border border-[#333]">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-bold text-gray-500">DISTRIBUTION</span>
                                    <div className="flex bg-[#161616] rounded p-0.5 border border-[#222]">
                                        {['ROUND_ROBIN', 'RANDOM'].map(m => (
                                            <button
                                                key={m}
                                                onClick={() => setDistributionMode(m)}
                                                className={`px-2 py-0.5 rounded text-[8px] font-bold transition-all ${distributionMode === m ? 'bg-cyan-900 text-cyan-200' : 'text-gray-600 hover:text-white'}`}
                                            >
                                                {m === 'ROUND_ROBIN' ? 'CYCLE' : 'RND'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center justify-between border-t border-[#222] pt-2">
                                    <span className="text-[9px] font-bold text-gray-500 flex items-center gap-1"><Maximize size={10} /> AUTO-SCALE</span>
                                    <button
                                        onClick={() => setNormalizeScale(!normalizeScale)}
                                        className={`w-8 h-4 rounded-full transition-colors relative border ${normalizeScale ? 'bg-cyan-900 border-cyan-700' : 'bg-[#161616] border-[#333]'}`}
                                    >
                                        <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-transform ${normalizeScale ? 'left-4.5' : 'left-0.5'}`} />
                                    </button>
                                </div>
                            </div>

                            {/* GRID PARAMS */}
                            {clonerMode === 'GRID' && (
                                <div className="space-y-4">
                                    {['x', 'y', 'z'].map(axis => (
                                        <div key={axis} className="space-y-2">
                                            {/* COUNT */}
                                            <div className="flex justify-between text-[9px] text-gray-500 font-bold items-center">
                                                <span>COUNT {axis.toUpperCase()}</span>
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => toggleKey(`grid_count_${axis}`, clonerCount[axis])} className={`transition-colors ${isKeyed(`grid_count_${axis}`, clonerCount[axis]) ? 'text-cyan-400 fill-cyan-400' : 'text-gray-700 hover:text-cyan-600'}`}>
                                                        <Diamond size={8} fill={isKeyed(`grid_count_${axis}`, clonerCount[axis]) ? "currentColor" : "none"} />
                                                    </button>
                                                    <span className="text-cyan-400">{clonerCount[axis]}</span>
                                                </div>
                                            </div>
                                            <Slider.Root
                                                className="relative flex items-center select-none touch-none w-full h-5"
                                                value={[clonerCount[axis]]}
                                                max={50} min={1} step={1}
                                                onValueChange={([v]) => setClonerCount({ ...clonerCount, [axis]: v })}
                                            >
                                                <Slider.Track className="bg-[#333] relative grow rounded-full h-[2px]"><Slider.Range className="absolute bg-cyan-600 rounded-full h-full" /></Slider.Track>
                                                <Slider.Thumb className="block w-3 h-3 bg-gray-300 shadow rounded-full hover:bg-white focus:outline-none transition-colors" />
                                            </Slider.Root>

                                            {/* SPACING */}
                                            <div className="flex justify-between text-[9px] text-gray-500 font-bold items-center">
                                                <span>SPACING {axis.toUpperCase()}</span>
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => toggleKey(`grid_space_${axis}`, clonerSpacing[axis])} className={`transition-colors ${isKeyed(`grid_space_${axis}`, clonerSpacing[axis]) ? 'text-cyan-400 fill-cyan-400' : 'text-gray-700 hover:text-cyan-600'}`}>
                                                        <Diamond size={8} fill={isKeyed(`grid_space_${axis}`, clonerSpacing[axis]) ? "currentColor" : "none"} />
                                                    </button>
                                                    <span className="text-cyan-400">{clonerSpacing[axis].toFixed(1)}</span>
                                                </div>
                                            </div>
                                            <Slider.Root
                                                className="relative flex items-center select-none touch-none w-full h-5"
                                                value={[clonerSpacing[axis]]}
                                                max={10} min={0.1} step={0.1}
                                                onValueChange={([v]) => setClonerSpacing({ ...clonerSpacing, [axis]: v })}
                                            >
                                                <Slider.Track className="bg-[#333] relative grow rounded-full h-[2px]"><Slider.Range className="absolute bg-gray-500 rounded-full h-full" /></Slider.Track>
                                                <Slider.Thumb className="block w-3 h-3 bg-gray-400 shadow rounded-full hover:bg-white focus:outline-none transition-colors" />
                                            </Slider.Root>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* RADIAL PARAMS */}
                            {clonerMode === 'RADIAL' && (
                                <div className="space-y-4">
                                    <div className="flex justify-between text-[9px] text-gray-500 font-bold items-center">
                                        <span>COUNT</span>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => toggleKey(`rad_count`, radialCount)} className={`transition-colors ${isKeyed('rad_count', radialCount) ? 'text-cyan-400 fill-cyan-400' : 'text-gray-700 hover:text-cyan-600'}`}>
                                                <Diamond size={8} fill={isKeyed('rad_count', radialCount) ? "currentColor" : "none"} />
                                            </button>
                                            <span className="text-cyan-400">{radialCount}</span>
                                        </div>
                                    </div>
                                    <Slider.Root
                                        className="relative flex items-center select-none touch-none w-full h-5"
                                        value={[radialCount]} max={200} min={3} step={1}
                                        onValueChange={([v]) => setRadialCount(v)}
                                    >
                                        <Slider.Track className="bg-[#333] relative grow rounded-full h-[2px]"><Slider.Range className="absolute bg-cyan-600 rounded-full h-full" /></Slider.Track>
                                        <Slider.Thumb className="block w-3 h-3 bg-gray-300 shadow rounded-full hover:bg-white focus:outline-none transition-colors" />
                                    </Slider.Root>

                                    <div className="flex justify-between text-[9px] text-gray-500 font-bold items-center">
                                        <span>RADIUS</span>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => toggleKey(`rad_radius`, radialRadius)} className={`transition-colors ${isKeyed('rad_radius', radialRadius) ? 'text-cyan-400 fill-cyan-400' : 'text-gray-700 hover:text-cyan-600'}`}>
                                                <Diamond size={8} fill={isKeyed('rad_radius', radialRadius) ? "currentColor" : "none"} />
                                            </button>
                                            <span className="text-cyan-400">{radialRadius}</span>
                                        </div>
                                    </div>
                                    <Slider.Root
                                        className="relative flex items-center select-none touch-none w-full h-5"
                                        value={[radialRadius]} max={50} min={1} step={0.5}
                                        onValueChange={([v]) => setRadialRadius(v)}
                                    >
                                        <Slider.Track className="bg-[#333] relative grow rounded-full h-[2px]"><Slider.Range className="absolute bg-cyan-600 rounded-full h-full" /></Slider.Track>
                                        <Slider.Thumb className="block w-3 h-3 bg-gray-300 shadow rounded-full hover:bg-white focus:outline-none transition-colors" />
                                    </Slider.Root>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* LIBRARY TAB */}
                {activeTab === 'LIBRARY' && (
                    <div className="space-y-6 animate-in slide-in-from-right-2 duration-200">
                        {/* CATEGORIES */}
                        <div>
                            <div className="text-[10px] font-bold text-gray-500 uppercase mb-3 flex items-center gap-2 tracking-wider"><Database size={10} /> Basic Motion</div>
                            <div className="grid grid-cols-2 gap-2">
                                {['ORBIT', 'FLOAT', 'PULSE', 'SHAKE', 'ELASTIC'].map(key => {
                                    const m = MODIFIERS[key]; return (
                                        <button key={key} onClick={() => onAddModifier(key)} className="flex flex-col items-center justify-center gap-2 p-2 bg-[#131313] border border-[#222] rounded hover:border-cyan-500/50 hover:bg-[#1a1a1a] transition-all group">
                                            <m.icon size={16} className="text-gray-400 group-hover:text-cyan-400 transition-colors" />
                                            <span className="text-[9px] font-bold text-gray-500 group-hover:text-gray-300">{m.name}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        <div>
                            <div className="text-[10px] font-bold text-cyan-600 uppercase mb-3 flex items-center gap-2 tracking-wider"><Activity size={10} /> Rhythmic</div>
                            <div className="grid grid-cols-2 gap-2">
                                {['PENDULUM', 'WOBBLE', 'FIGURE8', 'HEARTBEAT', 'GLITCH', 'STEP'].map(key => {
                                    const m = MODIFIERS[key]; return (
                                        <button key={key} onClick={() => onAddModifier(key)} className="flex flex-col items-center justify-center gap-2 p-2 bg-[#131313] border border-[#222] rounded hover:border-cyan-500/50 hover:bg-[#1a1a1a] transition-all group">
                                            <m.icon size={16} className="text-gray-400 group-hover:text-cyan-400 transition-colors" />
                                            <span className="text-[9px] font-bold text-gray-500 group-hover:text-gray-300">{m.name}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        <div>
                            <div className="text-[10px] font-bold text-orange-500 uppercase mb-3 flex items-center gap-2 tracking-wider"><Zap size={10} /> Physics & FX</div>
                            <div className="grid grid-cols-2 gap-2">
                                {['BOUNCE', 'TUMBLE', 'STROBE', 'CORKSCREW', 'SHIVER', 'SWAY', 'YOYO', 'CRAB'].map(key => {
                                    const m = MODIFIERS[key]; return (
                                        <button key={key} onClick={() => onAddModifier(key)} className="flex flex-col items-center justify-center gap-2 p-2 bg-[#131313] border border-[#222] rounded hover:border-orange-500/50 hover:bg-[#1a1a1a] transition-all group">
                                            <m.icon size={16} className="text-gray-400 group-hover:text-orange-400 transition-colors" />
                                            <span className="text-[9px] font-bold text-gray-500 group-hover:text-gray-300">{m.name}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        <div>
                            <div className="text-[10px] font-bold text-purple-500 uppercase mb-3 flex items-center gap-2 tracking-wider"><Spline size={10} /> Complex Math</div>
                            <div className="grid grid-cols-2 gap-2">
                                {['LISSAJOUS', 'FLIP', 'TREMOR', 'SCAN', 'WARP', 'DRIFT', 'BOBBLE', 'TWIST'].map(key => {
                                    const m = MODIFIERS[key]; return (
                                        <button key={key} onClick={() => onAddModifier(key)} className="flex flex-col items-center justify-center gap-2 p-2 bg-[#131313] border border-[#222] rounded hover:border-purple-500/50 hover:bg-[#1a1a1a] transition-all group">
                                            <m.icon size={16} className="text-gray-400 group-hover:text-purple-400 transition-colors" />
                                            <span className="text-[9px] font-bold text-gray-500 group-hover:text-gray-300">{m.name}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        <div>
                            <div className="text-[10px] font-bold text-pink-500 uppercase mb-3 flex items-center gap-2 tracking-wider"><TornadoIcon size={10} /> Advanced</div>
                            <div className="grid grid-cols-2 gap-2">
                                {['SPIRAL', 'VORTEX', 'MAGNET', 'NOISE_FLOW', 'RIPPLE', 'SQUASH', 'ACCORDION', 'CHAOS', 'BREATHE', 'EXPLODE'].map(key => {
                                    const m = MODIFIERS[key]; return (
                                        <button key={key} onClick={() => onAddModifier(key)} className="flex flex-col items-center justify-center gap-2 p-2 bg-[#131313] border border-[#222] rounded hover:border-pink-500/50 hover:bg-[#1a1a1a] transition-all group">
                                            <m.icon size={16} className="text-gray-400 group-hover:text-pink-400 transition-colors" />
                                            <span className="text-[9px] font-bold text-gray-500 group-hover:text-gray-300">{m.name}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        <div>
                            <div className="text-[10px] font-bold text-emerald-500 uppercase mb-3 flex items-center gap-2 tracking-wider"><Terminal size={10} /> Custom</div>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => onAddModifier('CODE')} className="col-span-2 flex flex-col items-center justify-center gap-2 p-2 bg-[#131313] border border-[#222] rounded hover:border-emerald-500/50 hover:bg-[#1a1a1a] transition-all group">
                                    <Terminal size={16} className="text-gray-400 group-hover:text-emerald-400 transition-colors" />
                                    <span className="text-[9px] font-bold text-gray-500 group-hover:text-gray-300">K-SCRIPT</span>
                                </button>
                            </div>
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
}
