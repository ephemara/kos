/**
 * universalStore.ts — Universal Workspace State
 *
 * Manages the Blender/UE5-style panel layout state for the Universal Workspace.
 * Completely data-driven: every panel, split, and app assignment is serialisable.
 *
 * ─── Panel Model ────────────────────────────────────────────────────────────
 *
 * The layout is a binary tree of nodes:
 *
 *   LayoutNode = SplitNode | PanelLeaf
 *
 *   SplitNode  { direction: 'h'|'v', ratio: 0..1, a: LayoutNode, b: LayoutNode }
 *   PanelLeaf  { id: string, appId: KOSAppId | null, tabs: TabState[] }
 *
 * Rendering: recursively subdivide the container rect along split axes.
 * Resizing: drag the split handle → update ratio.
 * Split: right-click panel header → Split H/V.
 * Close: merge panel back into sibling.
 *
 * ─── Cross-Panel Bus ─────────────────────────────────────────────────────────
 * All panels share a universal message bus. Apps can send/receive typed events:
 *   bus.emit('mesh:selected', { meshId })
 *   bus.on('mesh:selected', cb)
 */

import { v4 as uuid } from 'uuid';

// ─── App Registry ─────────────────────────────────────────────────────────────

export const KOS_APP_IDS = [
    'sculpt', 'retopo', 'greeble', 'scatter',
    'atlas', 'bake',
    'graphos', 'autopbr', 'painter',
    'weight', 'cloner',
    'inspect',
    'tecton', 'quantum',
    'kain',
    'terminal',   // built-in KAIN terminal
    'assets',     // built-in asset browser
    'viewport',   // plain 3D viewport
    'properties', // scene properties inspector
    'timeline',   // animation timeline
    'outliner',   // scene outliner
] as const;

export type KOSAppId = typeof KOS_APP_IDS[number];

export const APP_REGISTRY: Record<KOSAppId, {
    label: string;
    icon: string;   // lucide icon name
    color: string;   // hex or tailwind
    description: string;
    category: 'DCC' | 'UV' | 'SIM' | 'UTILITY' | 'BUILTIN';
}> = {
    sculpt: { label: 'K-SCULPT', icon: 'PenTool', color: '#f97316', description: 'Sculpting workspace', category: 'DCC' },
    retopo: { label: 'K-RETOPO', icon: 'Grid', color: '#f59e0b', description: 'Retopology tools', category: 'DCC' },
    greeble: { label: 'K-GREEBLE', icon: 'Rocket', color: '#10b981', description: 'Procedural greeble generation', category: 'DCC' },
    scatter: { label: 'K-SCATTER', icon: 'Sprout', color: '#84cc16', description: 'Surface scatter & distribution', category: 'DCC' },
    atlas: { label: 'K-ATLAS', icon: 'Map', color: '#14b8a6', description: 'UV atlas & unwrapping', category: 'UV' },
    bake: { label: 'K-BAKE', icon: 'Disc', color: '#ec4899', description: 'Texture baking pipeline', category: 'UV' },
    graphos: { label: 'K-GRAPHOS', icon: 'Brush', color: '#ef4444', description: 'Digital drawing suite', category: 'DCC' },
    autopbr: { label: 'K-SAMPLE', icon: 'Aperture', color: '#8b5cf6', description: 'Auto PBR material sampler', category: 'UV' },
    painter: { label: 'K-PAINTER', icon: 'Paintbrush', color: '#6366f1', description: '3D texture painter', category: 'DCC' },
    weight: { label: 'K-WEIGHT', icon: 'Weight', color: '#a78bfa', description: 'Weight painting & rigging', category: 'DCC' },
    cloner: { label: 'K-CLONER', icon: 'Copy', color: '#22d3ee', description: 'Array & cloner system', category: 'DCC' },
    inspect: { label: 'K-INSPECT', icon: 'Search', color: '#34d399', description: 'Render inspector & validator', category: 'UTILITY' },
    tecton: { label: 'K-TECTON', icon: 'Globe', color: '#06b6d4', description: 'Geological simulation', category: 'SIM' },
    quantum: { label: 'K-QUANTUM', icon: 'Atom', color: '#c084fc', description: 'Particle & quantum simulation', category: 'SIM' },
    kain: { label: 'K-AIN', icon: 'Zap', color: '#f97316', description: 'KAIN authoring and compile pipeline', category: 'BUILTIN' },
    terminal: { label: 'TERMINAL', icon: 'Terminal', color: '#4ade80', description: 'KAIN scripting terminal', category: 'BUILTIN' },
    assets: { label: 'ASSETS', icon: 'Database', color: '#94a3b8', description: 'Asset browser & library', category: 'BUILTIN' },
    viewport: { label: 'VIEWPORT', icon: 'Box', color: '#64748b', description: 'Plain 3D viewport', category: 'BUILTIN' },
    properties: { label: 'PROPERTIES', icon: 'Sliders', color: '#94a3b8', description: 'Scene & object properties', category: 'BUILTIN' },
    timeline: { label: 'TIMELINE', icon: 'GitBranch', color: '#7dd3fc', description: 'Animation timeline', category: 'BUILTIN' },
    outliner: { label: 'OUTLINER', icon: 'Layers', color: '#a3a3a3', description: 'Scene object outliner', category: 'BUILTIN' },
};

