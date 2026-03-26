import type * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { getActiveStage, subscribeActiveStage } from './lookdevRegistry';
import { StudioStagePresets, type StudioStage } from '@/systems/three/StudioStage';

export type LookdevEnvMode = 'room' | 'hdr';

export type LookdevSettings = {
    preset: keyof typeof StudioStagePresets;
    envMode: LookdevEnvMode;
    hdrPath: string;
    exposure: number;
    environmentIntensity: number;
    environmentBlur: number;
    pixelRatioScale: number;
    maxPixelRatio: number;
};

const DEFAULT_SETTINGS: LookdevSettings = {
    preset: 'default',
    envMode: 'room',
    hdrPath: '/hdr/HDR_029_Sky_Cloudy_Env.hdr',
    exposure: 1.0,
    environmentIntensity: 1.0,
    environmentBlur: 0.04,
    pixelRatioScale: 1.0,
    maxPixelRatio: 2.0,
};

type StoreState = {
    global: LookdevSettings;
    perApp: Record<string, Partial<LookdevSettings>>;
};

const STORAGE_GLOBAL = 'kos-lookdev-global-v1';
const STORAGE_PER_APP = 'kos-lookdev-per-app-v1';

let state: StoreState = {
    global: DEFAULT_SETTINGS,
    perApp: {},
};

const listeners = new Set<() => void>();

function safeParse<T>(raw: string | null): T | null {
    if (!raw) return null;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

function clamp(v: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, v));
}

function normalizeSettings(partial: Partial<LookdevSettings>): LookdevSettings {
    const merged = { ...DEFAULT_SETTINGS, ...partial };
    merged.exposure = clamp(Number(merged.exposure), 0.1, 3.0);
    merged.environmentIntensity = clamp(Number(merged.environmentIntensity), 0.0, 3.0);
    merged.environmentBlur = clamp(Number(merged.environmentBlur), 0.0, 0.35);
    merged.pixelRatioScale = clamp(Number(merged.pixelRatioScale), 0.5, 2.0);
    merged.maxPixelRatio = clamp(Number(merged.maxPixelRatio), 1.0, 3.0);
    return merged;
}

export function initLookdevStore(): void {
    const g = safeParse<Partial<LookdevSettings>>(localStorage.getItem(STORAGE_GLOBAL));
    const p = safeParse<Record<string, Partial<LookdevSettings>>>(localStorage.getItem(STORAGE_PER_APP));

    state = {
        global: normalizeSettings(g ?? {}),
        perApp: p ?? {},
    };
}

export function subscribeLookdev(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function emit(): void {
    for (const l of listeners) l();
}

function persist(): void {
    try {
        localStorage.setItem(STORAGE_GLOBAL, JSON.stringify(state.global));
        localStorage.setItem(STORAGE_PER_APP, JSON.stringify(state.perApp));
    } catch {
        // ignore
    }
}

export function getLookdevGlobal(): LookdevSettings {
    return state.global;
}

export function getLookdevEffective(appKey: string): LookdevSettings {
    return normalizeSettings({ ...state.global, ...(state.perApp[appKey] ?? {}) });
}

export function getLookdevAppOverride(appKey: string): Partial<LookdevSettings> | null {
    return state.perApp[appKey] ?? null;
}

export function clearLookdevAppOverride(appKey: string): void {
    if (state.perApp[appKey]) {
        delete state.perApp[appKey];
        persist();
        emit();
    }
}

export function setLookdevGlobal(patch: Partial<LookdevSettings>): void {
    state.global = normalizeSettings({ ...state.global, ...patch });
    persist();
    emit();
}

export function setLookdevAppOverride(appKey: string, patch: Partial<LookdevSettings>): void {
    const prev = state.perApp[appKey] ?? {};
    state.perApp[appKey] = { ...prev, ...patch };
    persist();
    emit();
}

let hdrCache = new Map<string, THREE.Texture>();
let hdrInFlight = new Map<string, Promise<THREE.Texture>>();

async function loadHdrTexture(path: string): Promise<THREE.Texture> {
    const cached = hdrCache.get(path);
    if (cached) return cached;

    const inflight = hdrInFlight.get(path);
    if (inflight) return inflight;

    const p = new Promise<THREE.Texture>((resolve, reject) => {
        const loader = new RGBELoader();
        loader.load(
            path,
            (tex) => {
                tex.mapping = (tex as any).mapping ?? (undefined as any);
                hdrCache.set(path, tex);
                hdrInFlight.delete(path);
                resolve(tex);
            },
            undefined,
            (err) => {
                hdrInFlight.delete(path);
                reject(err);
            }
        );
    });

    hdrInFlight.set(path, p);
    return p;
}

export async function applyLookdevToStage(stage: StudioStage, effective: LookdevSettings): Promise<void> {
    stage.renderer.toneMappingExposure = effective.exposure;

    const pr = Math.min(window.devicePixelRatio * effective.pixelRatioScale, effective.maxPixelRatio);
    stage.renderer.setPixelRatio(pr);

    // Add null check for scene before setting environmentIntensity
    if (stage.scene) {
        (stage.scene as any).environmentIntensity = effective.environmentIntensity;
    } else {
        console.warn('[lookdevStore] Scene is undefined, cannot set environmentIntensity');
    }

    if (effective.envMode === 'room') {
        stage.setEnvironmentFromRoom({ blur: effective.environmentBlur });
        return;
    }

    try {
        const hdr = await loadHdrTexture(effective.hdrPath);
        stage.setEnvironmentFromEquirectangular(hdr);
    } catch {
        stage.setEnvironmentFromRoom({ blur: effective.environmentBlur });
    }
}

let subscribed = false;

export function bindLookdevToActiveStage(getAppKey: () => string): () => void {
    if (subscribed) {
        return () => {
            // noop
        };
    }
    subscribed = true;

    let alive = true;

    const apply = () => {
        if (!alive) return;
        const stage = getActiveStage();
        if (!stage) return;
        const key = getAppKey();
        const eff = getLookdevEffective(key);
        void applyLookdevToStage(stage, eff);
    };

    const u1 = subscribeLookdev(apply);
    const u2 = subscribeActiveStage(apply);

    apply();

    return () => {
        alive = false;
        u1();
        u2();
        subscribed = false;
    };
}
