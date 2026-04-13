
import {
    Terminal, Command, Cpu, Zap, Database,
    PenTool, Layers, Grid, LayoutGrid, Copy,
    Map as MapIcon, Aperture, Paintbrush,
    Search, Activity, Box, Hexagon,
    Globe, Waves, HardDrive, FileJson, X, Check, Trash2, Download, UploadCloud, FileCode,
    Merge, CheckSquare, Combine, Group, Component, Loader2,
    FolderOpen, FolderClosed, ChevronRight, ChevronDown, Rocket, Mountain, Disc,
    Settings, Power, Battery, Wifi, Volume2, Info, Monitor, MemoryStick, Skull, Atom,
    FilePlus, Save, Palette, Image as ImageIcon, Key, Gauge, Stamp, TestTube, Sprout,
    PencilRuler, ScanLine, Brush, Maximize, Dog, Weight
} from 'lucide-react';

// Runtime app components now route through the native workspace scaffold.
import {
    KAtlasNative as KAtlas,
    KAutopbrNative as KAutopbr,
    KBakeNative as KBake,
    KClonerNative as KCloner,
    KGraphosNative as KGraphos,
    KGreebleNative as KGreeble,
    KInspectNative as KInspect,
    KPainterNative as KPainter,
    KQuantumNative as KQuantum,
    KRetopoNative as KRetopo,
    KScatterNative as KScatter,
    KSculptNative as KSculpt,
    KTectonNative as KTecton,
    KWeightNative as KWeight,
} from '@/features/native/runtimeModules';

export const CATEGORY_CONFIG: Record<string, { label: string, color: string, icon: any, border: string, bg: string }> = {
    'K-SCULPT': { label: 'K-SCULPT', color: 'text-orange-500', border: 'border-orange-500', bg: 'bg-orange-900/20', icon: PenTool },
    'K-GREEBLE': { label: 'K-GREEBLE', color: 'text-emerald-500', border: 'border-emerald-500', bg: 'bg-emerald-900/20', icon: Rocket },
    'K-TECTON': { label: 'K-TECTON', color: 'text-cyan-500', border: 'border-cyan-500', bg: 'bg-cyan-900/20', icon: Mountain },
    'K-CLONER': { label: 'K-CLONER', color: 'text-cyan-400', border: 'border-cyan-400', bg: 'bg-cyan-900/20', icon: Activity },
    'K-MOCAP': { label: 'K-MOCAP', color: 'text-sky-400', border: 'border-sky-400', bg: 'bg-sky-900/20', icon: Activity },
    'K-ANIM': { label: 'K-ANIM', color: 'text-fuchsia-400', border: 'border-fuchsia-400', bg: 'bg-fuchsia-900/20', icon: FileJson },
    'K-SCATTER': { label: 'K-SCATTER', color: 'text-lime-400', border: 'border-lime-400', bg: 'bg-lime-900/20', icon: Sprout },
    'K-RETOPO': { label: 'K-RETOPO', color: 'text-amber-500', border: 'border-amber-500', bg: 'bg-amber-900/20', icon: Grid },
    'K-BAKE': { label: 'K-BAKE', color: 'text-pink-500', border: 'border-pink-500', bg: 'bg-pink-900/20', icon: Disc },
    'K-WEIGHT': { label: 'K-WEIGHT', color: 'text-violet-400', border: 'border-violet-400', bg: 'bg-violet-900/20', icon: Weight },

    'K-QUANTUM': { label: 'K-QUANTUM', color: 'text-purple-400', border: 'border-purple-400', bg: 'bg-purple-900/20', icon: Atom },
    'K-PAINTER': { label: 'K-PAINTER', color: 'text-indigo-500', border: 'border-indigo-500', bg: 'bg-indigo-900/20', icon: Paintbrush },
    'K-GRAPHOS': { label: 'K-GRAPHOS', color: 'text-rose-500', border: 'border-rose-500', bg: 'bg-rose-900/20', icon: Brush },
    'K-ATLAS': { label: 'K-ATLAS', color: 'text-teal-500', border: 'border-teal-500', bg: 'bg-teal-900/20', icon: MapIcon },
    'K-BEVY': { label: 'K-BEVY', color: 'text-lime-500', border: 'border-lime-500', bg: 'bg-lime-900/20', icon: Dog },
    'MERGED': { label: 'FUSIONS', color: 'text-yellow-500', border: 'border-yellow-500', bg: 'bg-yellow-900/20', icon: Merge },
    'IMPORT': { label: 'IMPORTS', color: 'text-slate-400', border: 'border-slate-500', bg: 'bg-slate-800', icon: HardDrive },
};

export const WORKFLOW = [
    {
        label: "MODEL",
        color: "text-blue-500",
        border: "border-blue-500/30",
        modules: [
            { id: 'sculpt', name: 'K-SCULPT', icon: PenTool, component: KSculpt },
            { id: 'retopo', name: 'K-RETOPO', icon: Grid, component: KRetopo },
            { id: 'greeble', name: 'K-GREEBLE', icon: Grid, component: KGreeble },
            { id: 'scatter', name: 'K-SCATTER', icon: Sprout, component: KScatter },
        ]
    },
    {
        label: "UV",
        color: "text-teal-500",
        border: "border-teal-500/30",
        modules: [
            { id: 'atlas', name: 'K-ATLAS', icon: MapIcon, component: KAtlas },
            { id: 'bake', name: 'K-BAKE', icon: Disc, component: KBake },
        ]
    },
    {
        label: "SURFACE",
        color: "text-rose-500",
        border: "border-rose-500/30",
        modules: [
            { id: 'graphos', name: 'K-GRAPHOS', icon: Brush, component: KGraphos },
            { id: 'autopbr', name: 'K-SAMPLE', icon: Aperture, component: KAutopbr },
            { id: 'painter', name: 'K-PAINTER', icon: Paintbrush, component: KPainter },
        ]
    },
    {
        label: "ANIM",
        color: "text-violet-500",
        border: "border-violet-500/30",
        modules: [
            { id: 'weight', name: 'K-WEIGHT', icon: Weight, component: KWeight },
            { id: 'cloner', name: 'K-CLONER', icon: Copy, component: KCloner },
        ]
    },
    {
        label: "RENDER",
        color: "text-emerald-500",
        border: "border-emerald-500/30",
        modules: [
            { id: 'inspect', name: 'K-INSPECT', icon: Search, component: KInspect },
        ]
    },
    {
        label: "SIM",
        color: "text-cyan-500",
        border: "border-cyan-500/30",
        modules: [
            { id: 'tecton', name: 'K-TECTON', icon: Globe, component: KTecton },

            { id: 'quantum', name: 'K-QUANTUM', icon: Atom, component: KQuantum },
        ]
    },
    /* 
    {
        label: "DEV",
        color: "text-lime-500",
        border: "border-lime-500/30",
        modules: [
            { id: 'bevy', name: 'K-BEVY', icon: Dog, component: KBevyTest },
        ]
    }
    */
];

export const ALL_MODULES = WORKFLOW.flatMap(g => g.modules);
