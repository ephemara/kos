import type {
  TimelineRuntimeDiagnosticsPolicy,
  TimelineRuntimeDiagnosticsReasonDescriptor,
} from './MocapService';

const FALLBACK_REASON_CATALOG: TimelineRuntimeDiagnosticsReasonDescriptor[] = [
  {
    reason_id: 'runtime_requests_applied',
    label: 'Runtime Requests Applied',
    severity: 'info',
    action_hint: 'No action needed unless drift warnings persist.',
  },
  {
    reason_id: 'runtime_state_reset',
    label: 'Runtime State Reset',
    severity: 'warn',
    action_hint: 'Confirm timeline state was intentionally reset.',
  },
  {
    reason_id: 'active_take_changed',
    label: 'Active Take Binding Changed',
    severity: 'info',
    action_hint: 'Verify the active take path matches the current session.',
  },
  {
    reason_id: 'runtime_committed_to_take',
    label: 'Runtime Committed To Take',
    severity: 'info',
    action_hint: 'Review take ledger size if commit volume is unexpected.',
  },
  {
    reason_id: 'runtime_committed_to_active_take',
    label: 'Runtime Committed To Active Take',
    severity: 'info',
    action_hint: 'Validate active take ownership when repeated commits occur.',
  },
  {
    reason_id: 'runtime_hydrated_from_take',
    label: 'Runtime Hydrated From Take',
    severity: 'warn',
    action_hint: 'Investigate if hydrate repeats frequently or patch mismatches occur.',
  },
];

export const FALLBACK_TIMELINE_DIAGNOSTICS_POLICY: TimelineRuntimeDiagnosticsPolicy = {
  policy_id: 'timeline-runtime-diagnostics-fallback-v1',
  refresh: {
    enabled: true,
    interval_ms: 1500,
  },
  drift: {
    warn_pending_request_count: 6,
    warn_queue_vs_ledger_gap: 4,
  },
  trend: {
    reason_history_limit: 64,
    decay_window_ms: 300000,
    cooldown_window_ms: 120000,
    top_reason_count: 3,
    default_warn_count: 6,
    default_error_count: 12,
    reason_thresholds: [
      {
        reason_id: 'runtime_requests_applied',
        warn_count: 24,
        error_count: 40,
        warn_action_hint: 'Inspect queue drift and ledger growth for sustained write pressure.',
        error_action_hint: 'Pause edits and investigate sequencing loop pressure before continuing.',
      },
      {
        reason_id: 'runtime_state_reset',
        warn_count: 2,
        error_count: 4,
        warn_action_hint: 'Confirm resets are intentional and session ownership is stable.',
        error_action_hint: 'Investigate repeated runtime resets and capture repro logs immediately.',
      },
      {
        reason_id: 'runtime_hydrated_from_take',
        warn_count: 3,
        error_count: 6,
        warn_action_hint: 'Review hydrate frequency and confirm timeline replay stability.',
        error_action_hint: 'Investigate hydrate loop or replay mismatch before further edits.',
      },
      {
        reason_id: 'active_take_changed',
        warn_count: 8,
        error_count: 16,
        warn_action_hint: 'Validate active-take switching cadence against operator workflow.',
        error_action_hint: 'Investigate take-binding churn and potential command routing drift.',
      },
      {
        reason_id: 'runtime_committed_to_take',
        warn_count: 12,
        error_count: 24,
        warn_action_hint: 'Check take commit throughput and verify expected save cadence.',
        error_action_hint: 'Investigate commit storm risk and take ledger growth immediately.',
      },
      {
        reason_id: 'runtime_committed_to_active_take',
        warn_count: 12,
        error_count: 24,
        warn_action_hint: 'Validate active-take commit cadence against timeline activity.',
        error_action_hint: 'Investigate sustained active-take commit pressure and queue drift.',
      },
    ],
  },
  event: {
    include_reason: true,
    include_emitted_at_ms: true,
    include_trend_summary: true,
    trend_summary_min_severity: 'warn',
    trend_summary_top_count: 2,
    allowed_reasons: FALLBACK_REASON_CATALOG.map(descriptor => descriptor.reason_id),
    reason_catalog: FALLBACK_REASON_CATALOG,
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
