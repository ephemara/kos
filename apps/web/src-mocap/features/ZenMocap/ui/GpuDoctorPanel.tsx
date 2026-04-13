/**
 * GpuDoctorPanel
 *
 * Floating diagnostics panel that surfaces:
 *   - GPU adapter name, backend, driver, device type
 *   - Live pipeline error toasts with auto-dismiss
 *   - GPU health event log (device_lost, OOM, validation, internal errors)
 *   - Quick links to relevant debugging tools
 *
 * Data-driven: all error classifications and tool recommendations
 * are sourced from a config object — add new kinds there, not in markup.
 *
 * Shown automatically when pipelineError or gpuHealth is non-empty.
 * Can also be opened manually via View → GPU Doctor.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import {
    Activity, AlertTriangle, Cpu, X, ChevronDown, ChevronUp,
    Zap, RefreshCw, Wifi, Shield, Circle,
} from 'lucide-react';
import { cn } from '@mocap/shared/primitives/cn';
import type { GpuHealthEvent } from '../hooks/useSkeletonFrame';
import type {
    TimelineRuntimeDiagnosticsMutationMetadata,
    TimelineRuntimeDiagnosticsPolicy,
    TimelineRuntimeDiagnosticsReport,
} from '../MocapService';
import { formatTimelineReasonTrends, resolveTimelineReasonTrends } from '../timelineReasonTrend';

// ─── Config ───────────────────────────────────────────────────────────────────

interface GpuInfo {
    name: string;
    backend: string;
    driver: string;
    driver_info: string;
    vram_bytes: number;
    device_type: string;
}

/** Per-kind classification: icon, color, and suggested debugging tool. */
const GPU_ERROR_KINDS: Record<string, {
    label: string;
    color: string;
    icon: React.ElementType;
    tool: string;
}> = {
    device_lost: { label: 'Device Lost', color: '#ef4444', icon: AlertTriangle, tool: 'wgpu-trace / restart session' },
    out_of_memory: { label: 'Out of Memory', color: '#f97316', icon: Zap, tool: 'Reduce resolution or close other GPU apps' },
    validation: { label: 'Validation Err', color: '#eab308', icon: Shield, tool: 'wgpu-trace + RUST_LOG=wgpu=error' },
    internal: { label: 'Internal Error', color: '#a855f7', icon: AlertTriangle, tool: 'cargo flamegraph / wgpu-trace' },
    unknown: { label: 'Unknown', color: '#6b7280', icon: Activity, tool: 'Check Rust logs' },
};

/** Debug tool reference — shown in the Tools tab. Data-driven. */
const DEBUG_TOOLS = [
    {
        category: 'Backend (Rust)',
        items: [
            { name: 'wgpu-trace', desc: 'GPU command recording — set trace_path in DeviceDescriptor', cmd: 'WGPU_BACKEND=vulkan cargo tauri dev' },
            { name: 'RUST_LOG', desc: 'Verbose wgpu validation output', cmd: 'RUST_LOG=wgpu=error,wgpu_hal=error cargo tauri dev' },
            { name: 'cargo flamegraph', desc: 'CPU profiling (find hot-path bottlenecks)', cmd: 'cargo flamegraph --bin zen-mocap' },
            { name: 'rust-gdb', desc: 'Native debugger — attach to Tauri process', cmd: 'rust-gdb target/debug/zen-mocap' },
        ],
    },
    {
        category: 'Network (UDP / LiveLink)',
        items: [
            { name: 'netcat', desc: 'Manual UDP packet test (receive)', cmd: 'nc -u -l 11111' },
            { name: 'tcpdump', desc: 'Capture UDP traffic on loopback', cmd: 'tcpdump -i lo udp port 11111' },
            { name: 'Wireshark', desc: 'Full packet inspection — filter: udp.port==11111', cmd: 'wireshark' },
        ],
    },
];

// ─── Props ────────────────────────────────────────────────────────────────────

