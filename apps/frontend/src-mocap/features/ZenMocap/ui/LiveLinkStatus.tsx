/**
 * LiveLinkStatus
 *
 * Real-time pipeline stats display.
 * No hardcoded colours — all status colours resolve through CSS custom
 * properties (--kos-success, --kos-warning, --kos-error, --kos-text-muted)
 * set by ThemeProvider.
 *
 * STAT_ROWS is data-driven — add/remove metrics here only. The render
 * loop is generic and reads from PipelineStats by key.
 */

import React from 'react';
import { Zap, Wifi, WifiOff, Gauge, AlertTriangle, Cpu } from 'lucide-react';
import { Separator } from '@mocap/shared/primitives/Separator';
import type { PipelineStats, SessionStatus } from '../types';
import type {
  TimelineRuntimeDiagnosticsMutationMetadata,
  TimelineRuntimeDiagnosticsPolicy,
  TimelineRuntimeDiagnosticsReport,
} from '../MocapService';
import { formatTimelineReasonTrends, resolveTimelineReasonTrends } from '../timelineReasonTrend';

// ─── Data-Driven Stat Rows Config ────────────────────────────────────────────
// Each entry describes one stat row. `thresholds` control CSS variable colour.
// Add new metrics here + add the field to PipelineStats in types.ts.

type ThresholdMode = 'lower-better' | 'higher-better' | 'binary';

interface StatRow {
  key:       keyof PipelineStats;
  label:     string;
  icon:      React.ElementType;
  format:    (val: number | boolean) => string;
  threshold: (val: number | boolean) => 'good' | 'warn' | 'bad';
  mode:      ThresholdMode;
}

// Threshold → CSS custom property mapping (avoids every stat having hardcoded colours)
const THRESHOLD_CLASS: Record<'good' | 'warn' | 'bad', string> = {
  good: 'text-[color:var(--kos-success)]',
  warn: 'text-[color:var(--kos-warning)]',
  bad:  'text-[color:var(--kos-error)]',
};

