import React from 'react';
import * as Popover from '@radix-ui/react-popover';
import {
    Download, Share2, UploadCloud, Database, Split, RefreshCw,
    Undo2, Redo2, Settings, ChevronDown, Box
} from 'lucide-react';
import { cn } from '@/ui/primitives/cn';
import { AppTopBar, AppTopBarGroup, AppTopBarButton, AppTopBarSeparator } from '@/ui/shell/AppTopBar';

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
    cloneCount?: number;
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
        <AppTopBar>
            {/* LEFT: Tools & Stats */}
            <AppTopBarGroup align="start">
                {/* Undo/Redo (disabled for now) */}
                <div className="flex items-center gap-1">
                    <AppTopBarButton
                        disabled
                        tooltip="Undo"
                        shortcut="Ctrl+Z"
                        icon={<Undo2 size={12} />}
                        variant="ghost"
                    />
                    <AppTopBarButton
                        disabled
                        tooltip="Redo"
                        shortcut="Ctrl+Shift+Z"
                        icon={<Redo2 size={12} />}
                        variant="ghost"
                    />
                </div>

                <AppTopBarSeparator />

                {/* Clone Count Stats */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-black/50 border-l-2 border-cyan-500">
                    <Box size={10} className="text-cyan-400" />
                    <span className="text-[10px] font-bold text-cyan-400 font-mono tracking-wider">
                        {cloneCount > 0 ? cloneCount.toLocaleString() : '--'} CLONES
                    </span>
                </div>
            </AppTopBarGroup>

            {/* CENTER: Import & Library */}
            <AppTopBarGroup align="center">
                <AppTopBarButton
                    onClick={onImport}
                    tooltip="Import File"
                    shortcut="Ctrl+O"
                    icon={<UploadCloud size={12} />}
                    label="IMPORT"
                    variant="ghost"
                />
                
                <AppTopBarButton
                    onClick={onBrowse}
                    tooltip="Browse Storage Library"
                    icon={<Database size={12} />}
                    label="LIB"
                    variant="ghost"
                />
            </AppTopBarGroup>

            {/* RIGHT: Uplink & Export */}
            <AppTopBarGroup align="end">
                <AppTopBarButton
                    onClick={onUplink}
                    tooltip="Export to Kernel / Asset Browser"
                    shortcut="Ctrl+S"
                    icon={<Share2 size={12} />}
                    label="UPLINK"
                    variant="solid"
                    className="bg-green-500/10 hover:bg-green-500 border border-green-500/50 hover:border-green-400 text-green-400 hover:text-black"
                />

                {/* Export Popover */}
                <Popover.Root>
                    <Popover.Trigger asChild>
                        <AppTopBarButton
                            tooltip="Export Settings"
                            icon={<Download size={12} />}
                            label="EXPORT"
                            variant="solid"
                            className="bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 data-[state=open]:bg-cyan-500/30"
                        >
                            <ChevronDown size={10} className="opacity-50 ml-1" />
                        </AppTopBarButton>
                    </Popover.Trigger>
                    <Popover.Portal>
                        <Popover.Content 
                            className="z-50 w-64 bg-[color:var(--kos-surface-primary)] border border-[color:var(--kos-border-primary)] rounded-lg shadow-xl p-3 animate-in fade-in zoom-in-95 duration-200" 
                            sideOffset={8} 
                            align="end"
                        >
                            <div className="space-y-4">
                                {/* HEADER */}
                                <div className="flex items-center justify-between border-b border-[color:var(--kos-border-primary)] pb-2">
                                    <span className="text-[10px] font-black text-[color:var(--kos-text-secondary)] tracking-wider">EXPORT SETTINGS</span>
                                    <Settings size={10} className="text-[color:var(--kos-text-muted)]" />
                                </div>

                                {/* FORMAT */}
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-[color:var(--kos-text-muted)]">FORMAT</label>
                                    <div className="grid grid-cols-4 gap-1">
                                        {['GLB', 'OBJ', 'USDZ', 'VAT'].map(f => (
                                            <button
                                                key={f}
                                                onClick={() => setExportFormat(f)}
                                                className={cn(
                                                    "py-1.5 text-[9px] font-bold rounded border transition-all",
                                                    exportFormat === f
                                                        ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-400"
                                                        : "bg-[color:var(--kos-surface-secondary)] border-[color:var(--kos-border-primary)] text-[color:var(--kos-text-muted)] hover:bg-[color:var(--kos-surface-hover)] hover:text-[color:var(--kos-text-primary)]"
                                                )}
                                            >
                                                {f}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* ENGINE */}
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-[color:var(--kos-text-muted)]">TARGET ENGINE</label>
                                    <div className="grid grid-cols-3 gap-1">
                                        {['GENERIC', 'UNREAL', 'UNITY'].map(t => (
                                            <button
                                                key={t}
                                                onClick={() => setTargetEngine(t)}
                                                className={cn(
                                                    "py-1.5 text-[8px] font-bold rounded border transition-all",
                                                    targetEngine === t
                                                        ? "bg-[color:var(--kos-surface-tertiary)] border-[color:var(--kos-border-hover)] text-[color:var(--kos-text-primary)]"
                                                        : "bg-[color:var(--kos-surface-secondary)] border-[color:var(--kos-border-primary)] text-[color:var(--kos-text-muted)] hover:bg-[color:var(--kos-surface-hover)] hover:text-[color:var(--kos-text-primary)]"
                                                )}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* MODE */}
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-[color:var(--kos-text-muted)]">STRUCTURE</label>
                                    <div className="grid grid-cols-3 gap-1">
                                        {['ANIM', 'INSTANCE', 'SEPARATED'].map(m => (
                                            <button
                                                key={m}
                                                onClick={() => setExportMode(m)}
                                                className={cn(
                                                    "py-1.5 text-[8px] font-bold rounded border transition-all",
                                                    exportMode === m
                                                        ? "bg-blue-500/20 border-blue-500/50 text-blue-400"
                                                        : "bg-[color:var(--kos-surface-secondary)] border-[color:var(--kos-border-primary)] text-[color:var(--kos-text-muted)] hover:bg-[color:var(--kos-surface-hover)] hover:text-[color:var(--kos-text-primary)]"
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
                                                ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-400"
                                                : "bg-[color:var(--kos-surface-secondary)] border-[color:var(--kos-border-primary)] text-[color:var(--kos-text-muted)] hover:text-[color:var(--kos-text-primary)]"
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Split size={10} />
                                            <span>SPLIT ANIMATIONS</span>
                                        </div>
                                        <div className={cn("w-2 h-2 rounded-full", splitAnimations ? "bg-cyan-400" : "bg-[color:var(--kos-border-primary)]")} />
                                    </button>
                                </div>

                                {/* MAIN ACTION */}
                                <button
                                    onClick={onBake}
                                    disabled={baking}
                                    className={cn(
                                        "w-full py-2 rounded font-bold text-[10px] flex items-center justify-center gap-2 tracking-widest transition-all shadow-lg border mt-2",
                                        exportFormat === 'VAT'
                                            ? "bg-purple-600 hover:bg-purple-500 text-white border-purple-400 disabled:opacity-50"
                                            : "bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-400 disabled:opacity-50"
                                    )}
                                >
                                    {baking ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
                                    {baking ? 'PROCESSING...' : (exportFormat === 'VAT' ? 'BAKE TEXTURES' : 'EXPORT FILE')}
                                </button>
                            </div>
                            <Popover.Arrow className="fill-[color:var(--kos-surface-primary)] stroke-[color:var(--kos-border-primary)]" />
                        </Popover.Content>
                    </Popover.Portal>
                </Popover.Root>
            </AppTopBarGroup>
        </AppTopBar>
    );
}