export interface GpuDoctorPanelProps {
    open: boolean;
    onClose: () => void;
    pipelineError: string | null;
    gpuHealth: GpuHealthEvent[];
    pendingTimelineRequestCount: number;
    timelineBridgeError: string | null;
    timelineRuntimeDiagnostics: TimelineRuntimeDiagnosticsReport | null;
    timelineRuntimeMutation: TimelineRuntimeDiagnosticsMutationMetadata | null;
    timelineRuntimeDiagnosticsPolicy: TimelineRuntimeDiagnosticsPolicy | null;
    onClearErrors: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GpuDoctorPanel({
    open,
    onClose,
    pipelineError,
    gpuHealth,
    pendingTimelineRequestCount,
    timelineBridgeError,
    timelineRuntimeDiagnostics,
    timelineRuntimeMutation,
    timelineRuntimeDiagnosticsPolicy,
    onClearErrors,
}: GpuDoctorPanelProps) {
    const [gpuInfo, setGpuInfo] = useState<GpuInfo | null>(null);
    const [activeTab, setActiveTab] = useState<'errors' | 'info' | 'tools'>('errors');
    const [expanded, setExpanded] = useState<number | null>(null);
    const fieldVisibility = timelineRuntimeDiagnosticsPolicy?.field_visibility;
    const driftPolicy = timelineRuntimeDiagnosticsPolicy?.drift;
    const queueLedgerGap = Math.max(
        pendingTimelineRequestCount - (timelineRuntimeDiagnostics?.event_log_size ?? 0),
        0,
    );
    const hasDriftWarning = driftPolicy
        ? pendingTimelineRequestCount >= driftPolicy.warn_pending_request_count
            || queueLedgerGap >= driftPolicy.warn_queue_vs_ledger_gap
        : false;
    const reasonTrendText = timelineRuntimeDiagnostics && timelineRuntimeDiagnosticsPolicy
        ? formatTimelineReasonTrends(resolveTimelineReasonTrends(
            timelineRuntimeDiagnostics,
            timelineRuntimeDiagnosticsPolicy,
        ))
        : '—';

    // Fetch GPU adapter info when opened.
    useEffect(() => {
        if (!open) return;
        invoke<GpuInfo>('mocap_get_gpu_info')
            .then(info => {
                setGpuInfo(info);
            })
            .catch(() => { }); // silently ignore if not in Tauri context
    }, [open]);

    const hasErrors = !!pipelineError || gpuHealth.length > 0 || !!timelineBridgeError;

    if (!open) return null;

    return (
        <motion.div
            className={cn(
                'fixed bottom-6 right-6 z-[300] w-[400px] max-h-[560px] flex flex-col',
                'bg-[#070707]/97 backdrop-blur-2xl border border-white/10 rounded-2xl',
                'shadow-[0_32px_80px_rgba(0,0,0,0.8)]',
                'overflow-hidden pointer-events-auto',
            )}
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
        >
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8 shrink-0 bg-black/30">
                <div className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    hasErrors ? 'bg-red-500 animate-pulse' : 'bg-emerald-400',
                )} />
                <Cpu size={12} className="text-gray-400" />
                <span className="text-[11px] font-black tracking-widest text-gray-200">GPU DOCTOR</span>

                {hasErrors && (
                    <span className="ml-1 text-[9px] font-mono bg-red-500/15 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded">
                        {gpuHealth.length + (pipelineError ? 1 : 0) + (timelineBridgeError ? 1 : 0)} ERROR
                        {gpuHealth.length + (pipelineError ? 1 : 0) + (timelineBridgeError ? 1 : 0) !== 1 ? 'S' : ''}
                    </span>
                )}

                <div className="flex-1" />

                {hasErrors && (
                    <button
                        onClick={onClearErrors}
                        className="flex items-center gap-1 text-[9px] font-bold text-gray-500 hover:text-gray-300 transition-colors px-1.5 py-0.5 rounded hover:bg-white/5"
                        title="Clear all errors"
                    >
                        <RefreshCw size={9} />
                        Clear
                    </button>
                )}

