/**
 * AppApiRegistry.ts — K-OS Per-Application Extension APIs
 *
 * ═══════════════════════════════════════════════════════════════════════
 * UE5-LEVEL APP EXTENSIBILITY. EVERY APP EXPOSES ITS INTERNALS.
 *
 * Each K-OS application exposes its own typed extension API surface.
 * Unlike the global API (hooks/slots/themes), these are app-specific:
 *
 *   api.app('ksculpt').addBrush(def)     → register a new sculpt brush
 *   api.app('kpainter').addLayer(def)    → inject a custom layer type
 *   api.app('kquantum').addForce(def)    → add a custom simulation force
 *   api.app('kretopo').addTool()         → add a retopo tool
 *
 * App APIs are:
 *   - Lazy-initialized: built only when the app is active
 *   - Permission-gated: plugins declare which app APIs they need
 *   - Observable: plugins subscribe to app state changes
 *   - Bidirectional: apps can call back into plugin-registered handlers
 *
 * Adding a new app API:
 *   1. Create interface in this file
 *   2. Add entry to APP_API_REGISTRY
 *   3. App calls appApiRegistry.getApi('myapp') to get its impl
 * ═══════════════════════════════════════════════════════════════════════
 */

import React from 'react';
import { hookBus } from '../hooks/HookBus';
import type { HookHandler } from '../hooks/HookBus';
import type { KAINTarget, KAINCompileResult, KAINRunResult, KAINSourceFile } from '@/kain';

// ─── Shared types ─────────────────────────────────────────────────────────────

export type Vec3 = [number, number, number];
export type RGBA = [number, number, number, number];

// ─── KSculpt App API ─────────────────────────────────────────────────────────

export interface SculptBrushDef {
    id: string;
    label: string;
    icon?: string;            // Lucide icon name or URL
    category: 'standard' | 'simulation' | 'procedural' | 'plugin';
    /** Shortcut key */
    key?: string;
    /** Default strength 0-1 */
    defaultStrength?: number;
    /** Default radius in scene units */
    defaultRadius?: number;
    /** Called when this brush performs a stroke */
    apply: (ctx: SculptStrokeContext) => void | Promise<void>;
    /** Custom shader for GPU-accelerated brush (GLSL) */
    computeShader?: string;
    /** Custom properties panel rendered in the left sidebar */
    PropertiesPanel?: React.ComponentType<{ brushDef: SculptBrushDef }>;
}

export interface SculptStrokeContext {
    brush: SculptBrushDef;
    position: Vec3;
    normal: Vec3;
    strength: number;
    radius: number;
    /** Raw mesh vertex buffer access — modify in-place */
    vertices: Float32Array;
    /** Submit modifications back to GPU */
    commit(): Promise<void>;
}

export interface KSculptApi {
    /** Register a custom brush type — appears in brush picker */
    addBrush(def: SculptBrushDef): () => void;
    /** Get all registered brushes including plugin brushes */
    getBrushes(): SculptBrushDef[];
    /** Set the active brush */
    setActiveBrush(id: string): void;
    /** Get current active brush */
    getActiveBrush(): SculptBrushDef | null;
    /** Subscribe to active brush changes */
    onBrushChange(cb: (brush: SculptBrushDef) => void): () => void;
    /** Subscribe to every stroke applied */
    onStroke(cb: (ctx: SculptStrokeContext) => void): () => void;
    /** Get current mesh vertex data */
    getVertices(): Float32Array | null;
    /** Get current mesh triangle indices */
    getIndices(): Uint32Array | null;
    /** Force a mesh update */
    invalidateMesh(): void;
    /** Set matcap by ID */
    setMatcap(id: string): void;
    /** Get the current subdivision level */
    getSubdivisionLevel(): number;
}

// ─── KPainter App API ────────────────────────────────────────────────────────

export interface PaintBrushDef {
    id: string;
    label: string;
    icon?: string;
    blendMode?: string;
    /** Called on every paint event */
    apply: (ctx: PaintStrokeContext) => void | Promise<void>;
    /** Custom GPU shader for this brush */
    fragmentShader?: string;
    PropertiesPanel?: React.ComponentType<{ brushDef: PaintBrushDef }>;
}

export interface PaintStrokeContext {
    brush: PaintBrushDef;
    x: number;
    y: number;
    pressure: number;
    color: RGBA;
    opacity: number;
    canvas: OffscreenCanvas | null;
}

export interface LayerDef {
    id: string;
    label: string;
    blendMode?: string;
    /** Custom blend function — receives src/dst pixel data */
    blendFn?: (src: Uint8ClampedArray, dst: Uint8ClampedArray) => Uint8ClampedArray;
}