const STAT_ROWS: StatRow[] = [
  {
    key:       'fps',
    label:     'FPS',
    icon:      Gauge,
    format:    (v) => (v as number).toFixed(0),
    threshold: (v) => (v as number) >= 28 ? 'good' : (v as number) >= 20 ? 'warn' : 'bad',
    mode:      'higher-better',
  },
  {
    key:       'avg_latency_ms',
    label:     'LATENCY',
    icon:      Zap,
    format:    (v) => `${(v as number).toFixed(1)}ms`,
    threshold: (v) => (v as number) <= 33 ? 'good' : (v as number) <= 50 ? 'warn' : 'bad',
    mode:      'lower-better',
  },
  {
    key:       'frame_drops',
    label:     'DROPS/S',
    icon:      AlertTriangle,
    format:    (v) => String(v as number),
    threshold: (v) => (v as number) === 0 ? 'good' : (v as number) <= 3 ? 'warn' : 'bad',
    mode:      'lower-better',
  },
  {
    key:       'vram_mb',
    label:     'VRAM',
    icon:      Cpu,
    format:    (v) => `${v as number}MB`,
    threshold: () => 'good',  // informational only — always good colour
    mode:      'lower-better',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface LiveLinkStatusProps {
  stats:  PipelineStats;
  status: SessionStatus;
  error:  string | null;
  pendingTimelineRequestCount: number;
  timelineRuntimeDiagnostics: TimelineRuntimeDiagnosticsReport | null;
  timelineRuntimeMutation: TimelineRuntimeDiagnosticsMutationMetadata | null;
  timelineRuntimeDiagnosticsPolicy: TimelineRuntimeDiagnosticsPolicy | null;
}

export default function LiveLinkStatus({
  stats,
  status,
  error,
  pendingTimelineRequestCount,
  timelineRuntimeDiagnostics,
  timelineRuntimeMutation,
  timelineRuntimeDiagnosticsPolicy,
}: LiveLinkStatusProps) {
  const isActive = status === 'running' || status === 'recording';
  const fieldVisibility = timelineRuntimeDiagnosticsPolicy?.field_visibility;
  const driftPolicy = timelineRuntimeDiagnosticsPolicy?.drift;
  const queueLedgerGap = Math.max(
    pendingTimelineRequestCount - (timelineRuntimeDiagnostics?.event_log_size ?? 0),
    0
  );
  const hasTimelineDriftWarning = driftPolicy
    ? pendingTimelineRequestCount >= driftPolicy.warn_pending_request_count
      || queueLedgerGap >= driftPolicy.warn_queue_vs_ledger_gap
    : false;
  const mutationLabel = timelineRuntimeMutation?.reason_detail?.label ?? timelineRuntimeMutation?.reason;
  const mutationSeverity = timelineRuntimeMutation?.reason_detail?.severity ?? null;
  const mutationTrendSummary = timelineRuntimeMutation?.trend_summary ?? null;
  const mutationTrendSeverity = mutationTrendSummary?.highest_severity ?? null;
  const mutationTrendLabel = mutationTrendSummary
    ? `${mutationTrendSummary.highest_severity.toUpperCase()} (${mutationTrendSummary.escalated_reason_count} escalated)`
    : null;
  const reasonTrendText = timelineRuntimeDiagnostics && timelineRuntimeDiagnosticsPolicy
    ? formatTimelineReasonTrends(resolveTimelineReasonTrends(
      timelineRuntimeDiagnostics,
      timelineRuntimeDiagnosticsPolicy,
    ))
    : '—';

  return (
    <div className="flex flex-col gap-3 p-1">

      {/* ── Error Banner ──────────────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-[color:var(--kos-error)]/30 bg-[color:var(--kos-error)]/10 p-2">
          <AlertTriangle size={12} className="mt-0.5 shrink-0 text-[color:var(--kos-error)]" />
          <span className="text-[10px] text-[color:var(--kos-error)] leading-snug break-all">{error}</span>
        </div>
      )}

      {/* ── Metric Rows (data-driven) ─────────────────────────── */}
      <div className="flex flex-col gap-2">
        {STAT_ROWS.map(({ key, label, icon: Icon, format, threshold }) => {
          const val       = stats[key] as number | boolean;
          const tClass    = isActive ? THRESHOLD_CLASS[threshold(val)] : 'text-[color:var(--kos-text-muted)]';
          const display   = isActive ? format(val) : '—';

          return (
            <div key={key} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon size={12} className="text-[color:var(--kos-text-muted)] shrink-0" />
                <span className="text-[10px] text-[color:var(--kos-text-muted)] tracking-wider">{label}</span>
              </div>
              <span className={`text-[11px] font-black tabular-nums ${tClass}`}>{display}</span>
            </div>
          );
        })}
      </div>

      <Separator />

      {/* ── UDP / LiveLink Connection ─────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {stats.udp_connected
            ? <Wifi size={12} className="text-[color:var(--kos-success)]" />
            : <WifiOff size={12} className="text-[color:var(--kos-text-muted)]" />
          }
          <span className="text-[10px] text-[color:var(--kos-text-muted)] tracking-wider">UDP TX</span>
        </div>
        <span className={`text-[11px] font-black tabular-nums ${
          isActive
            ? stats.udp_connected
              ? `${THRESHOLD_CLASS.good}`
              : `${THRESHOLD_CLASS.bad}`
            : 'text-[color:var(--kos-text-muted)]'
        }`}>
          {isActive ? (stats.udp_connected ? `${stats.udp_tx_count}/s` : 'NO ACK') : '—'}
        </span>
      </div>

      {timelineRuntimeDiagnostics && (
        <>
          <Separator />
          <div className="flex flex-col gap-1">
            {hasTimelineDriftWarning && (
              <div className="rounded-md border border-[color:var(--kos-warning)]/30 bg-[color:var(--kos-warning)]/10 px-2 py-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-[color:var(--kos-warning)] tracking-wider">TL DRIFT</span>
                  <span className="text-[9px] font-mono text-[color:var(--kos-warning)]">
                    queue {pendingTimelineRequestCount} / gap {queueLedgerGap}
                  </span>
                </div>
              </div>
            )}
            {fieldVisibility?.show_active_take_path && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[color:var(--kos-text-muted)] tracking-wider">TL ACTIVE TAKE</span>
                <span className="text-[10px] font-mono text-[color:var(--kos-text)]">
                  {timelineRuntimeDiagnostics.active_take_path
                    ? timelineRuntimeDiagnostics.active_take_exists
                      ? 'BOUND'
                      : 'MISSING'
                    : 'NONE'}
                </span>
              </div>
            )}
            {fieldVisibility?.show_active_track_count && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[color:var(--kos-text-muted)] tracking-wider">TL TRACKS</span>
                <span className="text-[10px] font-mono text-[color:var(--kos-text)]">
                  {timelineRuntimeDiagnostics.active_track_count}
                </span>
              </div>
            )}
            {fieldVisibility?.show_event_log_size && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[color:var(--kos-text-muted)] tracking-wider">TL EVENTS</span>
                <span className="text-[10px] font-mono text-[color:var(--kos-text)]">
                  {timelineRuntimeDiagnostics.event_log_size}
                </span>
              </div>
            )}
            {fieldVisibility?.show_recent_reason_counts && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[color:var(--kos-text-muted)] tracking-wider">TL REASON TREND</span>
                <span className="text-[10px] font-mono text-[color:var(--kos-text)]">
                  {reasonTrendText}
                </span>
              </div>
            )}
            {mutationLabel && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[color:var(--kos-text-muted)] tracking-wider">TL LAST UPDATE</span>
                <span
                  className={`text-[10px] font-mono ${
                    mutationSeverity === 'error'
                      ? 'text-[color:var(--kos-error)]'
                      : mutationSeverity === 'warn'
                        ? 'text-[color:var(--kos-warning)]'
                        : 'text-[color:var(--kos-text)]'
                  }`}
                >
                  {mutationLabel}
                </span>
              </div>
            )}
            {mutationTrendLabel && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[color:var(--kos-text-muted)] tracking-wider">TL TREND ALERT</span>
                <span
                  className={`text-[10px] font-mono ${
                    mutationTrendSeverity === 'error'
                      ? 'text-[color:var(--kos-error)]'
                      : mutationTrendSeverity === 'warn'
                        ? 'text-[color:var(--kos-warning)]'
                        : 'text-[color:var(--kos-text)]'
                  }`}
                >
                  {mutationTrendLabel}
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