// ─── Layout Node Types ────────────────────────────────────────────────────────

export interface PanelTab {
    id: string;
    appId: KOSAppId;
}

export interface PanelLeaf {
    kind: 'panel';
    id: string;
    tabs: PanelTab[];
    activeTab: number;   // index into tabs
    appId: KOSAppId | null;   // shortcut: current app (tabs[activeTab].appId)
}

export interface SplitNode {
    kind: 'split';
    id: string;
    direction: 'horizontal' | 'vertical';
    ratio: number;   // 0..1 fraction for child A
    a: LayoutNode;
    b: LayoutNode;
}

export type LayoutNode = SplitNode | PanelLeaf;

// ─── Workspace Layout Presets ─────────────────────────────────────────────────

export interface LayoutPreset {
    id: string;
    label: string;
    description: string;
    icon: string;
    root: LayoutNode;
}

function leaf(appId: KOSAppId): PanelLeaf {
    const tabId = uuid();
    return { kind: 'panel', id: uuid(), tabs: [{ id: tabId, appId }], activeTab: 0, appId };
}

function split(
    direction: 'horizontal' | 'vertical',
    ratio: number,
    a: LayoutNode,
    b: LayoutNode
): SplitNode {
    return { kind: 'split', id: uuid(), direction, ratio, a, b };
}

export const LAYOUT_PRESETS: Record<string, LayoutPreset> = {
    SCULPT_STUDIO: {
        id: 'SCULPT_STUDIO',
        label: 'Sculpt Studio',
        description: 'Viewport + Timeline + Properties + Assets',
        icon: 'PenTool',
        root: split('horizontal', 0.75,
            split('vertical', 0.80,
                leaf('viewport'),
                leaf('timeline')
            ),
            split('vertical', 0.50,
                leaf('properties'),
                leaf('assets')
            )
        ),
    },

    UE5: {
        id: 'UE5',
        label: 'UE5 Layout',
        description: 'Viewport + Outliner + Properties + Content Browser',
        icon: 'Monitor',
        root: split('horizontal', 0.78,
            split('vertical', 0.72,
                split('horizontal', 0.72,
                    leaf('viewport'),
                    leaf('outliner')
                ),
                leaf('assets')
            ),
            split('vertical', 0.55,
                leaf('properties'),
                leaf('terminal')
            )
        ),
    },

    FULL_DCC: {
        id: 'FULL_DCC',
        label: 'Full DCC',
        description: 'Viewport · Assets · Outliner · Properties',
        icon: 'LayoutGrid',
        root: split('horizontal', 0.50,
            split('vertical', 0.50,
                leaf('viewport'),
                leaf('assets')
            ),
            split('vertical', 0.50,
                leaf('outliner'),
                leaf('properties')
            )
        ),
    },

    TEXTURE_PIPELINE: {
        id: 'TEXTURE_PIPELINE',
        label: 'Texture Pipeline',
        description: 'Viewport · Assets · Properties · Terminal',
        icon: 'Layers',
        root: split('horizontal', 0.60,
            split('vertical', 0.50,
                leaf('viewport'),
                leaf('assets')
            ),
            split('vertical', 0.50,
                leaf('properties'),
                leaf('terminal')
            )
        ),
    },

    SIMULATION: {
        id: 'SIMULATION',
        label: 'Simulation Lab',
        description: 'Viewport · Outliner · Properties · Terminal',
        icon: 'Activity',
        root: split('horizontal', 0.70,
            split('vertical', 0.60,
                leaf('viewport'),
                leaf('outliner')
            ),
            split('vertical', 0.50,
                leaf('properties'),
                leaf('terminal')
            )
        ),
    },

    SINGLE: {
        id: 'SINGLE',
        label: 'Single Viewport',
        description: 'One full-screen viewport',
        icon: 'Maximize',
        root: leaf('viewport'),
    },
};

