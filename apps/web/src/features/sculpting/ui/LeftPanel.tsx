import React from 'react';
import { Hammer, Paintbrush, Scan, Hexagon, Move, Undo, RefreshCcw, Copy, ChevronRight, Box } from 'lucide-react';
import { STANDARD_BRUSHES } from '../constants';
// AlphaPicker removed from LeftPanel — alpha management now lives in AssetBrowser
import { TransformPanel } from '@/ui/shell/controls/transform/TransformPanel';
import { ModelPanel, AppMode, ModelModeState } from '../model';
// BrushSelector removed — brush picking moved to TopBar BrushPickerPopover
import type { KBrushAsset } from '@/services/brushClient';


interface LeftPanelProps {
    mode: 'brushes' | 'geo' | 'edit';
    // App Mode (SCULPT vs MODEL)
    appMode: AppMode;
    modelState: ModelModeState;
    setModelState: React.Dispatch<React.SetStateAction<ModelModeState>>;

    // Legacy props for geo/edit modes
    activeTool?: string;
    setActiveTool?: (v: string) => void;

    // Data-Driven Brush Tab (for brushes mode)
    activeBrush?: KBrushAsset | null;
    setActiveBrush?: (brush: KBrushAsset) => void;
    brushesLoaded?: boolean;

    setMode: (v: 'SCULPT' | 'TRANSFORM') => void;
    activeColor: string;
    setActiveColor: (v: string) => void;
    undo: () => void;
    wireframe: boolean;
    setWireframe: (v: boolean) => void;
    // Alpha
    sharedState: any;
    activeAlpha: any;
    setActiveAlpha: (v: any) => void;
    onSaveAlphaToStorage: (alpha: { name: string; url: string }) => void;
    // Geo Tab
    subdivisionLevel: number;
    polyCount: number;
    handleStepUp: () => void;
    onRemesh: () => void;
    onGpuDynamesh?: (resolution: number) => void;
    onClearMask: () => void;
    onInvertMask: () => void;
    onExtractMask: () => void;
    // Edit Tab
    hasSelection: boolean;
    gizmoMode: 'translate' | 'rotate' | 'scale';
    setGizmoMode: (v: 'translate' | 'rotate' | 'scale') => void;
    transformSpace: 'world' | 'local';
    setTransformSpace: (v: 'world' | 'local') => void;
    snapEnabled: boolean;
    setSnapEnabled: (v: boolean) => void;
    transformData: any;
    updateTransformFromUI: (key: string, val: number) => void;
}

