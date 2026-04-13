/**
 * BevyViewportOverlay - Universal Viewport Overlay for Bevy
 * 
 * Provides side panels (Layer Panel, Sculpt Panel) and status bar.
 * Top bar is now handled by KOSTopBar in App.tsx.
 */

import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { BevyLayerPanel } from './BevyLayerPanel';
import { BevySculptPanel } from './BevySculptPanel';

type ActiveTool = 'viewport' | 'sculpt' | 'paint' | 'retopo';

interface BevyViewportOverlayProps {
    className?: string;
}

export function BevyViewportOverlay({ className = '' }: BevyViewportOverlayProps) {
    const [activeTool, setActiveTool] = useState<ActiveTool>('viewport');
    const [showLayers, setShowLayers] = useState(true);

    // ── Active tool: driven by Tauri push events ────────────────────────────────
    // Bevy emits 'leash://tool-changed' with the new tool string on every mode switch.
    useEffect(() => {
        let unlisten: (() => void) | null = null;
        let fallbackInterval: ReturnType<typeof setInterval> | null = null;

        const fetchTool = async () => {
            try {
                const tool = await invoke<string>('leash_get_active_tool');
                setActiveTool(tool.toLowerCase() as ActiveTool);
            } catch { /* Bevy not ready */ }
        };

        const setup = async () => {
            fetchTool(); // Initial fetch

            try {
                const { listen } = await import('@tauri-apps/api/event');
                unlisten = await listen<string>('leash://tool-changed', (event) => {
                    setActiveTool(event.payload.toLowerCase() as ActiveTool);
                });
            } catch {
                fallbackInterval = setInterval(fetchTool, 2000);
            }
        };

        setup();

        return () => {
            unlisten?.();
            if (fallbackInterval != null) clearInterval(fallbackInterval);
        };
    }, []);

    return (
        <div className={`absolute inset-0 pointer-events-none ${className}`}>
            {/* Left Panel - Tool-specific UI */}
            {activeTool === 'sculpt' && (
                <div className="absolute top-0 left-0 bottom-7 w-56 pointer-events-auto">
                    <BevySculptPanel isOpen />
                </div>
            )}

            {/* Right Panel - Layers */}
            {showLayers && (
                <div className="absolute top-0 right-0 bottom-7 pointer-events-auto">
                    <BevyLayerPanel
                        isOpen={showLayers}
                        onClose={() => setShowLayers(false)}
                    />
                </div>
            )}

            {/* Bottom Status Bar (handled by BevySculptPanel when in sculpt mode) */}
            {activeTool !== 'sculpt' && (
                <div className="absolute bottom-0 left-0 right-0 h-7 bg-[#12121a]/95 border-t border-[#1c1c23] flex items-center px-3 text-[10px] text-gray-500 pointer-events-auto">
                    <span className="text-cyan-400">VIEWPORT MODE</span>
                    <div className="flex-1" />
                    <span className="text-gray-600">Press S for Sculpt</span>
                </div>
            )}
        </div>
    );
}

export default BevyViewportOverlay;