// ─── Universal Bus ────────────────────────────────────────────────────────────

export type BusEventMap = {
    'mesh:selected': { meshId: string | null };
    'mesh:committed': { meshId: string; source: KOSAppId };
    'material:changed': { materialId: string };
    'panel:focused': { panelId: string };
    'panel:app:changed': { panelId: string; appId: KOSAppId };
    'layout:changed': Record<string, never>;
    'cfd:started': { simId: number };
    'flux:toggled': { active: boolean };
    'brush:applied': { position: [number, number, number] };
};

type BusListener<T extends keyof BusEventMap> = (data: BusEventMap[T]) => void;

class UniversalBus {
    private listeners: Map<string, Set<Function>> = new Map();

    on<T extends keyof BusEventMap>(event: T, cb: BusListener<T>): () => void {
        if (!this.listeners.has(event)) this.listeners.set(event, new Set());
        this.listeners.get(event)!.add(cb);
        return () => this.listeners.get(event)?.delete(cb);
    }

    emit<T extends keyof BusEventMap>(event: T, data: BusEventMap[T]): void {
        this.listeners.get(event)?.forEach(cb => {
            try { cb(data); } catch (e) { console.warn('[UniversalBus] listener error:', e); }
        });
    }
}

export const universalBus = new UniversalBus();

// ─── Layout Store ─────────────────────────────────────────────────────────────

export interface UniversalWorkspaceState {
    root: LayoutNode;
    focusedPanel: string | null;   // panelId
    presetsOpen: boolean;
    fullscreenPanel: string | null;  // panelId to fill entire workspace
    activeViewportDriverPanelId: string | null;
    viewportDriverPolicy: 'focused-panel';
}

/** Immutable helpers that return new tree copies */

export function findNode(root: LayoutNode, id: string): LayoutNode | null {
    if (root.id === id) return root;
    if (root.kind === 'split') {
        return findNode(root.a, id) ?? findNode(root.b, id);
    }
    return null;
}

export function mapNode(
    root: LayoutNode,
    id: string,
    transform: (node: LayoutNode) => LayoutNode
): LayoutNode {
    if (root.id === id) return transform(root);
    if (root.kind === 'split') {
        return { ...root, a: mapNode(root.a, id, transform), b: mapNode(root.b, id, transform) };
    }
    return root;
}

export function splitPanel(
    root: LayoutNode,
    panelId: string,
    direction: 'horizontal' | 'vertical',
    newAppId: KOSAppId = 'viewport'
): LayoutNode {
    return mapNode(root, panelId, (node) =>
        split(direction, 0.5, node, leaf(newAppId))
    );
}

export function closePanel(root: LayoutNode, panelId: string): LayoutNode {
    // Find parent and replace with sibling
    function removeFrom(node: LayoutNode, target: string): [LayoutNode | null, boolean] {
        if (node.kind === 'panel') return [node, false];
        const sp = node as SplitNode;

        if (sp.a.id === target) return [sp.b, true];
        if (sp.b.id === target) return [sp.a, true];

        const [na, removedA] = removeFrom(sp.a, target);
        if (removedA) return [{ ...sp, a: na! }, true];

        const [nb, removedB] = removeFrom(sp.b, target);
        if (removedB) return [{ ...sp, b: nb! }, true];

        return [node, false];
    }
    const [newRoot] = removeFrom(root, panelId);
    return newRoot ?? root;
}

export function setRatio(root: LayoutNode, splitId: string, ratio: number): LayoutNode {
    return mapNode(root, splitId, (node) =>
        node.kind === 'split' ? { ...node, ratio: Math.max(0.1, Math.min(0.9, ratio)) } : node
    );
}

export function setApp(root: LayoutNode, panelId: string, appId: KOSAppId): LayoutNode {
    const tabId = uuid();
    return mapNode(root, panelId, (node) => {
        if (node.kind !== 'panel') return node;
        const exists = node.tabs.findIndex(t => t.appId === appId);
        if (exists >= 0) return { ...node, activeTab: exists, appId };
        const tabs = [...node.tabs, { id: tabId, appId }];
        return { ...node, tabs, activeTab: tabs.length - 1, appId };
    });
}

export function collectLeaves(root: LayoutNode): PanelLeaf[] {
    if (root.kind === 'panel') return [root];
    return [...collectLeaves(root.a), ...collectLeaves(root.b)];
}

export function findLeafByAppId(root: LayoutNode, appId: KOSAppId): PanelLeaf | null {
    return collectLeaves(root).find((leaf) => leaf.appId === appId) ?? null;
}
