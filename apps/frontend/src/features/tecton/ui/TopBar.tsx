import React, { useState } from 'react';
import {
    Globe, Activity, Share2, Flame, UploadCloud, Film,
    LayoutTemplate, Layers, Thermometer, FileDown, Save, RotateCcw, Eye, Grid
} from 'lucide-react';
import { cn } from '@/ui/primitives/cn';
import {
    AppTopBar,
    AppTopBarGroup,
    AppTopBarSeparator,
    AppTopBarButton,
    AppTopBarToggleGroup,
    AppTopBarToggleItem
} from '@/ui/shell/AppTopBar';
import { AppMenuBar, AppMenuBarMenu } from '@/ui/shell/AppMenuBar';
import type { ShadingModeConfig } from '@/services/configClient';

interface TopBarProps {
    status: string;
    onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onCommit: () => void;
    onExportGLB: () => void;
    onExportHeightmap: (format: 'png8' | 'png16' | 'exr', resolution?: number) => void;
    viewMode: number;
    setViewMode: (m: number) => void;
    shadingModes: ShadingModeConfig[];
    asteroidParams: { radius: number; strength: number };
    setAsteroidParams: React.Dispatch<React.SetStateAction<{ radius: number; strength: number }>>;
    handleAsteroid: () => void;
    showSequencer: boolean;
    setShowSequencer: (s: boolean) => void;
}

