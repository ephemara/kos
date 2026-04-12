/**
 * MocapService
 *
 * All ZenMocap Tauri IPC lives here.
 * Extends BaseService — gets this.invoke<T>(), error handling, and dev logging for free.
 *
 * Pattern: follows the same convention as other K_OS services.
 * DO NOT call invoke() directly in components or hooks — go through this service.
 *
 * Command name contract (must match src-tauri/src/commands/mocap.rs exactly):
 *   mocap_start_session      → starts pipeline, emits mocap://joint_frame events
 *   mocap_stop_session       → tears down camera + inference
 *   mocap_set_paused(paused) → pause/resume without teardown
 *   mocap_set_recording(rec) → toggle recording flag on running session
 *   mocap_get_state          → returns SessionState enum from Rust
 *   mocap_update_ik(params)  → hot-update IK constraint params mid-session
 *   mocap_enumerate_cameras  → Vec<CameraInfo> from nokhwa
 *   mocap_list_models        → Vec<ModelEntry> from models manifest
 *
 * Events received from Rust (via app.emit):
 *   mocap://joint_frame  → JointFrame  (~30Hz)
 *   mocap://stats        → PipelineStats (~1Hz)
 *   mocap://status       → string ("running" on session start)
 *   mocap://error        → string (pipeline error — session stops)
 */

import { BaseService } from '@mocap/shared/services/BaseService';
import { invoke } from '@tauri-apps/api/core';
import type { TimelineRuntimeRequest } from '../Sequencer';
import type {
  SessionConfig,
  PipelineStats,
  SessionStatus,
  IKConstraints,
  CameraInfo,
  ModelEntry,
} from './types';

class MocapService extends BaseService {
  constructor() {
    super('MocapService');
  }

  // ─── Session Lifecycle ──────────────────────────────────────────────────────

  async startSession(config: SessionConfig): Promise<void> {
    return this.invoke('mocap_start_session', { config });
  }

  async stopSession(): Promise<void> {
    return this.invoke('mocap_stop_session');
  }

  /** Pause or resume. Pass paused=true to pause, false to resume. */
  async setPaused(paused: boolean): Promise<void> {
    return this.invoke('mocap_set_paused', { paused });
  }

  // ─── Recording ──────────────────────────────────────────────────────────────

  /** Toggle recording flag. Pipeline continues running while recording. */
  async setRecording(recording: boolean): Promise<void> {
    return this.invoke('mocap_set_recording', { recording });
  }

  // ─── Stats & Status ─────────────────────────────────────────────────────────

  /** Poll current session state from Rust side. */
  async getState(): Promise<string> {
    return this.invoke<string>('mocap_get_state');
  }

  // ─── IK Constraint Tuning ───────────────────────────────────────────────────

  /** Hot-update IK params mid-session. Applied on the next pipeline frame. */
  async updateIK(params: IKConstraints): Promise<void> {
    return this.invoke('mocap_update_ik', { params });
  }

  // ─── Sequencer Timeline Runtime ───────────────────────────────────────────────

  async applyTimelineRuntimeRequests(
    requests: TimelineRuntimeRequest[]
  ): Promise<TimelineRuntimeCommitReport> {
    return this.invoke<TimelineRuntimeCommitReport>('mocap_apply_timeline_runtime_requests', { requests });
  }

  async resetTimelineRuntimeState(): Promise<void> {
    return this.invoke('mocap_reset_timeline_runtime_state');
  }

  async commitTimelineRuntimeToTake(
    path: string,
    options?: TimelineRuntimeTakeCommitOptions
  ): Promise<TimelineRuntimeTakeCommitReport> {
    return this.invoke<TimelineRuntimeTakeCommitReport>('mocap_commit_timeline_runtime_to_take', {
      path,
      options,
    });
  }

  async hydrateTimelineRuntimeFromTake(path: string): Promise<TimelineRuntimeHydrateReport> {
    return this.invoke<TimelineRuntimeHydrateReport>('mocap_hydrate_timeline_runtime_from_take', { path });
  }

