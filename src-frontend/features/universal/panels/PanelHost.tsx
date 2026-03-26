/**
 * PanelHost.tsx — Universal Panel Host
 *
 * Renders a K-OS app inside a Universal Workspace panel.
 * Handles app switching, tab bar, context menu (split/close/fullscreen),
 * and app-picker overlay.
 */

import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    PenTool, Grid, Rocket, Sprout, Map, Disc, Brush, Aperture, Paintbrush,
    Weight, Copy, Search, Globe, Atom, Terminal, Database, Box, Sliders,
    GitBranch, Layers, Monitor, Maximize, Minimize, X, Plus, ChevronDown,
    SplitSquareVertical, SplitSquareHorizontal, LayoutGrid, Zap, RefreshCw,
} from 'lucide-react';

import {
    KOSAppId, APP_REGISTRY, PanelLeaf, universalBus,
    KOS_APP_IDS,
} from '../universalStore';
import { KAINConsole, KAINRuntimeBrowser } from '@/kain';

// ─── App component lazy registry ─────────────────────────────────────────────
// Apps are lazily imported to keep initial bundle small and avoid initializing
// heavy engines (Three.js, WebGPU) for panels not yet visible.

const APP_COMPONENTS: Record<KOSAppId, React.LazyExoticComponent<React.ComponentType<any>> | null> = {
    sculpt: React.lazy(() => import('@/features/native/runtimeModules').then(m => ({ default: m.KSculptNative }))),
    retopo: React.lazy(() => import('@/features/native/runtimeModules').then(m => ({ default: m.KRetopoNative }))),
    greeble: React.lazy(() => import('@/features/native/runtimeModules').then(m => ({ default: m.KGreebleNative }))),
    scatter: React.lazy(() => import('@/features/native/runtimeModules').then(m => ({ default: m.KScatterNative }))),
    atlas: React.lazy(() => import('@/features/native/runtimeModules').then(m => ({ default: m.KAtlasNative }))),
    bake: React.lazy(() => import('@/features/native/runtimeModules').then(m => ({ default: m.KBakeNative }))),
    graphos: React.lazy(() => import('@/features/native/runtimeModules').then(m => ({ default: m.KGraphosNative }))),
    autopbr: React.lazy(() => import('@/features/native/runtimeModules').then(m => ({ default: m.KAutopbrNative }))),
    painter: React.lazy(() => import('@/features/native/runtimeModules').then(m => ({ default: m.KPainterNative }))),
    weight: React.lazy(() => import('@/features/native/runtimeModules').then(m => ({ default: m.KWeightNative }))),
    cloner: React.lazy(() => import('@/features/native/runtimeModules').then(m => ({ default: m.KClonerNative }))),
    inspect: React.lazy(() => import('@/features/native/runtimeModules').then(m => ({ default: m.KInspectNative }))),
    tecton: React.lazy(() => import('@/features/native/runtimeModules').then(m => ({ default: m.KTectonNative }))),
    quantum: React.lazy(() => import('@/features/native/runtimeModules').then(m => ({ default: m.KQuantumNative }))),
    kain: null,
    // Built-ins are defined inline below
    terminal: null,
    assets: null,
    viewport: null,
    properties: null,
    timeline: null,
    outliner: null,
};

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.FC<any>> = {
    PenTool, Grid, Rocket, Sprout, Map, Disc, Brush, Aperture, Paintbrush,
    Weight, Copy, Search, Globe, Atom, Terminal, Database, Box, Sliders,
    GitBranch, Layers, Monitor, Maximize,
};

function AppIcon({ iconName, size = 12, className = '' }: { iconName: string; size?: number; className?: string }) {
    const Icon = ICON_MAP[iconName] ?? Box;
    return <Icon size={size} className={className} strokeWidth={1.8} />;
}

// ─── Builtin app placeholders ─────────────────────────────────────────────────

