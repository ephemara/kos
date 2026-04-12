import React, { useEffect, useMemo, useState } from 'react';
import { openKainAuthoringSession, kainBridge, type KAINHostKind, type KAINRuntimeApp, type KAINTarget } from '../bridge/KAINBridge';
import {
    describeRuntimeOutputPath,
    getPreferredRuntimeOutput,
    groupRuntimeAppsByHost,
    KAIN_RUNTIME_HOST_LABELS,
    KAIN_RUNTIME_KIND_LABELS,
    listRuntimeTargets,
    matchesRuntimeQuery,
    summarizeRuntimeTargets,
} from './registry';

const HOST_FILTERS: ReadonlyArray<{ value: KAINHostKind | 'all'; label: string }> = [
    { value: 'all', label: 'All Hosts' },
    { value: 'tauri', label: 'Tauri' },
    { value: 'webview', label: 'Webview' },
    { value: 'wasm_runtime', label: 'WASM Runtime' },
    { value: 'hybrid', label: 'Hybrid' },
];

const TARGET_FILTERS: ReadonlyArray<{ value: KAINTarget | 'all'; label: string }> = [
    { value: 'all', label: 'All Targets' },
    { value: 'hybrid', label: 'Hybrid' },
    { value: 'wasm', label: 'WASM' },
    { value: 'ts', label: 'TypeScript' },
    { value: 'js', label: 'JavaScript' },
    { value: 'ks', label: 'KainScript' },
];

