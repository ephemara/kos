import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import { describe, expect, it, vi } from 'vitest';

import type {
  TimelineRuntimeDiagnosticsMutationMetadata,
  TimelineRuntimeDiagnosticsPolicy,
  TimelineRuntimeDiagnosticsReport,
} from '../MocapService';
import LiveLinkStatus from './LiveLinkStatus';
import { GpuDoctorPanel } from './GpuDoctorPanel';

const BASE_POLICY: TimelineRuntimeDiagnosticsPolicy = {
  policy_id: 'timeline-runtime-diagnostics-test',
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
    allowed_reasons: ['runtime_requests_applied'],
    reason_catalog: [
      {
        reason_id: 'runtime_requests_applied',
        label: 'Runtime Requests Applied',
        severity: 'info',
        action_hint: 'No action needed unless drift warnings persist.',
      },
    ],
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
        reason_id: 'runtime_state_reset',
        warn_count: 2,
        error_count: 4,
        warn_action_hint: 'Confirm resets are intentional and session ownership is stable.',
        error_action_hint: 'Investigate repeated runtime resets and capture repro logs immediately.',
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

const BASE_REPORT: TimelineRuntimeDiagnosticsReport = {
  active_take_path: 'C:/takes/alpha.zenmocap',
  active_take_exists: true,
  active_track_count: 2,
  active_track_ids: ['pose_main', 'pose_secondary'],
  track_keyframe_counts: {
    pose_main: 12,
    pose_secondary: 4,
  },
  event_log_size: 16,
  latest_event_timestamp_ms: 1700000000000,
  event_source_counts: {
    'sequencer-ui': 16,
  },
  recent_reason_counts: {
    runtime_requests_applied: 14,
    runtime_state_reset: 2,
  },
  recent_reason_trends: [
    {
      reason_id: 'runtime_requests_applied',
      label: 'Runtime Requests Applied',
      count: 14,
      severity: 'error',
      action_hint: 'No action needed unless drift warnings persist.',
    },
    {
      reason_id: 'runtime_state_reset',
      label: 'Runtime State Reset',
      count: 2,
      severity: 'warn',
      action_hint: 'Confirm timeline state was intentionally reset.',
    },
  ],
};

const BASE_MUTATION: TimelineRuntimeDiagnosticsMutationMetadata = {
  reason: 'runtime_requests_applied',
  reason_detail: {
    reason_id: 'runtime_requests_applied',
    label: 'Runtime Requests Applied',
    severity: 'info',
    action_hint: 'No action needed unless drift warnings persist.',
  },
  trend_summary: null,
  emitted_at_ms: 1700000001000,
};

describe('timeline diagnostics policy matrix UI', () => {
  it('hides status rows when field visibility flags are disabled', () => {
    const policy: TimelineRuntimeDiagnosticsPolicy = {
      ...BASE_POLICY,
      field_visibility: {
        ...BASE_POLICY.field_visibility,
        show_active_take_path: false,
        show_active_track_count: false,
        show_event_log_size: false,
        show_recent_reason_counts: false,
      },
    };

    render(
      <LiveLinkStatus
        stats={{
          fps: 30,
          avg_latency_ms: 12,
          peak_latency_ms: 20,
          frame_drops: 0,
          vram_mb: 512,
          udp_tx_count: 24,
          udp_connected: true,
        }}
        status="running"
        error={null}
        pendingTimelineRequestCount={0}
        timelineRuntimeDiagnostics={BASE_REPORT}
        timelineRuntimeMutation={BASE_MUTATION}
        timelineRuntimeDiagnosticsPolicy={policy}
      />,
    );

    expect(screen.queryByText('TL ACTIVE TAKE')).not.toBeInTheDocument();
    expect(screen.queryByText('TL TRACKS')).not.toBeInTheDocument();
    expect(screen.queryByText('TL EVENTS')).not.toBeInTheDocument();
    expect(screen.queryByText('TL REASON TREND')).not.toBeInTheDocument();
    expect(screen.getByText('Runtime Requests Applied')).toBeInTheDocument();
  });

  it('renders GPU Doctor info-tab diagnostics according to visibility and mutation metadata', async () => {
    vi.mocked(invoke).mockResolvedValue({
      name: 'Mock Adapter',
      backend: 'vulkan',
      driver: '1.2.3',
      driver_info: 'mock',
      vram_bytes: 1024 * 1024 * 1024,
      device_type: 'DiscreteGpu',
    });

    const policy: TimelineRuntimeDiagnosticsPolicy = {
      ...BASE_POLICY,
      field_visibility: {
        ...BASE_POLICY.field_visibility,
        show_event_source_counts: false,
        show_track_keyframe_counts: false,
        show_recent_reason_counts: true,
      },
    };

    const mutation: TimelineRuntimeDiagnosticsMutationMetadata = {
      reason: 'runtime_requests_applied',
      reason_detail: {
        reason_id: 'runtime_requests_applied',
        label: 'Runtime Requests Applied',
        severity: 'error',
        action_hint: 'Inspect queue drift and active take ownership.',
      },
      trend_summary: {
        minimum_severity: 'warn',
        highest_severity: 'error',
        escalated_reason_count: 1,
        top_reasons: [
          {
            reason_id: 'runtime_requests_applied',
            label: 'Runtime Requests Applied',
            count: 14,
            severity: 'error',
            action_hint: 'Inspect queue drift and active take ownership.',
          },
        ],
      },
      emitted_at_ms: 1700000002000,
    };

    render(
      <GpuDoctorPanel
        open
        onClose={() => {}}
        pipelineError={null}
        gpuHealth={[]}
        pendingTimelineRequestCount={2}
        timelineBridgeError={null}
        timelineRuntimeDiagnostics={BASE_REPORT}
        timelineRuntimeMutation={mutation}
        timelineRuntimeDiagnosticsPolicy={policy}
        onClearErrors={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'info' }));

    await waitFor(() => {
      expect(screen.getByText('Adapter')).toBeInTheDocument();
      expect(screen.getByText('Mock Adapter')).toBeInTheDocument();
    });

    expect(screen.queryByText('Sources')).not.toBeInTheDocument();
    expect(screen.getByText('Reason Trend')).toBeInTheDocument();
    expect(screen.queryByText('Track Keys')).not.toBeInTheDocument();
    expect(screen.getByText('Last Update Reason')).toBeInTheDocument();
    expect(screen.getByText('Runtime Requests Applied')).toBeInTheDocument();
    expect(screen.getByText('Update Severity')).toBeInTheDocument();
    expect(screen.getByText('ERROR')).toBeInTheDocument();
    expect(screen.getByText('Trend Escalation')).toBeInTheDocument();
    expect(screen.getByText('ERROR (1 escalated)')).toBeInTheDocument();
    expect(screen.getByText('Recommended Action')).toBeInTheDocument();
    expect(
      screen.getByText('Inspect queue drift and active take ownership.'),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(text => text.includes('Runtime Requests Applied:14(ERROR)')).length,
    ).toBeGreaterThan(0);
  });
});
