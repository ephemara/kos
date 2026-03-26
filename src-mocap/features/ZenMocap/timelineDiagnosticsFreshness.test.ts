import { describe, expect, it } from 'vitest';

import {
  shouldApplyTimelineDiagnosticsUpdate,
  timelineDiagnosticsVersion,
} from './timelineDiagnosticsFreshness';

const SAMPLE_REPORT = {
  active_take_path: null,
  active_take_exists: false,
  active_track_count: 1,
  active_track_ids: ['pose_main'],
  track_keyframe_counts: { pose_main: 4 },
  event_log_size: 4,
  latest_event_timestamp_ms: 1000,
  event_source_counts: { 'sequencer-ui': 4 },
  recent_reason_counts: { runtime_requests_applied: 4 },
  recent_reason_trends: [],
};

describe('timelineDiagnosticsFreshness', () => {
  it('uses max(report timestamp, mutation emitted timestamp)', () => {
    const version = timelineDiagnosticsVersion(SAMPLE_REPORT, {
      reason: 'runtime_requests_applied',
      reason_detail: null,
      trend_summary: null,
      emitted_at_ms: 1500,
    });
    expect(version).toBe(1500);
  });

  it('accepts updates that are same or newer than current version', () => {
    expect(
      shouldApplyTimelineDiagnosticsUpdate(1000, SAMPLE_REPORT, {
        reason: null,
        reason_detail: null,
        trend_summary: null,
        emitted_at_ms: null,
      }),
    ).toBe(true);

    expect(
      shouldApplyTimelineDiagnosticsUpdate(999, SAMPLE_REPORT, {
        reason: null,
        reason_detail: null,
        trend_summary: null,
        emitted_at_ms: null,
      }),
    ).toBe(true);
  });

  it('rejects stale poll updates after newer event payloads', () => {
    const staleReport = {
      ...SAMPLE_REPORT,
      latest_event_timestamp_ms: 1200,
    };
    expect(
      shouldApplyTimelineDiagnosticsUpdate(2000, staleReport, {
        reason: null,
        reason_detail: null,
        trend_summary: null,
        emitted_at_ms: null,
      }),
    ).toBe(false);
  });
});
