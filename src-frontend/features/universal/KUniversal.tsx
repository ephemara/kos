/**
 * KUniversal.tsx — Universal Workspace
 *
 * THE LIGHTNING DRIVE OF K-OS.
 *
 * A Blender/UE5-style workspace where every app in the K-OS suite can run
 * simultaneously in a fully resizable, splittable panel system.
 *
 * ─── Features ───────────────────────────────────────────────────────────────
 *   • Infinite binary-tree panel splitting (horizontal or vertical)
 *   • Per-panel app switching with tabbed multi-app panels
 *   • 6 saved layout presets (UE5, Full DCC, Sculpt Studio, etc.)
 *   • Fullscreen any panel
 *   • Cross-panel event bus (mesh selection, material changes, etc.)
 *   • Layout persistence via localStorage
 *   • Unified topbar with workspace controls
 *
 * ─── Layout Diff from Normal Mode ────────────────────────────────────────────
 *   Normal Mode:  ONE app per screen, switch tabs to change
 *   Universal:    ALL apps can run simultaneously, panels live side-by-side
 */

import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Hexagon, LayoutGrid, Maximize, X, ChevronDown, Save,
    Zap, Activity, Monitor, Layers, Settings, RefreshCw,
    SplitSquareHorizontal, SplitSquareVertical, Grid,
    Fullscreen, Download, PenTool, Copy,
} from 'lucide-react';

import {
    LayoutNode, LayoutPreset, LAYOUT_PRESETS,
    UniversalWorkspaceState, universalBus,
    splitPanel, closePanel, setRatio, collectLeaves,
} from './universalStore';
import { LayoutRenderer } from './panels/LayoutRenderer';

// ─── Local storage persistence ────────────────────────────────────────────────

const STORAGE_KEY = 'kos_universal_workspace';

function saveLayout(root: LayoutNode): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(root));
    } catch { }
}

function loadLayout(): LayoutNode | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch { }
    return null;
}

// ─── Preset Panel ─────────────────────────────────────────────────────────────

const PRESET_ICONS: Record<string, React.FC<any>> = {
    PenTool, Monitor, LayoutGrid, Layers, Activity, Maximize,
};