export function TopBar({
    status,
    onImport,
    onCommit,
    onExportGLB,
    onExportHeightmap,
    viewMode,
    setViewMode,
    shadingModes,
    asteroidParams,
    setAsteroidParams,
    handleAsteroid,
    showSequencer,
    setShowSequencer
}: TopBarProps) {
    const [showAsteroidMenu, setShowAsteroidMenu] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);

    // File input ref for triggering import
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    
    // Icon mapping for shading modes
    const iconMap: Record<string, React.ReactNode> = {
        'eye': <Eye size={14} />,
        'grid': <Grid size={14} />,
        'activity': <Activity size={14} />,
        'layers': <Layers size={14} />,
        'thermometer': <Thermometer size={14} />,
        'layout': <LayoutTemplate size={14} />,
    };

    // Define menus for AppMenuBar
    const menus: AppMenuBarMenu[] = [
        {
            label: 'File',
            items: [
                { 
                    label: 'Import Heightmap...', 
                    onSelect: () => fileInputRef.current?.click(),
                    shortcut: 'Ctrl+I' 
                },
                { 
                    label: 'Export Terrain (GLB)', 
                    onSelect: onExportGLB,
                    shortcut: 'Ctrl+E' 
                },
                { 
                    label: 'Export Heightmap (PNG 8-bit)', 
                    onSelect: () => onExportHeightmap('png8'),
                },
                { 
                    label: 'Export Heightmap (PNG 16-bit)', 
                    onSelect: () => onExportHeightmap('png16'),
                },
                { 
                    label: 'Export Heightmap (EXR)', 
                    onSelect: () => onExportHeightmap('exr'),
                },
            ],
        },
        {
            label: 'Edit',
            items: [
                { label: 'Undo', disabled: true, shortcut: 'Ctrl+Z' },
                { label: 'Redo', disabled: true, shortcut: 'Ctrl+Y' },
            ],
        },
        {
            label: 'View',
            items: [
                // Dynamically generate view mode menu items from config
                ...shadingModes.map(mode => ({
                    label: mode.name,
                    onSelect: () => setViewMode(mode.modeIndex),
                })),
                { 
                    label: 'Toggle Sequencer', 
                    onSelect: () => setShowSequencer(!showSequencer),
                    shortcut: 'Ctrl+T'
                },
            ],
        },
    ];

    return (
        <>
            {/* Hidden file input for import */}
            <input 
                ref={fileInputRef}
                type="file" 
                onChange={onImport} 
                className="hidden" 
                accept="image/*" 
            />
            
            <AppTopBar>
                {/* LEFT: MENU BAR & STATUS */}
                <AppTopBarGroup align="start">
                    <AppMenuBar menus={menus} className="h-8 border-emerald-500/20" />

                    <AppTopBarSeparator />

                    <div className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded bg-[#0a0a0a] border border-[#1a1a1a] transition-all",
                        status.includes("PROCESSING") && "border-yellow-500/50 bg-yellow-500/10"
                    )}>
                        <Activity size={10} className={status.includes("PROCESSING") ? "text-yellow-400 animate-pulse" : "text-emerald-500"} />
                        <span className="text-[9px] font-mono text-gray-400 uppercase min-w-[100px] truncate">{status}</span>
                    </div>
                </AppTopBarGroup>

                {/* CENTER: UPLINK */}
                <AppTopBarGroup align="center">
                    <AppTopBarButton
                        onClick={onCommit}
                        label="UPLINK"
                        icon={<Share2 size={10} />}
                        variant="outline"
                        tooltip="Push Terrain to Kernel/Asset Browser"
                        className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/60 px-6 transition-all"
                    />
                </AppTopBarGroup>

                {/* RIGHT: TOOLS */}
                <AppTopBarGroup align="end">
                    <AppTopBarToggleGroup
                        type="single"
                        value={showSequencer ? 'on' : 'off'}
                        onValueChange={(v) => setShowSequencer(v === 'on')}
                    >
                        <AppTopBarToggleItem value="on" tooltip="Toggle Geo-Sequencer (Animation Timeline)">
                            <Film size={14} />
                        </AppTopBarToggleItem>
                    </AppTopBarToggleGroup>

                    <AppTopBarSeparator />

                    {/* View Modes - Dynamically generated from config */}
                    <AppTopBarToggleGroup
                        type="single"
                        value={viewMode.toString()}
                        onValueChange={(v) => v && setViewMode(parseInt(v))}
                    >
                        {shadingModes.map(mode => (
                            <AppTopBarToggleItem 
                                key={mode.id}
                                value={mode.modeIndex.toString()} 
                                tooltip={mode.description || mode.name}
                            >
                                {mode.icon && iconMap[mode.icon] ? iconMap[mode.icon] : <Eye size={14} />}
                            </AppTopBarToggleItem>
                        ))}
                    </AppTopBarToggleGroup>

                    <AppTopBarSeparator />

                    {/* Asteroid Menu */}
                    <div
                        className="relative"
                        onMouseEnter={() => setShowAsteroidMenu(true)}
                        onMouseLeave={() => setShowAsteroidMenu(false)}
                    >
                        <AppTopBarButton
                            onClick={handleAsteroid}
                            tooltip="Simulate Asteroid Impact (Destructive)"
                            className="text-red-500 hover:bg-red-900/20 hover:text-red-400 transition-all"
                        >
                            <Flame size={14} />
                        </AppTopBarButton>

                        {showAsteroidMenu && (
                            <div className="absolute top-full right-0 mt-2 w-52 bg-[#0a0a0a] border border-red-900/50 p-4 rounded-lg shadow-xl z-50 animate-in fade-in zoom-in-95 duration-200">
                                <div className="text-[10px] font-bold text-red-500 mb-3 tracking-widest uppercase border-b border-red-900/30 pb-2">Impact Settings</div>
                                <div className="space-y-3">
                                    <div>
                                        <div className="flex justify-between text-[10px] text-red-400 mb-1.5">
                                            <span>Radius</span>
                                            <span className="font-mono text-[9px]">{asteroidParams.radius.toFixed(1)}</span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min="0.1" 
                                            max="1.0" 
                                            step="0.1" 
                                            value={asteroidParams.radius} 
                                            onChange={e => setAsteroidParams(p => ({ ...p, radius: parseFloat(e.target.value) }))} 
                                            className="w-full h-1.5 bg-red-900/30 rounded appearance-none accent-red-500 cursor-pointer" 
                                        />
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-[10px] text-red-400 mb-1.5">
                                            <span>Force</span>
                                            <span className="font-mono text-[9px]">{asteroidParams.strength.toFixed(1)}</span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min="1.0" 
                                            max="20.0" 
                                            step="1.0" 
                                            value={asteroidParams.strength} 
                                            onChange={e => setAsteroidParams(p => ({ ...p, strength: parseFloat(e.target.value) }))} 
                                            className="w-full h-1.5 bg-red-900/30 rounded appearance-none accent-red-500 cursor-pointer" 
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </AppTopBarGroup>
            </AppTopBar>
        </>
    );
}