export interface KPainterApi {
    addBrush(def: PaintBrushDef): () => void;
    getBrushes(): PaintBrushDef[];
    setActiveBrush(id: string): void;
    getActiveBrush(): PaintBrushDef | null;
    addLayerType(def: LayerDef): () => void;
    getLayers(): LayerDef[];
    onStroke(cb: (ctx: PaintStrokeContext) => void): () => void;
    getCanvasElement(): HTMLCanvasElement | null;
    getActiveColor(): RGBA;
    setActiveColor(color: RGBA): void;
    onColorChange(cb: (color: RGBA) => void): () => void;
}

// ─── KQuantum App API ────────────────────────────────────────────────────────

export interface SimNodeDef {
    id: string;
    label: string;
    icon?: string;
    category: 'force' | 'constraint' | 'field' | 'emitter' | 'plugin';
    /** Called each simulation step */
    step: (ctx: SimStepContext) => void | Promise<void>;
    PropertiesPanel?: React.ComponentType<{ node: SimNodeDef }>;
}

export interface SimStepContext {
    dt: number;
    frame: number;
    particles: Float32Array;  // x,y,z,vx,vy,vz per particle
    particleCount: number;
}

export interface KQuantumApi {
    addSimNode(def: SimNodeDef): () => void;
    getSimNodes(): SimNodeDef[];
    onSimStep(cb: (ctx: SimStepContext) => void): () => void;
    isRunning(): boolean;
    start(): void;
    stop(): void;
    reset(): void;
    getParticleCount(): number;
    onStateChange(cb: (running: boolean) => void): () => void;
}

// ─── KRetopo App API ─────────────────────────────────────────────────────────

export interface RetopoToolDef {
    id: string;
    label: string;
    icon?: string;
    apply: (ctx: { x: number; y: number; mesh: Float32Array }) => void;
}

export interface KRetopoApi {
    addTool(def: RetopoToolDef): () => void;
    getTools(): RetopoToolDef[];
    setActiveTool(id: string): void;
    getActiveTool(): RetopoToolDef | null;
}

// ─── KGraphos App API ────────────────────────────────────────────────────────

export interface GraphosNodeDef {
    id: string;
    label: string;
    category: string;
    render: (ctx: CanvasRenderingContext2D, x: number, y: number) => void;
}

export interface KGraphosApi {
    addNode(def: GraphosNodeDef): () => void;
    getNodes(): GraphosNodeDef[];
    getCanvas(): HTMLCanvasElement | null;
}

// ─── App API contract ─────────────────────────────────────────────────────────

export interface AppApiMap {
    ksculpt: KSculptApi;
    kpainter: KPainterApi;
    kquantum: KQuantumApi;
    kretopo: KRetopoApi;
    kgraphos: KGraphosApi;
    kain: KAINApi;
}

// ─── KAIN Language App API ───────────────────────────────────────────────────

export interface KAINApi {
    /** Compile a .kn source string to any target */
    compile(source: string, target: KAINTarget): Promise<KAINCompileResult>;
    /** Run .kn source in the interpreter */
    run(source: string): Promise<KAINRunResult>;
    /** Rebuild a specific source file from the K-OS KAIN source tree */
    rebuildFile(file: KAINSourceFile): Promise<KAINCompileResult>;
    /** Get all registered KAIN source files */
    listSources(): KAINSourceFile[];
    /** Subscribe to source file rebuild events */
    onRebuild(cb: (file: KAINSourceFile, result: KAINCompileResult) => void): () => void;
}

// ─── App API Registry ─────────────────────────────────────────────────────────
// Each app mounts its API implementation here when it initialises.

class AppApiRegistry {
    private impls = new Map<string, unknown>();
    private listeners = new Map<string, Set<(api: unknown) => void>>();

    /** Called by each app when it mounts (registers its API implementation) */
    mount<K extends keyof AppApiMap>(appId: K, api: AppApiMap[K]): () => void {
        this.impls.set(appId, api);
        this.listeners.get(appId)?.forEach(cb => cb(api));
        hookBus.fire(`app:${appId}:mounted`, { appId });
        return () => {
            this.impls.delete(appId);
            hookBus.fire(`app:${appId}:unmounted`, { appId });
        };
    }

    /** Get the API for a specific app (null if app not mounted) */
    get<K extends keyof AppApiMap>(appId: K): AppApiMap[K] | null {
        return (this.impls.get(appId) as AppApiMap[K]) ?? null;
    }

    /** Wait for an app to mount, then call the callback */
    whenMounted<K extends keyof AppApiMap>(appId: K, cb: (api: AppApiMap[K]) => void): () => void {
        const existing = this.get(appId);
        if (existing) { cb(existing); return () => { }; }

        if (!this.listeners.has(appId)) this.listeners.set(appId, new Set());
        const handler = (api: unknown) => cb(api as AppApiMap[K]);
        this.listeners.get(appId)!.add(handler);
        return () => this.listeners.get(appId)?.delete(handler);
    }

    /** List all currently mounted app IDs */
    mountedApps(): string[] {
        return Array.from(this.impls.keys());
    }
}

export const appApiRegistry = new AppApiRegistry();

// ─── App metadata catalogue ───────────────────────────────────────────────────
// Data-driven: describes capabilities plugins can request access to.

