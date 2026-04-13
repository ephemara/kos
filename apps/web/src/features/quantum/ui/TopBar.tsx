import React from 'react';
import {
    Activity, Play, Pause, RotateCcw, Zap,
    Clock, Share2, Wind
} from 'lucide-react';
import {
    AppTopBar,
    AppTopBarGroup,
    AppTopBarButton,
    AppTopBarSeparator,
    AppTopBarToggleGroup,
    AppTopBarToggleItem
} from '@/ui/shell/AppTopBar';

interface TopBarProps {
    appMode: 'QUANTUM' | 'CHRONOS' | 'CFD';
    setAppMode: (mode: 'QUANTUM' | 'CHRONOS' | 'CFD') => void;
    isPlaying: boolean;
    togglePlay: () => void;
    handleReset: () => void;
    highFidelity: boolean;
    setHighFidelity: (b: boolean) => void;
    onUplink: () => void;
    fps?: number;
}

export default function TopBar({
    appMode, setAppMode,
    isPlaying, togglePlay,
    handleReset,
    highFidelity, setHighFidelity,
    onUplink,
    fps = 60
}: TopBarProps) {
    return (
        <AppTopBar>
            {/* LEFT: Mode Switcher & Transport Controls */}
            <AppTopBarGroup align="start">
                <AppTopBarToggleGroup
                    type="single"
                    value={appMode}
                    onValueChange={(value) => value && setAppMode(value as 'QUANTUM' | 'CHRONOS' | 'CFD')}
                >
                    <AppTopBarToggleItem
                        value="QUANTUM"
                        icon={<Zap size={12} />}
                        label="QUANTUM"
                        tooltip="Quantum Simulation Mode"
                    />
                    <AppTopBarToggleItem
                        value="CHRONOS"
                        icon={<Clock size={12} />}
                        label="CHRONOS"
                        tooltip="Chronos Time Mode"
                    />
                    <AppTopBarToggleItem
                        value="CFD"
                        icon={<Wind size={12} />}
                        label="CFD"
                        tooltip="Computational Fluid Dynamics"
                    />
                </AppTopBarToggleGroup>

                <AppTopBarSeparator />

                <AppTopBarButton
                    onClick={togglePlay}
                    active={isPlaying}
                    icon={isPlaying ? <Pause size={12} /> : <Play size={12} />}
                    label={isPlaying ? "RUNNING" : "PAUSED"}
                    tooltip={isPlaying ? "Pause Simulation" : "Start Simulation"}
                    variant="solid"
                />

                <div className="text-[10px] font-mono text-[color:var(--kos-text-muted)] px-2">
                    {fps} FPS
                </div>
            </AppTopBarGroup>

            {/* RIGHT: Tools & Actions */}
            <AppTopBarGroup align="end">
                <AppTopBarButton
                    onClick={() => setHighFidelity(!highFidelity)}
                    active={highFidelity}
                    icon={<Activity size={12} />}
                    label="HI-FI"
                    tooltip="High Fidelity Mode (Double Particles)"
                    variant="outline"
                />

                <AppTopBarSeparator />

                <AppTopBarButton
                    onClick={handleReset}
                    icon={<RotateCcw size={12} />}
                    tooltip="Reset Simulation"
                    variant="ghost"
                />

                <AppTopBarSeparator />

                {/* UPLINK BUTTON */}
                <AppTopBarButton
                    onClick={onUplink}
                    label="UPLINK"
                    icon={<Share2 size={12} />}
                    tooltip="Export to Kernel/Asset Browser"
                    variant="outline"
                />
            </AppTopBarGroup>
        </AppTopBar>
    );
}