function PresetPanel({
    onSelect, onClose,
    currentPreset
}: {
    onSelect: (preset: LayoutPreset) => void;
    onClose: () => void;
    currentPreset?: string;
}) {
    return (
        <motion.div
            className="absolute top-10 left-1/2 -translate-x-1/2 z-50
                        w-[520px] bg-[#0d0d14] border border-white/[0.08]
                        rounded-xl shadow-2xl overflow-hidden"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        >
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                <div>
                    <p className="text-[11px] font-mono text-white/80 tracking-wider">LAYOUT PRESETS</p>
                    <p className="text-[8px] text-white/30 mt-0.5">UE5-style workspace configurations</p>
                </div>
                <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
                    <X size={14} />
                </button>
            </div>

            <div className="p-3 grid grid-cols-3 gap-2">
                {Object.values(LAYOUT_PRESETS).map(preset => {
                    const Icon = PRESET_ICONS[preset.icon] ?? LayoutGrid;
                    const active = currentPreset === preset.id;
                    return (
                        <button
                            key={preset.id}
                            onClick={() => { onSelect(preset); onClose(); }}
                            className={`flex flex-col gap-2 p-3 rounded-lg border text-left
                                        transition-all duration-150 group
                                        ${active
                                    ? 'border-orange-500/50 bg-orange-500/[0.08] shadow-[0_0_12px_rgba(251,146,60,0.15)]'
                                    : 'border-white/[0.06] bg-white/[0.02] hover:border-white/12 hover:bg-white/[0.04]'}`}
                        >
                            {/* Mini layout preview */}
                            <div className="w-full aspect-video bg-black/40 rounded-md border border-white/[0.06] overflow-hidden relative">
                                <PresetMinimap preset={preset} />
                            </div>
                            <div>
                                <p className={`text-[9px] font-mono ${active ? 'text-orange-300' : 'text-white/70'}`}>
                                    {preset.label}
                                </p>
                                <p className="text-[7px] text-white/30 leading-relaxed mt-0.5">{preset.description}</p>
                            </div>
                        </button>
                    );
                })}
            </div>
        </motion.div>
    );
}

/** Tiny SVG-based minimap of the layout tree */
function PresetMinimap({ preset }: { preset: LayoutPreset }) {
    return (
        <svg width="100%" height="100%" viewBox="0 0 120 68" className="absolute inset-0">
            <MiniNode node={preset.root} x={0} y={0} w={120} h={68} depth={0} />
        </svg>
    );
}

function MiniNode({ node, x, y, w, h, depth }: {
    node: LayoutNode; x: number; y: number; w: number; h: number; depth: number;
}) {
    if (node.kind === 'panel') {
        return (
            <g>
                <rect x={x + 0.5} y={y + 0.5} width={w - 1} height={h - 1} rx={1}
                    fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" strokeWidth={0.5} />
                <rect x={x + 0.5} y={y + 0.5} width={w - 1} height={6} rx={1}
                    fill="rgba(255,255,255,0.06)" stroke="none" />
            </g>
        );
    }
    const sp = node;
    const isH = sp.direction === 'horizontal';
    const aW = isH ? w * sp.ratio : w;
    const aH = isH ? h : h * sp.ratio;
    const bX = isH ? x + aW : x;
    const bY = isH ? y : y + aH;
    const bW = isH ? w - aW : w;
    const bH = isH ? h : h - aH;

    return (
        <g>
            <MiniNode node={sp.a} x={x} y={y} w={aW} h={aH} depth={depth + 1} />
            <MiniNode node={sp.b} x={bX} y={bY} w={bW} h={bH} depth={depth + 1} />
        </g>
    );
}

// ─── Universal Topbar ─────────────────────────────────────────────────────────

interface UniversalTopbarProps {
    state: UniversalWorkspaceState;
    onPresetsToggle: () => void;
    presetsOpen: boolean;
    currentPreset: string | undefined;
    panelCount: number;
    onSaveLayout: () => void;
    onExit: () => void;
    onAddPanel: () => void;
}

function UniversalTopbar({
    state, onPresetsToggle, presetsOpen, currentPreset,
    panelCount, onSaveLayout, onExit, onAddPanel,
}: UniversalTopbarProps) {
    return (
        <div className="flex items-center h-9 px-3 gap-3
                         bg-[#080810] border-b border-white/[0.06] shrink-0
                         select-none z-30 relative">

            {/* Logo */}
            <div className="flex items-center gap-1.5 mr-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-600/20
                                border border-orange-500/30 flex items-center justify-center
                                shadow-[0_0_8px_rgba(251,146,60,0.2)]">
                    <Zap size={12} className="text-orange-400" />
                </div>
                <div>
                    <span className="text-[10px] font-mono text-white/90 tracking-widest uppercase">UNIVERSAL</span>
                    <span className="text-[8px] font-mono text-white/30 ml-1.5">K-OS</span>
                </div>
            </div>

            <div className="w-px h-4 bg-white/[0.08]" />

            {/* Preset selector */}
            <button
                onClick={onPresetsToggle}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-mono
                            border transition-all ${presetsOpen
                        ? 'bg-orange-500/15 border-orange-500/40 text-orange-300'
                        : 'bg-white/[0.03] border-white/[0.08] text-white/60 hover:text-white/80 hover:border-white/15'
                    }`}
            >
                <LayoutGrid size={10} />
                {currentPreset ? LAYOUT_PRESETS[currentPreset]?.label : 'Layouts'}
                <ChevronDown size={8} className={`transition-transform ${presetsOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Panel count badge */}
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded
                            bg-white/[0.04] text-[8px] font-mono text-white/40">
                <Grid size={8} />
                {panelCount} panels
            </div>

            <div className="flex-1" />

            {/* Bus activity indicator */}
            <BusActivity />

            <div className="w-px h-4 bg-white/[0.08]" />

            {/* Actions */}
            <button
                onClick={onAddPanel}
                title="Add Panel"
                className="p-1.5 rounded text-white/40 hover:text-white/70 hover:bg-white/[0.05] transition-colors"
            >
                <SplitSquareHorizontal size={14} />
            </button>

            <button
                onClick={onSaveLayout}
                title="Save Layout"
                className="p-1.5 rounded text-white/40 hover:text-white/70 hover:bg-white/[0.05] transition-colors"
            >
                <Save size={14} />
            </button>

            <div className="w-px h-4 bg-white/[0.08]" />

            <button
                onClick={onExit}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-mono
                           bg-white/[0.03] border border-white/[0.08] text-white/50
                           hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 transition-all"
            >
                <X size={10} />
                Exit
            </button>
        </div>
    );
}

/** Animated activity dot — pulses when bus events fire */
function BusActivity() {
    const [active, setActive] = useState(false);

    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout>;
        const events: Array<keyof import('./universalStore').BusEventMap> = [
            'mesh:selected', 'brush:applied', 'panel:focused', 'panel:app:changed',
            'cfd:started', 'flux:toggled', 'material:changed', 'layout:changed', 'mesh:committed',
        ];
        const unsubs = events.map(ev =>
            universalBus.on(ev as any, () => {
                setActive(true);
                clearTimeout(timeout);
                timeout = setTimeout(() => setActive(false), 800);
            })
        );
        return () => { unsubs.forEach(u => u()); clearTimeout(timeout); };
    }, []);

    return (
        <div className="flex items-center gap-1.5 text-[8px] font-mono text-white/30">
            <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${active ? 'bg-orange-400 shadow-[0_0_4px_rgba(251,146,60,0.8)]' : 'bg-white/10'
                }`} />
            Universal Bus
        </div>
    );
}

// ─── Main Universal Workspace ─────────────────────────────────────────────────

interface KUniversalProps {
    sharedState: Record<string, any>;
    bridgeProps: Record<string, any>;
    onExit: () => void;
}

export function KUniversal({ sharedState, bridgeProps, onExit }: KUniversalProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    // Load from localStorage or default to UE5 preset
    const [root, setRoot] = useState<LayoutNode>(() => {
        return loadLayout() ?? LAYOUT_PRESETS['UE5'].root;
    });

    const [focusedPanel, setFocusedPanel] = useState<string | null>(null);
    const [fullscreen, setFullscreen] = useState<string | null>(null);
    const [presetsOpen, setPresetsOpen] = useState(false);
    const [currentPreset, setCurrentPreset] = useState<string | undefined>('UE5');

    // Autosave layout on change
    useEffect(() => { saveLayout(root); }, [root]);

    const panelCount = useMemo(() => collectLeaves(root).length, [root]);

    const handlePresetSelect = useCallback((preset: LayoutPreset) => {
        setRoot(preset.root);
        setCurrentPreset(preset.id);
        setFocusedPanel(null);
        setFullscreen(null);
        universalBus.emit('layout:changed', {});
    }, []);

    const handleAddPanel = useCallback(() => {
        const leaves = collectLeaves(root);
        if (leaves.length === 0) return;
        const target = focusedPanel
            ? leaves.find(l => l.id === focusedPanel) ?? leaves[leaves.length - 1]
            : leaves[leaves.length - 1];
        setRoot(prev => splitPanel(prev, target.id, 'horizontal', 'viewport'));
    }, [root, focusedPanel]);

    const handleSaveLayout = useCallback(() => {
        saveLayout(root);
        // Toast-style feedback via bus
        universalBus.emit('layout:changed', {});
    }, [root]);

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && fullscreen) {
                setFullscreen(null);
            }
            if (e.ctrlKey && e.key === '\\') {
                setPresetsOpen(v => !v);
                e.preventDefault();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [fullscreen]);

    return (
        <div className="flex flex-col w-full h-full bg-[#080810] overflow-hidden">

            {/* Top bar */}
            <UniversalTopbar
                state={{ root, focusedPanel, presetsOpen, fullscreenPanel: fullscreen }}
                onPresetsToggle={() => setPresetsOpen(v => !v)}
                presetsOpen={presetsOpen}
                currentPreset={currentPreset}
                panelCount={panelCount}
                onSaveLayout={handleSaveLayout}
                onExit={onExit}
                onAddPanel={handleAddPanel}
            />

            {/* Layout area */}
            <div ref={containerRef} className="flex-1 relative overflow-hidden">
                <LayoutRenderer
                    node={root}
                    root={root}
                    focusedPanel={focusedPanel}
                    fullscreen={fullscreen}
                    sharedState={sharedState}
                    bridgeProps={bridgeProps}
                    containerRef={containerRef as React.RefObject<HTMLDivElement>}
                    onRootChange={setRoot}
                    onFocusPanel={setFocusedPanel}
                    onFullscreen={setFullscreen}
                />

                {/* Preset overlay */}
                <AnimatePresence>
                    {presetsOpen && (
                        <>
                            <motion.div
                                className="absolute inset-0 z-40"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setPresetsOpen(false)}
                            />
                            <PresetPanel
                                onSelect={handlePresetSelect}
                                onClose={() => setPresetsOpen(false)}
                                currentPreset={currentPreset}
                            />
                        </>
                    )}
                </AnimatePresence>
            </div>

            {/* Status bar */}
            <div className="h-5 flex items-center px-3 gap-4 bg-[#060609] border-t border-white/[0.04] shrink-0">
                <span className="text-[7px] font-mono text-white/20">
                    UNIVERSAL WORKSPACE · {panelCount} PANELS ACTIVE
                </span>
                {focusedPanel && (
                    <span className="text-[7px] font-mono text-orange-400/40">
                        FOCUS: {collectLeaves(root).find(l => l.id === focusedPanel)?.appId?.toUpperCase() ?? 'PANEL'}
                    </span>
                )}
                <span className="text-[7px] font-mono text-white/10 ml-auto">
                    Ctrl+\ = Layouts · Esc = Exit Fullscreen
                </span>
            </div>

        </div>
    );
}

export default KUniversal;
