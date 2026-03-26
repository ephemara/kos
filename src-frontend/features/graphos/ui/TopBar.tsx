import React from 'react';
import { ColorPopover } from '@/ui/primitives/ColorPopover';
import { Brush, Eraser, Cpu, Monitor, Split, Palette, Move, Square, Lasso, Sparkles } from 'lucide-react';
import { cn } from '@/ui/primitives/cn';
import {
    AppTopBar,
    AppTopBarGroup,
    AppTopBarSeparator,
    AppTopBarButton,
    AppTopBarToggleGroup,
    AppTopBarToggleItem,
    AppTopBarSlider
} from '@/ui/shell/AppTopBar';
import { GraphosTool } from '../tools';

interface TopBarProps {
    brush: any;
    setBrush: (v: any) => void;
    activeTool: GraphosTool;
    setActiveTool: (tool: GraphosTool) => void;
    selectionMode: 'replace' | 'add' | 'subtract' | 'intersect';
    setSelectionMode: (mode: 'replace' | 'add' | 'subtract' | 'intersect') => void;
    wandTolerance: number;
    setWandTolerance: (value: number) => void;
    gpuMode: boolean;
    setGpuMode: (v: boolean) => void;
    canvasConfig: { width: number; height: number };
    onResize: (size: number) => void;
}

export default function TopBar({
    brush, setBrush,
    activeTool, setActiveTool,
    selectionMode, setSelectionMode,
    wandTolerance, setWandTolerance,
    gpuMode, setGpuMode,
    canvasConfig, onResize
}: TopBarProps) {
    return (
        <AppTopBar>
            {/* LEFT: TOOLS */}
            <AppTopBarGroup align="start">
                <div className="flex items-center gap-2">
                    <Palette size={14} className="text-rose-500" />
                    <span className="text-[10px] font-black text-white tracking-widest hidden sm:block">K-GRAPHOS</span>
                </div>

                <AppTopBarSeparator />

                <AppTopBarToggleGroup
                    type="single"
                    value={activeTool}
                    onValueChange={(v) => {
                        if (!v) return;
                        const next = v as GraphosTool;
                        setActiveTool(next);
                        if (next === 'eraser') setBrush((b: any) => ({ ...b, erase: true }));
                        if (next === 'brush') setBrush((b: any) => ({ ...b, erase: false }));
                    }}
                >
                    <AppTopBarToggleItem value="brush" tooltip="Brush Tool (B)">
                        <Brush size={14} />
                    </AppTopBarToggleItem>
                    <AppTopBarToggleItem value="erase" tooltip="Eraser Tool (E)">
                        <Eraser size={14} />
                    </AppTopBarToggleItem>
                    <AppTopBarToggleItem value="move" tooltip="Move Tool (V)">
                        <Move size={14} />
                    </AppTopBarToggleItem>
                    <AppTopBarToggleItem value="marquee" tooltip="Rectangular Marquee (M)">
                        <Square size={14} />
                    </AppTopBarToggleItem>
                    <AppTopBarToggleItem value="lasso" tooltip="Lasso Tool (L)">
                        <Lasso size={14} />
                    </AppTopBarToggleItem>
                    <AppTopBarToggleItem value="wand" tooltip="Magic Wand (W)">
                        <Sparkles size={14} />
                    </AppTopBarToggleItem>
                </AppTopBarToggleGroup>

                <AppTopBarSeparator />

                {/* SLIDERS */}
                <AppTopBarSlider
                    label="Size"
                    value={brush.size}
                    min={1}
                    max={500}
                    step={1}
                    onChange={(v) => setBrush((b: any) => ({ ...b, size: v }))}
                    width="w-20"
                    showValue={true}
                    formatValue={(v) => `${v}px`}
                />

                <AppTopBarSlider
                    label="Opacity"
                    value={brush.opacity}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v) => setBrush((b: any) => ({ ...b, opacity: v }))}
                    width="w-16"
                    showValue={true}
                    formatValue={(v) => `${(v * 100).toFixed(0)}%`}
                />

                {(activeTool === 'marquee' || activeTool === 'lasso' || activeTool === 'wand') && (
                    <>
                        <AppTopBarSeparator />
                        <select
                            value={selectionMode}
                            onChange={(e) => setSelectionMode(e.target.value as any)}
                            className="bg-transparent text-[10px] font-bold text-cyan-300 outline-none cursor-pointer hover:text-cyan-200 uppercase"
                        >
                            <option value="replace">Replace</option>
                            <option value="add">Add</option>
                            <option value="subtract">Subtract</option>
                            <option value="intersect">Intersect</option>
                        </select>
                    </>
                )}

                {activeTool === 'wand' && (
                    <AppTopBarSlider
                        label="Tolerance"
                        value={wandTolerance}
                        min={0}
                        max={128}
                        step={1}
                        onChange={setWandTolerance}
                        width="w-20"
                        showValue={true}
                        formatValue={(v) => `${v}`}
                    />
                )}

                <AppTopBarSeparator />

                {/* SYMMETRY */}
                <AppTopBarToggleGroup
                    type="single"
                    value={brush.symmetry}
                    onValueChange={(v) => v && setBrush((b: any) => ({ ...b, symmetry: v }))}
                >
                    <AppTopBarToggleItem value="NONE" tooltip="No Symmetry">OFF</AppTopBarToggleItem>
                    <AppTopBarToggleItem value="X" tooltip="X Symmetry">X</AppTopBarToggleItem>
                    <AppTopBarToggleItem value="Y" tooltip="Y Symmetry">Y</AppTopBarToggleItem>
                    <AppTopBarToggleItem value="RADIAL" tooltip="Radial Symmetry (Slow)">
                        <Split size={12} />
                    </AppTopBarToggleItem>
                </AppTopBarToggleGroup>
            </AppTopBarGroup>

            {/* CENTER: COLOR */}
            <AppTopBarGroup align="center">
                <ColorPopover
                    color={brush.color}
                    onChange={(c) => setBrush((b: any) => ({ ...b, color: c }))}
                    label="PIGMENT"
                />
            </AppTopBarGroup>

            {/* RIGHT: MODE */}
            <AppTopBarGroup align="end">
                <AppTopBarButton
                    active={gpuMode}
                    onClick={() => setGpuMode(!gpuMode)}
                    tooltip="GPU Acceleration"
                    icon={<Cpu size={14} />}
                    label="GPU"
                    className={gpuMode ? "bg-cyan-900/20 text-cyan-400 border border-cyan-500 shadow-[0_0_10px_rgba(34,211,238,0.3)] hover:bg-cyan-900/40" : ""}
                />

                <AppTopBarSeparator />

                <div className="flex items-center gap-2">
                    <Monitor size={14} className="text-gray-500" />
                    <select
                        value={canvasConfig.width}
                        onChange={(e) => onResize(parseInt(e.target.value))}
                        className="bg-transparent text-[10px] font-bold text-gray-300 outline-none cursor-pointer hover:text-white"
                    >
                        <option value={1024}>1024x1024</option>
                        <option value={2048}>2048x2048</option>
                        <option value={4096}>4096x4096</option>
                    </select>
                </div>
            </AppTopBarGroup>
        </AppTopBar>
    );
}
