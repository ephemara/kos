import type {
  TimelineRuntimeDiagnosticsMutationMetadata,
  TimelineRuntimeDiagnosticsReport,
} from './MocapService';

export function timelineDiagnosticsVersion(
  report: TimelineRuntimeDiagnosticsReport,
  mutation: TimelineRuntimeDiagnosticsMutationMetadata | null,
): number {
  const reportTimestamp = report.latest_event_timestamp_ms ?? 0;
  const mutationTimestamp = mutation?.emitted_at_ms ?? 0;
  return Math.max(reportTimestamp, mutationTimestamp);
}

export function shouldApplyTimelineDiagnosticsUpdate(
  currentVersion: number,
  report: TimelineRuntimeDiagnosticsReport,
  mutation: TimelineRuntimeDiagnosticsMutationMetadata | null,
): boolean {
  return timelineDiagnosticsVersion(report, mutation) >= currentVersion;
}
