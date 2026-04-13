/**
 * Template - The Perfect App Template
 * 
 * This is a scaffolded template showing the EXACT structure every app should follow.
 * Copy this folder to create new apps (IDEs, Photoshop clones, video editors, game engines, etc.)
 * 
 * USES ONLY MODULAR COMPONENTS FROM:
 * - @/ui/shell/* (AppShell, AppTopBar, DockPanel, etc.)
 * - @/ui/layers/* (UniversalLayerPanel)
 * - @/shared/primitives/* (Button, Slider, etc.)
 */

import React, { useState } from 'react';
import { AppShell } from '@mocap/shared/shell/AppShell';
import { Box } from 'lucide-react';

// UI Panels
import TopBar from './ui/TopBar';
import LeftPanel from './ui/LeftPanel';
import RightPanel from './ui/RightPanel';

// Engine
import { useTemplateEngine } from './hooks/useTemplateEngine';

export default function Template() {
    // ===================================================================
    // STATE MANAGEMENT
    // ===================================================================

    const [activeTool, setActiveTool] = useState('default');
    const [layers, setLayers] = useState([]);
    const [activeLayerId, setActiveLayerId] = useState<string | null>(null);

    // Engine hook (THREE.js scene, Bevy sync, etc.)
    const engine = useTemplateEngine();

    // ===================================================================
    // CALLBACKS
    // ===================================================================

    const handleToolChange = (toolId: string) => {
        setActiveTool(toolId);
        console.log('[Template] Tool changed:', toolId);
    };

    const handleLayerSelect = (layerId: string) => {
        setActiveLayerId(layerId);
        console.log('[Template] Layer selected:', layerId);
    };

    // ===================================================================
    // RENDER
    // ===================================================================

    return (
        <AppShell
            layoutKey="template"
            topBar={
                <TopBar
                    activeTool={activeTool}
                    onToolChange={handleToolChange}
                />
            }
            left={{
                title: "Tools",
                tabs: [
                    {
                        id: 'tools',
                        label: 'Tools',
                        icon: Box,
                        content: (
                            <LeftPanel
                                activeTool={activeTool}
                                onToolChange={handleToolChange}
                            />
                        )
                    }
                ],
                defaultTabId: 'tools',
                defaultSize: 20,
                minSize: 15,
                collapsedSize: 5
            }}
            right={{
                title: "Layers",
                tabs: [
                    {
                        id: 'layers',
                        label: 'Layers',
                        icon: Box,
                        content: (
                            <RightPanel
                                layers={layers}
                                activeLayerId={activeLayerId}
                                onLayerSelect={handleLayerSelect}
                            />
                        )
                    }
                ],
                defaultTabId: 'layers',
                defaultSize: 20,
                minSize: 15,
                collapsedSize: 5
            }}
        >
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0a0a0a] to-[#111]" ref={engine.containerRef}>
                <div className="text-center space-y-4">
                    <Box size={64} className="mx-auto text-cyan-500/20" />
                    <div className="text-2xl font-black text-cyan-400 tracking-[0.2em]">
                        TEMPLATE
                    </div>
                    <div className="text-sm text-gray-600 max-w-md">
                        This is the perfect scaffolded template.
                        <br />
                        Replace this viewport with your app's main canvas.
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
