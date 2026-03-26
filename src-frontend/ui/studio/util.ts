export function uiStudioKey(appKey: string, surfaceKey: string): string {
    return `kos-ui-doc:${appKey}:${surfaceKey}`;
}

export function makeNodeId(prefix: string = 'n'): string {
    const g = (globalThis as any);
    if (g?.crypto?.randomUUID) return `${prefix}_${g.crypto.randomUUID()}`;
    return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function clamp(n: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, n));
}

export function moveArrayItem<T>(arr: T[], from: number, to: number): T[] {
    if (from === to) return arr;
    const copy = arr.slice();
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    return copy;
}
