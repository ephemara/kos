/**
 * KAINBridge.ts — K-OS ↔ KAIN Language Runtime Bridge
 *
 * ═══════════════════════════════════════════════════════════════════════
 * CONNECTS THE KAIN LANGUAGE COMPILER TO THE K-OS FRONTEND.
 *
 * KAIN is the native language of K-OS. It covers every layer:
 *
 *   .kn source → kain build -t spirv  → GPU compute shaders (brushes, physics)
 *   .kn source → kain build -t wasm   → WASM modules (math, physics, ML)
 *   .kn source → kain build -t ts     → TypeScript (K-OS plugins, scripts)
 *   .kn source → kain build -t rust   → Rust (backend crates, mesh ops)
 *   .kn source → kain run             → Live interpreter (REPL, prototyping)
 *
 * This bridge exposes KAIN to the frontend through three channels:
 *
 *   1. Tauri commands → invoke the KAIN CLI from the backend
 *   2. Compiled WASM → k-os-wasm crate, loaded directly in the browser
 *   3. KAINScript → transpile .kn to TS on the fly, then eval() for plugins
 *
 * KEY SCENARIOS:
 *   - User writes a plugin in KAINScript → compile to TS → register in Plugin Matrix
 *   - User writes a custom brush in KAIN → compile to SPIR-V → hot-reload into GPU pipeline
 *   - KAINScript REPL in the K-OS console → live interpreter via Tauri
 *   - Physics simulation nodes written in KAIN → WASM → KQuantum
 * ═══════════════════════════════════════════════════════════════════════
 */

import {
    kainBuildFile,
    kainCompile,
    kainListRuntimeApps,
    kainListSources,
    kainListUpstreamCapabilities,
    kainReadSource,
    kainRun,
    kainWriteSource,
    type KainCapabilityCategory as NativeKainCapabilityCategory,
    type KainCliTarget,
    type KainHostKind as NativeKainHostKind,
    type KainIntegrationStatus as NativeKainIntegrationStatus,
    type KainRuntimeKind as NativeKainRuntimeKind,
    type KainRuntimeRegistryEntry,
    type KainSourceDomain as NativeKainSourceDomain,
    type KainSourceRegistryEntry,
    type KainUpstreamCapabilityEntry,
} from '@/generated/tauriRegistry.gen';
import { GENERATED_KAIN_RUNTIME_REGISTRY } from '../runtime/generatedRegistry';

// ─── KAIN compilation targets (mirrors kain --help) ───────────────────────────

export type KAINTarget = KainCliTarget;

// ─── Result types ─────────────────────────────────────────────────────────────

export interface KAINCompileResult {
    success: boolean;
    output?: string | null;    // stdout / compiled output text
    outputPath?: string | null;   // path to compiled artifact
    errors?: string | null;    // stderr
    target: KAINTarget;
    durationMs: number;
    description: string;
}

export interface KAINRunResult {
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number;
}

export interface KAINScriptPlugin {
    id: string;
    name: string;
    source: string;        // .kn source code
    compiled?: string;        // compiled TypeScript
    status: 'source' | 'compiling' | 'compiled' | 'error';
    error?: string;
}

// ─── KAIN source file registry ────────────────────────────────────────────────
// Data-driven: all known .kn files in the K-OS codebase

export interface KAINSourceFile {
    path: string;
    domain: KAINSourceDomain;
    category: string;
    label: string;
    target: KAINTarget;
    description: string;
    outputPath?: string;
}

export type KAINSourceDomain = NativeKainSourceDomain | 'physics' | 'plugin' | 'custom';
export type KAINRuntimeKind = NativeKainRuntimeKind;
export type KAINHostKind = NativeKainHostKind;
export type KAINCapabilityCategory = NativeKainCapabilityCategory;
export type KAINIntegrationStatus = NativeKainIntegrationStatus;

export interface KAINRuntimeOutputFile {
    target: KAINTarget;
    path: string;
}

export interface KAINRuntimeApp {
    id: string;
    label: string;
    sourcePath: string;
    runtimeKind: KAINRuntimeKind;
    hostKind: KAINHostKind;
    namespace: string;
    outputs: KAINRuntimeOutputFile[];
}

export interface KAINUpstreamCapability {
    id: string;
    label: string;
    category: KAINCapabilityCategory;
    integrationStatus: KAINIntegrationStatus;
    summary: string;
    commands: string[];
    compileTargets: KAINTarget[];
    runtimeKinds: KAINRuntimeKind[];
    hostKinds: KAINHostKind[];
    upstreamCrates: string[];
    recommendedKosNextStep: string;
    notes: string[];
}

export const KAIN_SOURCE_REGISTRY: KAINSourceFile[] = [];
export const KAIN_RUNTIME_REGISTRY: KAINRuntimeApp[] = GENERATED_KAIN_RUNTIME_REGISTRY;

