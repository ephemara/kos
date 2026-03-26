/**
 * TopBar - Using AppTopBar Modular Components
 * 
 * Shows the pattern for tool selection, sliders, toggles, and action buttons.
 * NO "K" PREFIX - completely generic template!
 */

import React from 'react';
import {
    AppTopBar,
    AppTopBarGroup,
    AppTopBarSeparator,
    AppTopBarButton,
    AppTopBarToggleGroup,
    AppTopBarToggleItem,
    AppTopBarSlider
} from '@mocap/shared/shell/AppTopBar';
import {
    Box, Circle, Square, Hexagon,
    Undo, Redo, Save, UploadCloud
} from 'lucide-react';

interface TopBarProps {
    activeTool: string;
    onToolChange: (toolId: string) => void;
}

export default function TopBar({ activeTool, onToolChange }: TopBarProps) {
    const [sliderValue, setSliderValue] = React.useState(50);
    const [toggleState, setToggleState] = React.useState(false);

    return (
        <AppTopBar>
            {/* LEFT: TOOLS & CONTROLS */}
            <AppTopBarGroup align="start">

                {/* Tool Selector */}
                <AppTopBarToggleGroup
                    type="single"
                    value={activeTool}
                    onValueChange={(v) => v && onToolChange(v)}
                >
                    <AppTopBarToggleItem value="tool1" label="TOOL 1" icon={<Box size={14} />} />
                    <AppTopBarToggleItem value="tool2" label="TOOL 2" icon={<Circle size={14} />} />
                    <AppTopBarToggleItem value="tool3" label="TOOL 3" icon={<Square size={14} />} />
                </AppTopBarToggleGroup>

                <AppTopBarSeparator />

                {/* Undo/Redo */}
                <AppTopBarToggleGroup type="multiple">
                    <AppTopBarButton onClick={() => console.log('Undo')} tooltip="Undo (Ctrl+Z)" icon={<Undo size={14} />} />
                    <AppTopBarButton onClick={() => console.log('Redo')} tooltip="Redo (Ctrl+Shift+Z)" icon={<Redo size={14} />} />
                </AppTopBarToggleGroup>

                <AppTopBarSeparator />

                {/* Slider Example */}
                <AppTopBarSlider
                    label="INTENSITY"
                    value={sliderValue}
                    min={0}
                    max={100}
                    step={1}
                    onChange={setSliderValue}
                />

                <AppTopBarSeparator />

                {/* Toggle Example */}
                <AppTopBarToggleGroup type="single" value={toggleState ? 'on' : 'off'}>
                    <AppTopBarToggleItem
                        value="on"
                        onClick={() => setToggleState(!toggleState)}
                        label="FEATURE"
                        className={toggleState ? "text-cyan-400 bg-cyan-900/20" : ""}
                    />
                </AppTopBarToggleGroup>

            </AppTopBarGroup>

            {/* RIGHT: ACTIONS */}
            <AppTopBarGroup align="end">

                <AppTopBarButton
                    onClick={() => console.log('Save')}
                    tooltip="Save Project"
                    label="SAVE"
                    icon={<Save size={12} />}
                    variant="outline"
                    className="border-green-500/40 bg-green-500/10 text-green-200 hover:bg-green-500/15"
                />

                <AppTopBarButton
                    onClick={() => console.log('Upload')}
                    tooltip="Upload to Cloud"
                    label="UPLOAD"
                    icon={<UploadCloud size={12} />}
                    variant="outline"
                    className="border-cyan-500/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/15"
                />

            </AppTopBarGroup>
        </AppTopBar>
    );
}
