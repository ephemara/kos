import type {
  TimelineRuntimeDiagnosticsPolicy,
  TimelineRuntimeDiagnosticsReasonTrend,
  TimelineRuntimeDiagnosticsReport,
} from './MocapService';

function severityForCount(
  count: number,
  warnCount: number,
  errorCount: number,
): 'info' | 'warn' | 'error' {
  if (count >= errorCount) {
    return 'error';
  }
  if (count >= warnCount) {
    return 'warn';
  }
  return 'info';
}

function resolveTrendActionHint(
  count: number,
  threshold: TimelineRuntimeDiagnosticsPolicy['trend']['reason_thresholds'][number] | undefined,
  fallbackActionHint: string,
): string {
  if (!threshold) {
    return fallbackActionHint;
  }
  if (count >= threshold.error_count && threshold.error_action_hint) {
    return threshold.error_action_hint;
  }
  if (count >= threshold.warn_count && threshold.warn_action_hint) {
    return threshold.warn_action_hint;
  }
  return fallbackActionHint;
}

export function resolveTimelineReasonTrends(
  report: TimelineRuntimeDiagnosticsReport,
  policy: TimelineRuntimeDiagnosticsPolicy,
): TimelineRuntimeDiagnosticsReasonTrend[] {
  if (Object.keys(report.recent_reason_counts).length === 0 && report.recent_reason_trends.length > 0) {
    return report.recent_reason_trends;
  }

  const descriptorById = new Map(policy.event.reason_catalog.map(descriptor => [descriptor.reason_id, descriptor]));
  const thresholdById = new Map(policy.trend.reason_thresholds.map(threshold => [threshold.reason_id, threshold]));
  const generatedAtMs = report.generated_at_ms ?? Date.now();
  const lastSeenById = report.recent_reason_last_seen_ms ?? {};

  return Object.entries(report.recent_reason_counts)
    .map(([reasonId, count]) => {
      const descriptor = descriptorById.get(reasonId);
      const threshold = thresholdById.get(reasonId);
      const warnCount = threshold?.warn_count ?? policy.trend.default_warn_count;
      const errorCount = threshold?.error_count ?? policy.trend.default_error_count;
      const fallbackActionHint = descriptor?.action_hint ?? 'Review timeline runtime diagnostics for this reason.';
      const lastSeenMs = lastSeenById[reasonId];
      const cooldownExpired =
        typeof lastSeenMs === 'number' &&
        generatedAtMs - lastSeenMs > policy.trend.cooldown_window_ms;
      const severity = cooldownExpired
        ? 'info'
        : severityForCount(count, warnCount, errorCount);
      return {
        reason_id: reasonId,
        label: descriptor?.label ?? reasonId,
        count,
        severity,
        action_hint: cooldownExpired
          ? fallbackActionHint
          : resolveTrendActionHint(count, threshold, fallbackActionHint),
      };
    })
    .sort((left, right) => right.count - left.count || left.reason_id.localeCompare(right.reason_id));
}

export function formatTimelineReasonTrends(
  trends: TimelineRuntimeDiagnosticsReasonTrend[],
): string {
  if (trends.length === 0) {
    return '—';
  }
  return trends
    .map(trend => `${trend.label}:${trend.count}(${trend.severity.toUpperCase()})`)
    .join(', ');
}
