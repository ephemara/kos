import React from 'react';
import {
    Activity, Play, Pause, RotateCcw, Zap,
    Monitor, Clock, MoreHorizontal
} from 'lucide-react';
import { cn } from '@mocap/shared/primitives/cn'; // Assuming utility exists, otherwise inline

interface TopBarProps {
    appMode: 'QUANTUM' | 'CHRONOS';
    setAppMode: (mode: 'QUANTUM' | 'CHRONOS') => void;
    isPlaying: boolean;
    togglePlay: () => void;
    handleReset: () => void;
    highFidelity: boolean;
    setHighFidelity: (b: boolean) => void;
    fps?: number;
}

export default function TopBar({
    appMode, setAppMode,
    isPlaying, togglePlay,
    handleReset,
    highFidelity, setHighFidelity,
    fps = 60
}: TopBarProps) {
    return (
        <div className="h-10 flex items-center justify-between px-3 bg-[#0a0a0a] border-b border-[#222]">
            {/* LEFT: Mode Switcher */}
            <div className="flex items-center gap-4">
                <div className="flex bg-[#111] rounded border border-[#222] p-0.5">
                    <button
                        onClick={() => setAppMode('QUANTUM')}
                        className={cn(
                            "flex items-center gap-2 px-3 py-1 rounded transition-all text-[10px] font-bold",
                            appMode === 'QUANTUM'
                                ? "bg-blue-900/30 text-blue-400 border border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                                : "text-gray-500 hover:text-gray-300"
                        )}
                    >
                        <Zap size={12} /> QUANTUM
                    </button>
                    <button
                        onClick={() => setAppMode('CHRONOS')}
                        className={cn(
                            "flex items-center gap-2 px-3 py-1 rounded transition-all text-[10px] font-bold",
                            appMode === 'CHRONOS'
                                ? "bg-purple-900/30 text-purple-400 border border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.2)]"
                                : "text-gray-500 hover:text-gray-300"
                        )}
                    >
                        <Clock size={12} /> CHRONOS
                    </button>
                </div>

                <div className="w-px h-4 bg-[#222]" />

                {/* Transport */}
                <button
                    onClick={togglePlay}
                    className={cn(
                        "flex items-center gap-2 px-3 py-1 rounded border transition-all text-[10px] font-bold",
                        isPlaying
                            ? "bg-green-900/20 border-green-500/30 text-green-400"
                            : "bg-[#1a1a1a] border-[#333] text-gray-400 hover:text-white"
                    )}
                >
                    {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                    {isPlaying ? "RUNNING" : "PAUSED"}
                </button>

                <div className="text-[10px] font-mono text-gray-500">
                    {fps} FPS
                </div>
            </div>

            {/* RIGHT: Tools */}
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setHighFidelity(!highFidelity)}
                    className={cn(
                        "flex items-center gap-2 px-2 py-1 rounded border transition-all text-[10px] font-bold",
                        highFidelity
                            ? "bg-orange-900/20 border-orange-500/30 text-orange-400"
                            : "bg-[#1a1a1a] border-[#333] text-gray-600 hover:text-gray-400"
                    )}
                    title="High Fidelity Mode (Double Particles)"
                >
                    <Activity size={12} /> HI-FI
                </button>

                <div className="w-px h-4 bg-[#222]" />

                <button
                    onClick={handleReset}
                    className="p-1.5 rounded hover:bg-white/10 text-gray-500 hover:text-white transition"
                    title="Reset Simulation"
                >
                    <RotateCcw size={14} />
                </button>

                <button className="p-1.5 rounded hover:bg-white/10 text-gray-500 hover:text-white transition">
                    <MoreHorizontal size={14} />
                </button>
            </div>
        </div>
    );
}
