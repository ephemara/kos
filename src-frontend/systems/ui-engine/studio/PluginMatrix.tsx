/**
 * PluginMatrix.tsx — K-OS Hyperdrive Plugin Matrix
 *
 * ═══════════════════════════════════════════════════════════════════════
 * THE CONTROL CENTER FOR THE ENTIRE EXTENSION ECOSYSTEM.
 *
 * Inspired by:
 *   - UE5 Plugin Browser (module dependency graph)
 *   - VS Code Extensions (live enable/disable, manifest view)
 *   - Ableton Live (signal routing — visualized connections)
 *   - A film-noir command deck aesthetic
 *
 * Features:
 *   - Animated connection graph: plugins → hooks → apps
 *   - Live hook watcher: see every hook firing in real time
 *   - Per-plugin deep dive: slots used, hooks registered, permissions
 *   - Drag-to-reorder priority within slots
 *   - Install from URL / JSON manifest
 *   - Plugin Store tab with curated extensions
 *   - Permission request flow (user consent for high-risk access)
 *   - Plugin health monitor (error count, last error)
 *   - "Kill switch": disable any plugin instantly
 * ═══════════════════════════════════════════════════════════════════════
 */

import React, {
    useState, useEffect, useCallback, useRef, useMemo, memo,
} from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import {
    Puzzle, Zap, Activity, Cpu, Layers, Code2, Shield, ShieldAlert,
    ShieldCheck, ChevronDown, ChevronRight, X, Upload, Trash2,
    Terminal, Search, Package, Power, ToggleLeft, ToggleRight,
    AlertTriangle, CheckCircle, Clock, Wifi, WifiOff, Radio,
    Eye, Layout, Palette, ArrowRight, Plug, Cable, Globe,
    BarChart2, Loader2, Star, Download, ExternalLink,
    Hash, Database, Sliders, GitBranch, BookOpen, Sparkles,
} from 'lucide-react';

import { kosRegistry } from '@/systems/ui-engine/extensionRegistry';
import type { RuntimeExtension } from '@/systems/ui-engine/extensionApi';
import { hookBus, KOS_HOOK_REGISTRY, type HookDefinition } from '@/systems/ui-engine/hooks/HookBus';
import {
    slotRegistry, KOS_SLOT_DEFINITIONS, type SlotDefinition,
} from '@/systems/ui-engine/slots/SlotSystem';
import {
    appApiRegistry, APP_CATALOGUE, type AppMetadata,
} from '@/systems/ui-engine/appApi/AppApiRegistry';

// ─── Matrix view types ────────────────────────────────────────────────────────

type MatrixView = 'graph' | 'list' | 'hooks' | 'slots' | 'store' | 'permissions';

// ─── Live hook activity log ────────────────────────────────────────────────────

interface HookEvent {
    id: number;
    hook: string;
    owner?: string;
    ts: number;
    cancelled: boolean;
}

const MAX_HOOK_LOG = 80;
let eventIdCounter = 0;

function useHookActivityLog() {
    const [log, setLog] = useState<HookEvent[]>([]);

    useEffect(() => {
        // Intercept ALL hooks by monkey-patching the bus call
        // We wrap the original call to observe without interfering
        const orig = hookBus.call.bind(hookBus);
        (hookBus as any).call = async function <T>(hook: string, data: T, meta = {}) {
            const ctx = await orig(hook, data, meta);
            const event: HookEvent = {
                id: ++eventIdCounter, hook, ts: Date.now(), cancelled: ctx.cancelled,
            };
            setLog(prev => [event, ...prev].slice(0, MAX_HOOK_LOG));
            return ctx;
        };
        return () => { (hookBus as any).call = orig; };
    }, []);

    return log;
}

// ─── Animated connection line SVG ─────────────────────────────────────────────

const ConnectionLine = memo(({ fromX, fromY, toX, toY, active, color }: {
    fromX: number; fromY: number; toX: number; toY: number;
    active: boolean; color?: string;
}) => {
    const mx = fromX + (toX - fromX) * 0.5;
    const d = `M ${fromX} ${fromY} C ${mx} ${fromY} ${mx} ${toY} ${toX} ${toY}`;
    return (
        <g>
            <path d={d} fill="none" stroke={active ? (color ?? '#f97316') : '#ffffff08'}
                strokeWidth={active ? 1.5 : 0.5} strokeDasharray={active ? '0' : '4 4'}
                opacity={active ? 0.8 : 0.3} />
            {active && (
                <path d={d} fill="none" stroke={color ?? '#f97316'}
                    strokeWidth={3} opacity={0.15} filter="url(#glow)" />
            )}
        </g>
    );
});

