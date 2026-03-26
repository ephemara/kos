import React from 'react';
import {
    Plus, Hammer, MousePointer2, BrainCircuit, Film,
    Zap, MonitorPlay, Expand, Layers, Grid, Anchor, Dna
} from 'lucide-react';
import { KHDRWidget } from '@/ui/widgets/KHDRWidget';
import { AppTopBar, AppTopBarGroup, AppTopBarButton, AppTopBarSeparator } from '@/ui/shell/AppTopBar';

interface TopBarProps {
    mode: string;
    activeShape: string;
    layers: any[];
    activeLayerId: string;
    surfaceMode: boolean;
    gridLock: boolean;
    gridSize: number;
    voidAnchor: boolean;
    fractalEcho: boolean;
    neonMode: boolean;
    setNeonMode: (v: boolean) => void;
    rayTracing: boolean;
    setRayTracing: (v: boolean) => void;
    toggleFullscreen: () => void;
    scene: any;
    renderer: any;
    onHDRActive: (v: boolean) => void;
}

export default function TopBar({
    mode,
    activeShape,
    layers,
    activeLayerId,
    surfaceMode,
    gridLock,
    gridSize,
    voidAnchor,
    fractalEcho,
    neonMode,
    setNeonMode,
    rayTracing,
    setRayTracing,
    toggleFullscreen,
    scene,
    renderer,
    onHDRActive,
}: TopBarProps) {
    const getModeIcon = () => {
        switch (mode) {
            case 'build': return <Plus size={12} />;
            case 'sculpt': return <Hammer size={12} />;
            case 'edit': return <MousePointer2 size={12} />;
            case 'architect': return <BrainCircuit size={12} />;
            case 'animate': return <Film size={12} />;
            default: return <Plus size={12} />;
        }
    };

    const getModeLabel = () => {
        return `PROTOCOL: ${mode.toUpperCase()}`;
    };

    const activeLayer = layers.find((l: any) => l.id === activeLayerId);

    return (
        <AppTopBar>
            {/* Left: Status Indicators */}
            <AppTopBarGroup align="start">
                <AppTopBarButton
                    variant="solid"
                    active={true}
                    icon={getModeIcon()}
                    label={getModeLabel()}
                    tooltip={`Current mode: ${mode}`}
                />

                {mode === 'build' && (
                    <AppTopBarButton
                        variant="ghost"
                        label={`INSERT: ${activeShape.startsWith('import') ? activeShape.split('_')[1] : activeShape.toUpperCase()}`}
                        tooltip="Active shape"
                    />
                )}

                <AppTopBarSeparator />

                <AppTopBarButton
                    variant="ghost"
                    icon={<Layers size={12} />}
                    label={`STRATUM: ${activeLayer?.name?.toUpperCase() || 'NONE'}`}
                    tooltip="Active layer"
                />

                {surfaceMode && (
                    <AppTopBarButton
                        variant="ghost"
                        active={true}
                        icon={<Grid size={12} />}
                        label="SURFACE MODE"
                        tooltip="Surface mode enabled"
                    />
                )}

                {gridLock && (
                    <AppTopBarButton
                        variant="ghost"
                        active={true}
                        icon={<Grid size={12} />}
                        label={`GRID: ${gridSize}`}
                        tooltip="Grid lock enabled"
                    />
                )}

                {voidAnchor && (
                    <AppTopBarButton
                        variant="ghost"
                        active={true}
                        icon={<Anchor size={12} />}
                        label="VOID ANCHOR"
                        tooltip="Void anchor enabled"
                    />
                )}

                {fractalEcho && (
                    <AppTopBarButton
                        variant="ghost"
                        active={true}
                        icon={<Dna size={12} />}
                        label="FRACTAL ECHO"
                        tooltip="Fractal echo enabled"
                    />
                )}
            </AppTopBarGroup>

            {/* Right: Control Buttons */}
            <AppTopBarGroup align="end">
                <KHDRWidget
                    scene={scene}
                    renderer={renderer}
                    defaultEnabled={false}
                    onHDRActive={onHDRActive}
                />

                <AppTopBarButton
                    variant="ghost"
                    active={rayTracing}
                    icon={<Zap size={16} />}
                    tooltip="Ray Tracing"
                    onClick={() => setRayTracing(!rayTracing)}
                />

                <AppTopBarButton
                    variant="ghost"
                    active={neonMode}
                    icon={<MonitorPlay size={16} />}
                    tooltip="Neon Protocol"
                    onClick={() => setNeonMode(!neonMode)}
                />

                <AppTopBarButton
                    variant="ghost"
                    icon={<Expand size={16} />}
                    tooltip="Fullscreen"
                    onClick={toggleFullscreen}
                />
            </AppTopBarGroup>
        </AppTopBar>
    );
}
