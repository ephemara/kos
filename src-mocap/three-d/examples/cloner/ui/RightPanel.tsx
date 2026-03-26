import React, { useState } from 'react';
import {
    Layers, Settings, Plus, Trash2, Clock, X, MousePointer2, Diamond
} from 'lucide-react';
import * as Slider from '@radix-ui/react-slider';
import { cn } from '@mocap/shared/primitives/cn';

interface RightPanelProps {
    chains: any[];
    activeChainId: string; setActiveChainId: (id: string) => void;
    playbackChainId: string | null;
    addChain: () => void;
    removeChain: (id: string) => void;
    updateChain: (id: string, field: string, val: any) => void;

    modifiers: any[]; // active chain modifiers
    selectedModId: string | null; setSelectedModId: (id: string | null) => void;
    removeModifier: (id: string) => void;
    clearModifiers: () => void;
    updateParam: (modId: string, param: string, val: any) => void;

    keyframes: Record<string, any[]>;
    toggleKey: (id: string, val: any) => void;
    currentTime: number;
}

export function RightPanel({
    chains,
    activeChainId, setActiveChainId,
    playbackChainId,
    addChain, removeChain, updateChain,
    modifiers,
    selectedModId, setSelectedModId,
    removeModifier, clearModifiers,
    updateParam,
    keyframes, toggleKey, currentTime
}: RightPanelProps) {
    // activeTab removed (merged view)

    const activeChain = chains.find(c => c.id === activeChainId);
    // Note: activeModId is just selectedModId alias for clarity
    const activeModId = selectedModId;
    const activeMod = modifiers.find(m => m.instanceId === activeModId);

    const isKeyed = (id: string) => {
        const track = keyframes[id];
        if (!track) return false;
        return track.some(k => Math.abs(k.t - currentTime) < 0.1);
    };

    return (
        <div className="flex flex-col h-full bg-[#0e0e0e] text-gray-300 select-none border-l border-[#222]">

            {/* TOP HALF: STACK */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 border-b border-[#222]">
                <div className="space-y-6 animate-in slide-in-from-right-2 duration-200">
                    {/* CHAIN LIST */}
                    <div className="bg-[#131313] rounded border border-[#222] p-3">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
                                <Layers size={10} /> Chains
                            </span>
                            <button onClick={addChain} className="text-[9px] bg-cyan-900/50 hover:bg-cyan-700 text-cyan-100 px-1.5 py-0.5 rounded border border-cyan-800 flex items-center gap-1">
                                <Plus size={10} /> NEW
                            </button>
                        </div>

                        <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar mb-2">
                            {chains.map(chain => (
                                <div
                                    key={chain.id}
                                    onClick={() => { setActiveChainId(chain.id); setSelectedModId(null); }}
                                    className={cn(
                                        "flex items-center justify-between px-2 py-1.5 rounded cursor-pointer border text-[9px] font-bold transition-all",
                                        activeChainId === chain.id
                                            ? "bg-cyan-900/40 border-cyan-500/50 text-cyan-100"
                                            : "bg-[#0a0a0a] border-transparent text-gray-500 hover:text-gray-300",
                                        playbackChainId === chain.id && activeChainId !== chain.id ? "border-cyan-700" : ""
                                    )}
                                >
                                    <span>{chain.name}</span>
                                    {chains.length > 1 && (
                                        <button onClick={(e) => { e.stopPropagation(); removeChain(chain.id); }} className="text-gray-600 hover:text-red-500">
                                            <Trash2 size={10} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* ACTIVE CHAIN SETTINGS */}
                        {activeChain && (
                            <div className="border-t border-[#222] pt-2 mt-2 flex items-center justify-between">
                                <input
                                    type="text"
                                    value={activeChain.name}
                                    onChange={(e) => updateChain(activeChain.id, 'name', e.target.value)}
                                    className="bg-transparent text-[10px] font-bold text-white w-24 outline-none border-b border-transparent focus:border-cyan-500"
                                />
                                <div className="flex items-center gap-1">
                                    <Clock size={10} className="text-gray-500" />
                                    <input
                                        type="number"
                                        min="0.1" step="0.1"
                                        value={activeChain.duration}
                                        onChange={(e) => updateChain(activeChain.id, 'duration', parseFloat(e.target.value))}
                                        className="bg-transparent text-[9px] font-mono text-cyan-400 w-8 text-right outline-none border-b border-transparent focus:border-cyan-500"
                                    />
                                    <span className="text-[8px] text-gray-600">s</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* MODIFIER STACK */}
                    <div className="space-y-2">
                        <div className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
                            <Settings size={10} /> Modifiers
                        </div>

                        <div className="space-y-1">
                            {modifiers.length === 0 && (
                                <div className="text-[9px] text-gray-600 text-center py-4 italic border border-dashed border-[#222] rounded">
                                    No Modifiers
                                </div>
                            )}
                            {modifiers.map((mod, index) => (
                                <div
                                    key={mod.instanceId}
                                    onClick={() => setSelectedModId(mod.instanceId)}
                                    className={cn(
                                        "relative p-2 rounded border cursor-pointer flex items-center gap-3 transition-all backdrop-blur-sm group",
                                        selectedModId === mod.instanceId ? "bg-cyan-950/40 border-cyan-500/50" : "bg-[#131313] border-[#222] hover:bg-[#1a1a1a]"
                                    )}
                                >
                                    <div className="text-[9px] font-mono text-gray-600">0{index + 1}</div>
                                    <mod.icon size={14} className={selectedModId === mod.instanceId ? 'text-cyan-400' : 'text-gray-500'} />
                                    <div className="flex-1">
                                        <div className={cn("text-[10px] font-bold", selectedModId === mod.instanceId ? 'text-gray-200' : 'text-gray-400')}>
                                            {mod.name}
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); removeModifier(mod.instanceId); }}
                                        className="text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {modifiers.length > 0 && (
                            <button
                                onClick={clearModifiers}
                                className="w-full text-[9px] text-red-500 hover:text-red-400 flex items-center justify-center gap-1 bg-[#131313] hover:bg-[#1a1a1a] px-2 py-1.5 rounded border border-[#222] transition-colors"
                            >
                                <Trash2 size={10} /> CLEAR ALL
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* BOTTOM HALF: PARAMS */}
            <div className="h-1/2 overflow-y-auto custom-scrollbar p-4 bg-[#0a0a0a]">
                {/* PARAMS TAB CONTENT */}
                <div className="h-full">
                    {activeMod ? (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-200 pb-10">
                            <div className="flex items-start gap-3 border-b border-[#222] pb-4">
                                <div className="p-2 bg-cyan-900/20 rounded border border-cyan-900/50 text-cyan-400">
                                    <activeMod.icon size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm text-gray-200 uppercase">{activeMod.name}</h3>
                                    <span className="text-[9px] text-gray-500 font-mono">{activeMod.instanceId.toString().slice(-6)}</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {Object.keys(activeMod.params).map(key => {
                                    const val = activeMod.params[key];
                                    if (key === 'error' || key === 'sliders') return null;

                                    // CODE MODIFIER SPECIAL CASE
                                    if (activeMod.type === 'code' && key === 'code') {
                                        const hasError = activeMod.params.error;
                                        return (
                                            <div key={key} className="space-y-2">
                                                <div className="flex justify-between items-end">
                                                    <div className="text-[9px] text-gray-400 font-bold">SCRIPT</div>
                                                    {hasError && <span className="text-[8px] text-red-500 bg-red-900/20 px-2 rounded animate-pulse">SYNTAX ERROR</span>}
                                                </div>
                                                <div className="relative">
                                                    <textarea
                                                        className={cn("w-full h-32 bg-[#080808] border rounded p-2 text-[10px] font-mono outline-none resize-none leading-relaxed", hasError ? 'border-red-500 text-red-400' : 'border-[#333] text-cyan-400 focus:border-cyan-500')}
                                                        value={activeMod.params[key]}
                                                        onChange={(e) => updateParam(activeModId!, key, e.target.value)}
                                                        spellCheck={false}
                                                    />
                                                </div>
                                                {/* Custom Variable Sliders for Code Mod... simplistic implementation for now */}
                                                {activeMod.params.sliders && activeMod.params.sliders.length > 0 && (
                                                    <div className="space-y-2 border-t border-[#222] pt-2">
                                                        <div className="text-[9px] text-gray-500 font-bold">VARIABLES</div>
                                                        {activeMod.params.sliders.map((s: any, idx: number) => (
                                                            <div key={idx} className="space-y-1">
                                                                <div className="flex justify-between text-[9px] text-gray-500 font-bold items-center">
                                                                    <span>{s.label}</span>
                                                                    <div className="flex items-center gap-2">
                                                                        <button
                                                                            onClick={() => toggleKey(`mod_${activeModId}_slider_${s.id}`, s.val)}
                                                                            className={cn("transition-colors", isKeyed(`mod_${activeModId}_slider_${s.id}`) ? 'text-cyan-400 fill-cyan-400' : 'text-gray-700 hover:text-cyan-600')}
                                                                        >
                                                                            <Diamond size={8} fill={isKeyed(`mod_${activeModId}_slider_${s.id}`) ? "currentColor" : "none"} />
                                                                        </button>
                                                                        <span className="text-cyan-400">{s.val.toFixed(1)}</span>
                                                                    </div>
                                                                </div>
                                                                <Slider.Root
                                                                    className="relative flex items-center select-none touch-none w-full h-5"
                                                                    value={[s.val]} max={s.max} min={s.min} step={0.01}
                                                                    onValueChange={([v]) => {
                                                                        const copy = [...activeMod.params.sliders];
                                                                        copy[idx].val = v;
                                                                        updateParam(activeModId!, 'sliders', copy);
                                                                    }}
                                                                >
                                                                    <Slider.Track className="bg-[#333] relative grow rounded-full h-[2px]"><Slider.Range className="absolute bg-cyan-600 rounded-full h-full" /></Slider.Track>
                                                                    <Slider.Thumb className="block w-3 h-3 bg-gray-300 shadow rounded-full hover:bg-white focus:outline-none transition-colors" />
                                                                </Slider.Root>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }

                                    const isAxis = key === 'axis';
                                    const isStep = key === 'step';
                                    const paramKey = `mod_${activeModId}_${key}`;

                                    return (
                                        <div key={key}>
                                            <div className="flex justify-between text-[9px] text-gray-400 mb-2 font-bold uppercase tracking-wider">
                                                {key} {isStep && <span className="text-cyan-500">(OFFSET)</span>}
                                            </div>

                                            {isAxis ? (
                                                <div className="flex bg-[#161616] rounded border border-[#333] p-1">
                                                    {['x', 'y', 'z'].map(axis => (
                                                        <button
                                                            key={axis}
                                                            onClick={() => updateParam(activeModId!, key, axis)}
                                                            className={cn("flex-1 py-1 text-[9px] uppercase font-bold rounded", val === axis ? 'bg-cyan-700 text-white' : 'text-gray-500 hover:text-white')}
                                                        >
                                                            {axis}
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : typeof val === 'number' ? (
                                                <div className="space-y-1">
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => toggleKey(paramKey, val)}
                                                                className={cn("transition-colors", isKeyed(paramKey) ? 'text-cyan-400 fill-cyan-400' : 'text-gray-700 hover:text-cyan-600')}
                                                            >
                                                                <Diamond size={8} fill={isKeyed(paramKey) ? "currentColor" : "none"} />
                                                            </button>
                                                            <input
                                                                type="number"
                                                                value={val}
                                                                onChange={(e) => updateParam(activeModId!, key, parseFloat(e.target.value) || 0)}
                                                                className="w-12 bg-transparent text-[10px] text-cyan-400 font-mono outline-none border-b border-transparent focus:border-cyan-500"
                                                            />
                                                        </div>
                                                    </div>
                                                    <Slider.Root
                                                        className="relative flex items-center select-none touch-none w-full h-5"
                                                        value={[val]}
                                                        max={key.includes('angle') ? 360 : 10}
                                                        min={key.includes('speed') || key.includes('freq') ? 0.1 : 0}
                                                        step={0.01}
                                                        onValueChange={([v]) => updateParam(activeModId!, key, v)}
                                                    >
                                                        <Slider.Track className={cn("relative grow rounded-full h-[2px]", isStep ? 'bg-cyan-900/30' : 'bg-[#333]')}>
                                                            <Slider.Range className={cn("absolute rounded-full h-full", isStep ? 'bg-cyan-400' : 'bg-gray-400')} />
                                                        </Slider.Track>
                                                        <Slider.Thumb className="block w-3 h-3 bg-gray-300 shadow rounded-full hover:bg-white focus:outline-none transition-colors" />
                                                    </Slider.Root>
                                                </div>
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-700 opacity-50 gap-3">
                            <MousePointer2 size={32} />
                            <span className="text-[10px] uppercase font-bold tracking-widest text-center">Select a Modifier<br />to Edit</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