// ─── Status dot ───────────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
    active: '#22c55e',
    inactive: '#64748b',
    error: '#ef4444',
    activating: '#f59e0b',
    disabled: '#334155',
};

function StatusDot({ status }: { status: string }) {
    const color = statusColors[status] ?? '#64748b';
    return (
        <span className="relative flex h-2 w-2">
            {status === 'active' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-40"
                    style={{ background: color }} />
            )}
            <span className="relative inline-flex rounded-full h-2 w-2"
                style={{ background: color }} />
        </span>
    );
}

// ─── Risk badge ───────────────────────────────────────────────────────────────

function RiskBadge({ risk }: { risk: 'low' | 'medium' | 'high' }) {
    const cfg = {
        low: { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', icon: ShieldCheck },
        medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', icon: Shield },
        high: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: ShieldAlert },
    }[risk];
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[7px] font-mono
                          border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
            <Icon size={8} /> {risk}
        </span>
    );
}

// ─── Graph view ───────────────────────────────────────────────────────────────

function GraphView({ extensions }: { extensions: RuntimeExtension[] }) {
    const svgRef = useRef<SVGSVGElement>(null);
    const [dims, setDims] = useState({ w: 800, h: 500 });

    useEffect(() => {
        const obs = new ResizeObserver(e => {
            setDims({ w: e[0].contentRect.width, h: e[0].contentRect.height });
        });
        if (svgRef.current?.parentElement) obs.observe(svgRef.current.parentElement);
        return () => obs.disconnect();
    }, []);

    const mountedApps = appApiRegistry.mountedApps();

    // Layout: plugins on left, apps on right
    const pluginNodes = extensions.slice(0, 12).map((ext, i) => ({
        id: ext.manifest.id,
        label: ext.manifest.name,
        x: 60,
        y: (dims.h / (extensions.length + 1)) * (i + 1),
        status: ext.status,
        active: ext.status === 'active',
    }));

    const appNodes = APP_CATALOGUE.map((app, i) => ({
        id: app.id,
        label: app.label,
        icon: app.icon,
        x: dims.w - 80,
        y: (dims.h / (APP_CATALOGUE.length + 1)) * (i + 1),
        mounted: mountedApps.includes(app.id),
    }));

    // Hook bus node (center)
    const busX = dims.w * 0.5;
    const busY = dims.h * 0.5;

    return (
        <div className="relative w-full h-full min-h-[360px]">
            <svg ref={svgRef} width="100%" height="100%" className="absolute inset-0">
                <defs>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="2" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                </defs>

                {/* Plugin → HookBus lines */}
                {pluginNodes.map(p => (
                    <ConnectionLine key={`p-${p.id}`}
                        fromX={p.x + 80} fromY={p.y}
                        toX={busX - 40} toY={busY}
                        active={p.active} color="#f97316" />
                ))}

                {/* HookBus → App lines */}
                {appNodes.map(a => (
                    <ConnectionLine key={`a-${a.id}`}
                        fromX={busX + 40} fromY={busY}
                        toX={a.x - 80} toY={a.y}
                        active={a.mounted} color="#22d3ee" />
                ))}

                {/* HookBus node */}
                <g transform={`translate(${busX},${busY})`}>
                    <circle r={38} fill="#0a0a10" stroke="#f97316" strokeWidth={0.8} opacity={0.6} />
                    <circle r={32} fill="none" stroke="#f97316" strokeWidth={0.4} strokeDasharray="3 3" opacity={0.4}>
                        <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="20s" repeatCount="indefinite" />
                    </circle>
                    <text textAnchor="middle" y={-6} className="fill-orange-400 font-mono text-[8px]" fontSize={8}>HOOK</text>
                    <text textAnchor="middle" y={6} className="fill-orange-400 font-mono text-[8px]" fontSize={8}>BUS</text>
                    <text textAnchor="middle" y={18} fill="#f97316" fontSize={7} opacity={0.5}>
                        {hookBus.size} handlers
                    </text>
                </g>

                {/* Plugin nodes */}
                {pluginNodes.map(p => (
                    <g key={p.id} transform={`translate(${p.x},${p.y})`}>
                        <rect x={-60} y={-12} width={120} height={24} rx={4}
                            fill="#090910" stroke={p.active ? '#f97316' : '#ffffff12'} strokeWidth={0.8} />
                        <circle cx={-48} cy={0} r={3} fill={statusColors[p.status] ?? '#64748b'} />
                        <text x={-40} textAnchor="start" y={4} fill={p.active ? '#e2e2e2' : '#666'}
                            fontSize={7} fontFamily="monospace">
                            {p.label.slice(0, 14)}
                        </text>
                    </g>
                ))}

                {/* App nodes */}
                {appNodes.map(a => (
                    <g key={a.id} transform={`translate(${a.x},${a.y})`}>
                        <rect x={-70} y={-14} width={140} height={28} rx={4}
                            fill="#090910" stroke={a.mounted ? '#22d3ee' : '#ffffff12'} strokeWidth={0.8} />
                        <text x={-58} y={5} fontSize={12}>{a.icon}</text>
                        <text x={-40} textAnchor="start" y={4} fill={a.mounted ? '#22d3ee' : '#666'}
                            fontSize={7} fontFamily="monospace">
                            {a.label}
                        </text>
                        {a.mounted && (
                            <circle cx={52} cy={0} r={3} fill="#22c55e">
                                <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" />
                            </circle>
                        )}
                    </g>
                ))}
            </svg>

            {extensions.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-[9px] font-mono text-white/20">No extensions installed. Install a plugin to see the connection graph.</p>
                </div>
            )}
        </div>
    );
}