  async setTimelineRuntimeActiveTake(path: string | null): Promise<TimelineRuntimeActiveTakeReport> {
    return this.invoke<TimelineRuntimeActiveTakeReport>('mocap_set_timeline_runtime_active_take', { path });
  }

  async getTimelineRuntimeDiagnostics(): Promise<TimelineRuntimeDiagnosticsReport> {
    return this.invoke<TimelineRuntimeDiagnosticsReport>('mocap_get_timeline_runtime_diagnostics');
  }

  async getTimelineRuntimeDiagnosticsPolicy(): Promise<TimelineRuntimeDiagnosticsPolicy> {
    return this.invoke<TimelineRuntimeDiagnosticsPolicy>('mocap_get_timeline_runtime_diagnostics_policy');
  }

  async commitTimelineRuntimeToActiveTake(
    options?: TimelineRuntimeTakeCommitOptions
  ): Promise<TimelineRuntimeTakeCommitReport> {
    return this.invoke<TimelineRuntimeTakeCommitReport>('mocap_commit_timeline_runtime_to_active_take', {
      options,
    });
  }

  // ─── Device & Model Enumeration ─────────────────────────────────────────────

  async enumerateCameras(): Promise<CameraInfo[]> {
    return this.invoke<CameraInfo[]>('mocap_enumerate_cameras');
  }

  async listModels(): Promise<ModelEntry[]> {
    return this.invoke<ModelEntry[]>('mocap_list_models');
  }

  // ─── Native File Dialogs ────────────────────────────────────────────────────

  /** Open a native file-open dialog via Rust. Returns path or null if cancelled. */
  async openLoadTakeDialog(): Promise<string | null> {
    // Delegates to Rust's native dialog (shell-open-dialog via tauri-plugin-dialog on the Rust side)
    return invoke<string | null>('mocap_open_take_dialog').catch(() => null);
  }

  /** Open a native save dialog via Rust. Returns chosen path or null if cancelled. */
  async openSaveTakeDialog(defaultName = 'take_001.zenmocap'): Promise<string | null> {
    return invoke<string | null>('mocap_save_take_dialog', { default_name: defaultName }).catch(() => null);
  }

  // ─── Take Library ────────────────────────────────────────────────────────────

  /** List all saved takes from the ZenMocap takes directory. */
  async listTakes(): Promise<import('./types').TakeSummary[]> {
    return this.invoke<import('./types').TakeSummary[]>('mocap_list_takes');
  }

  /** Delete a take by its absolute path on disk. */
  async deleteTake(path: string): Promise<void> {
    return this.invoke('mocap_delete_take', { path });
  }

  /** Rename a take. Returns the new file path. */
  async renameTake(path: string, newName: string): Promise<string> {
    return this.invoke<string>('mocap_rename_take', { path, newName });
  }

  /**
   * Load a full take (all frames) for timeline playback.
   * Do NOT call this every tick — call once on take open, then scrub locally.
   */
  async loadTake(path: string): Promise<import('./types').AnimationTake> {
    return this.invoke<import('./types').AnimationTake>('mocap_load_take', { path });
  }
  // ─── Phase 4: Video Analysis ─────────────────────────────────────────────────

  /**
   * Probe a video file metadata (resolution, fps, frame count, duration).
   * Call before analyze to show info in the UI.
   */
  async probeVideo(path: string): Promise<import('./types').VideoProbeResult> {
    return this.invoke<import('./types').VideoProbeResult>('mocap_probe_video', { path });
  }

  /**
   * Start offline video analysis. Non-blocking — returns immediately.
   * Listen for `mocap://video_progress` events for progress updates.
   * `mocap://take_saved` fires when done (same as recording).
   */
  async analyzeVideo(config: import('./types').VideoAnalysisConfig): Promise<void> {
    return this.invoke('mocap_analyze_video', { config });
  }

  /** Request cancellation of the currently running offline video analysis. */
  async cancelVideoAnalysis(): Promise<void> {
    return this.invoke('mocap_cancel_video_analysis');
  }

}

