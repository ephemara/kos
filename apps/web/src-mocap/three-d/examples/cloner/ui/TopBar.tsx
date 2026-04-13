import React from 'react';
import * as Popover from '@radix-ui/react-popover';
import {
    Download, Share2, UploadCloud, Database, Split, RefreshCw,
    Undo2, Redo2, Settings, ChevronDown, Box
} from 'lucide-react';
import { cn } from '@mocap/shared/primitives/cn';

interface TopBarProps {
    exportFormat: string; setExportFormat: (v: string) => void;
    exportMode: string; setExportMode: (v: string) => void;
    targetEngine: string; setTargetEngine: (v: string) => void;
    splitAnimations: boolean; setSplitAnimations: (v: boolean) => void;
    baking: boolean;
    onImport: () => void;
    onBrowse: () => void;
    onUplink: () => void;
    onBake: () => void;
    cloneCount?: number; // Optional prop for future stats
}

export function TopBar({
    exportFormat, setExportFormat,
    exportMode, setExportMode,
    targetEngine, setTargetEngine,
    splitAnimations, setSplitAnimations,
    baking,
    onImport,
    onBrowse,
    onUplink,
    onBake,
    cloneCount = 0
}: TopBarProps) {
    return (
        <div className="h-10 border-b border-[#222] bg-[#0a0a0a] flex items-center justify-between px-3 select-none">

            {/* LEFT: TOOLS & STATS */}
            <div className="flex items-center gap-1">
                <div className="flex items-center bg-[#161616] rounded border border-[#333] p-0.5">
                    <button className="p-1.5 text-gray-500 hover:text-white rounded hover:bg-[#222] disabled:opacity-30" disabled>
                        <Undo2 size={12} />
                    </button>
                    <button className="p-1.5 text-gray-500 hover:text-white rounded hover:bg-[#222] disabled:opacity-30" disabled>
                        <Redo2 size={12} />
                    </button>
                </div>

                <div className="w-px h-5 bg-[#222] mx-2" />

                <div className="flex items-center gap-2 px-2 py-1 rounded bg-[#161616]/50 border border-[#222]">
                    <Box size={10} className="text-cyan-600" />
                    <span className="text-[9px] font-bold text-gray-400 font-mono">
                        {cloneCount > 0 ? cloneCount.toLocaleString() : '--'} CLONES
                    </span>
                </div>
            </div>

            {/* RIGHT: ACTIONS */}
            <div className="flex items-center gap-2">
                <div className="flex items-center bg-[#161616] rounded border border-[#333] p-0.5">
                    <button onClick={onImport} className="px-2 py-1.5 text-[9px] font-bold text-gray-400 hover:text-white hover:bg-[#222] rounded flex items-center gap-2" title="Import File">
                        <UploadCloud size={10} /> IMPORT
                    </button>
                    <div className="w-px h-3 bg-[#333] mx-1" />
                    <button onClick={onBrowse} className="px-2 py-1.5 text-[9px] font-bold text-gray-400 hover:text-white hover:bg-[#222] rounded flex items-center gap-2" title="Browse Storage">
                        <Database size={10} /> LIB
                    </button>
                </div>

                <button onClick={onUplink} className="px-3 py-1.5 bg-green-900/10 hover:bg-green-900/30 text-green-500 border border-green-900/30 rounded text-[9px] font-bold flex items-center gap-2 transition-all" title="Send to Kernel">
                    <Share2 size={10} /> UPLINK
                </button>

                {/* EXPORT POPOVER */}
                <Popover.Root>
                    <Popover.Trigger asChild>
                        <button className="px-3 py-1.5 bg-cyan-900/20 hover:bg-cyan-900/40 text-cyan-400 border border-cyan-900/50 rounded text-[9px] font-bold flex items-center gap-2 transition-all data-[state=open]:bg-cyan-900/40 data-[state=open]:text-white">
                            <Download size={10} /> EXPORT <ChevronDown size={10} className="opacity-50" />
                        </button>
                    </Popover.Trigger>
                    <Popover.Portal>
                        <Popover.Content className="z-50 w-64 bg-[#111] border border-[#333] rounded-lg shadow-xl p-3 animate-in fade-in zoom-in-95 duration-200" sideOffset={5} align="end">
                            <div className="space-y-4">
                                {/* HEADER */}
                                <div className="flex items-center justify-between border-b border-[#222] pb-2">
                                    <span className="text-[10px] font-black text-gray-400 tracking-wider">EXPORT SETTINGS</span>
                                    <Settings size={10} className="text-gray-600" />
                                </div>

                                {/* FORMAT */}
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-gray-500">FORMAT</label>
                                    <div className="grid grid-cols-4 gap-1">
                                        {['GLB', 'OBJ', 'USDZ', 'VAT'].map(f => (
                                            <button
                                                key={f}
                                                onClick={() => setExportFormat(f)}
                                                className={cn(
                                                    "py-1.5 text-[9px] font-bold rounded border",
                                                    exportFormat === f
                                                        ? "bg-cyan-900/40 border-cyan-500/50 text-cyan-100"
                                                        : "bg-[#161616] border-[#222] text-gray-500 hover:bg-[#222] hover:text-gray-300"
                                                )}
                                            >
                                                {f}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* ENGINE */}
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-gray-500">TARGET ENGINE</label>
                                    <div className="grid grid-cols-3 gap-1">
                                        {['GENERIC', 'UNREAL', 'UNITY'].map(t => (
                                            <button
                                                key={t}
                                                onClick={() => setTargetEngine(t)}
                                                className={cn(
                                                    "py-1.5 text-[8px] font-bold rounded border",
                                                    targetEngine === t
                                                        ? "bg-gray-700 border-gray-500 text-white"
                                                        : "bg-[#161616] border-[#222] text-gray-500 hover:bg-[#222] hover:text-gray-300"
                                                )}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* MODE */}
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-gray-500">STRUCTURE</label>
                                    <div className="grid grid-cols-3 gap-1">
                                        {['ANIM', 'INSTANCE', 'SEPARATED'].map(m => (
                                            <button
                                                key={m}
                                                onClick={() => setExportMode(m)}
                                                className={cn(
                                                    "py-1.5 text-[8px] font-bold rounded border",
                                                    exportMode === m
                                                        ? "bg-blue-900/40 border-blue-500/50 text-blue-100"
                                                        : "bg-[#161616] border-[#222] text-gray-500 hover:bg-[#222] hover:text-gray-300"
                                                )}
                                            >
                                                {m}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* OPTIONS */}
                                <div className="space-y-1.5">
                                    <button
                                        onClick={() => setSplitAnimations(!splitAnimations)}
                                        className={cn(
                                            "w-full py-1.5 px-2 rounded border flex items-center justify-between text-[9px] font-bold transition-all",
                                            splitAnimations
                                                ? "bg-cyan-900/20 border-cyan-500/50 text-cyan-400"
                                                : "bg-[#161616] border-[#222] text-gray-500 hover:text-gray-300"
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Split size={10} />
                                            <span>SPLIT ANIMATIONS</span>
                                        </div>
                                        <div className={cn("w-2 h-2 rounded-full", splitAnimations ? "bg-cyan-400" : "bg-[#333]")} />
                                    </button>
                                </div>

                                {/* MAIN ACTION */}
                                <button
                                    onClick={onBake}
                                    disabled={baking}
                                    className={cn(
                                        "w-full py-2 rounded font-bold text-[10px] flex items-center justify-center gap-2 tracking-widest hover:text-white transition-all shadow-lg border mt-2",
                                        exportFormat === 'VAT'
                                            ? "bg-purple-900 hover:bg-purple-800 text-white border-purple-500"
                                            : "bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-400"
                                    )}
                                >
                                    {baking ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
                                    {baking ? 'PROCESSING...' : (exportFormat === 'VAT' ? 'BAKE TEXTURES' : 'EXPORT FILE')}
                                </button>
                            </div>
                            <Popover.Arrow className="fill-[#111] stroke-[#333]" />
                        </Popover.Content>
                    </Popover.Portal>
                </Popover.Root>
            </div>
        </div>
    );
}