export interface KAINAuthoringSession {
    source?: string;
    path?: string;
    target?: KAINTarget;
    domain?: KAINSourceFile['domain'];
    label?: string;
    description?: string;
}

const AUTHORING_EVENT = 'kos:kain-authoring-session';

const CATEGORY_BY_SOURCE_DOMAIN: Record<KAINSourceDomain, string> = {
    fluid: 'native',
    sculpt: 'native',
    mocap: 'supermotion',
    paint: 'paint',
    renderer: 'renderer',
    materials: 'native',
    imports: 'native',
    sculpting_engine: 'native',
    brush: 'native',
    shader: 'native',
    procedural: 'native',
    kainscript: 'native',
    physics: 'native',
    plugin: 'native',
    custom: 'native',
};

function mapNativeSourceEntry(entry: KainSourceRegistryEntry): KAINSourceFile {
    return {
        path: entry.sourcePath,
        domain: entry.domain,
        category: CATEGORY_BY_SOURCE_DOMAIN[entry.domain],
        label: entry.label,
        target: entry.target === 'source' ? 'ts' : entry.target,
        description: `Native KAIN registry entry: ${entry.id}`,
        outputPath: entry.compiledPath ?? undefined,
    };
}

function mapNativeRuntimeEntry(entry: KainRuntimeRegistryEntry): KAINRuntimeApp {
    return {
        id: entry.id,
        label: entry.label,
        sourcePath: entry.sourcePath,
        runtimeKind: entry.runtimeKind,
        hostKind: entry.hostKind,
        namespace: entry.namespace,
        outputs: entry.outputs.map((output) => ({
            target: output.target,
            path: output.path,
        })),
    };
}

function mapUpstreamCapabilityEntry(
    entry: KainUpstreamCapabilityEntry,
): KAINUpstreamCapability {
    return {
        id: entry.id,
        label: entry.label,
        category: entry.category,
        integrationStatus: entry.integrationStatus,
        summary: entry.summary,
        commands: [...entry.commands],
        compileTargets: [...entry.compileTargets],
        runtimeKinds: [...entry.runtimeKinds],
        hostKinds: [...entry.hostKinds],
        upstreamCrates: [...entry.upstreamCrates],
        recommendedKosNextStep: entry.recommendedKosNextStep,
        notes: [...entry.notes],
    };
}

// ─── KAINBridge class ─────────────────────────────────────────────────────────

export class KAINBridge {
    private static _instance: KAINBridge;
    private nativeRegistryCache: KAINSourceFile[] | null = null;
    private nativeRuntimeRegistryCache: KAINRuntimeApp[] | null = null;
    private nativeCapabilityCache: KAINUpstreamCapability[] | null = null;

    static get instance(): KAINBridge {
        if (!KAINBridge._instance) KAINBridge._instance = new KAINBridge();
        return KAINBridge._instance;
    }

    // ── Tauri-backed compilation ───────────────────────────────────────────────

    /**
     * Compile a .kn source string to a target via the KAIN CLI (Tauri backend).
     */
    async compile(source: string, target: KAINTarget, opts: {
        outputName?: string;
        verbose?: boolean;
        strict?: boolean;
    } = {}): Promise<KAINCompileResult> {
        const start = performance.now();
        try {
            const result = await kainCompile(
                source,
                target,
                opts.outputName ?? 'kain_output',
                opts.verbose ?? false,
                opts.strict ?? false,
            );
            return {
                ...result,
                target,
                durationMs: performance.now() - start,
                description: `Compiled ${source} to ${target}`,
            };
        } catch (err: any) {
            return {
                success: false,
                errors: String(err?.message ?? err),
                target,
                durationMs: performance.now() - start,
                description: `Compilation failed: ${err}`,
            };
        }
    }

    /**
     * Run a .kn source string in the KAIN interpreter (Tauri backend).
     * Returns stdout + stderr.
     */
    async run(source: string, opts: { verbose?: boolean } = {}): Promise<KAINRunResult> {
        try {
            return await kainRun(source, opts.verbose ?? false);
        } catch (err: any) {
            return { success: false, stdout: '', stderr: String(err), exitCode: 1 };
        }
    }

    /**
     * Compile a .kn source to TypeScript (KAINScript → TS).
     * The resulting TypeScript can be dynamically loaded as a plugin.
     */
    async compileToTypeScript(source: string): Promise<{ ts: string; success: boolean; error?: string }> {
        const result = await this.compile(source, 'ts');
        if (!result.success || !result.output) {
            return { ts: '', success: false, error: result.errors };
        }
        return { ts: result.output, success: true };
    }

