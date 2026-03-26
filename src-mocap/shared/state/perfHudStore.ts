export type PerfHudEntry = {
    at: number;
    cmd: string;
    invoke_ms: number;
    rust_ms?: number;
    payload_bytes?: number;
    response_bytes?: number;
    note?: string;
};

// Use a const array and mutate it in place.
// This prevents creating garbage arrays 60 times a second.
const entries: PerfHudEntry[] = [];
const MAX_ENTRIES = 200;
const listeners = new Set<() => void>();

export function getPerfHudEntries(): PerfHudEntry[] {
    // Return a copy so React detects the change (new reference)
    // But we only pay this cost when the UI actually asks for it.
    return entries.slice();
}

export function clearPerfHudEntries(): void {
    entries.length = 0; // Clear in place (no GC)
    emit();
}

export function pushPerfHudEntry(entry: PerfHudEntry): void {
    // Mutate in place (fastest possible JS operation)
    entries.push(entry);

    // Trim if too big (ring buffer logic)
    if (entries.length > MAX_ENTRIES) {
        entries.shift();
    }

    // Only emit if there are actual listeners (i.e., if the UI is open)
    if (listeners.size > 0) {
        emit();
    }
}

export function subscribePerfHud(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function emit() {
    for (const l of listeners) l();
}