export interface AppPermission {
    id: string;
    label: string;
    risk: 'low' | 'medium' | 'high';
    description: string;
}

export interface AppMetadata {
    id: string;
    label: string;
    icon: string;
    description: string;
    permissions: AppPermission[];
    apiKeys: string[];   // Top-level methods on the app API
}

export const APP_CATALOGUE: AppMetadata[] = [
    {
        id: 'ksculpt', label: 'K-SCULPT', icon: '🗿',
        description: 'GPU-accelerated 3D sculpting engine',
        apiKeys: ['addBrush', 'getBrushes', 'setActiveBrush', 'onStroke', 'getVertices', 'getIndices', 'setMatcap'],
        permissions: [
            { id: 'sculpt.brush.add', label: 'Add custom brushes', risk: 'low', description: 'Register new brush types in KSculpt' },
            { id: 'sculpt.mesh.read', label: 'Read mesh geometry', risk: 'low', description: 'Access vertex/index buffer data' },
            { id: 'sculpt.mesh.write', label: 'Modify mesh geometry', risk: 'high', description: 'Write to vertex buffers — can corrupt meshes' },
            { id: 'sculpt.gpu.shader', label: 'Inject GPU brush shaders', risk: 'high', description: 'Register custom GLSL compute shaders' },
        ],
    },
    {
        id: 'kpainter', label: 'K-PAINTER', icon: '🎨',
        description: 'GPU texture painting with layered compositing',
        apiKeys: ['addBrush', 'getBrushes', 'addLayerType', 'getLayers', 'onStroke', 'getCanvasElement', 'getActiveColor'],
        permissions: [
            { id: 'painter.brush.add', label: 'Add custom brushes', risk: 'low', description: 'Register custom paint brush types' },
            { id: 'painter.layer.add', label: 'Add custom layer types', risk: 'medium', description: 'Register custom blend mode layer types' },
            { id: 'painter.canvas.read', label: 'Read canvas pixels', risk: 'low', description: 'Access ImageData from the paint canvas' },
            { id: 'painter.canvas.write', label: 'Write to canvas', risk: 'high', description: 'Write pixels directly to the paint canvas' },
        ],
    },
    {
        id: 'kquantum', label: 'K-QUANTUM', icon: '⚛️',
        description: 'Physics & CFD simulation engine',
        apiKeys: ['addSimNode', 'getSimNodes', 'onSimStep', 'isRunning', 'start', 'stop', 'reset'],
        permissions: [
            { id: 'quantum.node.add', label: 'Add simulation nodes', risk: 'medium', description: 'Register custom force/field simulation nodes' },
            { id: 'quantum.step.hook', label: 'Hook simulation steps', risk: 'medium', description: 'Run per-frame code during simulation' },
            { id: 'quantum.particles.read', label: 'Read particle state', risk: 'low', description: 'Access particle buffer data' },
            { id: 'quantum.particles.write', label: 'Write particle state', risk: 'high', description: 'Modify particle positions/velocities directly' },
        ],
    },
    {
        id: 'kretopo', label: 'K-RETOPO', icon: '🔲',
        description: 'Manual & auto retopology tools',
        apiKeys: ['addTool', 'getTools', 'setActiveTool'],
        permissions: [
            { id: 'retopo.tool.add', label: 'Add retopo tools', risk: 'low', description: 'Register custom retopology tools' },
        ],
    },
    {
        id: 'kgraphos', label: 'K-GRAPHOS', icon: '✏️',
        description: 'GPU-accelerated drawing suite',
        apiKeys: ['addNode', 'getNodes', 'getCanvas'],
        permissions: [
            { id: 'graphos.node.add', label: 'Add simulation nodes', risk: 'low', description: 'Register custom drawing/simulation nodes' },
            { id: 'graphos.canvas.read', label: 'Read canvas', risk: 'low', description: 'Access Graphos canvas state' },
        ],
    },
    {
        id: 'kain', label: 'K-AIN', icon: '⚡',
        description: 'KAIN language runtime — compile .kn to SPIR-V, WASM, TypeScript, Rust, C++',
        apiKeys: ['compile', 'run', 'rebuildFile', 'listSources', 'onRebuild'],
        permissions: [
            { id: 'kain.compile',          label: 'Compile KAIN source',    risk: 'medium', description: 'Compile .kn to any target (SPIR-V, WASM, TypeScript, Rust, C++)' },
            { id: 'kain.run',              label: 'Run KAIN interpreter',   risk: 'medium', description: 'Execute .kn code in the KAIN interpreter' },
            { id: 'kain.sources.read',     label: 'Read KAIN source files', risk: 'low',    description: 'List and read existing .kn source files in the K-OS tree' },
            { id: 'kain.sources.rebuild',  label: 'Rebuild GPU shaders',    risk: 'high',   description: 'Trigger rebuild of KAIN GPU brush shaders (SPIR-V hot-reload)' },
        ],
    },
];