function ViewportBuiltin() {
    return (
        <div className="w-full h-full flex items-center justify-center bg-[#0b0b0f]">
            <div className="text-center space-y-2">
                <Box size={32} className="text-white/20 mx-auto" />
                <p className="text-[10px] font-mono text-white/30">3D VIEWPORT</p>
                <p className="text-[8px] text-white/15">Drop a scene object to preview</p>
            </div>
        </div>
    );
}

function OutlinerBuiltin({ panelId }: { panelId: string }) {
    return (
        <div className="w-full h-full bg-[#0d0d12] flex flex-col">
            <div className="px-3 py-2 border-b border-white/[0.06]">
                <p className="text-[9px] font-mono text-white/50 uppercase tracking-wider">Scene Objects</p>
            </div>
            <div className="flex-1 p-2 space-y-0.5 overflow-y-auto">
                {['Mesh_001', 'Camera_Main', 'Light_Key', 'Light_Fill'].map(name => (
                    <button key={name}
                        className="w-full flex items-center gap-2 px-2 py-1 rounded text-left
                                   text-[9px] font-mono text-white/50 hover:text-white/80
                                   hover:bg-white/[0.04] transition-colors">
                        <Box size={9} className="text-white/25 flex-shrink-0" />
                        {name}
                    </button>
                ))}
            </div>
        </div>
    );
}