export function KAINRuntimeBrowser({ embedded = false }: { embedded?: boolean }) {
    const [apps, setApps] = useState<KAINRuntimeApp[]>(() => kainBridge.listRuntimeApps());
    const [loading, setLoading] = useState(apps.length === 0);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [hostFilter, setHostFilter] = useState<KAINHostKind | 'all'>('all');
    const [targetFilter, setTargetFilter] = useState<KAINTarget | 'all'>('all');
    const [selectedId, setSelectedId] = useState<string | null>(apps[0]?.id ?? null);

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError(null);
        void kainBridge.listRuntimeAppsFromBackend()
            .then((entries) => {
                if (!active) {
                    return;
                }
                setApps(entries);
                setSelectedId((current) => current ?? entries[0]?.id ?? null);
            })
            .catch((err) => {
                if (!active) {
                    return;
                }
                setError(String(err?.message ?? err));
            })
            .finally(() => {
                if (active) {
                    setLoading(false);
                }
            });
        return () => {
            active = false;
        };
    }, []);

    const filteredApps = useMemo(() => {
        return apps.filter((app) => {
            if (hostFilter !== 'all' && app.hostKind !== hostFilter) {
                return false;
            }
            if (targetFilter !== 'all' && !app.outputs.some((output) => output.target === targetFilter)) {
                return false;
            }
            return matchesRuntimeQuery(app, query);
        });
    }, [apps, hostFilter, query, targetFilter]);

    const groupedApps = useMemo(() => groupRuntimeAppsByHost(filteredApps), [filteredApps]);

    const selectedApp = useMemo(() => {
        return filteredApps.find((app) => app.id === selectedId)
            ?? apps.find((app) => app.id === selectedId)
            ?? filteredApps[0]
            ?? apps[0]
            ?? null;
    }, [apps, filteredApps, selectedId]);

    useEffect(() => {
        if (!selectedApp) {
            setSelectedId(null);
            return;
        }
        if (selectedId !== selectedApp.id) {
            setSelectedId(selectedApp.id);
        }
    }, [selectedApp, selectedId]);

    const selectedPreferred = selectedApp ? getPreferredRuntimeOutput(selectedApp) : undefined;

    return (
        <div className={`w-full h-full ${embedded ? '' : 'min-h-[640px]'} bg-[#0b0b10] text-white flex`}>
            <div className="w-[380px] min-w-[320px] border-r border-white/[0.06] flex flex-col bg-[#0d0d12]">
                <div className="px-4 py-3 border-b border-white/[0.06] space-y-3">
                    <div>
                        <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-orange-300/70">KAIN Runtime Registry</p>
                        <p className="text-[11px] text-white/45 mt-1">{filteredApps.length} of {apps.length} apps visible</p>
                    </div>
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search runtime apps, namespaces, outputs..."
                        className="w-full rounded-md border border-white/[0.08] bg-black/20 px-3 py-2 text-[11px] text-white/85 outline-none transition-colors focus:border-orange-500/40"
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <select
                            value={hostFilter}
                            onChange={(event) => setHostFilter(event.target.value as KAINHostKind | 'all')}
                            className="rounded-md border border-white/[0.08] bg-black/20 px-2 py-2 text-[10px] text-white/80 outline-none"
                        >
                            {HOST_FILTERS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                        <select
                            value={targetFilter}
                            onChange={(event) => setTargetFilter(event.target.value as KAINTarget | 'all')}
                            className="rounded-md border border-white/[0.08] bg-black/20 px-2 py-2 text-[10px] text-white/80 outline-none"
                        >
                            {TARGET_FILTERS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading && apps.length === 0 ? (
                        <div className="p-4 text-[11px] text-white/45">Loading runtime registry…</div>
                    ) : filteredApps.length === 0 ? (
                        <div className="p-4 text-[11px] text-white/35">No runtime apps matched the current filters.</div>
                    ) : (
                        groupedApps.map((group) => (
                            <div key={group.hostKind} className="border-b border-white/[0.04] last:border-b-0">
                                <div className="px-4 py-2 sticky top-0 bg-[#0d0d12]/95 backdrop-blur text-[9px] font-mono uppercase tracking-[0.2em] text-white/30">
                                    {KAIN_RUNTIME_HOST_LABELS[group.hostKind]} · {group.apps.length}
                                </div>
                                <div className="p-2 space-y-1.5">
                                    {group.apps.map((app) => {
                                        const preferred = getPreferredRuntimeOutput(app);
                                        const active = selectedApp?.id === app.id;
                                        return (
                                            <button
                                                key={app.id}
                                                onClick={() => setSelectedId(app.id)}
                                                className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${active ? 'border-orange-500/40 bg-orange-500/10' : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12]'}`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-[11px] font-semibold text-white/92 truncate">{app.label}</p>
                                                        <p className="text-[9px] font-mono text-white/40 truncate mt-0.5">{app.namespace}</p>
                                                    </div>
                                                    <span className="text-[8px] font-mono uppercase tracking-[0.18em] text-orange-300/70 whitespace-nowrap">
                                                        {preferred?.target ?? 'N/A'}
                                                    </span>
                                                </div>
                                                <div className="mt-2 flex items-center gap-2 text-[9px] text-white/45">
                                                    <span>{KAIN_RUNTIME_KIND_LABELS[app.runtimeKind]}</span>
                                                    <span>•</span>
                                                    <span>{summarizeRuntimeTargets(app)}</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="flex-1 min-w-0 flex flex-col bg-[#09090d]">
                <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between gap-4">
                    <div className="min-w-0">
                        <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/30">Runtime Details</p>
                        <h2 className="text-[18px] font-semibold text-white/95 truncate mt-1">{selectedApp?.label ?? 'No runtime selected'}</h2>
                        {selectedApp && (
                            <p className="text-[11px] text-white/45 mt-1 truncate">{selectedApp.id} · {selectedApp.namespace}</p>
                        )}
                    </div>
                    {selectedApp && (
                        <button
                            onClick={() => openKainAuthoringSession({
                                path: selectedApp.sourcePath,
                                target: selectedPreferred?.target ?? 'ts',
                                label: selectedApp.label,
                                description: `${KAIN_RUNTIME_KIND_LABELS[selectedApp.runtimeKind]} runtime entry`,
                            })}
                            className="shrink-0 rounded-md border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.16em] text-orange-200/85 hover:bg-orange-500/15 transition-colors"
                        >
                            Open Source
                        </button>
                    )}
                </div>

                {error ? (
                    <div className="mx-5 mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-[11px] text-red-200/80">
                        Failed to load the runtime registry from backend: {error}
                    </div>
                ) : null}

                {!selectedApp ? (
                    <div className="flex-1 flex items-center justify-center text-[12px] text-white/30">Select a runtime app to inspect its outputs.</div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-5 space-y-5">
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                                <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-white/30">Host</p>
                                <p className="text-[14px] font-semibold text-white/90 mt-2">{KAIN_RUNTIME_HOST_LABELS[selectedApp.hostKind]}</p>
                            </div>
                            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                                <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-white/30">Runtime Kind</p>
                                <p className="text-[14px] font-semibold text-white/90 mt-2">{KAIN_RUNTIME_KIND_LABELS[selectedApp.runtimeKind]}</p>
                            </div>
                            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                                <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-white/30">Targets</p>
                                <p className="text-[14px] font-semibold text-white/90 mt-2">{listRuntimeTargets(selectedApp).length}</p>
                                <p className="text-[10px] text-white/45 mt-1">{summarizeRuntimeTargets(selectedApp)}</p>
                            </div>
                        </div>

                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                            <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-white/30">Source</p>
                            <p className="mt-2 text-[12px] font-mono text-white/80 break-all">{selectedApp.sourcePath}</p>
                        </div>

                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between gap-3">
                                <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-white/30">Materialized Outputs</p>
                                <p className="text-[10px] text-white/35">{selectedApp.outputs.length} artifacts</p>
                            </div>
                            <div className="divide-y divide-white/[0.06]">
                                {selectedApp.outputs.map((output) => {
                                    const details = describeRuntimeOutputPath(output.path);
                                    return (
                                        <div key={`${selectedApp.id}:${output.target}:${output.path}`} className="px-4 py-3 flex items-start justify-between gap-4">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="rounded bg-orange-500/10 px-2 py-1 text-[9px] font-mono uppercase tracking-[0.16em] text-orange-200/80">{output.target}</span>
                                                    <span className="text-[11px] text-white/80 font-medium">{details.fileName}</span>
                                                    {details.extension ? (
                                                        <span className="text-[10px] text-white/35">.{details.extension}</span>
                                                    ) : null}
                                                </div>
                                                <p className="mt-2 text-[11px] font-mono text-white/55 break-all">{output.path}</p>
                                                <p className="mt-1 text-[10px] text-white/30">{details.directory}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