                <button
                    onClick={onClose}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                >
                    <X size={11} />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/8 shrink-0">
                {(['errors', 'info', 'tools'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                            'flex-1 py-2 text-[9px] font-black tracking-widest uppercase transition-all',
                            activeTab === tab
                                ? 'text-[color:var(--kos-accent-primary)] border-b-2 border-[color:var(--kos-accent-primary)]'
                                : 'text-gray-600 hover:text-gray-400',
                        )}
                    >
                        {tab}
                        {tab === 'errors' && hasErrors && (
                            <span className="ml-1 text-[8px] bg-red-500/20 text-red-400 px-1 rounded">
                                {gpuHealth.length + (pipelineError ? 1 : 0) + (timelineBridgeError ? 1 : 0)}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto min-h-0">

                {/* ── Errors tab ── */}
                {activeTab === 'errors' && (
                    <div className="p-3 space-y-2">
                        {!hasErrors && (
                            <div className="flex flex-col items-center justify-center py-10 gap-3">
                                <Circle size={20} className="text-emerald-400/50" />
                                <span className="text-[10px] text-gray-500 font-bold">No errors detected</span>
                            </div>
                        )}

                        {/* Pipeline error */}
                        {pipelineError && (
                            <div className="p-3 rounded-xl bg-red-500/8 border border-red-500/25">
                                <div className="flex items-center gap-2 mb-1">
                                    <AlertTriangle size={11} className="text-red-400 shrink-0" />
                                    <span className="text-[9px] font-black text-red-400 tracking-widest">PIPELINE FATAL</span>
                                </div>
                                <p className="text-[9px] font-mono text-red-300/80 leading-relaxed break-all">
                                    {pipelineError}
                                </p>
                                <p className="text-[8px] text-gray-600 mt-1.5">Session terminated. Restart session to recover.</p>
                            </div>
                        )}

                        {timelineBridgeError && (
                            <div className="p-3 rounded-xl bg-orange-500/8 border border-orange-500/25">
                                <div className="flex items-center gap-2 mb-1">
                                    <Wifi size={11} className="text-orange-400 shrink-0" />
                                    <span className="text-[9px] font-black text-orange-400 tracking-widest">TIMELINE BRIDGE</span>
                                </div>
                                <p className="text-[9px] font-mono text-orange-300/80 leading-relaxed break-all">
                                    {timelineBridgeError}
                                </p>
                                <p className="text-[8px] text-gray-600 mt-1.5">
                                    Pending requests: {pendingTimelineRequestCount}
                                </p>
                            </div>
                        )}

                        {/* GPU health events */}
                        {gpuHealth.map((evt, i) => {
                            const kind = GPU_ERROR_KINDS[evt.kind] ?? GPU_ERROR_KINDS.unknown;
                            const KindIcon = kind.icon;
                            const isExpanded = expanded === i;
                            return (
                                <div
                                    key={i}
                                    className="rounded-xl border overflow-hidden"
                                    style={{ borderColor: `${kind.color}33`, background: `${kind.color}08` }}
                                >
                                    <button
                                        onClick={() => setExpanded(isExpanded ? null : i)}
                                        className="w-full flex items-center gap-2 p-2.5 text-left"
                                    >
                                        <KindIcon size={11} style={{ color: kind.color }} className="shrink-0" />
                                        <span className="text-[9px] font-black tracking-widest flex-1" style={{ color: kind.color }}>
                                            {kind.label}
                                        </span>
                                        <span className="text-[8px] text-gray-600 font-mono">
                                            {new Date(evt.timestamp_ms).toLocaleTimeString()}
                                        </span>
                                        {isExpanded ? <ChevronUp size={9} className="text-gray-600" /> : <ChevronDown size={9} className="text-gray-600" />}
                                    </button>
                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div
                                                initial={{ height: 0 }}
                                                animate={{ height: 'auto' }}
                                                exit={{ height: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="px-3 pb-3 space-y-2">
                                                    <p className="text-[9px] font-mono text-gray-300/80 leading-relaxed break-all">
                                                        {evt.message}
                                                    </p>
                                                    <div className="flex items-start gap-1.5 bg-black/30 rounded-lg p-2">
                                                        <span className="text-[8px] text-gray-600 font-bold shrink-0 mt-0.5">TOOL:</span>
                                                        <span className="text-[8px] font-mono text-[color:var(--kos-accent-primary)]/70">
                                                            {kind.tool}
                                                        </span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ── Info tab ── */}
                {activeTab === 'info' && (
                    <div className="p-3 space-y-2">
                        {gpuInfo ? (
                            <>
                                <InfoRow label="Adapter" value={gpuInfo.name} />
                                <InfoRow label="Backend" value={gpuInfo.backend} accent />
                                <InfoRow label="Device Type" value={gpuInfo.device_type} />
                                <InfoRow label="Driver" value={gpuInfo.driver || '—'} />
                                <InfoRow label="Driver Info" value={gpuInfo.driver_info || '—'} />
                                {gpuInfo.vram_bytes > 0 && (
                                    <InfoRow
                                        label="VRAM"
                                        value={`${(gpuInfo.vram_bytes / 1024 / 1024 / 1024).toFixed(1)} GB`}
                                        accent
                                    />
                                )}
                                <div className="pt-2 mt-2 border-t border-white/8 space-y-1.5">
                                    <p className="text-[8px] font-black tracking-widest text-gray-600 uppercase">
                                        Timeline Runtime
                                    </p>
                                    {fieldVisibility?.show_active_take_path && (
                                        <InfoRow
                                            label="Active Take"
                                            value={
                                                timelineRuntimeDiagnostics?.active_take_path
                                                    ? timelineRuntimeDiagnostics.active_take_path
                                                    : 'None'
                                            }
                                            accent={Boolean(timelineRuntimeDiagnostics?.active_take_path)}
                                        />
                                    )}
                                    {fieldVisibility?.show_take_existence && (
                                        <InfoRow
                                            label="Take Exists"
                                            value={timelineRuntimeDiagnostics?.active_take_exists ? 'yes' : 'no'}
                                            accent={Boolean(timelineRuntimeDiagnostics?.active_take_exists)}
                                        />
                                    )}
                                    <InfoRow
                                        label="Pending Queue"
                                        value={`${pendingTimelineRequestCount}`}
                                        accent={pendingTimelineRequestCount > 0}
                                    />
                                    <InfoRow
                                        label="Queue/Ledger Drift"
                                        value={`${queueLedgerGap}`}
                                        accent={hasDriftWarning}
                                    />
                                    {fieldVisibility?.show_active_track_count && (
                                        <InfoRow
                                            label="Tracks"
                                            value={`${timelineRuntimeDiagnostics?.active_track_count ?? 0}`}
                                        />
                                    )}
                                    {fieldVisibility?.show_event_log_size && (
                                        <InfoRow
                                            label="Ledger Events"
                                            value={`${timelineRuntimeDiagnostics?.event_log_size ?? 0}`}
                                        />
                                    )}
                                    {fieldVisibility?.show_latest_event_timestamp && (
                                        <InfoRow
                                            label="Last Event"
                                            value={
                                                timelineRuntimeDiagnostics?.latest_event_timestamp_ms
                                                    ? new Date(timelineRuntimeDiagnostics.latest_event_timestamp_ms).toLocaleTimeString()
                                                    : '—'
                                            }
                                        />
                                    )}
                                    {fieldVisibility?.show_event_source_counts && (
                                        <InfoRow
                                            label="Sources"
                                            value={
                                                timelineRuntimeDiagnostics
                                                    ? Object.entries(timelineRuntimeDiagnostics.event_source_counts)
                                                        .map(([source, count]) => `${source}:${count}`)
                                                        .join(', ') || '—'
                                                    : '—'
                                            }
                                        />
                                    )}
                                    {fieldVisibility?.show_recent_reason_counts && (
                                        <InfoRow
                                            label="Reason Trend"
                                            value={reasonTrendText}
                                        />
                                    )}
                                    {fieldVisibility?.show_track_keyframe_counts && (
                                        <InfoRow
                                            label="Track Keys"
                                            value={
                                                timelineRuntimeDiagnostics
                                                    ? Object.entries(timelineRuntimeDiagnostics.track_keyframe_counts)
                                                        .map(([trackId, count]) => `${trackId}:${count}`)
                                                        .join(', ') || '—'
                                                    : '—'
                                            }
                                        />
                                    )}
                                    {timelineRuntimeMutation?.reason && (
                                        <InfoRow
                                            label="Last Update Reason"
                                            value={
                                                timelineRuntimeMutation.reason_detail?.label
                                                    ?? timelineRuntimeMutation.reason
                                            }
                                            accent={timelineRuntimeMutation.reason_detail?.severity !== 'error'}
                                        />
                                    )}
                                    {timelineRuntimeMutation?.reason_detail && (
                                        <InfoRow
                                            label="Update Severity"
                                            value={timelineRuntimeMutation.reason_detail.severity.toUpperCase()}
                                            accent={timelineRuntimeMutation.reason_detail.severity !== 'error'}
                                        />
                                    )}
                                    {timelineRuntimeMutation?.reason_detail?.action_hint && (
                                        <InfoRow
                                            label="Recommended Action"
                                            value={timelineRuntimeMutation.reason_detail.action_hint}
                                        />
                                    )}
                                    {timelineRuntimeMutation?.trend_summary && (
                                        <InfoRow
                                            label="Trend Escalation"
                                            value={`${timelineRuntimeMutation.trend_summary.highest_severity.toUpperCase()} (${timelineRuntimeMutation.trend_summary.escalated_reason_count} escalated)`}
                                            accent={timelineRuntimeMutation.trend_summary.highest_severity !== 'error'}
                                        />
                                    )}
                                    {timelineRuntimeMutation?.trend_summary?.top_reasons.length
                                        ? (
                                            <InfoRow
                                                label="Trend Reasons"
                                                value={timelineRuntimeMutation.trend_summary.top_reasons
                                                    .map(trend => `${trend.label}:${trend.count}(${trend.severity.toUpperCase()})`)
                                                    .join(', ')}
                                            />
                                        )
                                        : null}
                                    {timelineRuntimeMutation?.emitted_at_ms && (
                                        <InfoRow
                                            label="Last Update At"
                                            value={new Date(timelineRuntimeMutation.emitted_at_ms).toLocaleTimeString()}
                                        />
                                    )}
                                    {timelineBridgeError && (
                                        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2">
                                            <p className="text-[8px] font-black tracking-widest text-red-400">BRIDGE ERROR</p>
                                            <p className="mt-1 text-[8px] font-mono text-red-300/80 break-all">
                                                {timelineBridgeError}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center py-10">
                                <span className="text-[10px] text-gray-600">Start a session to read GPU info</span>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Tools tab ── */}
                {activeTab === 'tools' && (
                    <div className="p-3 space-y-3">
                        {DEBUG_TOOLS.map(group => (
                            <div key={group.category}>
                                <p className="text-[8px] font-black tracking-widest text-gray-600 uppercase mb-2">{group.category}</p>
                                <div className="space-y-1.5">
                                    {group.items.map(tool => (
                                        <div key={tool.name} className="p-2.5 rounded-lg bg-white/3 border border-white/6">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <span className="text-[9px] font-black text-[color:var(--kos-accent-primary)]">{tool.name}</span>
                                            </div>
                                            <p className="text-[8px] text-gray-500 leading-relaxed mb-1.5">{tool.desc}</p>
                                            <div className="bg-black/50 rounded px-2 py-1">
                                                <code className="text-[8px] font-mono text-gray-400 break-all">{tool.cmd}</code>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </motion.div>
    );
}

// ─── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
    return (
        <div className="flex items-start justify-between gap-3 py-1.5 border-b border-white/5 last:border-0">
            <span className="text-[9px] font-bold text-gray-600 shrink-0">{label}</span>
            <span className={cn(
                'text-[9px] font-mono text-right break-all',
                accent ? 'text-[color:var(--kos-accent-primary)]' : 'text-gray-300',
            )}>
                {value}
            </span>
        </div>
    );
}
