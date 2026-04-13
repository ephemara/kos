import React, { useState } from 'react';
import {
    Palette, Layers, Aperture, Video, Box, Download,
    Camera, Maximize, Film, Sparkles
} from 'lucide-react';
import { cn } from '@/ui/primitives/cn';
import { PALETTE_NAMES, COLOR_PALETTES } from '../KQuantumPresets';
import { VATExportDialog } from './VATExportDialog';

// --- OPTICS TAB ---
interface OpticsTabProps {
    colorHex: string; setColorHex: (c: string) => void;
    color2Hex: string; setColor2Hex: (c: string) => void;
    colorMode: number; setColorMode: (m: number) => void;
    pointSize: number; setPointSize: (s: number) => void;
    opacity: number; setOpacity: (o: number) => void;
    gradientStrength: number; setGradientStrength: (n: number) => void;

    // Post Proc
    aberration: number; setAberration: (n: number) => void;
    decay: number; setDecay: (n: number) => void;
    distortion: number; setDistortion: (n: number) => void;

    // Hi-Fi
    highFidelity: boolean; setHighFidelity: (b: boolean) => void;
    bloomIntensity: number; setBloomIntensity: (n: number) => void;
    bloomThreshold: number; setBloomThreshold: (n: number) => void;

    // Palette
    currentPalette: string; setCurrentPalette: (p: string) => void;
}