function PropertiesBuiltin() {
    return (
        <div className="w-full h-full bg-[#0d0d12] flex flex-col">
            <div className="px-3 py-2 border-b border-white/[0.06]">
                <p className="text-[9px] font-mono text-white/50 uppercase tracking-wider">Properties</p>
            </div>
            <div className="p-3 space-y-3 overflow-y-auto flex-1">
                {[
                    { label: 'Location', vals: ['0.0', '0.0', '0.0'] },
                    { label: 'Rotation', vals: ['0°', '0°', '0°'] },
                    { label: 'Scale', vals: ['1.0', '1.0', '1.0'] },
                ].map(p => (
                    <div key={p.label}>
                        <p className="text-[8px] font-mono text-white/35 uppercase mb-1">{p.label}</p>
                        <div className="grid grid-cols-3 gap-1">
                            {['X', 'Y', 'Z'].map((axis, i) => (
                                <div key={axis} className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded px-1.5 py-1">
                                    <span className="text-[8px] font-bold text-red-400/60">{axis}</span>
                                    <span className="text-[8px] font-mono text-white/60 tabular-nums">{p.vals[i]}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function TimelineBuiltin() {
    return (
        <div className="w-full h-full bg-[#0b0b0f] flex flex-col">
            <div className="px-3 py-1.5 border-b border-white/[0.06] flex items-center gap-3">
                <span className="text-[9px] font-mono text-white/40 uppercase tracking-wider">Timeline</span>
                <span className="text-[8px] font-mono text-white/25">Frame: 1 / 250</span>
            </div>
            <div className="flex-1 flex items-center px-3">
                <div className="w-full h-6 bg-white/[0.03] border border-white/[0.06] rounded relative overflow-hidden">
                    <div className="absolute left-0 top-0 h-full w-0.5 bg-blue-400/60" style={{ left: '1%' }} />
                    {Array.from({ length: 25 }, (_, i) => (
                        <div key={i} className="absolute top-0 h-full w-px bg-white/[0.04]" style={{ left: `${(i + 1) * 4}%` }} />
                    ))}
                </div>
            </div>
        </div>
    );
}

function TerminalBuiltin() {
    const [lines, setLines] = useState<string[]>(['KAIN Terminal v1.0', '> ']);
    const [input, setInput] = useState('');

    const handleKey = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            setLines(prev => [...prev, `> ${input}`, `[${input}] — not implemented in preview`]);
            setInput('');
        }
    };

    return (
        <div className="w-full h-full bg-[#060608] flex flex-col font-mono text-[9px]">
            <div className="flex-1 p-3 overflow-y-auto space-y-0.5">
                {lines.map((l, i) => (
                    <p key={i} className="text-green-400/70">{l}</p>
                ))}
            </div>
            <div className="flex items-center gap-2 px-3 py-2 border-t border-white/[0.06]">
                <span className="text-green-400/50">&gt;</span>
                <input
                    className="flex-1 bg-transparent outline-none text-green-400/80 caret-green-400 placeholder-white/15"
                    placeholder="kain run ..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKey}
                />
            </div>
        </div>
    );
}

function AssetsBuiltin() {
    return (
        <div className="w-full h-full bg-[#0d0d12] flex flex-col">
            <div className="px-3 py-2 border-b border-white/[0.06]">
                <p className="text-[9px] font-mono text-white/50 uppercase tracking-wider">Asset Browser</p>
            </div>
            <div className="p-2 grid grid-cols-3 gap-1 overflow-y-auto">
                {['Mat_001', 'Brush_Clay', 'Alpha_Skin', 'Tex_Bark', 'Mesh_Rock', 'HDR_Studio'].map(name => (
                    <div key={name}
                        className="rounded-md border border-white/[0.06] bg-white/[0.02] p-1.5 cursor-pointer
                                    hover:border-white/15 transition-colors text-center">
                        <div className="w-full aspect-square bg-white/[0.03] rounded mb-1 flex items-center justify-center">
                            <Database size={12} className="text-white/20" />
                        </div>
                        <p className="text-[7px] font-mono text-white/40 truncate">{name}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── App Picker Modal ─────────────────────────────────────────────────────────

const CATEGORY_ORDER: Array<'DCC' | 'UV' | 'SIM' | 'UTILITY' | 'BUILTIN'> = [
    'DCC', 'UV', 'SIM', 'UTILITY', 'BUILTIN'
];
const CATEGORY_LABELS = {
    DCC: 'Digital Content Creation',
    UV: 'UV & Textures',
    SIM: 'Simulation',
    UTILITY: 'Utilities',
    BUILTIN: 'Built-in',
};

function AppPicker({ onSelect, onClose }: {
    onSelect: (id: KOSAppId) => void;
    onClose: () => void;
}) {
    const [search, setSearch] = useState('');
    const q = search.toLowerCase();

    return (
        <motion.div
            className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <motion.div
                className="w-[360px] max-h-[480px] bg-[#0e0e14] border border-white/[0.08]
                            rounded-xl shadow-2xl overflow-hidden flex flex-col"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                onClick={e => e.stopPropagation()}
            >
                {/* Search */}
                <div className="px-4 py-3 border-b border-white/[0.06]">
                    <input
                        autoFocus
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg
                                   px-3 py-1.5 text-[10px] font-mono text-white/80
                                   placeholder-white/25 outline-none focus:border-orange-500/40
                                   transition-colors"
                        placeholder="Search apps..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                <div className="overflow-y-auto flex-1 p-3 space-y-3 custom-scrollbar">
                    {CATEGORY_ORDER.map(cat => {
                        const apps = KOS_APP_IDS.filter(id => {
                            const def = APP_REGISTRY[id];
                            return def.category === cat &&
                                (q === '' || def.label.toLowerCase().includes(q) || id.includes(q));
                        });
                        if (apps.length === 0) return null;
                        return (
                            <div key={cat}>
                                <p className="text-[7px] font-mono text-white/25 uppercase tracking-widest mb-1.5 px-1">
                                    {CATEGORY_LABELS[cat]}
                                </p>
                                <div className="grid grid-cols-2 gap-1">
                                    {apps.map(id => {
                                        const def = APP_REGISTRY[id];
                                        return (
                                            <button
                                                key={id}
                                                onClick={() => onSelect(id)}
                                                className="flex items-center gap-2 px-2.5 py-2 rounded-lg
                                                           bg-white/[0.02] border border-white/[0.05]
                                                           hover:border-white/15 hover:bg-white/[0.06]
                                                           text-left transition-all group"
                                            >
                                                <AppIcon iconName={def.icon} size={11}
                                                    className="flex-shrink-0 text-white/40 group-hover:text-white/70 transition-colors" />
                                                <div className="min-w-0">
                                                    <p className="text-[9px] font-mono text-white/70 group-hover:text-white/90 truncate">
                                                        {def.label}
                                                    </p>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </motion.div>
        </motion.div>
    );
}

// ─── Panel Header ─────────────────────────────────────────────────────────────

interface PanelHeaderProps {
    panel: PanelLeaf;
    focused: boolean;
    onFocus: () => void;
    onPickApp: () => void;
    onSplitH: () => void;
    onSplitV: () => void;
    onClose: () => void;
    onFullscreen: () => void;
    onTabSelect: (i: number) => void;
    onTabClose: (i: number) => void;
}

function PanelHeader({
    panel, focused, onFocus, onPickApp,
    onSplitH, onSplitV, onClose, onFullscreen,
    onTabSelect, onTabClose,
}: PanelHeaderProps) {
    const [ctxOpen, setCtxOpen] = useState(false);

    return (
        <div
            className={`flex items-stretch shrink-0 border-b transition-colors select-none
                        overflow-hidden
                        ${focused ? 'border-orange-500/25 bg-[#0e0e14]' : 'border-white/[0.05] bg-[#0a0a0f]'}`}
            style={{ height: 28 }}
            onClick={onFocus}
        >
            {/* Tabs */}
            <div className="flex items-stretch flex-1 min-w-0 overflow-hidden">
                {panel.tabs.map((tab, i) => {
                    const def = APP_REGISTRY[tab.appId];
                    const active = i === panel.activeTab;
                    return (
                        <div
                            key={tab.id}
                            className={`flex items-center gap-1.5 px-2.5 border-r border-white/[0.05]
                                        cursor-pointer min-w-0 flex-1 transition-colors
                                        ${active
                                    ? 'bg-white/[0.06] text-white/90'
                                    : 'text-white/40 hover:text-white/60 hover:bg-white/[0.03]'}`}
                            title={def.label}
                        >
                            <button className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden" onClick={() => onTabSelect(i)}>
                                <AppIcon iconName={def.icon} size={10}
                                    className={`shrink-0 ${active ? 'text-white/70' : 'text-white/30'}`} />
                                <span className="truncate text-[9px] font-mono">{def.label}</span>
                            </button>
                            {panel.tabs.length > 1 && (
                                <button
                                    onClick={e => { e.stopPropagation(); onTabClose(i); }}
                                    className="ml-0.5 shrink-0 text-white/20 hover:text-white/60 transition-colors"
                                >
                                    <X size={8} />
                                </button>
                            )}
                        </div>
                    );
                })}

                {/* Add tab */}
                <button
                    onClick={onPickApp}
                    className="flex shrink-0 items-center px-2 text-white/20 hover:text-white/50 transition-colors"
                >
                    <Plus size={10} />
                </button>
            </div>

            {/* Panel controls */}
            <div className="flex items-center gap-0.5 px-1.5 border-l border-white/[0.05]">
                <button onClick={onSplitH} title="Split Horizontal"
                    className="p-0.5 text-white/20 hover:text-white/60 transition-colors rounded">
                    <SplitSquareHorizontal size={10} />
                </button>
                <button onClick={onSplitV} title="Split Vertical"
                    className="p-0.5 text-white/20 hover:text-white/60 transition-colors rounded">
                    <SplitSquareVertical size={10} />
                </button>
                <button onClick={onFullscreen} title="Fullscreen"
                    className="p-0.5 text-white/20 hover:text-white/60 transition-colors rounded">
                    <Maximize size={10} />
                </button>
                <button onClick={onClose} title="Close Panel"
                    className="p-0.5 text-white/20 hover:text-red-400/70 transition-colors rounded">
                    <X size={10} />
                </button>
            </div>
        </div>
    );
}

// ─── Panel Host ───────────────────────────────────────────────────────────────

interface PanelHostProps {
    panel: PanelLeaf;
    focused: boolean;
    sharedState: Record<string, any>;
    bridgeProps: Record<string, any>;
    onFocus: () => void;
    onSplitH: () => void;
    onSplitV: () => void;
    onClose: () => void;
    onFullscreen: () => void;
    onAppChange: (appId: KOSAppId) => void;
    onTabSelect: (i: number) => void;
    onTabClose: (i: number) => void;
}

export function PanelHost({
    panel, focused, sharedState, bridgeProps,
    onFocus, onSplitH, onSplitV, onClose, onFullscreen,
    onAppChange, onTabSelect, onTabClose,
}: PanelHostProps) {
    const [pickerOpen, setPickerOpen] = useState(false);
    const appId = panel.appId;

    const handlePickApp = useCallback((id: KOSAppId) => {
        setPickerOpen(false);
        onAppChange(id);
        universalBus.emit('panel:app:changed', { panelId: panel.id, appId: id });
    }, [onAppChange, panel.id]);

    // Render app content
    const renderContent = () => {
        if (!appId) {
            return (
                <div className="flex-1 flex items-center justify-center">
                    <button
                        onClick={() => setPickerOpen(true)}
                        className="flex flex-col items-center gap-2 text-white/20 hover:text-white/50 transition-colors"
                    >
                        <Plus size={24} />
                        <span className="text-[9px] font-mono uppercase tracking-wider">Choose App</span>
                    </button>
                </div>
            );
        }

        // Builtin apps
        const builtins: Record<string, React.ReactNode> = {
            viewport: <ViewportBuiltin />,
            outliner: <OutlinerBuiltin panelId={panel.id} />,
            properties: <PropertiesBuiltin />,
            timeline: <TimelineBuiltin />,
            terminal: <KAINConsole embedded />,
            kain: <KAINRuntimeBrowser embedded />,
            assets: <AssetsBuiltin />,
        };
        if (appId in builtins) {
            return <div className="flex-1 overflow-hidden">{builtins[appId]}</div>;
        }

        // Lazy-loaded DCC apps
        const Component = APP_COMPONENTS[appId];
        if (!Component) {
            return (
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-[9px] font-mono text-white/30">App not found: {appId}</p>
                </div>
            );
        }

        return (
            <React.Suspense fallback={
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center space-y-2">
                        <div className="w-6 h-6 border border-orange-500/40 border-t-orange-500 rounded-full animate-spin mx-auto" />
                        <p className="text-[8px] font-mono text-white/30">Loading {APP_REGISTRY[appId]?.label}…</p>
                    </div>
                </div>
            }>
                <div className="flex-1 overflow-hidden">
                    <Component {...(bridgeProps as any)} sharedState={sharedState} />
                </div>
            </React.Suspense>
        );
    };

    return (
        <div className={`relative flex flex-col w-full h-full overflow-hidden transition-all duration-100
                         ${focused ? 'ring-1 ring-inset ring-orange-500/25' : ''}`}>
            <PanelHeader
                panel={panel}
                focused={focused}
                onFocus={onFocus}
                onPickApp={() => setPickerOpen(true)}
                onSplitH={onSplitH}
                onSplitV={onSplitV}
                onClose={onClose}
                onFullscreen={onFullscreen}
                onTabSelect={onTabSelect}
                onTabClose={onTabClose}
            />

            {renderContent()}

            {/* App picker overlay */}
            <AnimatePresence>
                {pickerOpen && (
                    <AppPicker
                        onSelect={handlePickApp}
                        onClose={() => setPickerOpen(false)}
                    />
                )}
            </AnimatePresence>

            {/* Focus indicator stripe */}
            {focused && (
                <div className="absolute bottom-0 left-0 right-0 h-px bg-orange-500/40 pointer-events-none" />
            )}
        </div>
    );
}
