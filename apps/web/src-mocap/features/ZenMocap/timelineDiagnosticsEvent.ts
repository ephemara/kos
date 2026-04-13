import type {
  TimelineRuntimeDiagnosticsReasonDescriptor,
  TimelineRuntimeDiagnosticsReport,
  TimelineRuntimeDiagnosticsTrendSummary,
} from './MocapService';

export interface TimelineRuntimeDiagnosticsMutationMetadata {
  reason: string | null;
  reason_detail: TimelineRuntimeDiagnosticsReasonDescriptor | null;
  trend_summary: TimelineRuntimeDiagnosticsTrendSummary | null;
  emitted_at_ms: number | null;
}

export interface TimelineRuntimeDiagnosticsChangedEventPayload {
  report: TimelineRuntimeDiagnosticsReport;
  mutation: TimelineRuntimeDiagnosticsMutationMetadata;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isDiagnosticsReport(value: unknown): value is TimelineRuntimeDiagnosticsReport {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.active_track_count === 'number'
    && typeof value.event_log_size === 'number'
    && Array.isArray(value.active_track_ids)
    && typeof value.track_keyframe_counts === 'object'
    && value.track_keyframe_counts !== null
    && typeof value.event_source_counts === 'object'
    && value.event_source_counts !== null
    && (value.recent_reason_counts === undefined
      || (typeof value.recent_reason_counts === 'object' && value.recent_reason_counts !== null))
    && (value.recent_reason_trends === undefined || Array.isArray(value.recent_reason_trends));
}

function parseDiagnosticsReport(value: TimelineRuntimeDiagnosticsReport): TimelineRuntimeDiagnosticsReport {
  const recentReasonCounts = isRecord(value.recent_reason_counts)
    ? value.recent_reason_counts as Record<string, number>
    : {};
  const reasonTrends = Array.isArray(value.recent_reason_trends)
    ? value.recent_reason_trends.filter((entry): entry is TimelineRuntimeDiagnosticsReport['recent_reason_trends'][number] => (
      isRecord(entry)
      && typeof entry.reason_id === 'string'
      && typeof entry.label === 'string'
      && typeof entry.count === 'number'
      && (entry.severity === 'info' || entry.severity === 'warn' || entry.severity === 'error')
      && typeof entry.action_hint === 'string'
    ))
    : [];
  return {
    ...value,
    recent_reason_counts: recentReasonCounts,
    recent_reason_trends: reasonTrends,
  };
}

function parseMutationMetadata(value: unknown): TimelineRuntimeDiagnosticsMutationMetadata {
  if (!isRecord(value)) {
    return {
      reason: null,
      reason_detail: null,
      trend_summary: null,
      emitted_at_ms: null,
    };
  }

  const reason = typeof value.reason === 'string' ? value.reason : null;
  const reasonDetail = isRecord(value.reason_detail)
    && typeof value.reason_detail.reason_id === 'string'
    && typeof value.reason_detail.label === 'string'
    && typeof value.reason_detail.action_hint === 'string'
    && (value.reason_detail.severity === 'info'
      || value.reason_detail.severity === 'warn'
      || value.reason_detail.severity === 'error')
    ? {
      reason_id: value.reason_detail.reason_id,
      label: value.reason_detail.label,
      severity: value.reason_detail.severity as 'info' | 'warn' | 'error',
      action_hint: value.reason_detail.action_hint,
    }
    : null;
  const emittedAt = typeof value.emitted_at_ms === 'number' ? value.emitted_at_ms : null;
  const trendSummary = isRecord(value.trend_summary)
    && (value.trend_summary.minimum_severity === 'info'
      || value.trend_summary.minimum_severity === 'warn'
      || value.trend_summary.minimum_severity === 'error')
    && (value.trend_summary.highest_severity === 'info'
      || value.trend_summary.highest_severity === 'warn'
      || value.trend_summary.highest_severity === 'error')
    && typeof value.trend_summary.escalated_reason_count === 'number'
    && Array.isArray(value.trend_summary.top_reasons)
    ? {
      minimum_severity: value.trend_summary.minimum_severity as 'info' | 'warn' | 'error',
      highest_severity: value.trend_summary.highest_severity as 'info' | 'warn' | 'error',
      escalated_reason_count: value.trend_summary.escalated_reason_count,
      top_reasons: value.trend_summary.top_reasons.filter((entry): entry is TimelineRuntimeDiagnosticsTrendSummary['top_reasons'][number] => (
        isRecord(entry)
        && typeof entry.reason_id === 'string'
        && typeof entry.label === 'string'
        && typeof entry.count === 'number'
        && (entry.severity === 'info' || entry.severity === 'warn' || entry.severity === 'error')
        && typeof entry.action_hint === 'string'
      )),
    }
    : null;

  return {
    reason,
    reason_detail: reasonDetail,
    trend_summary: trendSummary,
    emitted_at_ms: emittedAt,
  };
}

export function coerceTimelineRuntimeDiagnosticsChangedPayload(
  payload: unknown,
): TimelineRuntimeDiagnosticsChangedEventPayload | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (isDiagnosticsReport(payload.report)) {
    return {
      report: parseDiagnosticsReport(payload.report),
      mutation: parseMutationMetadata(payload.mutation),
    };
  }

  if (isDiagnosticsReport(payload)) {
    return {
      report: parseDiagnosticsReport(payload),
      mutation: {
        reason: null,
        reason_detail: null,
        trend_summary: null,
        emitted_at_ms: null,
      },
    };
  }

  return null;
}
