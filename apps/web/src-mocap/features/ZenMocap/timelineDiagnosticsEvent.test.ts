import { describe, expect, it } from 'vitest';

import { coerceTimelineRuntimeDiagnosticsChangedPayload } from './timelineDiagnosticsEvent';

const SAMPLE_REPORT = {
  active_take_path: 'C:/takes/one.zenmocap',
  active_take_exists: true,
  active_track_count: 2,
  active_track_ids: ['pose_main', 'pose_secondary'],
  track_keyframe_counts: {
    pose_main: 10,
    pose_secondary: 4,
  },
  event_log_size: 14,
  latest_event_timestamp_ms: 1000,
  event_source_counts: {
    'sequencer-ui': 14,
  },
  recent_reason_counts: {
    runtime_requests_applied: 11,
    runtime_state_reset: 3,
  },
  recent_reason_trends: [
    {
      reason_id: 'runtime_requests_applied',
      label: 'Runtime Requests Applied',
      count: 11,
      severity: 'error',
      action_hint: 'No action needed unless drift warnings persist.',
    },
  ],
};

describe('timelineDiagnosticsEvent', () => {
  it('parses structured diagnostics-changed payloads', () => {
    const parsed = coerceTimelineRuntimeDiagnosticsChangedPayload({
      report: SAMPLE_REPORT,
      mutation: {
        reason: 'runtime_requests_applied',
        reason_detail: {
          reason_id: 'runtime_requests_applied',
          label: 'Runtime Requests Applied',
          severity: 'info',
          action_hint: 'No action needed unless drift warnings persist.',
        },
        trend_summary: {
          minimum_severity: 'warn',
          highest_severity: 'error',
          escalated_reason_count: 1,
          top_reasons: [
            {
              reason_id: 'runtime_requests_applied',
              label: 'Runtime Requests Applied',
              count: 11,
              severity: 'error',
              action_hint: 'No action needed unless drift warnings persist.',
            },
          ],
        },
        emitted_at_ms: 2000,
      },
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.report.active_track_count).toBe(2);
    expect(parsed?.mutation.reason).toBe('runtime_requests_applied');
    expect(parsed?.mutation.reason_detail?.label).toBe('Runtime Requests Applied');
    expect(parsed?.mutation.trend_summary?.minimum_severity).toBe('warn');
    expect(parsed?.mutation.trend_summary?.highest_severity).toBe('error');
    expect(parsed?.mutation.trend_summary?.top_reasons).toHaveLength(1);
    expect(parsed?.mutation.emitted_at_ms).toBe(2000);
  });

  it('supports legacy diagnostics-only event payloads', () => {
    const { recent_reason_counts: _ignored, recent_reason_trends: _ignoredTrends, ...legacyReport } = SAMPLE_REPORT;
    const parsed = coerceTimelineRuntimeDiagnosticsChangedPayload(legacyReport);

    expect(parsed).not.toBeNull();
    expect(parsed?.report.event_log_size).toBe(14);
    expect(parsed?.report.recent_reason_counts).toEqual({});
    expect(parsed?.report.recent_reason_trends).toEqual([]);
    expect(parsed?.mutation.reason).toBeNull();
    expect(parsed?.mutation.reason_detail).toBeNull();
    expect(parsed?.mutation.trend_summary).toBeNull();
    expect(parsed?.mutation.emitted_at_ms).toBeNull();
  });

  it('returns null for incompatible payloads', () => {
    expect(coerceTimelineRuntimeDiagnosticsChangedPayload({})).toBeNull();
    expect(coerceTimelineRuntimeDiagnosticsChangedPayload(null)).toBeNull();
    expect(coerceTimelineRuntimeDiagnosticsChangedPayload('bad')).toBeNull();
  });
});