    /**
     * Compile a .kn source to WASM and return the compiled bytes.
     * Used by KQuantum for hot-loading custom simulation nodes.
     */
    async compileToWASM(source: string): Promise<{ bytes: Uint8Array | null; success: boolean; error?: string }> {
        const result = await this.compile(source, 'wasm');
        if (!result.success) {
            return { bytes: null, success: false, error: result.errors };
        }
        // Backend returns base64-encoded WASM bytes
        try {
            const binary = atob(result.output ?? '');
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            return { bytes, success: true };
        } catch (err: any) {
            return { bytes: null, success: false, error: String(err) };
        }
    }

    /**
     * Compile a .kn GPU brush to SPIR-V.
     * Returns base64-encoded SPV bytes for hot-reload into the GPU pipeline.
     */
    async compileBrushToSPIRV(source: string): Promise<{ spv: string | null; success: boolean; error?: string }> {
        const result = await this.compile(source, 'spirv');
        return {
            spv: result.success ? (result.output ?? null) : null,
            success: result.success,
            error: result.errors,
        };
    }

    /**
     * Compile a .kn file to TypeScript and execute it as a plugin module.
     * Returns the module's exported `activate` and `deactivate` functions.
     */
    async loadKAINPlugin(source: string, id: string): Promise<{
        activate?: (api: any) => void | Promise<void>;
        deactivate?: () => void | Promise<void>;
        manifest?: any;
        success: boolean;
        error?: string;
    }> {
        const { ts, success, error } = await this.compileToTypeScript(source);
        if (!success) return { success: false, error };

        try {
            // Dynamic eval of compiled TypeScript (stripped of types)
            // In production, use a sandboxed iframe or worker
            const sanitized = ts
                .replace(/:\s*\w+(\[\])?(\s*[|&]\s*\w+(\[\])?)*(?=\s*[=,;){\n])/g, '') // strip type annotations
                .replace(/export\s+/g, '')
                .replace(/import\s+[^;]+;/g, ''); // strip imports (deps injected separately)

            const fn = new Function('require', 'exports', 'module', sanitized);
            const exports: any = {};
            const module: any = { exports };
            fn(() => ({}), exports, module);

            return {
                activate: exports.activate ?? module.exports?.activate,
                deactivate: exports.deactivate ?? module.exports?.deactivate,
                manifest: exports.manifest ?? module.exports?.manifest ?? { id, name: id, version: '1.0.0', description: 'KAINScript plugin' },
                success: true,
            };
        } catch (err: any) {
            return { success: false, error: String(err?.message ?? err) };
        }
    }

    // ── Rebuild existing KAIN sources ─────────────────────────────────────────

    /**
     * Trigger a rebuild of a specific .kn file via the Tauri backend.
     * Used for hot-reload of GPU brushes and simulation nodes.
     */
    async rebuildFile(file: KAINSourceFile): Promise<KAINCompileResult> {
        const start = performance.now();
        try {
            const result = await kainBuildFile(
                file.path,
                file.target,
                file.outputPath ?? null,
            );
            return { ...result, output: result.outputPath, target: file.target, durationMs: performance.now() - start, description: `Rebuilt ${file.path}` };
        } catch (err: any) {
            return { success: false, errors: String(err), target: file.target, durationMs: performance.now() - start, description: `Rebuild failed: ${err}` };
        }
    }

    /**
     * Rebuild all KAIN files in a domain (e.g. all sculpt brushes).
     */
    async rebuildDomain(domain: KAINSourceFile['domain']): Promise<Map<string, KAINCompileResult>> {
        const files = (await this.listSourcesFromBackend()).filter(f => f.domain === domain);
        const results = new Map<string, KAINCompileResult>();
        await Promise.all(files.map(async f => {
            results.set(f.path, await this.rebuildFile(f));
        }));
        return results;
    }

    /**
     * Query the Rust-side KAIN registry and map it to frontend source entries.
     * Falls back to the baked frontend registry if the backend command is unavailable.
     */
    async listSourcesFromBackend(): Promise<KAINSourceFile[]> {
        if (this.nativeRegistryCache) {
            return this.nativeRegistryCache;
        }

        try {
            const entries = await kainListSources();
            this.nativeRegistryCache = entries.map(mapNativeSourceEntry);
            return this.nativeRegistryCache;
        } catch (err) {
            console.warn('[KAINBridge] Falling back to frontend KAIN registry:', err);
            return KAIN_SOURCE_REGISTRY;
        }
    }

    /**
     * Get the best currently-known source list synchronously.
     * Uses backend-populated cache if available, otherwise falls back to the baked registry.
     */
    listSources(): KAINSourceFile[] {
        return this.nativeRegistryCache ?? KAIN_SOURCE_REGISTRY;
    }

