import React, { useRef } from 'react';
import {
    AppTopBar,
    AppTopBarGroup,
    AppTopBarSeparator,
    AppTopBarButton,
    AppTopBarToggleGroup,
    AppTopBarToggleItem,
    AppTopBarSlider
} from '@/ui/shell/AppTopBar';
import {
    Undo, Redo, Split, Scan, Share2, Plus, Minus, Zap
} from 'lucide-react';
import { AppMode } from '../model';
import { invoke } from '@tauri-apps/api/core';
import { MatcapPicker } from './MatcapPicker';
import { BrushPickerPopover } from './BrushPickerPopover';
import type { KBrushAsset } from '@/services/brushClient';

interface TopBarProps {
    appMode: AppMode;
    setAppMode: (v: AppMode) => void;
    // Brush
    activeBrush: KBrushAsset;
    setActiveBrush: (b: KBrushAsset) => void;
    brushesLoaded?: boolean;
    // Sliders
    radius: number;
    setRadius: (v: number) => void;
    intensity: number;
    setIntensity: (v: number) => void;
    // Brush mode
    brushMode: 'ADD' | 'SUB';
    setBrushMode: (v: 'ADD' | 'SUB') => void;
    // View
    symmetry: 'NONE' | 'X';
    setSymmetry: (v: 'NONE' | 'X') => void;
    wireframe: boolean;
    setWireframe: (v: boolean) => void;
    dynamicTopology: boolean;
    setDynamicTopology: (v: boolean) => void;
    detailSize: number;
    setDetailSize: (v: number) => void;
    currentMatCap: string;
    setCurrentMatCap: (v: string) => void;
    showGrid: boolean;
    setShowGrid: (v: boolean) => void;
    // KAIN
    useKainShaders: boolean;
    setUseKainShaders: (v: boolean) => void;
    pipelineStatus: 'WGSL' | 'KAIN' | 'KAIN_META';
    onOpenKainAuthoring: () => void;
    onUplink: () => void;
    // KFlux
    fluxActive: boolean;
    onFluxToggle: () => void;
}

