import React from 'react';
import { PenTool, Hammer, Minimize2, Layers, Activity, Droplet, AlignJustify, Target, Zap, Shrink, RotateCw } from 'lucide-react';
import { cn } from '@/ui/primitives/cn';

interface SculptPanelProps {
    sculptMode: number; setSculptMode: (m: number) => void;
    brushSize: number; setBrushSize: (s: number) => void;
    brushStrength: number; setBrushStrength: (s: number) => void;
}

export function SculptPanel({
    sculptMode, setSculptMode,
    brushSize, setBrushSize,
    brushStrength, setBrushStrength
}: SculptPanelProps) {
    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-3">
                <div className="text-[10px] font-bold text-gray-400 flex items-center gap-2 uppercase tracking-widest">
                    <PenTool size={12} className="text-emerald-500" /> Manual Tools
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {[
                        { id: 0, l: 'UPLIFT', i: Hammer },
                        { id: 1, l: 'ERODE', i: Minimize2 },
                        { id: 2, l: 'FLATTEN', i: Layers },
                        { id: 3, l: 'NOISE', i: Activity },
                        { id: 4, l: 'SMOOTH', i: Droplet },
                        { id: 5, l: 'TERRACE', i: AlignJustify },
                        { id: 6, l: 'CRATER', i: Target },
                        { id: 7, l: 'SHARPEN', i: Zap },
                        { id: 8, l: 'PINCH', i: Shrink },
                        { id: 9, l: 'TWIST', i: RotateCw }
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => setSculptMode(t.id)}
                            className={cn(
                                "p-3 border rounded-lg flex flex-col items-center justify-center gap-2 transition-all group",
                                sculptMode === t.id 
                                    ? 'bg-emerald-900/20 border-emerald-500 text-white shadow-lg shadow-emerald-900/30' 
                                    : 'bg-[#0a0a0a] text-gray-500 border-[#1a1a1a] hover:border-gray-600 hover:bg-[#111]'
                            )}
                        >
                            <t.i 
                                size={16} 
                                className={sculptMode === t.id ? 'text-emerald-400' : 'text-gray-600 group-hover:text-gray-400 transition-colors'} 
                            />
                            <span className="text-[9px] font-bold tracking-widest">{t.l}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-4 bg-[#0a0a0a] rounded-lg border border-[#1a1a1a] space-y-4">
                <div>
                    <div className="flex justify-between text-[10px] text-gray-500 mb-2 font-medium">
                        <span>Brush Radius</span>
                        <span className="text-emerald-400 font-mono text-[9px]">{brushSize.toFixed(2)}</span>
                    </div>
                    <input 
                        type="range" 
                        min="0.01" 
                        max="0.5" 
                        step="0.01" 
                        value={brushSize} 
                        onChange={e => setBrushSize(parseFloat(e.target.value))} 
                        className="w-full h-1.5 bg-[#222] rounded-lg appearance-none accent-emerald-500 cursor-pointer hover:accent-emerald-400 transition-all" 
                    />
                </div>
                <div>
                    <div className="flex justify-between text-[10px] text-gray-500 mb-2 font-medium">
                        <span>Brush Force</span>
                        <span className="text-lime-400 font-mono text-[9px]">{brushStrength.toFixed(2)}</span>
                    </div>
                    <input 
                        type="range" 
                        min="0.01" 
                        max="1.0" 
                        step="0.01" 
                        value={brushStrength} 
                        onChange={e => setBrushStrength(parseFloat(e.target.value))} 
                        className="w-full h-1.5 bg-[#222] rounded-lg appearance-none accent-lime-500 cursor-pointer hover:accent-lime-400 transition-all" 
                    />
                </div>
            </div>
        </div>
    );
}