// ─── Hook Monitor ─────────────────────────────────────────────────────────────

function HooksView({ hookLog }: { hookLog: HookEvent[] }) {
    const [filterArea, setFilterArea] = useState('all');
    const [search, setSearch] = useState('');

    const areas = useMemo(() => ['all', ...new Set(KOS_HOOK_REGISTRY.map(h => h.area))], []);

    const filteredDefs = KOS_HOOK_REGISTRY.filter(h =>
        (filterArea === 'all' || h.area === filterArea) &&
        (search === '' || h.hook.includes(search) || h.description.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div className="flex flex-col h-full">
            {/* Filter bar */}
            <div className="flex items-center gap-2 p-2 border-b border-white/[0.05] shrink-0">
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search hooks..."
                    className="flex-1 text-[9px] font-mono bg-white/[0.03] border border-white/[0.06]
                               rounded px-2 py-1 text-white/60 placeholder-white/20 outline-none"
                />
                <div className="flex gap-1">
                    {areas.map(a => (
                        <button
                            key={a}
                            onClick={() => setFilterArea(a)}
                            className={`px-2 py-0.5 rounded text-[8px] font-mono transition-colors ${filterArea === a
                                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                                    : 'text-white/30 hover:text-white/55'
                                }`}
                        >
                            {a}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Hook definitions */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {filteredDefs.map(def => {
                        const handlers = hookBus.listHandlers(def.hook);
                        const recentEvent = hookLog.find(e => e.hook === def.hook);
                        return (
                            <div key={def.hook}
                                className="flex items-start gap-2 px-3 py-2 border-b border-white/[0.03]
                                            hover:bg-white/[0.02] transition-colors group">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <code className="text-[8px] text-orange-300/80">{def.hook}</code>
                                        <span className={`text-[7px] px-1 py-0.5 rounded font-mono border ${def.timing === 'before' ? 'text-yellow-400 border-yellow-500/20 bg-yellow-500/10' :
                                                def.timing === 'after' ? 'text-green-400  border-green-500/20  bg-green-500/10' :
                                                    def.timing === 'filter' ? 'text-cyan-400   border-cyan-500/20   bg-cyan-500/10' :
                                                        'text-purple-400 border-purple-500/20 bg-purple-500/10'
                                            }`}>
                                            {def.timing}
                                        </span>
                                        {def.cancellable && (
                                            <span className="text-[7px] font-mono text-red-400 border border-red-500/20 bg-red-500/10 px-1 py-0.5 rounded">
                                                cancellable
                                            </span>
                                        )}
                                        {recentEvent && (
                                            <span className="text-[7px] font-mono text-white/30 animate-fade">
                                                {recentEvent.cancelled ? '⛔ cancelled' : '✓ fired'}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[8px] text-white/35 mt-0.5">{def.description}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                    <span className="text-[8px] font-mono text-white/25">
                                        {handlers.length} handler{handlers.length !== 1 ? 's' : ''}
                                    </span>
                                    {handlers.length > 0 && (
                                        <div className="flex gap-0.5">
                                            {handlers.slice(0, 4).map(h => (
                                                <span key={h.id} className="text-[6px] font-mono text-orange-400/60
                                                       bg-orange-500/10 border border-orange-500/20 px-1 py-0.5 rounded">
                                                    {h.owner.slice(0, 8)}
                                                </span>
                                            ))}
                                            {handlers.length > 4 && (
                                                <span className="text-[6px] font-mono text-white/20">+{handlers.length - 4}</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Live event log */}
                <div className="w-[200px] border-l border-white/[0.05] flex flex-col shrink-0">
                    <div className="px-2 py-1 border-b border-white/[0.05] flex items-center gap-1.5">
                        <Radio size={8} className="text-orange-400 animate-pulse" />
                        <span className="text-[8px] font-mono text-white/40">LIVE</span>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {hookLog.slice(0, 30).map(event => (
                            <div key={event.id}
                                className="flex items-start gap-1 px-2 py-1 border-b border-white/[0.03]">
                                <span className={`mt-0.5 text-[8px] ${event.cancelled ? 'text-red-400' : 'text-green-400'}`}>
                                    {event.cancelled ? '⛔' : '→'}
                                </span>
                                <div className="min-w-0">
                                    <p className="text-[7px] font-mono text-orange-300/60 truncate">{event.hook}</p>
                                    <p className="text-[6px] text-white/20">{new Date(event.ts).toLocaleTimeString()}</p>
                                </div>
                            </div>
                        ))}
                        {hookLog.length === 0 && (
                            <p className="text-[7px] text-white/20 text-center p-4">No hooks fired yet</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Slot View ────────────────────────────────────────────────────────────────

function SlotsView() {
    const [filterApp, setFilterApp] = useState('all');

    const apps = useMemo(() => ['all', ...new Set(KOS_SLOT_DEFINITIONS.map(s => s.app))], []);

    const filteredSlots = KOS_SLOT_DEFINITIONS.filter(s =>
        filterApp === 'all' || s.app === filterApp
    );

    const occupiedIds = new Set(slotRegistry.getOccupiedSlots());

    return (
        <div className="flex flex-col h-full">
            <div className="flex gap-1 p-2 border-b border-white/[0.05] flex-wrap shrink-0">
                {apps.map(a => (
                    <button
                        key={a}
                        onClick={() => setFilterApp(a)}
                        className={`px-2 py-0.5 rounded text-[8px] font-mono transition-colors ${filterApp === a
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                : 'text-white/30 hover:text-white/55'
                            }`}
                    >
                        {a}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-0.5">
                {filteredSlots.map(slot => {
                    const components = slotRegistry.getComponents(slot.id);
                    const occupied = occupiedIds.has(slot.id);
                    return (
                        <div key={slot.id}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${occupied
                                    ? 'border-cyan-500/20 bg-cyan-500/[0.04]'
                                    : 'border-white/[0.04] bg-white/[0.01]'
                                }`}>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <code className="text-[8px] font-mono text-cyan-400/70">{slot.id}</code>
                                    <span className="text-[7px] text-white/25 uppercase font-mono">{slot.layout}</span>
                                </div>
                                <p className="text-[7px] text-white/30 mt-0.5">{slot.description}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                {occupied ? (
                                    <div>
                                        {components.map(c => (
                                            <span key={c.id}
                                                className="text-[7px] font-mono text-cyan-400 bg-cyan-500/10
                                                             border border-cyan-500/20 px-1 py-0.5 rounded ml-0.5">
                                                {c.owner}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-[7px] font-mono text-white/15">empty</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Permissions tab ──────────────────────────────────────────────────────────

function PermissionsView({ extensions }: { extensions: RuntimeExtension[] }) {
    return (
        <div className="flex flex-col h-full overflow-y-auto custom-scrollbar p-3 space-y-4">
            {APP_CATALOGUE.map(app => (
                <div key={app.id} className="border border-white/[0.06] rounded-xl overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.02]">
                        <span className="text-base">{app.icon}</span>
                        <div>
                            <p className="text-[9px] font-mono text-white/70">{app.label}</p>
                            <p className="text-[7px] text-white/30">{app.description}</p>
                        </div>
                        <div className="ml-auto flex items-center gap-1">
                            <span className={`text-[7px] font-mono px-1 py-0.5 rounded border ${appApiRegistry.mountedApps().includes(app.id)
                                    ? 'text-green-400 border-green-500/20 bg-green-500/10'
                                    : 'text-white/25 border-white/[0.08]'
                                }`}>
                                {appApiRegistry.mountedApps().includes(app.id) ? 'ONLINE' : 'OFFLINE'}
                            </span>
                        </div>
                    </div>
                    <div className="divide-y divide-white/[0.03]">
                        {app.permissions.map(perm => {
                            const requestingPlugins = extensions.filter(e =>
                                e.manifest.permissions?.includes(perm.id)
                            );
                            return (
                                <div key={perm.id} className="flex items-start gap-3 px-3 py-2">
                                    <RiskBadge risk={perm.risk} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[8px] font-mono text-white/60">{perm.label}</p>
                                        <p className="text-[7px] text-white/30 mt-0.5">{perm.description}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                                        {requestingPlugins.length > 0 ? (
                                            requestingPlugins.map(p => (
                                                <span key={p.manifest.id}
                                                    className="text-[7px] font-mono text-orange-400 bg-orange-500/10
                                                                 border border-orange-500/20 px-1 py-0.5 rounded">
                                                    {p.manifest.name.slice(0, 10)}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-[7px] font-mono text-white/15">none</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="px-3 py-1.5 bg-white/[0.01] border-t border-white/[0.04]">
                        <p className="text-[7px] font-mono text-white/20">
                            API: {app.apiKeys.join(' · ')}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── List view (extensions) ───────────────────────────────────────────────────

function ExtCard({ ext, onToggle, onUninstall }: {
    ext: RuntimeExtension;
    onToggle: (id: string) => void;
    onUninstall: (id: string) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const enabled = kosRegistry.isEnabled(ext.manifest.id);
    const hooks = hookBus.listByOwner(ext.manifest.id);
    const slots = slotRegistry.listByOwner(ext.manifest.id);

    return (
        <motion.div layout
            className={`rounded-xl border overflow-hidden transition-colors ${ext.status === 'active' ? 'border-white/[0.08] bg-[#0a0a12]'
                    : ext.status === 'error' ? 'border-red-500/20 bg-red-900/5'
                        : 'border-white/[0.04] bg-[#08080f]'
                }`}>
            <div className="flex items-center gap-3 p-3">
                {/* Icon + status */}
                <div className="relative flex-shrink-0">
                    <div className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/[0.08]
                                    flex items-center justify-center text-xl">
                        {ext.manifest.icon ?? '🔌'}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5">
                        <StatusDot status={ext.status} />
                    </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono text-white/80">{ext.manifest.name}</span>
                        <span className="text-[7px] font-mono text-white/25 bg-white/[0.04] px-1 py-0.5 rounded">
                            v{ext.manifest.version}
                        </span>
                    </div>
                    <p className="text-[8px] text-white/35 mt-0.5 truncate">{ext.manifest.description}</p>

                    {/* Contribution summary */}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                        {hooks.length > 0 && (
                            <span className="flex items-center gap-0.5 text-[7px] font-mono text-orange-400
                                             bg-orange-500/10 border border-orange-500/20 px-1 py-0.5 rounded">
                                <Zap size={7} /> {hooks.length} hooks
                            </span>
                        )}
                        {slots.length > 0 && (
                            <span className="flex items-center gap-0.5 text-[7px] font-mono text-cyan-400
                                             bg-cyan-500/10 border border-cyan-500/20 px-1 py-0.5 rounded">
                                <Layout size={7} /> {slots.length} slots
                            </span>
                        )}
                        {ext.runtime.commands.length > 0 && (
                            <span className="flex items-center gap-0.5 text-[7px] font-mono text-purple-400
                                             bg-purple-500/10 border border-purple-500/20 px-1 py-0.5 rounded">
                                <Terminal size={7} /> {ext.runtime.commands.length} cmds
                            </span>
                        )}
                        {ext.runtime.themes.length > 0 && (
                            <span className="flex items-center gap-0.5 text-[7px] font-mono text-pink-400
                                             bg-pink-500/10 border border-pink-500/20 px-1 py-0.5 rounded">
                                <Palette size={7} /> {ext.runtime.themes.length} themes
                            </span>
                        )}
                        {ext.runtime.shaders.length > 0 && (
                            <span className="flex items-center gap-0.5 text-[7px] font-mono text-yellow-400
                                             bg-yellow-500/10 border border-yellow-500/20 px-1 py-0.5 rounded">
                                <Sparkles size={7} /> {ext.runtime.shaders.length} shaders
                            </span>
                        )}
                    </div>

                    {ext.error && (
                        <p className="text-[8px] text-red-400 mt-1 flex items-start gap-1">
                            <AlertTriangle size={10} className="shrink-0 mt-0.5" />
                            {ext.error}
                        </p>
                    )}
                </div>

                {/* Controls */}
                <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => onToggle(ext.manifest.id)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enabled ? 'bg-orange-500' : 'bg-white/10'
                            }`}>
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'
                            }`} />
                    </button>
                    <button onClick={() => setExpanded(v => !v)}
                        className="p-1 text-white/25 hover:text-white/55 transition-colors">
                        <ChevronDown size={12} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                    <button onClick={() => onUninstall(ext.manifest.id)}
                        className="p-1 text-white/20 hover:text-red-400 transition-colors">
                        <Trash2 size={11} />
                    </button>
                </div>
            </div>

            {/* Expanded details */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden border-t border-white/[0.04]"
                    >
                        <div className="p-3 space-y-3">
                            {/* Hook list */}
                            {hooks.length > 0 && (
                                <div>
                                    <p className="text-[7px] font-mono text-white/30 uppercase tracking-wider mb-1.5">
                                        Hook Handlers ({hooks.length})
                                    </p>
                                    <div className="space-y-0.5">
                                        {hooks.map(({ hook }) => (
                                            <div key={hook} className="flex items-center gap-2">
                                                <Zap size={8} className="text-orange-400" />
                                                <code className="text-[8px] text-orange-300/60">{hook}</code>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Slot list */}
                            {slots.length > 0 && (
                                <div>
                                    <p className="text-[7px] font-mono text-white/30 uppercase tracking-wider mb-1.5">
                                        UI Slots ({slots.length})
                                    </p>
                                    <div className="space-y-0.5">
                                        {slots.map(({ slotId }) => (
                                            <div key={slotId} className="flex items-center gap-2">
                                                <Layout size={8} className="text-cyan-400" />
                                                <code className="text-[8px] text-cyan-300/60">{slotId}</code>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Permissions */}
                            {ext.manifest.permissions && ext.manifest.permissions.length > 0 && (
                                <div>
                                    <p className="text-[7px] font-mono text-white/30 uppercase tracking-wider mb-1.5">
                                        Permissions
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                        {ext.manifest.permissions.map(p => (
                                            <span key={p} className="text-[7px] font-mono text-white/40
                                                   border border-white/[0.08] px-1 py-0.5 rounded">
                                                {p}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <p className="text-[7px] font-mono text-white/15">id: {ext.manifest.id}</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ─── Install panel ────────────────────────────────────────────────────────────

function InstallPanel({ onInstall }: { onInstall: (manifest: any) => void }) {
    const [json, setJson] = useState('');
    const [error, setError] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);

    function tryInstall() {
        try {
            const m = JSON.parse(json);
            if (!m.id || !m.name) throw new Error('Missing required fields: id, name');
            onInstall(m);
            setJson('');
            setError('');
        } catch (e: any) { setError(e?.message ?? 'Invalid manifest'); }
    }

    return (
        <div className="space-y-2 p-3 border border-orange-500/20 rounded-xl bg-orange-500/[0.03]">
            <p className="text-[8px] font-mono text-orange-400/70 uppercase tracking-widest">
                ⚡ Install Extension
            </p>
            <textarea
                className="w-full h-24 bg-black/60 border border-white/[0.08] rounded-lg p-2
                           text-[8px] font-mono text-white/60 placeholder-white/15 outline-none
                           focus:border-orange-500/30 resize-none"
                placeholder={'{\n  "id": "my-plugin",\n  "name": "My Plugin",\n  "version": "1.0.0"\n}'}
                value={json}
                onChange={e => setJson(e.target.value)}
            />
            {error && (
                <p className="text-[8px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
                    {error}
                </p>
            )}
            <div className="flex gap-2">
                <button onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[8px] font-mono
                                   bg-white/[0.04] border border-white/[0.08] text-white/50 hover:text-white/70">
                    <Upload size={9} /> File
                </button>
                <input ref={fileRef} type="file" accept=".json"
                    onChange={e => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        new FileReader().readAsText(f);
                    }}
                    className="hidden" />
                <button onClick={tryInstall} disabled={!json.trim()}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[8px] font-mono
                                   bg-orange-500/20 border border-orange-500/30 text-orange-300
                                   hover:bg-orange-500/30 disabled:opacity-30 transition-colors">
                    <Plug size={9} /> Install
                </button>
            </div>
        </div>
    );
}

// ─── Main PluginMatrix ────────────────────────────────────────────────────────

export interface PluginMatrixProps {
    onClose?: () => void;
    embedded?: boolean;
}

export function PluginMatrix({ onClose, embedded = false }: PluginMatrixProps) {
    const [view, setView] = useState<MatrixView>('list');
    const [search, setSearch] = useState('');
    const [installing, setInstalling] = useState(false);
    const [, forceUpdate] = useState(0);
    const refresh = () => forceUpdate(n => n + 1);

    const hookLog = useHookActivityLog();

    const extensions = useMemo(() =>
        kosRegistry.listExtensions().filter(e =>
            search === '' ||
            e.manifest.name.toLowerCase().includes(search.toLowerCase()) ||
            e.manifest.id.toLowerCase().includes(search.toLowerCase())
        ),
        [search, kosRegistry.listExtensions().length]
    );

    const stats = useMemo(() => ({
        total: kosRegistry.listExtensions().length,
        active: kosRegistry.listExtensions().filter(e => e.status === 'active').length,
        hooks: hookBus.size,
        slotsFilled: slotRegistry.getOccupiedSlots().length,
        appsOnline: appApiRegistry.mountedApps().length,
    }), [extensions.length, hookLog.length]);

    const handleToggle = useCallback((id: string) => {
        kosRegistry.setEnabled(id, !kosRegistry.isEnabled(id));
        refresh();
    }, []);

    const handleUninstall = useCallback((id: string) => {
        kosRegistry.deactivateExtension(id);
        refresh();
    }, []);

    const handleInstall = useCallback((manifest: any) => {
        kosRegistry.registerExtension({ manifest, activate: undefined, deactivate: undefined });
        setInstalling(false);
        refresh();
    }, []);

    // ─── View config (data-driven) ────────────────────────────────────────────
    const VIEWS: Array<{ id: MatrixView; label: string; icon: React.FC<any> }> = [
        { id: 'list', label: 'Plugins', icon: Puzzle },
        { id: 'graph', label: 'Graph', icon: GitBranch },
        { id: 'hooks', label: 'Hooks', icon: Zap },
        { id: 'slots', label: 'Slots', icon: Layout },
        { id: 'permissions', label: 'Access', icon: Shield },
    ];

    const wrapperCls = embedded
        ? 'flex flex-col w-full h-full bg-[#06060e] border border-white/[0.06] rounded-2xl overflow-hidden'
        : 'flex flex-col w-[720px] h-[80vh] bg-[#06060e] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden';

    return (
        <div className={wrapperCls} style={{ fontFamily: 'var(--kos-font-mono, "JetBrains Mono", monospace)' }}>

            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.05] shrink-0
                            bg-gradient-to-r from-orange-950/20 to-transparent">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-500/40 to-red-500/20
                                    border border-orange-500/40 flex items-center justify-center">
                        <Cable size={12} className="text-orange-400" />
                    </div>
                    <span className="text-[11px] text-white/85 tracking-widest uppercase">
                        Plugin Matrix
                    </span>
                    <span className="text-[8px] text-orange-400/60 border border-orange-500/20
                                     bg-orange-500/10 px-1.5 py-0.5 rounded-full">
                        HYPERDRIVE
                    </span>
                </div>

                <div className="flex-1" />

                {/* Stats row */}
                {([
                    { label: 'PLUGINS', value: stats.total, color: 'text-orange-400' },
                    { label: 'ACTIVE', value: stats.active, color: 'text-green-400' },
                    { label: 'HOOKS', value: stats.hooks, color: 'text-yellow-400' },
                    { label: 'SLOTS', value: stats.slotsFilled, color: 'text-cyan-400' },
                    { label: 'APPS', value: stats.appsOnline, color: 'text-purple-400' },
                ] as const).map(s => (
                    <div key={s.label} className="flex flex-col items-center">
                        <span className={`text-[11px] font-bold tabular-nums ${s.color}`}>{s.value}</span>
                        <span className="text-[6px] text-white/20 tracking-widest">{s.label}</span>
                    </div>
                ))}

                <div className="flex items-center gap-1 ml-2">
                    <button
                        onClick={() => setInstalling(v => !v)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[8px] font-mono
                                    border transition-colors ${installing
                                ? 'bg-orange-500/20 border-orange-500/40 text-orange-300'
                                : 'bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white/70'}`}
                    >
                        <Upload size={10} /> Install
                    </button>
                    {!embedded && onClose && (
                        <button onClick={onClose} className="p-1 text-white/25 hover:text-white/55 ml-1">
                            <X size={13} />
                        </button>
                    )}
                </div>
            </div>

            {/* ── View tabs ──────────────────────────────────────────────── */}
            <div className="flex border-b border-white/[0.05] shrink-0 bg-white/[0.01]">
                {VIEWS.map(v => {
                    const Icon = v.icon;
                    const active = view === v.id;
                    return (
                        <button
                            key={v.id}
                            onClick={() => setView(v.id)}
                            className={`flex items-center gap-1.5 px-3 py-2 text-[8px] font-mono
                                        uppercase tracking-wider transition-colors border-b relative ${active
                                    ? 'text-orange-300 border-orange-500/60'
                                    : 'text-white/30 border-transparent hover:text-white/55'
                                }`}
                        >
                            <Icon size={9} />
                            {v.label}
                            {v.id === 'hooks' && hookLog.length > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                            )}
                        </button>
                    );
                })}

                {/* Search — only in list view */}
                {view === 'list' && (
                    <div className="flex items-center gap-1.5 flex-1 justify-end px-2">
                        <Search size={9} className="text-white/30" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="text-[9px] font-mono bg-transparent text-white/60
                                       placeholder-white/20 outline-none w-32"
                            placeholder="Search..."
                        />
                    </div>
                )}
            </div>

            {/* ── Install panel ──────────────────────────────────────────── */}
            <AnimatePresence>
                {installing && (
                    <motion.div
                        initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                        className="overflow-hidden border-b border-white/[0.05] shrink-0"
                    >
                        <div className="p-3">
                            <InstallPanel onInstall={handleInstall} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Content area ───────────────────────────────────────────── */}
            <div className="flex-1 overflow-hidden">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={view}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.12 }}
                        className="h-full"
                    >
                        {view === 'list' && (
                            <div className="h-full overflow-y-auto custom-scrollbar p-3 space-y-2">
                                {extensions.length === 0 && !installing && (
                                    <div className="flex flex-col items-center justify-center h-40 gap-3">
                                        <Package size={32} className="text-white/[0.08]" />
                                        <div className="text-center">
                                            <p className="text-[9px] font-mono text-white/25">No extensions installed</p>
                                            <p className="text-[8px] text-white/15 mt-1">
                                                Click Install to add plugins
                                            </p>
                                        </div>
                                    </div>
                                )}
                                {extensions.map(ext => (
                                    <ExtCard key={ext.manifest.id} ext={ext}
                                        onToggle={handleToggle}
                                        onUninstall={handleUninstall} />
                                ))}
                            </div>
                        )}
                        {view === 'graph' && (
                            <div className="h-full flex flex-col">
                                <div className="flex-1 overflow-hidden p-2">
                                    <GraphView extensions={extensions} />
                                </div>
                                <div className="p-2 border-t border-white/[0.05] flex gap-4 text-[7px] font-mono text-white/30 shrink-0">
                                    <span className="flex items-center gap-1">
                                        <span className="w-8 h-px bg-orange-500 block" />
                                        Plugin → HookBus
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="w-8 h-px bg-cyan-500 block" />
                                        HookBus → App
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-green-500 block" />
                                        App Online
                                    </span>
                                </div>
                            </div>
                        )}
                        {view === 'hooks' && <HooksView hookLog={hookLog} />}
                        {view === 'slots' && <SlotsView />}
                        {view === 'permissions' && <PermissionsView extensions={extensions} />}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* ── Footer ─────────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 px-4 py-2 border-t border-white/[0.04] shrink-0">
                <div className="flex items-center gap-1.5">
                    <Radio size={8} className="text-green-400 animate-pulse" />
                    <span className="text-[7px] font-mono text-white/25">
                        {hookLog.length} hook events intercepted this session
                    </span>
                </div>
                <div className="flex-1" />
                <span className="text-[7px] font-mono text-white/15">
                    K-OS Plugin Matrix v2 · {stats.total} extensions
                </span>
            </div>
        </div>
    );
}

export default PluginMatrix;
