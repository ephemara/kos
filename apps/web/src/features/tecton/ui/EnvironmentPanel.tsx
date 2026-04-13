import React from 'react';
import { Sun } from 'lucide-react';
import { KHDRWidget } from '@/ui/widgets/KHDRWidget';

interface EnvironmentPanelProps {
    sunIntensity: number; setSunIntensity: (v: number) => void;
    sunAzimuth: number; setSunAzimuth: (v: number) => void;
    sunElevation: number; setSunElevation: (v: number) => void;
    scene: any;
    renderer: any;
}

export function EnvironmentPanel({
    sunIntensity, setSunIntensity,
    sunAzimuth, setSunAzimuth,
    sunElevation, setSunElevation,
    scene, renderer
}: EnvironmentPanelProps) {
    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
            {/* HDR WIDGET */}
            <div className="space-y-3 pb-4 border-b border-[#1a1a1a]">
                <div className="text-[10px] font-bold text-gray-400 flex items-center gap-2 uppercase tracking-widest">
                    <Sun size={12} className="text-emerald-500" /> Environment HDR
                </div>
                <KHDRWidget
                    scene={scene}
                    renderer={renderer}
                    defaultEnabled={true}
                />
            </div>

            {/* SOLAR POSITION */}
            <div className="space-y-3">
                <div className="text-[10px] font-bold text-gray-400 flex items-center gap-2 uppercase tracking-widest">
                    <Sun size={12} className="text-emerald-500" /> Solar Position
                </div>

                <div className="space-y-4 bg-[#0a0a0a] p-4 rounded-lg border border-[#1a1a1a]">
                    <div className="space-y-2">
                        <div className="flex justify-between text-[10px] text-gray-500 font-medium">
                            <span>Intensity</span>
                            <span className="text-emerald-400 font-mono text-[9px]">{sunIntensity.toFixed(1)}</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" 
                            max="5" 
                            step="0.1" 
                            value={sunIntensity} 
                            onChange={e => setSunIntensity(Number(e.target.value))} 
                            className="w-full h-1.5 bg-[#222] rounded-lg appearance-none accent-emerald-500 cursor-pointer hover:accent-emerald-400 transition-all" 
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-[10px] text-gray-500 font-medium">
                            <span>Azimuth</span>
                            <span className="text-emerald-400 font-mono text-[9px]">{sunAzimuth}°</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" 
                            max="360" 
                            value={sunAzimuth} 
                            onChange={e => setSunAzimuth(Number(e.target.value))} 
                            className="w-full h-1.5 bg-[#222] rounded-lg appearance-none accent-emerald-500 cursor-pointer hover:accent-emerald-400 transition-all" 
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-[10px] text-gray-500 font-medium">
                            <span>Elevation</span>
                            <span className="text-emerald-400 font-mono text-[9px]">{sunElevation}°</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" 
                            max="90" 
                            value={sunElevation} 
                            onChange={e => setSunElevation(Number(e.target.value))} 
                            className="w-full h-1.5 bg-[#222] rounded-lg appearance-none accent-emerald-500 cursor-pointer hover:accent-emerald-400 transition-all" 
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