export default function LeftPanel({
    mode,
    appMode, modelState, setModelState,
    activeTool, setActiveTool, // Legacy props for geo/edit modes
    activeBrush, setActiveBrush, brushesLoaded, // Data-driven props for brushes mode
    setMode,
    activeColor, setActiveColor,
    undo, wireframe, setWireframe,
    sharedState, activeAlpha, setActiveAlpha, onSaveAlphaToStorage,
    subdivisionLevel, polyCount, handleStepUp, onRemesh, onGpuDynamesh,
    onClearMask, onInvertMask, onExtractMask,
    hasSelection,
    gizmoMode, setGizmoMode, transformSpace, setTransformSpace,
    snapEnabled, setSnapEnabled,
    transformData, updateTransformFromUI
}: LeftPanelProps) {
    // AlphaPicker now manages its own library via KBrushEngine

    // =========================================================================
    // MODEL MODE - Shape picker + modifiers for instant mesh spawning
    // =========================================================================
    if (appMode === 'MODEL') {
        return (
            <div className="flex flex-col h-full bg-[#0f0f0f] p-4 space-y-6 overflow-y-auto custom-scrollbar">
                {/* HEADER */}
                <div className="border-b border-[#222] pb-4">
                    <div className="flex items-center gap-2 text-emerald-500 mb-1">
                        <Box size={16} />
                        <span className="font-black tracking-[0.2em] text-xs">MODEL MODE</span>
                    </div>
                    <div className="text-[9px] text-gray-600 uppercase tracking-widest">Drag to spawn geometry</div>
                </div>

                {/* MODEL PANEL */}
                <ModelPanel
                    activeShape={modelState.activeShape}
                    onShapeChange={(id) => setModelState(prev => ({ ...prev, activeShape: id }))}
                    modifiers={modelState.modifiers}
                    onModifiersChange={(mods) => setModelState(prev => ({ ...prev, modifiers: mods }))}
                    userImports={modelState.userImports}
                />
            </div>
        );
    }

    // =========================================================================
    // SCULPT MODE - Standard brush/geo/edit tabs
    // =========================================================================
    if (mode === 'brushes') {
        // Brush PICKER is now in the TopBar (ZBrush style).
        // This panel shows brush settings / quick actions.
        return (
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', background: '#0d0d0d', padding: '10px 8px', gap: 8 }}>

                {/* Active brush info card */}
                {activeBrush && (
                    <div style={{
                        background: '#111', border: '1px solid #1e1e1e', borderRadius: 7,
                        padding: '10px 12px',
                    }}>
                        <div className="text-[8px] font-bold text-gray-700 uppercase tracking-widest mb-2">Active Brush</div>
                        <div className="text-[11px] font-bold text-gray-200">{activeBrush.name}</div>
                        <div className="text-[9px] text-gray-600 mt-0.5">
                            {activeBrush.category?.split('/').pop()}
                            {(activeBrush.kernel as any)?.family === 'spirv' && (
                                <span className="ml-2 text-purple-500">KAIN</span>
                            )}
                        </div>
                    </div>
                )}

                {/* Quick actions */}
                <div className="grid grid-cols-2 gap-1">
                    <button
                        onClick={undo}
                        className="py-2 bg-[#111] hover:bg-[#181818] border border-[#1e1e1e] rounded text-gray-600 hover:text-gray-300 text-[9px] font-bold flex items-center justify-center gap-1.5 transition-all"
                    >
                        <Undo size={10} /> Undo
                    </button>
                    <button
                        onClick={() => setWireframe(!wireframe)}
                        className={`py-2 rounded text-[9px] font-bold flex items-center justify-center gap-1.5 border transition-all ${
                            wireframe
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                                : 'bg-[#111] text-gray-600 border-[#1e1e1e] hover:text-gray-300'
                        }`}
                    >
                        <Scan size={10} /> Wire
                    </button>
                </div>

                {activeTool === 'PAINT' && (
                    <div className="flex items-center gap-2 p-2 bg-[#111] border border-[#1e1e1e] rounded">
                        <span className="text-[8px] font-bold text-gray-700">COLOR</span>
                        <input
                            type="color"
                            value={activeColor}
                            onChange={e => setActiveColor(e.target.value)}
                            className="flex-1 h-6 cursor-pointer bg-transparent border-none"
                        />
                    </div>
                )}

            </div>
        );
    }

    if (mode === 'geo') {
        return (
            <div className="flex flex-col h-full bg-[#0f0f0f] p-4 space-y-6 overflow-y-auto custom-scrollbar">
                {/* MASKING */}
                <div className="space-y-2">
                    <div className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2 tracking-wider"><Scan size={12} /> Masking</div>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={onClearMask} className="py-2 bg-[#222] hover:bg-[#333] rounded text-gray-400 text-[9px] font-bold">CLEAR (Alt+C)</button>
                        <button onClick={onInvertMask} className="py-2 bg-[#222] hover:bg-[#333] rounded text-gray-400 text-[9px] font-bold">INVERT (Alt+I)</button>
                        <button onClick={onExtractMask} className="col-span-2 py-2 bg-[#222] hover:bg-[#333] border border-[#333] hover:border-orange-500/50 rounded text-gray-400 hover:text-orange-400 text-[9px] font-bold flex items-center justify-center gap-2">
                            <Copy size={12} /> EXTRACT MASK
                        </button>
                    </div>
                </div>

                {/* SUBDIVISION */}
                <div className="space-y-4 pt-4 border-t border-[#222]">
                    <div className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2 tracking-wider"><Hexagon size={12} /> Geometry Ops</div>
                    <div className="p-3 bg-[#161616] rounded border border-[#222]">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[9px] font-bold text-gray-400">Subdivision Level</span>
                            <span className="text-[9px] font-bold text-orange-500">{subdivisionLevel}</span>
                        </div>
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-[9px] font-bold text-gray-500">Poly Count</span>
                            <span className="text-[9px] font-bold text-orange-500">{polyCount.toLocaleString()} tris</span>
                        </div>
                        <button onClick={handleStepUp} className="w-full py-2 bg-gradient-to-r from-orange-900/50 to-red-900/50 border border-orange-500/30 hover:border-orange-500 text-orange-200 rounded text-[9px] font-bold">
                            SUBDIVIDE
                        </button>
                    </div>

                    {/* REMESH */}
                    <div className="p-3 bg-[#161616] rounded border border-[#222] space-y-2">
                        <button onClick={onRemesh} className="w-full py-2 bg-[#222] border border-[#333] hover:border-white text-gray-300 rounded text-[9px] font-bold flex items-center justify-center gap-2">
                            <RefreshCcw size={12} /> REMESH (VOXEL)
                        </button>
                        {onGpuDynamesh && (
                            <div className="space-y-1">
                                <div className="flex gap-1">
                                    <button onClick={() => onGpuDynamesh(64)} className="flex-1 py-2 bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 hover:border-purple-500 text-purple-300 rounded text-[8px] font-bold">
                                        GPU 64
                                    </button>
                                    <button onClick={() => onGpuDynamesh(128)} className="flex-1 py-2 bg-gradient-to-r from-purple-900/50 to-blue-900/50 border border-purple-500/50 hover:border-purple-400 text-purple-200 rounded text-[8px] font-bold">
                                        GPU 128
                                    </button>
                                    <button onClick={() => onGpuDynamesh(192)} className="flex-1 py-2 bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 hover:border-purple-500 text-purple-300 rounded text-[8px] font-bold">
                                        GPU 192
                                    </button>
                                </div>
                                <div className="text-[7px] text-gray-600 text-center">GPU DYNAMESH (ZBrush-style)</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // mode === 'edit'
    return (
        <div className="flex flex-col h-full bg-[#0f0f0f] p-4 space-y-6 overflow-y-auto custom-scrollbar">
            <div className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2 tracking-wider"><Move size={12} /> Transform</div>
            <TransformPanel
                hasSelection={hasSelection}
                mode={gizmoMode}
                onModeChange={setGizmoMode}
                space={transformSpace}
                onSpaceChange={setTransformSpace}
                snapEnabled={snapEnabled}
                onSnapEnabledChange={setSnapEnabled}
                value={transformData}
                onChange={(key, val) => updateTransformFromUI(key, val)}
                translateMin={-100}
                translateMax={100}
                translateStep={0.1}
                rotateMinDeg={0}
                rotateMaxDeg={360}
                rotateStepDeg={1}
                scaleMin={0.001}
                scaleMax={10}
                scaleStep={0.01}
            />
        </div>
    );
}