// Singleton — matches the pattern used by other K_OS services
export const mocapService = new MocapService();

export interface TimelineRuntimeCommitReport {
  applied_request_count: number;
  emitted_event_count: number;
  active_track_count: number;
  event_log_size: number;
}

export interface TimelineRuntimeTakeCommitOptions {
  clear_runtime_state_after_commit?: boolean;
  merge_strategy?: 'append_unique' | 'replace';
}

export interface TimelineRuntimeTakeCommitReport {
  take_path: string;
  appended_event_count: number;
  skipped_duplicate_event_count: number;
  take_event_count: number;
  runtime_event_log_size: number;
}

export interface TimelineRuntimeHydrateReport {
  take_path: string;
  hydrated_track_count: number;
  hydrated_event_count: number;
}

export interface TimelineRuntimeActiveTakeReport {
  active_take_path: string | null;
  active_track_count: number;
  event_log_size: number;
}

export interface TimelineRuntimeDiagnosticsReport {
  generated_at_ms?: number;
  active_take_path: string | null;
  active_take_exists: boolean;
  active_track_count: number;
  active_track_ids: string[];
  track_keyframe_counts: Record<string, number>;
  event_log_size: number;
  latest_event_timestamp_ms: number | null;
  event_source_counts: Record<string, number>;
  recent_reason_counts: Record<string, number>;
  recent_reason_last_seen_ms?: Record<string, number>;
  recent_reason_trends: TimelineRuntimeDiagnosticsReasonTrend[];
}

export interface TimelineRuntimeDiagnosticsMutationMetadata {
  reason: string | null;
  reason_detail: TimelineRuntimeDiagnosticsReasonDescriptor | null;
  trend_summary?: TimelineRuntimeDiagnosticsTrendSummary | null;
  emitted_at_ms: number | null;
}

export interface TimelineRuntimeDiagnosticsReasonDescriptor {
  reason_id: string;
  label: string;
  severity: 'info' | 'warn' | 'error';
  action_hint: string;
}

export interface TimelineRuntimeDiagnosticsReasonTrend {
  reason_id: string;
  label: string;
  count: number;
  severity: 'info' | 'warn' | 'error';
  action_hint: string;
}

export interface TimelineRuntimeDiagnosticsTrendSummary {
  minimum_severity: 'info' | 'warn' | 'error';
  highest_severity: 'info' | 'warn' | 'error';
  escalated_reason_count: number;
  top_reasons: TimelineRuntimeDiagnosticsReasonTrend[];
}

export interface TimelineRuntimeDiagnosticsChangedEventPayload {
  report: TimelineRuntimeDiagnosticsReport;
  mutation: TimelineRuntimeDiagnosticsMutationMetadata;
}

export interface TimelineRuntimeDiagnosticsPolicy {
  policy_id: string;
  refresh: {
    enabled: boolean;
    interval_ms: number;
  };
  event: {
    include_reason: boolean;
    include_emitted_at_ms: boolean;
    include_trend_summary: boolean;
    trend_summary_min_severity: 'info' | 'warn' | 'error';
    trend_summary_top_count: number;
    allowed_reasons: string[];
    reason_catalog: TimelineRuntimeDiagnosticsReasonDescriptor[];
  };
  drift: {
    warn_pending_request_count: number;
    warn_queue_vs_ledger_gap: number;
  };
  trend: {
    reason_history_limit: number;
    top_reason_count: number;
    default_warn_count: number;
    default_error_count: number;
    decay_window_ms: number;
    cooldown_window_ms: number;
    reason_thresholds: Array<{
      reason_id: string;
      warn_count: number;
      error_count: number;
      warn_action_hint?: string;
      error_action_hint?: string;
    }>;
  };
  field_visibility: {
    show_active_take_path: boolean;
    show_take_existence: boolean;
    show_active_track_count: boolean;
    show_active_track_ids: boolean;
    show_event_log_size: boolean;
    show_latest_event_timestamp: boolean;
    show_track_keyframe_counts: boolean;
    show_event_source_counts: boolean;
    show_recent_reason_counts: boolean;
  };
}
