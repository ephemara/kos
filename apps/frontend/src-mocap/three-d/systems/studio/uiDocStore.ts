import type { UiDoc } from './types';
import { uiStudioKey } from './util';

const docs = new Map<string, UiDoc>();
const listenersByKey = new Map<string, Set<() => void>>();

function emit(key: string) {
    const ls = listenersByKey.get(key);
    if (!ls) return;
    for (const l of ls) l();
}

export function getUiDoc(appKey: string, surfaceKey: string): UiDoc | null {
    const key = uiStudioKey(appKey, surfaceKey);
    return docs.get(key) ?? null;
}

export function ensureUiDocLoaded(appKey: string, surfaceKey: string, fallback: UiDoc): UiDoc {
    const key = uiStudioKey(appKey, surfaceKey);
    const cached = docs.get(key);
    if (cached) return cached;

    try {
        const raw = localStorage.getItem(key);
        if (raw) {
            const parsed = JSON.parse(raw) as UiDoc;
            if (parsed && (parsed as any).version === 1 && (parsed as any).root) {
                docs.set(key, parsed);
                return parsed;
            }
        }
    } catch {
        // ignore
    }

    docs.set(key, fallback);
    return fallback;
}

export function setUiDoc(appKey: string, surfaceKey: string, doc: UiDoc): void {
    const key = uiStudioKey(appKey, surfaceKey);
    docs.set(key, doc);
    try {
        localStorage.setItem(key, JSON.stringify(doc));
    } catch {
        // ignore
    }
    emit(key);
}

export function resetUiDoc(appKey: string, surfaceKey: string, fallback: UiDoc): void {
    const key = uiStudioKey(appKey, surfaceKey);
    docs.set(key, fallback);
    try {
        localStorage.removeItem(key);
    } catch {
        // ignore
    }
    emit(key);
}

export function subscribeUiDoc(appKey: string, surfaceKey: string, listener: () => void): () => void {
    const key = uiStudioKey(appKey, surfaceKey);
    let ls = listenersByKey.get(key);
    if (!ls) {
        ls = new Set();
        listenersByKey.set(key, ls);
    }
    ls.add(listener);
    return () => {
        ls?.delete(listener);
    };
}