export function OpticsTab({
    colorHex, setColorHex, color2Hex, setColor2Hex, colorMode, setColorMode,
    pointSize, setPointSize, opacity, setOpacity, gradientStrength, setGradientStrength,
    aberration, setAberration, decay, setDecay, distortion, setDistortion,
    highFidelity, setHighFidelity, bloomIntensity, setBloomIntensity, bloomThreshold, setBloomThreshold,
    currentPalette, setCurrentPalette
}: OpticsTabProps) {
    return (
        <div className="flex flex-col gap-6 p-4">
            {/* COLOR SYSTEM */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500">
                    <Palette size={12} /> COLOR SYSTEM
                </div>

                <div className="bg-[#111] border border-[#222] p-3 rounded space-y-3">
                    {/* Color Mode Buttons */}
                    <div className="flex gap-2">
                        {[0, 1, 2, 3].map(m => (
                            <button
                                key={m}
                                onClick={() => setColorMode(m)}
                                className={cn(
                                    "flex-1 py-1 text-[9px] font-bold rounded border transition-all",
                                    colorMode === m
                                        ? "bg-blue-900/40 text-blue-300 border-blue-500/30"
                                        : "bg-[#0a0a0a] border-[#333] text-gray-500"
                                )}
                            >
                                {['SOLID', 'VELOCITY', 'RADIAL', 'GRADIENT'][m]}
                            </button>
                        ))}
                    </div>

                    {/* Color Pickers - Primary & Secondary */}
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <input type="color" value={colorHex} onChange={e => setColorHex(e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent border-none" />
                            <span className="text-[9px] text-gray-500">PRIMARY</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="color" value={color2Hex} onChange={e => setColor2Hex(e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent border-none" />
                            <span className="text-[9px] text-gray-500">SECONDARY</span>
                        </div>
                    </div>

                    {/* Gradient Strength (for modes 2,3) */}
                    {(colorMode === 2 || colorMode === 3) && (
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-gray-400">
                                <span>GRADIENT BLEND</span>
                                <span>{gradientStrength.toFixed(2)}</span>
                            </div>
                            <input type="range" min="0" max="2" step="0.05" value={gradientStrength} onChange={e => setGradientStrength(parseFloat(e.target.value))}
                                className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-purple-500" />
                        </div>
                    )}
                </div>
            </div>

            {/* PALETTE PRESETS */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500">
                    <Sparkles size={12} /> PALETTES ({PALETTE_NAMES.length})
                </div>

                <div className="grid grid-cols-4 gap-1.5 bg-[#111] border border-[#222] p-3 rounded">
                    {PALETTE_NAMES.map(name => {
                        const colors = COLOR_PALETTES[name];
                        const isActive = currentPalette === name;
                        return (
                            <button
                                key={name}
                                onClick={() => setCurrentPalette(name)}
                                className={cn(
                                    "h-8 rounded border-2 transition-all overflow-hidden flex",
                                    isActive ? "border-white scale-105" : "border-[#333] hover:border-gray-500"
                                )}
                                title={name}
                            >
                                {colors.map((c, i) => (
                                    <div key={i} className="flex-1 h-full" style={{ backgroundColor: c }} />
                                ))}
                            </button>
                        );
                    })}
                </div>
                <div className="text-[9px] text-gray-600 px-1">
                    Active: <span className="text-gray-400 font-mono">{currentPalette}</span>
                </div>
            </div>

            {/* PARTICLE RENDERER */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500">
                    <Layers size={12} /> RENDERER
                </div>

                <div className="bg-[#111] border border-[#222] p-3 rounded space-y-3">
                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-400">
                            <span>POINT SIZE</span>
                            <span>{pointSize.toFixed(1)}px</span>
                        </div>
                        <input type="range" min="0.1" max="10" step="0.1" value={pointSize} onChange={e => setPointSize(parseFloat(e.target.value))}
                            className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-white" />
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-400">
                            <span>OPACITY</span>
                            <span>{opacity.toFixed(2)}</span>
                        </div>
                        <input type="range" min="0.01" max="1.0" step="0.01" value={opacity} onChange={e => setOpacity(parseFloat(e.target.value))}
                            className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-white" />
                    </div>
                </div>
            </div>

            {/* POST PROCESS */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500">
                    <Aperture size={12} /> POST-FX
                </div>

                <div className="bg-[#111] border border-[#222] p-3 rounded space-y-3">
                    {/* Hi-Fi Toggle */}
                    <button
                        onClick={() => setHighFidelity(!highFidelity)}
                        className={cn(
                            "w-full flex items-center justify-between py-2 px-3 rounded border transition-all",
                            highFidelity
                                ? "bg-amber-900/30 border-amber-500/40 text-amber-300"
                                : "bg-[#0a0a0a] border-[#1a1a1a] text-gray-600 hover:bg-[#111] hover:text-gray-400"
                        )}
                    >
                        <span className="text-[10px] font-bold">HI-FIDELITY MODE</span>
                        <span className={cn(
                            "text-[8px] font-mono px-2 py-0.5 rounded",
                            highFidelity ? "bg-amber-500/20 text-amber-300" : "bg-[#111] text-gray-600"
                        )}>
                            {highFidelity ? 'BLOOM ON' : 'OFF'}
                        </span>
                    </button>

                    {/* Bloom Controls (only visible when Hi-Fi is on) */}
                    {highFidelity && (
                        <>
                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-gray-400">
                                    <span>BLOOM INTENSITY</span>
                                    <span>{bloomIntensity.toFixed(1)}</span>
                                </div>
                                <input type="range" min="0" max="3" step="0.1" value={bloomIntensity} onChange={e => setBloomIntensity(parseFloat(e.target.value))}
                                    className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-amber-500" />
                            </div>

                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-gray-400">
                                    <span>BLOOM THRESHOLD</span>
                                    <span>{bloomThreshold.toFixed(2)}</span>
                                </div>
                                <input type="range" min="0" max="1" step="0.05" value={bloomThreshold} onChange={e => setBloomThreshold(parseFloat(e.target.value))}
                                    className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-amber-500" />
                            </div>
                        </>
                    )}

                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-400">
                            <span>CHROMATIC ABERRATION</span>
                            <span>{aberration.toFixed(2)}</span>
                        </div>
                        <input type="range" min="0" max="5" step="0.1" value={aberration} onChange={e => setAberration(parseFloat(e.target.value))}
                            className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-400">
                            <span>FEEDBACK DECAY</span>
                            <span>{decay.toFixed(3)}</span>
                        </div>
                        <input type="range" min="0.8" max="0.99" step="0.001" value={decay} onChange={e => setDecay(parseFloat(e.target.value))}
                            className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-yellow-500" />
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-400">
                            <span>LENS DISTORTION</span>
                            <span>{distortion.toFixed(2)}</span>
                        </div>
                        <input type="range" min="0" max="1" step="0.05" value={distortion} onChange={e => setDistortion(parseFloat(e.target.value))}
                            className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-pink-500" />
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- EXPORT TAB ---
interface ExportTabProps {
    appMode: 'QUANTUM' | 'CHRONOS';
    isRecording: boolean;
    toggleRecording: () => void;
    exportGLB: () => void;
    exportOBJ: () => void;
    recResolution: string;
    setRecResolution: (r: string) => void;
    status: string;
    simId: number | null;
}

export function ExportTab({
    appMode, isRecording, toggleRecording, exportGLB, exportOBJ,
    recResolution, setRecResolution, status, simId
}: ExportTabProps) {
    const [vatDialogOpen, setVatDialogOpen] = useState(false);
    return (
        <div className="flex flex-col gap-6 p-4">
            {/* VIDEO EXPORT */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500">
                    <Video size={12} /> VIDEO CAPTURE
                </div>

                <div className="bg-[#111] border border-[#222] p-3 rounded space-y-3">
                    <div className="grid grid-cols-3 gap-1">
                        {['WINDOW', '4K', '8K'].map(r => (
                            <button
                                key={r}
                                onClick={() => setRecResolution(r)}
                                className={cn(
                                    "text-[9px] font-bold py-1 rounded border transition-all",
                                    recResolution === r
                                        ? "bg-red-900/30 text-red-300 border-red-500/30"
                                        : "bg-[#0a0a0a] border-[#333] text-gray-500"
                                )}
                            >
                                {r}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={toggleRecording}
                        className={cn(
                            "w-full flex items-center justify-center gap-2 py-3 rounded font-bold text-[10px] transition-all border",
                            isRecording
                                ? "bg-red-500 text-white border-red-400 animate-pulse"
                                : "bg-[#1a1a1a] border-[#333] text-gray-300 hover:text-white"
                        )}
                    >
                        <div className={cn("w-2 h-2 rounded-full", isRecording ? "bg-white" : "bg-red-500")} />
                        {isRecording ? "STOP RECORDING" : "START RECORDING"}
                    </button>
                </div>
            </div>

            {/* GEOMETRY EXPORT */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500">
                    <Box size={12} /> GEOMETRY
                </div>

                <div className="bg-[#111] border border-[#222] p-3 rounded space-y-2">
                    <button onClick={exportGLB} className="w-full flex items-center gap-2 px-3 py-2 bg-[#1a1a1a] hover:bg-[#222] border border-[#333] rounded text-[10px] text-gray-300 transition">
                        <Download size={12} /> EXPORT .GLB SCENE
                    </button>
                    <button onClick={exportOBJ} className="w-full flex items-center gap-2 px-3 py-2 bg-[#1a1a1a] hover:bg-[#222] border border-[#333] rounded text-[10px] text-gray-300 transition">
                        <Download size={12} /> EXPORT .OBJ FRAME
                    </button>
                </div>
            </div>

            {/* VAT EXPORT */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-bold text-purple-500">
                    <Film size={12} /> VAT EXPORT
                </div>

                <div className="bg-purple-900/10 border border-purple-500/20 p-3 rounded space-y-3">
                    <div className="text-[9px] text-purple-300 mb-2">
                        Export particle animation as Vertex Animation Textures for game engines (Unreal, Unity, etc.)
                    </div>
                    
                    <button 
                        onClick={() => setVatDialogOpen(true)}
                        disabled={!simId}
                        className="w-full flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-500 border border-purple-400 rounded text-[10px] text-white font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Download size={12} /> EXPORT VAT TEXTURES
                    </button>
                    
                    <div className="text-[8px] text-purple-400/60 space-y-0.5">
                        <div>• Position + Normal textures</div>
                        <div>• Configurable frame count & resolution</div>
                        <div>• Ready for UE5/Unity import</div>
                    </div>
                </div>
            </div>

            <VATExportDialog
                open={vatDialogOpen}
                onOpenChange={setVatDialogOpen}
                simId={simId}
                onExportComplete={() => {
                    console.log('VAT export completed');
                }}
            />
        </div>
    );
}