export default function TopBar({
    appMode, setAppMode,
    activeBrush, setActiveBrush, brushesLoaded,
    radius, setRadius,
    intensity, setIntensity,
    brushMode, setBrushMode,
    symmetry, setSymmetry,
    wireframe, setWireframe,
    dynamicTopology, setDynamicTopology,
    detailSize, setDetailSize,
    currentMatCap, setCurrentMatCap,
    showGrid, setShowGrid,
    useKainShaders, setUseKainShaders,
    pipelineStatus,
    onOpenKainAuthoring,
    onUplink,
    fluxActive, onFluxToggle,
}: TopBarProps) {
    return (
        <AppTopBar>
            {/* LEFT: BRUSH PICKER → MODE → CONTROLS */}
            <AppTopBarGroup align="start">

                {/* ── BRUSH PICKER — ZBrush style ── */}
                {activeBrush && (
                    <BrushPickerPopover
                        activeBrush={activeBrush}
                        setActiveBrush={(brush) => {
                            setActiveBrush(brush);
                            const isKain = (brush.kernel as any)?.family === 'spirv';
                            if (isKain) {
                                setUseKainShaders(true);
                            }
                        }}
                        brushesLoaded={brushesLoaded}
                    />
                )}

                <AppTopBarSeparator />

                {/* SCULPT / MODEL mode toggle */}
                <AppTopBarToggleGroup
                    type="single"
                    value={appMode}
                    onValueChange={(v) => v && setAppMode(v as AppMode)}
                >
                    <AppTopBarToggleItem value="SCULPT" label="SCULPT" />
                    <AppTopBarToggleItem value="MODEL" label="MODEL" />
                </AppTopBarToggleGroup>

                <AppTopBarSeparator />

                {/* ADD / SUB brush mode */}
                <AppTopBarToggleGroup
                    type="single"
                    value={brushMode}
                    onValueChange={(v) => v && setBrushMode(v as 'ADD' | 'SUB')}
                >
                    <AppTopBarToggleItem value="ADD" tooltip="Add clay" icon={<Plus size={13} />} />
                    <AppTopBarToggleItem value="SUB" tooltip="Subtract clay" icon={<Minus size={13} />} />
                </AppTopBarToggleGroup>

                <AppTopBarSeparator />

                {/* RADIUS */}
                <AppTopBarSlider
                    label="RADIUS"
                    value={radius}
                    min={0.05} max={5.0} step={0.05}
                    onChange={setRadius}
                />

                {/* INTENSITY */}
                <AppTopBarSlider
                    label="INTENSITY"
                    value={intensity}
                    min={0.1} max={5.0} step={0.1}
                    onChange={setIntensity}
                />

                <AppTopBarSeparator />

                {/* DYNTOPO */}
                <div className="flex items-center gap-2">
                    <AppTopBarToggleGroup type="single" value={dynamicTopology ? 'on' : 'off'}>
                        <AppTopBarToggleItem
                            value="on"
                            onClick={() => setDynamicTopology(!dynamicTopology)}
                            label="DYNTOPO"
                            className={dynamicTopology ? 'text-red-400 data-[state=on]:bg-red-900/20' : ''}
                        />
                    </AppTopBarToggleGroup>

                    {dynamicTopology && (
                        <div className="animate-in fade-in slide-in-from-left-2 duration-200">
                            <AppTopBarSlider
                                label="DETAIL"
                                value={detailSize}
                                min={0.1} max={2.0} step={0.1}
                                onChange={setDetailSize}
                                width="w-16"
                            />
                        </div>
                    )}
                </div>

                <AppTopBarSeparator />

                {/* KAIN */}
                <AppTopBarToggleGroup type="single" value={useKainShaders ? 'on' : 'off'}>
                    <AppTopBarToggleItem
                        value="on"
                        onClick={() => setUseKainShaders(!useKainShaders)}
                        label="KAIN"
                        tooltip="KAIN SPIR-V Pipeline"
                        className={useKainShaders ? 'text-purple-400 data-[state=on]:bg-purple-900/25' : ''}
                    />
                </AppTopBarToggleGroup>

                <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded border ${
                    pipelineStatus === 'KAIN_META'
                        ? 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/35'
                        : pipelineStatus === 'KAIN'
                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                            : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                }`}>
                    {pipelineStatus}
                </span>

                <AppTopBarButton
                    onClick={onOpenKainAuthoring}
                    tooltip="Open KAIN brush authoring"
                    label="KAIN IDE"
                    icon={<Zap size={12} />}
                    variant="outline"
                    className="border-purple-500/35 bg-purple-500/10 text-purple-200 hover:bg-purple-500/15"
                />

                <AppTopBarSeparator />

                {/* KFLUX — Turbo Lightspeed Flux Capacitor */}
                <AppTopBarToggleGroup type="single" value={fluxActive ? 'on' : 'off'}>
                    <AppTopBarToggleItem
                        value="on"
                        onClick={onFluxToggle}
                        label="FLUX"
                        tooltip="KFlux — GPU Surface Dynamics"
                        className={fluxActive
                            ? 'text-orange-400 data-[state=on]:bg-orange-900/25 border-orange-500/40 shadow-[0_0_8px_rgba(251,146,60,0.3)]'
                            : ''
                        }
                    />
                </AppTopBarToggleGroup>

            </AppTopBarGroup>

            {/* RIGHT: VIEW + ACTIONS */}
            <AppTopBarGroup align="end">
                <AppTopBarToggleGroup type="multiple" value={[
                    showGrid ? 'grid' : '',
                    symmetry === 'X' ? 'sym' : '',
                    wireframe ? 'wire' : ''
                ].filter(Boolean)}>
                    <AppTopBarToggleItem
                        value="grid"
                        onClick={() => setShowGrid(!showGrid)}
                        label="GRID"
                    />
                    <AppTopBarToggleItem
                        value="sym"
                        onClick={() => setSymmetry(symmetry === 'X' ? 'NONE' : 'X')}
                    >
                        <div className="flex items-center">
                            <Split size={12} className="mr-1" />
                            {symmetry === 'X' ? 'X' : 'OFF'}
                        </div>
                    </AppTopBarToggleItem>
                    <AppTopBarToggleItem
                        value="wire"
                        onClick={() => setWireframe(!wireframe)}
                        tooltip="Toggle Wireframe"
                        icon={<Scan size={13} />}
                    />
                </AppTopBarToggleGroup>

                <AppTopBarSeparator />

                {/* MATCAP — visual sphere swatch picker */}
                <MatcapPicker
                    currentMatCap={currentMatCap}
                    onSelect={setCurrentMatCap}
                />

                <AppTopBarSeparator />

                <AppTopBarButton
                    onClick={onUplink}
                    tooltip="Push to Cloud"
                    label="UPLINK"
                    icon={<Share2 size={12} />}
                    variant="outline"
                    className="border-orange-500/40 bg-orange-500/10 text-orange-200 hover:bg-orange-500/15"
                />
            </AppTopBarGroup>
        </AppTopBar>
    );
}