    async listRuntimeAppsFromBackend(): Promise<KAINRuntimeApp[]> {
        if (this.nativeRuntimeRegistryCache) {
            return this.nativeRuntimeRegistryCache;
        }

        try {
            const entries = await kainListRuntimeApps();
            this.nativeRuntimeRegistryCache = entries.map(mapNativeRuntimeEntry);
            return this.nativeRuntimeRegistryCache;
        } catch (err) {
            console.warn('[KAINBridge] Falling back to frontend runtime registry:', err);
            // Do not cache the generated runtime fallback as backend data
            return KAIN_RUNTIME_REGISTRY;
        }
    }

    listRuntimeApps(): KAINRuntimeApp[] {
        return this.nativeRuntimeRegistryCache ?? KAIN_RUNTIME_REGISTRY;
    }

    async listUpstreamCapabilitiesFromBackend(): Promise<KAINUpstreamCapability[]> {
        if (this.nativeCapabilityCache) {
            return this.nativeCapabilityCache;
        }

        const entries = await kainListUpstreamCapabilities();
        this.nativeCapabilityCache = entries.map(mapUpstreamCapabilityEntry);
        return this.nativeCapabilityCache;
    }

    listUpstreamCapabilities(): KAINUpstreamCapability[] {
        return this.nativeCapabilityCache ?? [];
    }

    async listRuntimeAppsForHost(hostKind: KAINHostKind): Promise<KAINRuntimeApp[]> {
        const apps = await this.listRuntimeAppsFromBackend();
        return apps.filter((app) => app.hostKind === hostKind);
    }

    async listRuntimeAppsForTarget(target: KAINTarget): Promise<KAINRuntimeApp[]> {
        const apps = await this.listRuntimeAppsFromBackend();
        return apps.filter((app) => app.outputs.some((output) => output.target === target));
    }

    async getRuntimeAppById(id: string): Promise<KAINRuntimeApp | undefined> {
        const apps = await this.listRuntimeAppsFromBackend();
        return apps.find((app) => app.id === id);
    }

    async getRuntimeOutputPath(id: string, target: KAINTarget): Promise<string | undefined> {
        const app = await this.getRuntimeAppById(id);
        return app?.outputs.find((output) => output.target === target)?.path;
    }

    async readSource(path: string): Promise<string> {
        return kainReadSource(path);
    }

    async writeSource(path: string, source: string): Promise<void> {
        await kainWriteSource(path, source);
    }

    openAuthoringSession(session: KAINAuthoringSession): void {
        if (typeof window === 'undefined') return;
        window.dispatchEvent(new CustomEvent(AUTHORING_EVENT, { detail: session }));
    }

    onAuthoringSession(cb: (session: KAINAuthoringSession) => void): () => void {
        if (typeof window === 'undefined') return () => {};
        const handler = (event: Event) => {
            const custom = event as CustomEvent<KAINAuthoringSession>;
            cb(custom.detail);
        };
        window.addEventListener(AUTHORING_EVENT, handler);
        return () => window.removeEventListener(AUTHORING_EVENT, handler);
    }

    // ── REPL / session ────────────────────────────────────────────────────────

    private _session: string[] = [];

    /** Execute a KAIN expression in the running session context */
    async evalInSession(expr: string): Promise<KAINRunResult> {
        this._session.push(expr);
        const full = this._session.join('\n');
        return this.run(full);
    }

    resetSession(): void {
        this._session = [];
    }

    getSession(): string[] {
        return [...this._session];
    }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const kainBridge = KAINBridge.instance;

export function openKainAuthoringSession(session: KAINAuthoringSession): void {
    kainBridge.openAuthoringSession(session);
}

// ─── React hook ───────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react';

export interface UseKAINResult {
    compile: (source: string, target: KAINTarget) => Promise<KAINCompileResult>;
    run: (source: string) => Promise<KAINRunResult>;
    loading: boolean;
    result: KAINCompileResult | KAINRunResult | null;
    error: string | null;
    clear: () => void;
}

export function useKAIN(): UseKAINResult {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<KAINCompileResult | KAINRunResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const compile = useCallback(async (source: string, target: KAINTarget) => {
        setLoading(true);
        setError(null);
        const res = await kainBridge.compile(source, target);
        setResult(res);
        if (!res.success) setError(res.errors ?? 'Compilation failed');
        setLoading(false);
        return res;
    }, []);

    const run = useCallback(async (source: string) => {
        setLoading(true);
        setError(null);
        const res = await kainBridge.run(source);
        setResult(res);
        if (!res.success) setError(res.stderr ?? 'Runtime error');
        setLoading(false);
        return res;
    }, []);

    const clear = useCallback(() => { setResult(null); setError(null); }, []);

    return { compile, run, loading, result, error, clear };
}
