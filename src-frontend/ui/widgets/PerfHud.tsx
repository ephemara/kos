import React from 'react';
import { X, Trash2 } from 'lucide-react';
import { clearPerfHudEntries, getPerfHudEntries, subscribePerfHud, type PerfHudEntry } from '@/lib/stores/perfHudStore';

function formatBytes(bytes: number | undefined): string {
    if (!bytes || bytes <= 0) return '-';
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
}

function formatMs(ms: number | undefined): string {
    if (ms == null || Number.isNaN(ms)) return '-';
    if (ms < 1) return `${ms.toFixed(3)}ms`;
    if (ms < 10) return `${ms.toFixed(2)}ms`;
    return `${ms.toFixed(1)}ms`;
}

export function PerfHud({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const [entries, setEntries] = React.useState<PerfHudEntry[]>([]);

    React.useEffect(() => {
        // THE FIX: If closed, do nothing.
        // No listeners. No updates. No React overhead.
        if (!open) return;

        // 1. Load initial data when opening
        setEntries(getPerfHudEntries());

        // 2. Subscribe only while open
        const unsubscribe = subscribePerfHud(() => {
            // This reads the store (slice) only when necessary
            setEntries(getPerfHudEntries());
        });

        // 3. Cleanup: unsubscribe when closed
        return unsubscribe;
    }, [open]); // Re-run when 'open' toggles

    if (!open) return null;

    const last = entries[entries.length - 1];

    return (
        <div className="pointer-events-none fixed top-16 right-4 z-[190] w-[520px]">
            <div className="pointer-events-auto rounded-xl border border-white/10 bg-black/70 backdrop-blur-xl shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                    <div className="min-w-0">
                        <div className="text-[11px] font-black tracking-widest text-white/80">PERF HUD</div>
                        <div className="text-[10px] font-mono text-white/40 truncate">
                            {last ? `${last.cmd}  |  invoke ${formatMs(last.invoke_ms)}  |  rust ${formatMs(last.rust_ms)}` : 'No entries yet'}
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            className="h-7 px-2 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-[10px] text-white/70"
                            onClick={() => clearPerfHudEntries()}
                            title="Clear"
                        >
                            <Trash2 size={14} className="inline-block mr-1" />
                            Clear
                        </button>
                        <button
                            className="h-7 w-7 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 flex items-center justify-center"
                            onClick={() => onOpenChange(false)}
                            aria-label="Close"
                            title="Close (F8)"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>

                <div className="max-h-[320px] overflow-auto">
                    <table className="w-full text-[10px] font-mono">
                        <thead className="sticky top-0 bg-black/60 backdrop-blur">
                            <tr className="text-white/40 border-b border-white/5">
                                <th className="text-left font-bold px-3 py-2">t</th>
                                <th className="text-left font-bold px-3 py-2">cmd</th>
                                <th className="text-right font-bold px-3 py-2">payload</th>
                                <th className="text-right font-bold px-3 py-2">invoke</th>
                                <th className="text-right font-bold px-3 py-2">rust</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries
                                .slice()
                                .reverse()
                                .slice(0, 60)
                                .map((e, idx) => (
                                    <tr key={`${e.at}-${idx}`} className="border-b border-white/5 text-white/70 hover:bg-white/5">
                                        <td className="px-3 py-1.5 text-white/30">{new Date(e.at).toLocaleTimeString()}</td>
                                        <td className="px-3 py-1.5">
                                            <div className="truncate max-w-[220px]">{e.cmd}</div>
                                            {e.note ? <div className="text-white/30 truncate max-w-[220px]">{e.note}</div> : null}
                                        </td>
                                        <td className="px-3 py-1.5 text-right">{formatBytes(e.payload_bytes)}</td>
                                        <td className="px-3 py-1.5 text-right">{formatMs(e.invoke_ms)}</td>
                                        <td className="px-3 py-1.5 text-right">{formatMs(e.rust_ms)}</td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>

                <div className="px-3 py-2 border-t border-white/10 text-[10px] text-white/30 font-mono flex items-center justify-between">
                    <span>F8 toggle</span>
                    <span>{entries.length} events</span>
                </div>
            </div>
        </div>
    );
}
