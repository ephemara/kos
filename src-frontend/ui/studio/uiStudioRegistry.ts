import type { UiSurfaceInfo } from './types';

const surfacesByApp = new Map<string, Map<string, UiSurfaceInfo>>();
const cachedListsByApp = new Map<string, UiSurfaceInfo[]>();
const listeners = new Set<() => void>();

function recomputeCache(appKey: string) {
    const app = surfacesByApp.get(appKey);
    if (!app) {
        cachedListsByApp.delete(appKey);
        return;
    }
    const next = Array.from(app.values()).sort((a, b) => a.title.localeCompare(b.title));
    cachedListsByApp.set(appKey, next);
}

function emit() {
    for (const l of listeners) l();
}

export function registerUiSurface(info: UiSurfaceInfo): () => void {
    let app = surfacesByApp.get(info.appKey);
    if (!app) {
        app = new Map();
        surfacesByApp.set(info.appKey, app);
    }
    app.set(info.surfaceKey, info);
    recomputeCache(info.appKey);
    emit();

    return () => {
        const a = surfacesByApp.get(info.appKey);
        if (!a) return;
        a.delete(info.surfaceKey);
        if (a.size === 0) surfacesByApp.delete(info.appKey);
        recomputeCache(info.appKey);
        emit();
    };
}

export function listUiSurfaces(appKey: string): UiSurfaceInfo[] {
    const cached = cachedListsByApp.get(appKey);
    if (cached) return cached;
    recomputeCache(appKey);
    return cachedListsByApp.get(appKey) ?? [];
}

export function subscribeUiSurfaces(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
