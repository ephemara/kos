import { describe, expect, it } from 'vitest';

import type {
  TimelineRuntimeDiagnosticsPolicy,
  TimelineRuntimeDiagnosticsReport,
} from './MocapService';
import { resolveTimelineReasonTrends } from './timelineReasonTrend';

const POLICY: TimelineRuntimeDiagnosticsPolicy = {
  policy_id: 'trend-test',
  refresh: {
    enabled: true,
    interval_ms: 1500,
  },
  event: {
    include_reason: true,
    include_emitted_at_ms: true,
    include_trend_summary: true,
    trend_summary_min_severity: 'warn',
    trend_summary_top_count: 2,
    allowed_reasons: ['runtime_state_reset'],
    reason_catalog: [
      {
        reason_id: 'runtime_state_reset',
        label: 'Runtime State Reset',
        severity: 'warn',
        action_hint: 'Descriptor fallback action.',
      },
    ],
  },
  drift: {
    warn_pending_request_count: 6,
    warn_queue_vs_ledger_gap: 4,
  },
  trend: {
    reason_history_limit: 64,
    top_reason_count: 3,
    default_warn_count: 6,
    default_error_count: 12,
    decay_window_ms: 300000,
    cooldown_window_ms: 120000,
    reason_thresholds: [
      {
        reason_id: 'runtime_state_reset',
        warn_count: 2,
        error_count: 4,
        warn_action_hint: 'Warn escalation action.',
        error_action_hint: 'Error escalation action.',
      },
    ],
  },
  field_visibility: {
    show_active_take_path: true,
    show_take_existence: true,
    show_active_track_count: true,
    show_active_track_ids: true,
    show_event_log_size: true,
    show_latest_event_timestamp: true,
    show_track_keyframe_counts: true,
    show_event_source_counts: true,
    show_recent_reason_counts: true,
  },
};

function reportWithCount(count: number): TimelineRuntimeDiagnosticsReport {
  return {
    generated_at_ms: 2_000,
    active_take_path: null,
    active_take_exists: false,
    active_track_count: 0,
    active_track_ids: [],
    track_keyframe_counts: {},
    event_log_size: 0,
    latest_event_timestamp_ms: null,
    event_source_counts: {},
    recent_reason_counts: {
      runtime_state_reset: count,
    },
    recent_reason_last_seen_ms: {
      runtime_state_reset: 2_000,
    },
    recent_reason_trends: [],
  };
}

describe('timeline reason trend resolver', () => {
  it('uses warn and error escalation action hints from policy thresholds', () => {
    const warnTrend = resolveTimelineReasonTrends(reportWithCount(2), POLICY);
    expect(warnTrend[0]?.severity).toBe('warn');
    expect(warnTrend[0]?.action_hint).toBe('Warn escalation action.');

    const errorTrend = resolveTimelineReasonTrends(reportWithCount(4), POLICY);
    expect(errorTrend[0]?.severity).toBe('error');
    expect(errorTrend[0]?.action_hint).toBe('Error escalation action.');
  });

  it('recomputes trends from counts when reason counts are present', () => {
    const report: TimelineRuntimeDiagnosticsReport = {
      ...reportWithCount(2),
      recent_reason_trends: [
        {
          reason_id: 'runtime_state_reset',
          label: 'Runtime State Reset',
          count: 2,
          severity: 'info',
          action_hint: 'stale backend trend',
        },
      ],
    };

    const trends = resolveTimelineReasonTrends(report, POLICY);
    expect(trends[0]?.severity).toBe('warn');
    expect(trends[0]?.action_hint).toBe('Warn escalation action.');
  });

  it('de-escalates stale counts after cooldown window', () => {
    const report: TimelineRuntimeDiagnosticsReport = {
      ...reportWithCount(4),
      generated_at_ms: 200_000,
      recent_reason_last_seen_ms: {
        runtime_state_reset: 1_000,
      },
    };

    const trends = resolveTimelineReasonTrends(report, POLICY);
    expect(trends[0]?.severity).toBe('info');
    expect(trends[0]?.action_hint).toBe('Descriptor fallback action.');
  });
});
