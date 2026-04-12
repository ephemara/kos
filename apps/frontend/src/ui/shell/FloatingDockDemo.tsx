/**
 * FloatingDockDemo — Example usage of the floating dock system
 * ─────────────────────────────────────────────────────────────────────────────
 * Shows how to integrate FloatingDock into your app
 */

import React from 'react';
import { AppShellFloating } from './AppShellFloating';
import { FloatingDockTab } from './FloatingDock';
import { Layers, Settings, Palette, Box } from 'lucide-react';

export function FloatingDockDemo() {
    const dockTabs: FloatingDockTab[] = [
        {
            id: 'layers',
            title: 'Layers',
            icon: Layers,
            content: (
                <div className="p-4 space-y-2">
                    <h3 className="text-sm font-bold text-gray-200">Layers Panel</h3>
                    <div className="space-y-1">
                        {['Background', 'Main', 'Foreground', 'Effects'].map((layer, i) => (
                            <div
                                key={i}
                                className="px-3 py-2 bg-[#111] rounded-md text-xs text-gray-400 hover:bg-[#1a1a1a] cursor-pointer transition-colors"
                            >
                                {layer}
                            </div>
                        ))}
                    </div>
                </div>
            ),
            closable: false,
        },
        {
            id: 'properties',
            title: 'Properties',
            icon: Settings,
            content: (
                <div className="p-4 space-y-3">
                    <h3 className="text-sm font-bold text-gray-200">Properties</h3>
                    <div className="space-y-2">
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Opacity</label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                defaultValue="100"
                                className="w-full"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Blend Mode</label>
                            <select className="w-full px-2 py-1 bg-[#111] border border-[#2a2a2a] rounded text-xs text-gray-300">
                                <option>Normal</option>
                                <option>Multiply</option>
                                <option>Screen</option>
                                <option>Overlay</option>
                            </select>
                        </div>
                    </div>
                </div>
            ),
        },
        {
            id: 'materials',
            title: 'Materials',
            icon: Palette,
            content: (
                <div className="p-4">
                    <h3 className="text-sm font-bold text-gray-200 mb-3">Material Library</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {['Metal', 'Wood', 'Glass', 'Plastic', 'Fabric', 'Stone'].map((mat, i) => (
                            <div
                                key={i}
                                className="aspect-square bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] rounded-lg flex items-center justify-center text-xs text-gray-400 hover:text-gray-200 cursor-pointer transition-colors border border-[#2a2a2a] hover:border-orange-500/50"
                            >
                                {mat}
                            </div>
                        ))}
                    </div>
                </div>
            ),
        },
        {
            id: 'objects',
            title: 'Objects',
            icon: Box,
            content: (
                <div className="p-4">
                    <h3 className="text-sm font-bold text-gray-200 mb-3">Scene Objects</h3>
                    <div className="space-y-1">
                        {['Camera', 'Light 1', 'Light 2', 'Mesh 1', 'Mesh 2', 'Mesh 3'].map((obj, i) => (
                            <div
                                key={i}
                                className="px-3 py-2 bg-[#111] rounded-md text-xs text-gray-400 hover:bg-[#1a1a1a] cursor-pointer transition-colors flex items-center gap-2"
                            >
                                <Box size={12} />
                                {obj}
                            </div>
                        ))}
                    </div>
                </div>
            ),
        },
    ];

    return (
        <AppShellFloating
            layoutKey="floating-dock-demo"
            dockTabs={dockTabs}
            defaultDockLayout="left-right"
            topBar={
                <div className="h-10 flex items-center px-4 gap-4">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Floating Dock Demo
                    </span>
                    <div className="flex-1" />
                    <span className="text-xs text-gray-600">
                        Drag tabs to detach • Drag back to dock
                    </span>
                </div>
            }
            statusBar={
                <span>Ready • Floating dock system active</span>
            }
        >
            <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-[#0a0a0a] to-[#050505]">
                <div className="text-center space-y-4">
                    <h1 className="text-4xl font-black text-gray-200">Floating Dock System</h1>
                    <p className="text-gray-500 max-w-md">
                        Drag any tab to detach it into a floating window. Drag it back to any edge to re-dock.
                        Resize panels, maximize windows, and organize your workspace however you want.
                    </p>
                    <div className="flex gap-2 justify-center text-xs text-gray-600">
                        <div className="px-3 py-1 bg-[#111] rounded-md">Drag tabs to float</div>
                        <div className="px-3 py-1 bg-[#111] rounded-md">Drop to dock</div>
                        <div className="px-3 py-1 bg-[#111] rounded-md">Persistent layout</div>
                    </div>
                </div>
            </div>
        </AppShellFloating>
    );
}
