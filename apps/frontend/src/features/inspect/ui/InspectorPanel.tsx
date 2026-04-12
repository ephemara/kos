import React from 'react';
import { Activity, Aperture } from 'lucide-react';
import type { RenderSettings } from '@/features/inspect/HighFidelityRenderer';

export type InspectorPanelProps = {
    modelStats: any;
    settings: RenderSettings;
    setSettings: React.Dispatch<React.SetStateAction<RenderSettings>>;
};

export default function InspectorPanel({ modelStats, settings, setSettings }: InspectorPanelProps) {
    return (
        <div className="space-y-6">
            <div className="bg-[#111] p-3 rounded border border-[#222] space-y-2">
                <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <Activity size={10} /> Metrics
                </div>
                {modelStats ? (
                    <>
                        <div className="flex justify-between text-[10px] text-gray-400">
                            <span>Name</span>
                            <span className="text-white truncate max-w-[140px]">{modelStats.name}</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-400">
                            <span>Polys</span>
                            <span className="text-orange-400 font-mono">{modelStats.polyCount?.toLocaleString()}</span>
                        </div>
                    </>
                ) : (
                    <div className="text-[10px] text-gray-600 italic">No model loaded</div>
                )}
            </div>

            <div className="space-y-3">
                <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <Aperture size={10} /> Lens
                </div>
                <div>
                    <div className="flex justify-between text-[10px] text-gray-400 mb-1">Exposure</div>
                    <input
                        type="range"
                        min="0"
                        max="3"
                        step="0.1"
                        value={settings.exposure}
                        onChange={(e) => setSettings({ ...settings, exposure: parseFloat(e.target.value) })}
                        className="w-full h-1 bg-[#222] rounded accent-[#00ffcc]"
                    />
                </div>
                <div>
                    <div className="flex justify-between text-[10px] text-gray-400 mb-1">Bloom</div>
                    <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={settings.bloomStrength}
                        onChange={(e) => setSettings({ ...settings, bloomStrength: parseFloat(e.target.value) })}
                        className="w-full h-1 bg-[#222] rounded accent-[#00ffcc]"
                    />
                </div>

                <button
                    onClick={() => setSettings({ ...settings, rayTracing: !settings.rayTracing })}
                    className={`w-full py-2 border rounded text-[9px] font-bold flex items-center justify-center gap-2 transition-all ${settings.rayTracing ? 'bg-purple-600 text-white border-purple-500' : 'border-[#222] text-gray-500 hover:text-gray-300'}`}
                >
                    <Activity size={12} className={settings.rayTracing ? 'animate-pulse' : ''} /> RAY TRACING
                </button>
            </div>
        </div>
    );
}
