/**
 * ExtensionManager.tsx — K-OS Plugin / Extension Manager UI
 *
 * VS Code-style extension management:
 *   - List all installed extensions with status badges
 *   - Enable / disable individual extensions live
 *   - View manifests, contribution counts, error states
 *   - Install from JSON manifest (runtime loading)
 *   - Uninstall extensions
 *   - Browse contribution categories (commands, panels, themes, shaders)
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Puzzle, CheckCircle, AlertCircle, XCircle, Pause, Play,
    ChevronDown, ChevronRight, X, Upload, Trash2, Terminal,
    Sliders, Palette, Zap, Layout, Type, Search, RefreshCw,
    Info, Package,
} from 'lucide-react';

import { kosRegistry } from '@/systems/ui-engine/extensionRegistry';
import type { RuntimeExtension, ExtensionManifest } from '@/systems/ui-engine/extensionApi';

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES = {
    active: { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30', icon: CheckCircle },
    inactive: { color: 'text-white/30', bg: 'bg-white/[0.04]', border: 'border-white/[0.08]', icon: Pause },
    activating: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', icon: RefreshCw },
    error: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', icon: XCircle },
    disabled: { color: 'text-white/20', bg: 'bg-white/[0.02]', border: 'border-white/[0.05]', icon: Pause },
};

function StatusBadge({ status }: { status: RuntimeExtension['status'] }) {
    const style = STATUS_STYLES[status] ?? STATUS_STYLES.inactive;
    const Icon = style.icon;
    return (
        <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[7px] font-mono
                          border ${style.color} ${style.bg} ${style.border}`}>
            <Icon size={8} className={status === 'activating' ? 'animate-spin' : ''} />
            {status}
        </span>
    );
}

// ─── Contribution summary ─────────────────────────────────────────────────────

const CONTRIBUTION_ICONS: Record<string, React.FC<any>> = {
    commands: Terminal, panels: Layout, themes: Palette, shaders: Zap,
    menus: SlidersFallback, tokens: Type, fonts: Type,
};
function SlidersFallback(p: any) { return <Sliders {...p} />; }

function ContribBadge({ label, count, icon: Icon }: { label: string; count: number; icon: React.FC<any> }) {
    if (count === 0) return null;
    return (
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.04]
                         border border-white/[0.06] text-[7px] font-mono text-white/40">
            <Icon size={8} />
            {count} {label}
        </div>
    );
}

// ─── Extension card ───────────────────────────────────────────────────────────

function ExtensionCard({ ext, onToggle, onUninstall }: {
    ext: RuntimeExtension;
    onToggle: (id: string) => void;
    onUninstall: (id: string) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const { manifest: m, status, error, runtime } = ext;

    const counts = {
        commands: runtime.commands.length,
        panels: runtime.panels.length,
        themes: runtime.themes.length,
        shaders: runtime.shaders.length,
    };

    const enabled = kosRegistry.isEnabled(m.id);

    return (
        <motion.div
            layout
            className={`rounded-xl border overflow-hidden transition-all ${status === 'active'
                ? 'border-white/[0.08] bg-white/[0.02]'
                : status === 'error'
                    ? 'border-red-500/20 bg-red-500/[0.03]'
                    : 'border-white/[0.04] bg-white/[0.01]'
                }`}
        >
            {/* Header */}
            <div className="flex items-start gap-3 p-3">
                {/* Icon */}
                <div className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.08]
                                flex items-center justify-center flex-shrink-0 text-lg">
                    {m.icon || '🔌'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono text-white/80">{m.name}</span>
                        <span className="text-[7px] font-mono text-white/25">v{m.version}</span>
                        <StatusBadge status={status} />
                    </div>
                    <p className="text-[8px] text-white/35 mt-0.5 leading-relaxed truncate">{m.description}</p>
                    {m.author && <p className="text-[7px] text-white/20 mt-0.5">by {m.author}</p>}

                    {/* Contribution badges */}
                    {status === 'active' && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                            {Object.entries(counts).map(([k, v]) => {
                                const Icon = CONTRIBUTION_ICONS[k] ?? Puzzle;
                                return <ContribBadge key={k} label={k} count={v} icon={Icon} />;
                            })}
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <p className="text-[8px] text-red-400 mt-1 bg-red-500/10 rounded px-1.5 py-0.5 border border-red-500/20">
                            ⚠ {error}
                        </p>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                        onClick={() => onToggle(m.id)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-mono border transition-all ${enabled
                            ? 'bg-white/[0.04] border-white/[0.08] text-white/50 hover:bg-white/[0.08]'
                            : 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
                            }`}
                    >
                        {enabled ? <><Pause size={8} /> Disable</> : <><Play size={8} /> Enable</>}
                    </button>
                    <button
                        onClick={() => setExpanded(v => !v)}
                        className="p-1 text-white/25 hover:text-white/55 transition-colors"
                    >
                        <ChevronDown size={11} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                    <button
                        onClick={() => onUninstall(m.id)}
                        className="p-1 text-white/20 hover:text-red-400 transition-colors"
                    >
                        <Trash2 size={11} />
                    </button>
                </div>
            </div>

            {/* Expanded detail */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden border-t border-white/[0.05]"
                    >
                        <div className="p-3 space-y-2">
                            <div className="grid grid-cols-2 gap-3 text-[8px] font-mono text-white/40">
                                <span>ID: <span className="text-white/60">{m.id}</span></span>
                                {m.minKosVersion && <span>Requires: <span className="text-white/60">K-OS {m.minKosVersion}+</span></span>}
                                {m.tags && <span className="col-span-2">Tags: {m.tags.join(', ')}</span>}
                            </div>

                            {/* Commands list */}
                            {runtime.commands.length > 0 && (
                                <div>
                                    <p className="text-[7px] text-white/30 uppercase tracking-wider mb-1">Commands</p>
                                    <div className="space-y-0.5">
                                        {runtime.commands.map(c => (
                                            <div key={c.id} className="flex items-center gap-2">
                                                <Terminal size={8} className="text-white/20" />
                                                <span className="text-[8px] font-mono text-white/50">{c.label}</span>
                                                {c.shortcut && <kbd className="text-[7px] px-1 py-0.5 rounded bg-white/[0.06] border border-white/[0.08]">{c.shortcut}</kbd>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Shaders list */}
                            {runtime.shaders.length > 0 && (
                                <div>
                                    <p className="text-[7px] text-white/30 uppercase tracking-wider mb-1">Shaders</p>
                                    {runtime.shaders.map(s => (
                                        <p key={s.id} className="text-[8px] font-mono text-white/40">
                                            <Zap size={8} className="inline mr-1" />{s.label} → {s.target}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ─── Install from manifest ────────────────────────────────────────────────────

function InstallPanel({ onInstall }: { onInstall: (manifest: ExtensionManifest) => void }) {
    const [json, setJson] = useState('');
    const [error, setError] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);

    const tryInstall = useCallback(() => {
        try {
            const manifest = JSON.parse(json) as ExtensionManifest;
            if (!manifest.id || !manifest.name) throw new Error('Missing id or name');
            onInstall(manifest);
            setJson('');
            setError('');
        } catch (e: any) {
            setError(String(e?.message ?? 'Invalid manifest'));
        }
    }, [json, onInstall]);

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const r = new FileReader();
        r.onload = ev => setJson(ev.target?.result as string);
        r.readAsText(file);
    };

    return (
        <div className="space-y-2">
            <p className="text-[8px] text-white/40">
                Paste a K-OS extension manifest JSON or load from file:
            </p>
            <textarea
                className="w-full h-28 bg-black/40 border border-white/[0.08] rounded-lg p-2
                           text-[8px] font-mono text-white/60 placeholder-white/20 outline-none
                           focus:border-orange-500/40 resize-none"
                placeholder='{ "id": "my-ext", "name": "My Extension", "version": "1.0.0", ... }'
                value={json}
                onChange={e => setJson(e.target.value)}
            />
            {error && (
                <p className="text-[8px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">{error}</p>
            )}
            <div className="flex gap-2">
                <button
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-mono
                               bg-white/[0.04] border border-white/[0.08] text-white/50 hover:text-white/70"
                >
                    <Upload size={9} /> Load file
                </button>
                <input ref={fileRef} type="file" accept=".json" onChange={handleFile} className="hidden" />
                <button
                    onClick={tryInstall}
                    disabled={!json.trim()}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-mono
                               bg-orange-500/20 border border-orange-500/30 text-orange-300
                               hover:bg-orange-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                    <Puzzle size={9} /> Install
                </button>
            </div>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface ExtensionManagerProps {
    onClose?: () => void;
    embedded?: boolean;
}

export function ExtensionManager({ onClose, embedded = false }: ExtensionManagerProps) {
    const [search, setSearch] = useState('');
    const [installing, setInstalling] = useState(false);
    const [, forceRender] = useState(0);
    const refresh = () => forceRender(n => n + 1);

    const extensions = useMemo(() =>
        kosRegistry.listExtensions().filter(e =>
            search === '' ||
            e.manifest.name.toLowerCase().includes(search.toLowerCase()) ||
            e.manifest.id.toLowerCase().includes(search.toLowerCase())
        )
        , [search, kosRegistry.listExtensions().length]);

    const handleToggle = useCallback((id: string) => {
        const enabled = kosRegistry.isEnabled(id);
        kosRegistry.setEnabled(id, !enabled);
        refresh();
    }, []);

    const handleUninstall = useCallback((id: string) => {
        kosRegistry.deactivateExtension(id);
        refresh();
    }, []);

    const handleInstall = useCallback((manifest: ExtensionManifest) => {
        // Register a stub module; real loading would dynamic-import the extension JS
        kosRegistry.registerExtension({ manifest, activate: undefined, deactivate: undefined });
        setInstalling(false);
        refresh();
    }, []);

    const wrapperCls = embedded
        ? 'flex flex-col w-full h-full bg-[#090910] border border-white/[0.06] rounded-xl overflow-hidden'
        : 'flex flex-col w-[380px] max-h-[80vh] bg-[#090910] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden';

    return (
        <div className={wrapperCls}>
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.06] shrink-0">
                <Puzzle size={14} className="text-orange-400" />
                <span className="text-[10px] font-mono text-white/80 tracking-widest uppercase flex-1">
                    Extensions
                </span>
                <span className="text-[8px] text-white/25">
                    {extensions.length} installed
                </span>
                {!embedded && onClose && (
                    <button onClick={onClose} className="p-1 text-white/30 hover:text-white/60 ml-1">
                        <X size={12} />
                    </button>
                )}
            </div>

            {/* Search + actions */}
            <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-white/[0.04] shrink-0">
                <div className="flex items-center gap-1.5 flex-1 bg-white/[0.03] border border-white/[0.06]
                                rounded-lg px-2 py-1">
                    <Search size={9} className="text-white/30 flex-shrink-0" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="flex-1 bg-transparent text-[9px] font-mono text-white/60
                                   placeholder-white/20 outline-none"
                        placeholder="Search extensions..."
                    />
                </div>
                <button
                    onClick={() => setInstalling(v => !v)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-mono border transition-all ${installing
                        ? 'bg-orange-500/20 border-orange-500/40 text-orange-300'
                        : 'bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white/70'
                        }`}
                >
                    <Upload size={9} /> Install
                </button>
            </div>

            {/* Install panel */}
            <AnimatePresence>
                {installing && (
                    <motion.div
                        initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                        className="overflow-hidden border-b border-white/[0.06]"
                    >
                        <div className="p-3">
                            <InstallPanel onInstall={handleInstall} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Extensions list */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
                {extensions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 gap-3">
                        <Package size={24} className="text-white/10" />
                        <div className="text-center">
                            <p className="text-[9px] font-mono text-white/30">No extensions installed</p>
                            <p className="text-[8px] text-white/15 mt-1">Click Install to add your first plugin</p>
                        </div>
                    </div>
                ) : (
                    extensions.map(ext => (
                        <ExtensionCard
                            key={ext.manifest.id}
                            ext={ext}
                            onToggle={handleToggle}
                            onUninstall={handleUninstall}
                        />
                    ))
                )}
            </div>

            {/* Footer info */}
            <div className="px-3 py-2 border-t border-white/[0.04] shrink-0">
                <p className="text-[7px] font-mono text-white/20">
                    Extensions run in the same context. Review manifests before installing.
                </p>
            </div>
        </div>
    );
}

export default ExtensionManager;
