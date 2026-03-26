/**
 * BevySculptPanel - Sculpt Mode UI for Bevy Viewport
 * 
 * Ported from egui sculpt_panel.rs to React.
 * Shows brush library, settings, symmetry, and geometry operations.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
    Undo2, Redo2, Camera, ChevronDown, ChevronRight,
    Plus, Minus, Scissors, Grid3X3
} from 'lucide-react';

// Types matching Bevy's brush system
interface BrushAsset {
    id: string;
    name: string;
    category: string;
    kernel: string;
}

interface SculptState {
    activeBrushId: string;
    radius: number;
    intensity: number;
    isAddMode: boolean;
    symmetryX: boolean;
    symmetryY: boolean;
    symmetryZ: boolean;
    hitPoint: [number, number, number] | null;
    vertCount: number;
    triCount: number;
    undoCount: number;
    fps: number;
}

interface BevySculptPanelProps {
    isOpen?: boolean;
    className?: string;
}

// Brush kernel icons
const KERNEL_ICONS: Record<string, string> = {
    stamp: '🏺',
    smooth: '✨',
    pinch: '🤏',
    grab: '✊',
    flatten: '⬛',
    physics: '⚡',
    sim_cloth: '👕',
    sim_gravity: '🍎',
    sim_inflate: '🎈',
    paint_color: '🎨',
    paint_mask: '🎭',
    crystal_growth: '💎',
    crystal_bismuth: '🔮',
    voronoi_shatter: '💥',
    custom: '🔧',
};

function getKernelIcon(kernel: string): string {
    return KERNEL_ICONS[kernel.toLowerCase()] || '🖌️';
}

export function BevySculptPanel({ isOpen = true, className = '' }: BevySculptPanelProps) {
    const [brushes, setBrushes] = useState<BrushAsset[]>([]);
    const [state, setState] = useState<SculptState>({
        activeBrushId: '',
        radius: 0.35,
        intensity: 0.6,
        isAddMode: true,
        symmetryX: false,
        symmetryY: false,
        symmetryZ: false,
        hitPoint: null,
        vertCount: 0,
        triCount: 0,
        undoCount: 0,
        fps: 60,
    });
    const [geometryExpanded, setGeometryExpanded] = useState(false);

    // ── Sculpt state: driven by Tauri push events, not polling ─────────────────
    // Bevy emits 'leash://sculpt-state' whenever brush state changes.
    // We keep a 2-second fallback poll only for startup (before first event fires).
    useEffect(() => {
        if (!isOpen) return;

        let unlisten: (() => void) | null = null;
        let fallbackInterval: ReturnType<typeof setInterval> | null = null;

        const pollState = async () => {
            try {
                const result = await invoke<SculptState>('leash_get_sculpt_state');
                setState(result);
            } catch { /* Bevy not ready */ }
        };

        const loadBrushes = async () => {
            try {
                const result = await invoke<BrushAsset[]>('leash_get_brush_library');
                setBrushes(result);
            } catch { /* Use fallback brushes */ }
        };

        const setup = async () => {
            loadBrushes();
            pollState(); // Initial fetch

            // Try to subscribe to push events from Bevy
            try {
                const { listen } = await import('@tauri-apps/api/event');
                unlisten = await listen<SculptState>('leash://sculpt-state', (event) => {
                    setState(event.payload);
                });
            } catch {
                // If listen() isn't available (dev/test env), use throttled fallback
                fallbackInterval = setInterval(pollState, 2000);
            }
        };

        setup();

        return () => {
            unlisten?.();
            if (fallbackInterval != null) clearInterval(fallbackInterval);
        };
    }, [isOpen]);

    const handleSwitchBrush = useCallback(async (brushId: string) => {
        try {
            await invoke('leash_switch_brush', { brushId });
        } catch (e) {
            console.error('Failed to switch brush:', e);
        }
    }, []);

    const handleSetRadius = useCallback(async (radius: number) => {
        setState(s => ({ ...s, radius }));
        try {
            await invoke('leash_set_brush_radius', { radius });
        } catch (e) {
            console.error('Failed to set radius:', e);
        }
    }, []);

    const handleSetIntensity = useCallback(async (intensity: number) => {
        setState(s => ({ ...s, intensity }));
        try {
            await invoke('leash_set_brush_intensity', { intensity });
        } catch (e) {
            console.error('Failed to set intensity:', e);
        }
    }, []);

    const handleToggleMode = useCallback(async () => {
        const newMode = !state.isAddMode;
        setState(s => ({ ...s, isAddMode: newMode }));
        try {
            await invoke('leash_set_brush_mode', { isAdd: newMode });
        } catch (e) {
            console.error('Failed to set mode:', e);
        }
    }, [state.isAddMode]);

    const handleToggleSymmetry = useCallback(async (axis: 'x' | 'y' | 'z') => {
        const key = `symmetry${axis.toUpperCase()}` as keyof SculptState;
        const newValue = !state[key];
        setState(s => ({ ...s, [key]: newValue }));
        try {
            await invoke('leash_set_symmetry', { axis, enabled: newValue });
        } catch (e) {
            console.error('Failed to set symmetry:', e);
        }
    }, [state]);

    const handleUndo = useCallback(async () => {
        try {
            await invoke('leash_sculpt_undo');
        } catch (e) {
            console.error('Failed to undo:', e);
        }
    }, []);

    const handleRedo = useCallback(async () => {
        try {
            await invoke('leash_sculpt_redo');
        } catch (e) {
            console.error('Failed to redo:', e);
        }
    }, []);

    const handleSubdivide = useCallback(async () => {
        try {
            await invoke('leash_subdivide');
        } catch (e) {
            console.error('Failed to subdivide:', e);
        }
    }, []);

    const handleRemesh = useCallback(async () => {
        try {
            await invoke('leash_remesh', { resolution: 128 });
        } catch (e) {
            console.error('Failed to remesh:', e);
        }
    }, []);

    // Group brushes by category
    const brushesByCategory = brushes.reduce((acc, brush) => {
        const cat = brush.category.split('/')[0] || 'Other';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(brush);
        return acc;
    }, {} as Record<string, BrushAsset[]>);

    const activeBrush = brushes.find(b => b.id === state.activeBrushId);

    // Format numbers for display
    const formatNumber = (n: number) => {
        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
        if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
        return n.toString();
    };

    if (!isOpen) return null;

    return (
        <div className={`flex flex-col h-full ${className}`}>
            {/* Left Panel - Brushes & Settings */}
            <div className="flex flex-col bg-[#1c1c23] border-r border-[#12121a] w-56 h-full">
                {/* Brush Library Header */}
                <div className="px-3 py-2 border-b border-[#12121a]">
                    <span className="text-purple-400 font-semibold text-xs">
                        📁 BRUSH LIBRARY
                    </span>
                </div>

                {/* Active Brush */}
                {activeBrush && (
                    <div className="px-3 py-2 border-b border-[#12121a] bg-[#1a1a22]">
                        <div className="text-[10px] text-gray-500">Active:</div>
                        <div className="text-cyan-400 text-sm font-semibold flex items-center gap-1">
                            <span>{getKernelIcon(activeBrush.kernel)}</span>
                            {activeBrush.name}
                        </div>
                    </div>
                )}

                {/* Brush List */}
                <div className="flex-1 overflow-y-auto px-2 py-2">
                    {Object.entries(brushesByCategory).map(([category, categoryBrushes]) => (
                        <div key={category} className="mb-3">
                            <div className="text-[9px] text-gray-500 font-semibold uppercase mb-1 px-1">
                                {category}
                            </div>
                            {categoryBrushes.map((brush) => {
                                const isActive = brush.id === state.activeBrushId;
                                return (
                                    <button
                                        key={brush.id}
                                        onClick={() => handleSwitchBrush(brush.id)}
                                        className={`w-full text-left px-2 py-1.5 rounded text-xs mb-0.5 transition-colors flex items-center gap-2 ${isActive
                                                ? 'bg-purple-500/30 text-white border border-purple-500/50'
                                                : 'bg-[#26262f] text-gray-300 hover:bg-[#2e2e3a]'
                                            }`}
                                    >
                                        <span>{getKernelIcon(brush.kernel)}</span>
                                        {brush.name}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                    {brushes.length === 0 && (
                        <div className="text-gray-600 text-xs text-center py-4">
                            Loading brushes...
                        </div>
                    )}
                </div>

                {/* Settings Section */}
                <div className="border-t border-[#12121a] px-3 py-2">
                    <div className="text-[10px] text-gray-500 mb-2">SETTINGS</div>

                    {/* Radius Slider */}
                    <div className="mb-2">
                        <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                            <span>Size</span>
                            <span>{state.radius.toFixed(2)}</span>
                        </div>
                        <input
                            type="range"
                            min="0.01"
                            max="2"
                            step="0.01"
                            value={state.radius}
                            onChange={(e) => handleSetRadius(parseFloat(e.target.value))}
                            className="w-full h-1 bg-[#26262f] rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        />
                    </div>

                    {/* Intensity Slider */}
                    <div className="mb-2">
                        <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                            <span>Strength</span>
                            <span>{Math.round(state.intensity * 100)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.01"
                            value={state.intensity}
                            onChange={(e) => handleSetIntensity(parseFloat(e.target.value))}
                            className="w-full h-1 bg-[#26262f] rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        />
                    </div>

                    {/* Add/Subtract Mode */}
                    <div className="flex gap-1 mb-3">
                        <button
                            onClick={() => !state.isAddMode && handleToggleMode()}
                            className={`flex-1 py-1 rounded text-[10px] flex items-center justify-center gap-1 transition-colors ${state.isAddMode
                                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                    : 'bg-[#26262f] text-gray-500'
                                }`}
                        >
                            <Plus size={10} /> Add
                        </button>
                        <button
                            onClick={() => state.isAddMode && handleToggleMode()}
                            className={`flex-1 py-1 rounded text-[10px] flex items-center justify-center gap-1 transition-colors ${!state.isAddMode
                                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                    : 'bg-[#26262f] text-gray-500'
                                }`}
                        >
                            <Minus size={10} /> Sub
                        </button>
                    </div>
                </div>

                {/* Symmetry Section */}
                <div className="border-t border-[#12121a] px-3 py-2">
                    <div className="text-[10px] text-gray-500 mb-2">SYMMETRY</div>
                    <div className="flex gap-2">
                        {(['x', 'y', 'z'] as const).map((axis) => {
                            const isActive = state[`symmetry${axis.toUpperCase()}` as keyof SculptState];
                            const colors = {
                                x: 'orange',
                                y: 'cyan',
                                z: 'purple',
                            };
                            return (
                                <button
                                    key={axis}
                                    onClick={() => handleToggleSymmetry(axis)}
                                    className={`px-3 py-1 rounded text-xs font-bold transition-colors ${isActive
                                            ? `bg-${colors[axis]}-500/20 text-${colors[axis]}-400 border border-${colors[axis]}-500/30`
                                            : 'bg-[#26262f] text-gray-500'
                                        }`}
                                    style={{
                                        backgroundColor: isActive ? `rgba(var(--${colors[axis]}-rgb), 0.2)` : undefined,
                                        color: isActive ? `var(--${colors[axis]})` : undefined,
                                    }}
                                >
                                    {axis.toUpperCase()}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Geometry Section */}
                <div className="border-t border-[#12121a] px-3 py-2">
                    <button
                        onClick={() => setGeometryExpanded(!geometryExpanded)}
                        className="flex items-center gap-1 text-[10px] text-gray-500 w-full"
                    >
                        {geometryExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        GEOMETRY
                    </button>
                    {geometryExpanded && (
                        <div className="flex flex-wrap gap-1 mt-2">
                            <button
                                onClick={handleSubdivide}
                                className="px-2 py-1 bg-[#26262f] hover:bg-[#2e2e3a] rounded text-[10px] text-gray-300 flex items-center gap-1"
                            >
                                <Grid3X3 size={10} /> Subdivide
                            </button>
                            <button
                                onClick={handleRemesh}
                                className="px-2 py-1 bg-[#26262f] hover:bg-[#2e2e3a] rounded text-[10px] text-gray-300 flex items-center gap-1"
                            >
                                <Scissors size={10} /> Remesh
                            </button>
                        </div>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="border-t border-[#12121a] px-3 py-2 flex gap-1">
                    <button
                        onClick={handleUndo}
                        className="flex-1 py-1.5 bg-[#26262f] hover:bg-[#2e2e3a] rounded text-xs text-gray-300 flex items-center justify-center gap-1"
                    >
                        <Undo2 size={12} /> Undo
                    </button>
                    <button
                        onClick={handleRedo}
                        className="flex-1 py-1.5 bg-[#26262f] hover:bg-[#2e2e3a] rounded text-xs text-gray-300 flex items-center justify-center gap-1"
                    >
                        <Redo2 size={12} /> Redo
                    </button>
                </div>
            </div>

            {/* Bottom Status Bar */}
            <div className="absolute bottom-0 left-0 right-0 h-7 bg-[#12121a] border-t border-[#1c1c23] flex items-center px-3 text-[10px] text-gray-500">
                <span className="mr-4">Verts: {formatNumber(state.vertCount)}</span>
                <span className="mr-4">Tris: {formatNumber(state.triCount)}</span>
                <span className="mr-4">Undo: {state.undoCount}</span>
                <div className="flex-1" />
                <span className="text-purple-400 mr-4">SCULPT MODE</span>
                <span className={state.fps > 55 ? 'text-cyan-400' : state.fps > 30 ? 'text-orange-400' : 'text-red-400'}>
                    {Math.round(state.fps)} FPS
                </span>
            </div>
        </div>
    );
}

export default BevySculptPanel;
