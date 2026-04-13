import type { KAINHostKind, KAINRuntimeApp, KAINRuntimeOutputFile, KAINTarget } from '../bridge/KAINBridge';

export interface KAINRuntimeHostGroup {
    hostKind: KAINHostKind;
    apps: KAINRuntimeApp[];
}

export const KAIN_RUNTIME_TARGET_PRIORITY: ReadonlyArray<KAINTarget> = ['hybrid', 'wasm', 'ts', 'js', 'ks'];

export const KAIN_RUNTIME_HOST_LABELS: Readonly<Record<KAINHostKind, string>> = {
    tauri: 'Tauri',
    webview: 'Webview',
    wasm_runtime: 'WASM Runtime',
    hybrid: 'Hybrid',
    native_runtime: 'Native Runtime',
    python: 'Python',
    node: 'Node',
    rust_host: 'Rust Host',
    c_abi: 'C ABI',
    ue_5: 'UE5',
    cli: 'CLI',
};

export const KAIN_RUNTIME_KIND_LABELS: Readonly<Record<KAINRuntimeApp['runtimeKind'], string>> = {
    tauri_frontend: 'Tauri Frontend',
    desktop_script: 'Desktop Script',
    compute_kernel: 'Compute Kernel',
    hybrid_module: 'Hybrid Module',
    native_ui_app: 'Native UI App',
    viewport_3d_app: 'Viewport 3D App',
    python_bridge: 'Python Bridge',
    node_bridge: 'Node Bridge',
    rust_crate_bridge: 'Rust Crate Bridge',
    c_abi_bridge: 'C ABI Bridge',
    omni_pipeline: 'Omni Pipeline',
    selfhost_harness: 'Selfhost Harness',
};

export function sortRuntimeApps(apps: readonly KAINRuntimeApp[]): KAINRuntimeApp[] {
    return [...apps].sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
}

export function groupRuntimeAppsByHost(apps: readonly KAINRuntimeApp[]): KAINRuntimeHostGroup[] {
    const groups = new Map<KAINHostKind, KAINRuntimeApp[]>();
    for (const app of sortRuntimeApps(apps)) {
        const bucket = groups.get(app.hostKind) ?? [];
        bucket.push(app);
        groups.set(app.hostKind, bucket);
    }

    return Array.from(groups.entries())
        .sort(([a], [b]) => KAIN_RUNTIME_HOST_LABELS[a].localeCompare(KAIN_RUNTIME_HOST_LABELS[b]))
        .map(([hostKind, hostApps]) => ({ hostKind, apps: hostApps }));
}

export function listRuntimeTargets(app: KAINRuntimeApp): KAINTarget[] {
    const seen = new Set<KAINTarget>();
    for (const output of app.outputs) {
        seen.add(output.target);
    }

    return [...seen].sort((a, b) => {
        const aIndex = KAIN_RUNTIME_TARGET_PRIORITY.indexOf(a);
        const bIndex = KAIN_RUNTIME_TARGET_PRIORITY.indexOf(b);
        const left = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
        const right = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
        return left - right || a.localeCompare(b);
    });
}

export function getRuntimeOutput(app: KAINRuntimeApp, target: KAINTarget): KAINRuntimeOutputFile | undefined {
    return app.outputs.find((output) => output.target === target);
}

export function getPreferredRuntimeOutput(app: KAINRuntimeApp, preferredTargets: readonly KAINTarget[] = KAIN_RUNTIME_TARGET_PRIORITY): KAINRuntimeOutputFile | undefined {
    for (const target of preferredTargets) {
        const output = getRuntimeOutput(app, target);
        if (output) {
            return output;
        }
    }

    return app.outputs[0];
}

export function summarizeRuntimeTargets(app: KAINRuntimeApp): string {
    return listRuntimeTargets(app)
        .map((target) => target.toUpperCase())
        .join(' • ');
}

export function describeRuntimeOutputPath(path: string): { fileName: string; extension: string; directory: string } {
    const normalized = path.replace(/\\/g, '/');
    const segments = normalized.split('/').filter(Boolean);
    const fileName = segments[segments.length - 1] ?? normalized;
    const dot = fileName.lastIndexOf('.');
    return {
        fileName,
        extension: dot >= 0 ? fileName.slice(dot + 1) : '',
        directory: segments.slice(0, -1).join('/'),
    };
}

export function matchesRuntimeQuery(app: KAINRuntimeApp, query: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q) {
        return true;
    }

    return [
        app.id,
        app.label,
        app.namespace,
        app.sourcePath,
        app.runtimeKind,
        app.hostKind,
        ...app.outputs.map((output) => output.path),
        ...app.outputs.map((output) => output.target),
    ].some((value) => value.toLowerCase().includes(q));
}
