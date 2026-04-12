//! ZenMocap Tauri command interface.
//!
//! Thin proxy layer between React and `zen-mocap-engine`.
//! The session lives in a global `Mutex<MocapSession>`.
//! All heavy work happens inside `zen_mocap_engine::session`.
//!
//! ## Commands exposed to frontend
//! - `mocap_enumerate_cameras` → `Vec<CameraInfo>`
//! - `mocap_list_models`       → `Vec<ModelEntry>`
//! - `mocap_start_session`     → `Result<(), String>`
//! - `mocap_stop_session`      → `()`
//! - `mocap_set_paused`        → `()`
//! - `mocap_set_recording`     → `()`
//! - `mocap_update_ik`         → `()`
//! - `mocap_get_state`         → `SessionState`
//! - `mocap_apply_timeline_runtime_requests` → timeline runtime commit report
//! - `mocap_reset_timeline_runtime_state`    → `()`
//! - `mocap_set_timeline_runtime_active_take` → bind/unbind active take ownership for timeline runtime
//! - `mocap_get_timeline_runtime_diagnostics` → timeline runtime diagnostics snapshot
//! - `mocap_commit_timeline_runtime_to_take` → persist runtime event log into take
//! - `mocap_commit_timeline_runtime_to_active_take` → persist runtime event log using active take binding
//! - `mocap_hydrate_timeline_runtime_from_take` → rebuild runtime state from take
//!
//! ## Events emitted to frontend
//! - `mocap://joint_frame`  — `JointFrame`  at ~30Hz
//! - `mocap://stats`        — `PipelineStats` at ~1Hz
//! - `mocap://error`        — `String`
//! - `mocap://timeline_runtime_diagnostics_changed` — diagnostics snapshot after timeline runtime mutations

use lazy_static::lazy_static;
use parking_lot::Mutex;
use std::collections::{BTreeMap, BTreeSet, HashSet, VecDeque};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::broadcast::error::RecvError;

use zen_mocap_engine::{
    camera::CameraCapture,
    models::{list_models, ModelEntry},
    session::{MocapSession, SessionState},
    timeline_edit::{apply_keyframe_edit, TimelineTrackState},
    timeline_event::TimelineEditEvent,
    timeline_runtime::{apply_timeline_runtime_request, TimelineRuntimeRequest},
    timeline_runtime_diagnostics_policy::{
        timeline_runtime_diagnostics_policy, TimelineRuntimeDiagnosticsPolicy,
    },
    types::{CameraInfo, GpuInfo, IkConstraintParams, PipelineEvent, SessionConfig},
};

const TIMELINE_RUNTIME_DIAGNOSTICS_CHANGED_EVENT: &str =
    "mocap://timeline_runtime_diagnostics_changed";

// ─── Global Session State ─────────────────────────────────────────────────────

lazy_static! {
    static ref MOCAP_SESSION: Mutex<MocapSession> = {
        let (session, _rx) = MocapSession::new();
        // NOTE: the receiver from `new()` is discarded here.
        // Actual listeners are re-subscribed per command via session.subscribe().
        Mutex::new(session)
    };
    static ref VIDEO_ANALYSIS_CANCEL: Arc<AtomicBool> = Arc::new(AtomicBool::new(false));
    static ref TIMELINE_RUNTIME_STATE: Mutex<TimelineRuntimeState> =
        Mutex::new(TimelineRuntimeState::default());
}

#[derive(Default)]
struct TimelineRuntimeState {
    tracks: std::collections::HashMap<String, TimelineTrackState>,
    event_log: Vec<TimelineEditEvent>,
    active_take_path: Option<String>,
    recent_mutation_reasons: VecDeque<TimelineMutationReasonEntry>,
}

#[derive(Debug, Clone)]
struct TimelineMutationReasonEntry {
    reason_id: String,
    timestamp_ms: u64,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct TimelineRuntimeCommitReport {
    pub applied_request_count: usize,
    pub emitted_event_count: usize,
    pub active_track_count: usize,
    pub event_log_size: usize,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(default)]
pub struct TimelineRuntimeTakeCommitOptions {
    pub clear_runtime_state_after_commit: bool,
    pub merge_strategy: TimelineRuntimeTakeCommitMergeStrategy,
}

#[derive(Debug, Clone, Copy, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TimelineRuntimeTakeCommitMergeStrategy {
    AppendUnique,
    Replace,
}

impl Default for TimelineRuntimeTakeCommitMergeStrategy {
    fn default() -> Self {
        Self::AppendUnique
    }
}

impl Default for TimelineRuntimeTakeCommitOptions {
    fn default() -> Self {
        Self {
            clear_runtime_state_after_commit: false,
            merge_strategy: TimelineRuntimeTakeCommitMergeStrategy::default(),
        }
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct TimelineRuntimeTakeCommitReport {
    pub take_path: String,
    pub appended_event_count: usize,
    pub skipped_duplicate_event_count: usize,
    pub take_event_count: usize,
    pub runtime_event_log_size: usize,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct TimelineRuntimeHydrateReport {
    pub take_path: String,
    pub hydrated_track_count: usize,
    pub hydrated_event_count: usize,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct TimelineRuntimeActiveTakeReport {
    pub active_take_path: Option<String>,
    pub active_track_count: usize,
    pub event_log_size: usize,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct TimelineRuntimeDiagnosticsReport {
    pub generated_at_ms: u64,
    pub active_take_path: Option<String>,
    pub active_take_exists: bool,
    pub active_track_count: usize,
    pub active_track_ids: Vec<String>,
    pub track_keyframe_counts: BTreeMap<String, usize>,
    pub event_log_size: usize,
    pub latest_event_timestamp_ms: Option<u64>,
    pub event_source_counts: BTreeMap<String, usize>,
    pub recent_reason_counts: BTreeMap<String, usize>,
    pub recent_reason_last_seen_ms: BTreeMap<String, u64>,
    pub recent_reason_trends: Vec<TimelineRuntimeDiagnosticsReasonTrend>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct TimelineRuntimeDiagnosticsMutationMetadata {
    pub reason: Option<String>,
    pub reason_detail: Option<TimelineRuntimeDiagnosticsReasonMetadata>,
    pub trend_summary: Option<TimelineRuntimeDiagnosticsTrendSummary>,
    pub emitted_at_ms: Option<u64>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct TimelineRuntimeDiagnosticsReasonMetadata {
    pub reason_id: String,
    pub label: String,
    pub severity: String,
    pub action_hint: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct TimelineRuntimeDiagnosticsReasonTrend {
    pub reason_id: String,
    pub label: String,
    pub count: usize,
    pub severity: String,
    pub action_hint: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct TimelineRuntimeDiagnosticsTrendSummary {
    pub minimum_severity: String,
    pub highest_severity: String,
    pub escalated_reason_count: usize,
    pub top_reasons: Vec<TimelineRuntimeDiagnosticsReasonTrend>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct TimelineRuntimeDiagnosticsChangedPayload {
    pub report: TimelineRuntimeDiagnosticsReport,
    pub mutation: TimelineRuntimeDiagnosticsMutationMetadata,
}

fn trend_severity_rank(severity: &str) -> usize {
    match severity {
        "error" => 2,
        "warn" => 1,
        _ => 0,
    }
}

fn normalize_timeline_runtime_diagnostics_reason(
    policy: &TimelineRuntimeDiagnosticsPolicy,
    reason: &str,
) -> String {
    if policy
        .event
        .allowed_reasons
        .iter()
        .any(|candidate| candidate == reason)
    {
        reason.to_string()
    } else {
        let fallback = policy
            .event
            .allowed_reasons
            .first()
            .cloned()
            .unwrap_or_else(|| "runtime_requests_applied".to_string());
        log::warn!(
            "[zen-mocap] diagnostics reason '{}' not allowed by policy '{}'; using fallback '{}'",
            reason,
            policy.policy_id,
            fallback
        );
        fallback
    }
}

fn build_timeline_runtime_diagnostics_report(
    state: &TimelineRuntimeState,
    policy: &TimelineRuntimeDiagnosticsPolicy,
    now_ms: u64,
) -> TimelineRuntimeDiagnosticsReport {
    let mut active_track_ids = state.tracks.keys().cloned().collect::<Vec<_>>();
    active_track_ids.sort();
    let mut track_keyframe_counts = state
        .tracks
        .iter()
        .map(|(track_id, track)| (track_id.clone(), track.keyframes.len()))
        .collect::<BTreeMap<_, _>>();
    let mut latest_event_timestamp_ms =
        state.event_log.iter().map(|event| event.timestamp_ms).max();
    let mut event_source_counts: BTreeMap<String, usize> = BTreeMap::new();
    for event in &state.event_log {
        *event_source_counts
            .entry(event.source_id.clone())
            .or_insert(0) += 1;
    }
    let decay_cutoff_ms = now_ms.saturating_sub(policy.trend.decay_window_ms);
    let mut reason_histogram: BTreeMap<String, usize> = BTreeMap::new();
    let mut reason_last_seen_ms: BTreeMap<String, u64> = BTreeMap::new();
    for entry in &state.recent_mutation_reasons {
        if entry.timestamp_ms < decay_cutoff_ms {
            continue;
        }
        *reason_histogram.entry(entry.reason_id.clone()).or_insert(0) += 1;
        reason_last_seen_ms
            .entry(entry.reason_id.clone())
            .and_modify(|timestamp| *timestamp = (*timestamp).max(entry.timestamp_ms))
            .or_insert(entry.timestamp_ms);
    }
    let mut reason_entries = reason_histogram.into_iter().collect::<Vec<_>>();
    reason_entries.sort_by(|(left_reason, left_count), (right_reason, right_count)| {
        right_count
            .cmp(left_count)
            .then_with(|| left_reason.cmp(right_reason))
    });
    reason_entries.truncate(policy.trend.top_reason_count);
    let mut recent_reason_counts = reason_entries.into_iter().collect::<BTreeMap<_, _>>();
    reason_last_seen_ms.retain(|reason_id, _| recent_reason_counts.contains_key(reason_id));
    let mut recent_reason_trends = recent_reason_counts
        .iter()
        .map(|(reason_id, count)| {
            let reason_detail = policy.event.reason_descriptor(reason_id);
            let cooldown_expired = reason_last_seen_ms
                .get(reason_id)
                .map(|last_seen_ms| {
                    now_ms.saturating_sub(*last_seen_ms) > policy.trend.cooldown_window_ms
                })
                .unwrap_or(false);
            let severity = if cooldown_expired {
                "info".to_string()
            } else {
                policy
                    .trend_severity_for_count(reason_id, *count)
                    .to_string()
            };
            TimelineRuntimeDiagnosticsReasonTrend {
                reason_id: reason_id.clone(),
                label: reason_detail
                    .map(|descriptor| descriptor.label.clone())
                    .unwrap_or_else(|| reason_id.clone()),
                count: *count,
                severity: severity.clone(),
                action_hint: if cooldown_expired {
                    reason_detail
                        .map(|descriptor| descriptor.action_hint.clone())
                        .unwrap_or_else(|| {
                            "Recent trend cooled down; continue monitoring this reason.".to_string()
                        })
                } else {
                    policy
                        .trend_action_hint_for_count(reason_id, *count)
                        .map(str::to_string)
                        .or_else(|| reason_detail.map(|descriptor| descriptor.action_hint.clone()))
                        .unwrap_or_else(|| {
                            "Review timeline runtime diagnostics for this reason.".to_string()
                        })
                },
            }
        })
        .collect::<Vec<_>>();
    recent_reason_trends.sort_by(|left, right| {
        right
            .count
            .cmp(&left.count)
            .then_with(|| left.reason_id.cmp(&right.reason_id))
    });
    let mut active_take_exists = state
        .active_take_path
        .as_ref()
        .map(|path| std::path::Path::new(path).exists())
        .unwrap_or(false);
    let mut active_take_path = state.active_take_path.clone();

    if !policy.field_visibility.show_active_track_ids {
        active_track_ids.clear();
    }
    if !policy.field_visibility.show_track_keyframe_counts {
        track_keyframe_counts.clear();
    }
    if !policy.field_visibility.show_latest_event_timestamp {
        latest_event_timestamp_ms = None;
    }
    if !policy.field_visibility.show_event_source_counts {
        event_source_counts.clear();
    }
    if !policy.field_visibility.show_recent_reason_counts {
        recent_reason_counts.clear();
        reason_last_seen_ms.clear();
        recent_reason_trends.clear();
    }
    if !policy.field_visibility.show_take_existence {
        active_take_exists = false;
    }
    if !policy.field_visibility.show_active_take_path {
        active_take_path = None;
    }

    TimelineRuntimeDiagnosticsReport {
        generated_at_ms: now_ms,
        active_take_path,
        active_take_exists,
        active_track_count: if policy.field_visibility.show_active_track_count {
            state.tracks.len()
        } else {
            0
        },
        active_track_ids,
        track_keyframe_counts,
        event_log_size: if policy.field_visibility.show_event_log_size {
            state.event_log.len()
        } else {
            0
        },
        latest_event_timestamp_ms,
        event_source_counts,
        recent_reason_counts,
        recent_reason_last_seen_ms: reason_last_seen_ms,
        recent_reason_trends,
    }
}

fn build_timeline_runtime_diagnostics_changed_payload(
    state: &TimelineRuntimeState,
    policy: &TimelineRuntimeDiagnosticsPolicy,
    reason: &str,
    emitted_at_ms: u64,
) -> TimelineRuntimeDiagnosticsChangedPayload {
    let report = build_timeline_runtime_diagnostics_report(state, policy, emitted_at_ms);
    let normalized_reason = normalize_timeline_runtime_diagnostics_reason(policy, reason);
    let reason_detail = policy
        .event
        .reason_descriptor(&normalized_reason)
        .map(|descriptor| TimelineRuntimeDiagnosticsReasonMetadata {
            reason_id: descriptor.reason_id.clone(),
            label: descriptor.label.clone(),
            severity: descriptor.severity.clone(),
            action_hint: descriptor.action_hint.clone(),
        });
    let trend_summary = if policy.event.include_trend_summary {
        let minimum_severity_rank =
            trend_severity_rank(policy.event.trend_summary_min_severity.as_str());
        let mut escalated_trends = report
            .recent_reason_trends
            .iter()
            .filter(|trend| trend_severity_rank(&trend.severity) >= minimum_severity_rank)
            .cloned()
            .collect::<Vec<_>>();
        escalated_trends.sort_by(|left, right| {
            trend_severity_rank(&right.severity)
                .cmp(&trend_severity_rank(&left.severity))
                .then_with(|| right.count.cmp(&left.count))
                .then_with(|| left.reason_id.cmp(&right.reason_id))
        });
        let highest_severity = escalated_trends
            .first()
            .map(|trend| trend.severity.clone())
            .unwrap_or_else(|| "info".to_string());
        let escalated_reason_count = escalated_trends.len();
        escalated_trends.truncate(policy.event.trend_summary_top_count);
        Some(TimelineRuntimeDiagnosticsTrendSummary {
            minimum_severity: policy.event.trend_summary_min_severity.clone(),
            highest_severity,
            escalated_reason_count,
            top_reasons: escalated_trends,
        })
    } else {
        None
    };
    let mutation = TimelineRuntimeDiagnosticsMutationMetadata {
        reason: policy
            .event
            .include_reason
            .then(|| normalized_reason.clone()),
        reason_detail: policy
            .event
            .include_reason
            .then_some(reason_detail)
            .flatten(),
        trend_summary,
        emitted_at_ms: if policy.event.include_emitted_at_ms {
            Some(emitted_at_ms)
        } else {
            None
        },
    };
    TimelineRuntimeDiagnosticsChangedPayload { report, mutation }
}

fn emit_timeline_runtime_diagnostics_changed(app: &AppHandle, reason: &str) {
    let policy = timeline_runtime_diagnostics_policy();
    let normalized_reason = normalize_timeline_runtime_diagnostics_reason(policy, reason);
    let mut state = TIMELINE_RUNTIME_STATE.lock();
    let emitted_at_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0);
    state
        .recent_mutation_reasons
        .push_back(TimelineMutationReasonEntry {
            reason_id: normalized_reason.clone(),
            timestamp_ms: emitted_at_ms,
        });
    while state.recent_mutation_reasons.len() > policy.trend.reason_history_limit {
        state.recent_mutation_reasons.pop_front();
    }
    let payload = build_timeline_runtime_diagnostics_changed_payload(
        &state,
        policy,
        &normalized_reason,
        emitted_at_ms,
    );
    if let Err(error) = app.emit(TIMELINE_RUNTIME_DIAGNOSTICS_CHANGED_EVENT, &payload) {
        log::warn!(
            "[zen-mocap] failed to emit timeline runtime diagnostics changed event: {}",
            error
        );
    }
}

// ─── Commands ────────────────────────────────────────────────────────────────

/// Enumerate connected camera devices.
#[tauri::command]
pub fn mocap_enumerate_cameras() -> Vec<CameraInfo> {
    CameraCapture::enumerate()
}

/// List all available pose models from the embedded manifest.
#[tauri::command]
pub fn mocap_list_models() -> Vec<ModelEntry> {
    list_models().to_vec()
}

/// Get the current session state.
#[tauri::command]
pub fn mocap_get_state() -> SessionState {
    MOCAP_SESSION.lock().current_state()
}

/// Start a capture session with the given config.
/// Spawns the pipeline loop and begins emitting `mocap://joint_frame` events.
#[tauri::command]
pub async fn mocap_start_session(app: AppHandle, config: SessionConfig) -> Result<(), String> {
    // Subscribe before starting so we don't miss the first frame
    let mut rx = MOCAP_SESSION.lock().subscribe();

    // Start in a blocking task so the MutexGuard is never held across .await
    // (parking_lot::MutexGuard is not Send — can't cross await points)
    let config_clone = config.clone();
    tokio::task::spawn_blocking(move || {
        // We can't .await inside spawn_blocking, so we create a local runtime
        // just for this call. The pipeline itself will use the main Tauri runtime.
        tokio::runtime::Handle::current()
            .block_on(async { MOCAP_SESSION.lock().start(config_clone).await })
    })
    .await
    .map_err(|e| format!("Task join error: {e}"))??;
    // Spawn the event forwarding task (pipeline → Tauri → React)
    tokio::spawn(async move {
        loop {
            match rx.recv().await {
                Ok(event) => {
                    match event {
                        PipelineEvent::Frame(frame) => {
                            app.emit("mocap://joint_frame", &frame).ok();
                        }
                        PipelineEvent::Stats(stats) => {
                            app.emit("mocap://stats", &stats).ok();
                        }
                        PipelineEvent::Error(msg) => {
                            app.emit("mocap://error", &msg).ok();
                            break;
                        }
                        PipelineEvent::SessionStopped => {
                            break;
                        }
                        PipelineEvent::SessionStarted => {
                            app.emit("mocap://status", "running").ok();
                        }
                        PipelineEvent::TakeSaved {
                            name,
                            path,
                            frame_count,
                        } => {
                            #[derive(serde::Serialize, Clone)]
                            struct TakeSavedPayload {
                                name: String,
                                path: String,
                                frame_count: usize,
                            }
                            app.emit(
                                "mocap://take_saved",
                                TakeSavedPayload {
                                    name,
                                    path,
                                    frame_count,
                                },
                            )
                            .ok();
                        }
                        PipelineEvent::GpuHealth(health) => {
                            // GPU doctor event — forward to frontend verbatim
                            app.emit("mocap://gpu_health", &health).ok();
                        }
                        PipelineEvent::CameraFrame {
                            data,
                            width,
                            height,
                            timestamp_ms,
                        } => {
                            // Forward camera frame to webcam preview window
                            #[derive(serde::Serialize, Clone)]
                            struct CameraFramePayload {
                                data: Vec<u8>,
                                width: u32,
                                height: u32,
                                timestamp_ms: f64,
                            }
                            app.emit(
                                "mocap://camera_frame",
                                CameraFramePayload {
                                    data,
                                    width,
                                    height,
                                    timestamp_ms,
                                },
                            )
                            .ok();
                        }
                    }
                }
                Err(RecvError::Lagged(n)) => {
                    log::warn!("[zen-mocap] Event channel lagged by {} messages — increase buffer if needed", n);
                }
                Err(RecvError::Closed) => {
                    break;
                }
            }
        }
    });

    Ok(())
}

/// Stop the active session. Cleans up camera and inference resources.
#[tauri::command]
pub fn mocap_stop_session() {
    MOCAP_SESSION.lock().stop();
}

/// Pause or resume the pipeline without tearing it down.
#[tauri::command]
pub fn mocap_set_paused(paused: bool) {
    MOCAP_SESSION.lock().set_paused(paused);
}

/// Toggle recording mode (pipeline continues but frames are flagged for saving).
#[tauri::command]
pub fn mocap_set_recording(recording: bool) {
    MOCAP_SESSION.lock().set_recording(recording);
}

/// Hot-update IK solver parameters while the session is running.
/// Called from the IKConstraintPanel sliders — applies on the next frame.
#[tauri::command]
pub fn mocap_update_ik(params: IkConstraintParams) {
    MOCAP_SESSION.lock().update_ik_params(params);
}

fn single_track_id_for_request(request: &TimelineRuntimeRequest) -> Result<String, String> {
    if request.envelopes.is_empty() {
        return Err("Timeline runtime request must contain at least one envelope.".to_string());
    }

    let track_ids: HashSet<String> = request
        .envelopes
        .iter()
        .map(|envelope| envelope.track_id.clone())
        .collect();

    if track_ids.len() != 1 {
        let mut sorted_ids = track_ids.into_iter().collect::<Vec<_>>();
        sorted_ids.sort();
        return Err(format!(
            "Timeline runtime request must target exactly one track, found [{}].",
            sorted_ids.join(", ")
        ));
    }

    Ok(track_ids
        .into_iter()
        .next()
        .expect("single-track set must contain one id"))
}

/// Apply sequencer/bridge runtime requests through the engine's authoritative timeline runtime.
/// Requests are committed atomically per request and event logs are preserved in process memory.
#[tauri::command]
pub fn mocap_apply_timeline_runtime_requests(
    app: AppHandle,
    requests: Vec<TimelineRuntimeRequest>,
) -> Result<TimelineRuntimeCommitReport, String> {
    if requests.is_empty() {
        return Ok(TimelineRuntimeCommitReport {
            applied_request_count: 0,
            emitted_event_count: 0,
            active_track_count: TIMELINE_RUNTIME_STATE.lock().tracks.len(),
            event_log_size: TIMELINE_RUNTIME_STATE.lock().event_log.len(),
        });
    }

    let mut state = TIMELINE_RUNTIME_STATE.lock();
    let mut emitted_event_count = 0usize;
    let applied_request_count = requests.len();

    for request in requests {
        let track_id = single_track_id_for_request(&request)?;
        let existing_event_log = state.event_log.clone();
        let track = state
            .tracks
            .entry(track_id.clone())
            .or_insert_with(|| TimelineTrackState::new(&track_id));

        let result =
            apply_timeline_runtime_request(track, &existing_event_log, request).map_err(|err| {
                format!("Timeline runtime apply failed for track '{track_id}': {err}")
            })?;
        emitted_event_count += result.emitted_events.len();
        state.event_log.extend(result.emitted_events);
    }

    let report = TimelineRuntimeCommitReport {
        applied_request_count,
        emitted_event_count,
        active_track_count: state.tracks.len(),
        event_log_size: state.event_log.len(),
    };
    drop(state);
    emit_timeline_runtime_diagnostics_changed(&app, "runtime_requests_applied");
    Ok(report)
}

/// Reset in-memory timeline runtime state used by sequencer bridge command integration.
#[tauri::command]
pub fn mocap_reset_timeline_runtime_state(app: AppHandle) {
    *TIMELINE_RUNTIME_STATE.lock() = TimelineRuntimeState::default();
    emit_timeline_runtime_diagnostics_changed(&app, "runtime_state_reset");
}

/// Return the shared diagnostics policy loaded from engine resources manifest.
#[tauri::command]
pub fn mocap_get_timeline_runtime_diagnostics_policy() -> TimelineRuntimeDiagnosticsPolicy {
    timeline_runtime_diagnostics_policy().clone()
}

/// Return a snapshot of timeline runtime ownership and ledger health.
#[tauri::command]
pub fn mocap_get_timeline_runtime_diagnostics() -> TimelineRuntimeDiagnosticsReport {
    let policy = timeline_runtime_diagnostics_policy();
    let state = TIMELINE_RUNTIME_STATE.lock();
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0);
    build_timeline_runtime_diagnostics_report(&state, policy, now_ms)
}

/// Set or clear active take ownership for timeline runtime persistence.
#[tauri::command]
pub fn mocap_set_timeline_runtime_active_take(
    app: AppHandle,
    path: Option<String>,
) -> Result<TimelineRuntimeActiveTakeReport, String> {
    let mut state = TIMELINE_RUNTIME_STATE.lock();
    state.active_take_path = match path {
        Some(raw) => {
            let trimmed = raw.trim();
            if trimmed.is_empty() {
                return Err("Active take path cannot be empty.".to_string());
            }
            let take_path = std::path::Path::new(trimmed);
            if !take_path.exists() {
                return Err(format!(
                    "Cannot bind active take path '{}': file does not exist.",
                    take_path.display()
                ));
            }
            Some(trimmed.to_string())
        }
        None => None,
    };

    let report = TimelineRuntimeActiveTakeReport {
        active_take_path: state.active_take_path.clone(),
        active_track_count: state.tracks.len(),
        event_log_size: state.event_log.len(),
    };
    drop(state);
    emit_timeline_runtime_diagnostics_changed(&app, "active_take_changed");
    Ok(report)
}

fn commit_runtime_state_to_take(
    state: &mut TimelineRuntimeState,
    path: &str,
    options: TimelineRuntimeTakeCommitOptions,
) -> Result<TimelineRuntimeTakeCommitReport, String> {
    let take_path = std::path::Path::new(path);
    let mut take = zen_mocap_engine::take::load_take(take_path)
        .map_err(|err| format!("Failed to load take for runtime commit: {err}"))?;
    let mut appended_event_count = 0usize;
    let mut skipped_duplicate_event_count = 0usize;

    match options.merge_strategy {
        TimelineRuntimeTakeCommitMergeStrategy::Replace => {
            appended_event_count = state.event_log.len();
            take.timeline_edit_events = state.event_log.clone();
        }
        TimelineRuntimeTakeCommitMergeStrategy::AppendUnique => {
            let mut known_event_ids: BTreeSet<String> = take
                .timeline_edit_events
                .iter()
                .map(|event| event.event_id.clone())
                .collect();
            for event in &state.event_log {
                if known_event_ids.insert(event.event_id.clone()) {
                    take.timeline_edit_events.push(event.clone());
                    appended_event_count += 1;
                } else {
                    skipped_duplicate_event_count += 1;
                }
            }
        }
    }

    zen_mocap_engine::take::save_take(&take, take_path)
        .map_err(|err| format!("Failed to save take after runtime commit: {err}"))?;

    if options.clear_runtime_state_after_commit {
        state.tracks.clear();
        state.event_log.clear();
    }

    Ok(TimelineRuntimeTakeCommitReport {
        take_path: path.to_string(),
        appended_event_count,
        skipped_duplicate_event_count,
        take_event_count: take.timeline_edit_events.len(),
        runtime_event_log_size: state.event_log.len(),
    })
}

/// Persist in-memory timeline runtime events into a take's `timeline_edit_events` ledger.
/// Existing take events are retained; duplicate event IDs are skipped.
#[tauri::command]
pub fn mocap_commit_timeline_runtime_to_take(
    app: AppHandle,
    path: String,
    options: Option<TimelineRuntimeTakeCommitOptions>,
) -> Result<TimelineRuntimeTakeCommitReport, String> {
    let options = options.unwrap_or_default();
    let mut state = TIMELINE_RUNTIME_STATE.lock();
    state.active_take_path = Some(path.clone());
    let report = commit_runtime_state_to_take(&mut state, &path, options)?;
    drop(state);
    emit_timeline_runtime_diagnostics_changed(&app, "runtime_committed_to_active_take");
    Ok(report)
}

/// Persist in-memory timeline runtime events using active take ownership.
#[tauri::command]
pub fn mocap_commit_timeline_runtime_to_active_take(
    app: AppHandle,
    options: Option<TimelineRuntimeTakeCommitOptions>,
) -> Result<TimelineRuntimeTakeCommitReport, String> {
    let options = options.unwrap_or_default();
    let mut state = TIMELINE_RUNTIME_STATE.lock();
    let path = state
        .active_take_path
        .clone()
        .ok_or_else(|| "No active take bound for timeline runtime commit.".to_string())?;
    let report = commit_runtime_state_to_take(&mut state, &path, options)?;
    drop(state);
    emit_timeline_runtime_diagnostics_changed(&app, "runtime_committed_to_take");
    Ok(report)
}

fn hydrate_runtime_state_from_event_log(
    events: &[TimelineEditEvent],
) -> Result<TimelineRuntimeState, String> {
    let mut state = TimelineRuntimeState::default();
    for event in events {
        let track = state
            .tracks
            .entry(event.track_id.clone())
            .or_insert_with(|| TimelineTrackState::new(event.track_id.clone()));
        let replayed = apply_keyframe_edit(track, event.op.clone()).map_err(|err| {
            format!(
                "Timeline hydrate failed for track '{}' event '{}': {err}",
                event.track_id, event.event_id
            )
        })?;
        if replayed.patch != event.patch {
            return Err(format!(
                "Timeline hydrate patch mismatch for track '{}' event '{}': persisted patch does not match replayed patch.",
                event.track_id, event.event_id
            ));
        }
        state.event_log.push(event.clone());
    }
    Ok(state)
}

/// Load a take and hydrate timeline runtime state from its persisted timeline event ledger.
#[tauri::command]
pub fn mocap_hydrate_timeline_runtime_from_take(
    app: AppHandle,
    path: String,
) -> Result<TimelineRuntimeHydrateReport, String> {
    let take_path = std::path::Path::new(&path);
    let take = zen_mocap_engine::take::load_take(take_path)
        .map_err(|err| format!("Failed to load take for timeline hydrate: {err}"))?;
    let mut hydrated = hydrate_runtime_state_from_event_log(&take.timeline_edit_events)?;
    let hydrated_track_count = hydrated.tracks.len();
    let hydrated_event_count = hydrated.event_log.len();
    hydrated.active_take_path = Some(path.clone());
    *TIMELINE_RUNTIME_STATE.lock() = hydrated;

    let report = TimelineRuntimeHydrateReport {
        take_path: path,
        hydrated_track_count,
        hydrated_event_count,
    };
    emit_timeline_runtime_diagnostics_changed(&app, "runtime_hydrated_from_take");
    Ok(report)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;
    use zen_mocap_engine::timeline_edit::{
        apply_keyframe_edit, KeyframeEditOp, KeyframeInterpolation, KeyframeSample,
        TimelineTrackPatch,
    };

    fn sample(frame: u32, value: i64) -> KeyframeSample {
        KeyframeSample {
            frame,
            value: Value::from(value),
            interpolation: KeyframeInterpolation::Linear,
        }
    }

    #[test]
    fn hydrate_rejects_patch_mismatch() {
        let event = TimelineEditEvent {
            event_id: "event_1".to_string(),
            track_id: "pose_main".to_string(),
            source_id: "sequencer-ui".to_string(),
            session_frame: 5,
            timestamp_ms: 1000,
            op: KeyframeEditOp::Upsert {
                sample: sample(5, 10),
            },
            patch: TimelineTrackPatch {
                prior_keyframes: vec![],
            },
        };

        let result = hydrate_runtime_state_from_event_log(&[event]);
        assert!(result.is_err(), "hydrate should reject mismatched patch");
        let error = result.err().unwrap_or_default();
        assert!(error.contains("patch mismatch"));
    }

    #[test]
    fn hydrate_accepts_replayable_event_log() {
        let mut track = TimelineTrackState::new("pose_main");
        let applied = apply_keyframe_edit(
            &mut track,
            KeyframeEditOp::Upsert {
                sample: sample(5, 10),
            },
        )
        .expect("upsert should succeed");

        let event = TimelineEditEvent {
            event_id: "event_1".to_string(),
            track_id: "pose_main".to_string(),
            source_id: "sequencer-ui".to_string(),
            session_frame: 5,
            timestamp_ms: 1000,
            op: KeyframeEditOp::Upsert {
                sample: sample(5, 10),
            },
            patch: applied.patch,
        };

        let hydrated =
            hydrate_runtime_state_from_event_log(&[event]).expect("hydrate should succeed");
        assert_eq!(hydrated.event_log.len(), 1);
        assert_eq!(hydrated.tracks.len(), 1);
    }

    #[test]
    fn diagnostics_report_reflects_runtime_state() {
        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis() as u64)
            .unwrap_or(0);
        let mut track = TimelineTrackState::new("pose_main");
        let applied = apply_keyframe_edit(
            &mut track,
            KeyframeEditOp::Upsert {
                sample: sample(3, 42),
            },
        )
        .expect("upsert should succeed");
        let event = TimelineEditEvent {
            event_id: "event_diag".to_string(),
            track_id: "pose_main".to_string(),
            source_id: "sequencer-ui".to_string(),
            session_frame: 3,
            timestamp_ms: 2000,
            op: KeyframeEditOp::Upsert {
                sample: sample(3, 42),
            },
            patch: applied.patch,
        };
        let missing_take =
            std::env::temp_dir().join(format!("zenmocap_missing_take_{}.json", std::process::id()));
        let missing_take_path = missing_take.to_string_lossy().into_owned();

        {
            let mut state = TIMELINE_RUNTIME_STATE.lock();
            state.tracks.insert("pose_main".to_string(), track);
            state.event_log.push(event);
            state.active_take_path = Some(missing_take_path.clone());
            state
                .recent_mutation_reasons
                .push_back(TimelineMutationReasonEntry {
                    reason_id: "runtime_requests_applied".to_string(),
                    timestamp_ms: now_ms,
                });
            state
                .recent_mutation_reasons
                .push_back(TimelineMutationReasonEntry {
                    reason_id: "runtime_state_reset".to_string(),
                    timestamp_ms: now_ms,
                });
            state
                .recent_mutation_reasons
                .push_back(TimelineMutationReasonEntry {
                    reason_id: "runtime_state_reset".to_string(),
                    timestamp_ms: now_ms,
                });
            state
                .recent_mutation_reasons
                .push_back(TimelineMutationReasonEntry {
                    reason_id: "runtime_requests_applied".to_string(),
                    timestamp_ms: now_ms,
                });
        }

        let report = mocap_get_timeline_runtime_diagnostics();
        assert_eq!(
            report.active_take_path.as_deref(),
            Some(missing_take_path.as_str())
        );
        assert!(report.generated_at_ms >= now_ms);
        assert!(!report.active_take_exists);
        assert_eq!(report.active_track_count, 1);
        assert!(report.active_track_ids.is_empty());
        assert_eq!(
            report.track_keyframe_counts.get("pose_main").copied(),
            Some(1)
        );
        assert_eq!(report.event_log_size, 1);
        assert_eq!(report.latest_event_timestamp_ms, Some(2000));
        assert_eq!(
            report.event_source_counts.get("sequencer-ui").copied(),
            Some(1)
        );
        assert_eq!(
            report
                .recent_reason_counts
                .get("runtime_requests_applied")
                .copied(),
            Some(2)
        );
        assert_eq!(
            report
                .recent_reason_counts
                .get("runtime_state_reset")
                .copied(),
            Some(2)
        );
        assert_eq!(
            report
                .recent_reason_last_seen_ms
                .get("runtime_state_reset")
                .copied(),
            Some(now_ms)
        );
        let reset_trend = report
            .recent_reason_trends
            .iter()
            .find(|entry| entry.reason_id == "runtime_state_reset")
            .expect("trend should include runtime_state_reset");
        assert_eq!(reset_trend.count, 2);
        assert_eq!(reset_trend.severity, "warn");
        assert_eq!(reset_trend.label, "Runtime State Reset");
        assert_eq!(
            reset_trend.action_hint,
            "Confirm resets are intentional and session ownership is stable."
        );

        *TIMELINE_RUNTIME_STATE.lock() = TimelineRuntimeState::default();
    }

    #[test]
    fn diagnostics_report_applies_trend_cooldown_window() {
        let policy = timeline_runtime_diagnostics_policy().clone();
        let now_ms = policy.trend.cooldown_window_ms + 5_000;
        let mut state = TimelineRuntimeState::default();
        state
            .recent_mutation_reasons
            .push_back(TimelineMutationReasonEntry {
                reason_id: "runtime_state_reset".to_string(),
                timestamp_ms: 0,
            });
        state
            .recent_mutation_reasons
            .push_back(TimelineMutationReasonEntry {
                reason_id: "runtime_state_reset".to_string(),
                timestamp_ms: 100,
            });

        let report = build_timeline_runtime_diagnostics_report(&state, &policy, now_ms);
        assert_eq!(
            report
                .recent_reason_counts
                .get("runtime_state_reset")
                .copied(),
            Some(2)
        );
        assert_eq!(
            report
                .recent_reason_last_seen_ms
                .get("runtime_state_reset")
                .copied(),
            Some(100)
        );
        let reset_trend = report
            .recent_reason_trends
            .iter()
            .find(|entry| entry.reason_id == "runtime_state_reset")
            .expect("trend should include runtime_state_reset");
        assert_eq!(reset_trend.severity, "info");
        assert_eq!(
            reset_trend.action_hint,
            "Confirm timeline state was intentionally reset."
        );
    }

    #[test]
    fn diagnostics_changed_payload_respects_event_policy() {
        let mut policy = timeline_runtime_diagnostics_policy().clone();
        policy.event.include_reason = true;
        policy.event.include_emitted_at_ms = true;
        policy.event.include_trend_summary = true;
        policy.event.trend_summary_top_count = 1;
        policy.event.allowed_reasons = vec![
            "runtime_requests_applied".to_string(),
            "runtime_state_reset".to_string(),
        ];

        let mut state = TimelineRuntimeState::default();
        state
            .recent_mutation_reasons
            .push_back(TimelineMutationReasonEntry {
                reason_id: "runtime_requests_applied".to_string(),
                timestamp_ms: 1_000,
            });
        state
            .recent_mutation_reasons
            .push_back(TimelineMutationReasonEntry {
                reason_id: "runtime_requests_applied".to_string(),
                timestamp_ms: 1_001,
            });
        state
            .recent_mutation_reasons
            .push_back(TimelineMutationReasonEntry {
                reason_id: "runtime_state_reset".to_string(),
                timestamp_ms: 1_002,
            });
        state
            .recent_mutation_reasons
            .push_back(TimelineMutationReasonEntry {
                reason_id: "runtime_state_reset".to_string(),
                timestamp_ms: 1_003,
            });
        state
            .recent_mutation_reasons
            .push_back(TimelineMutationReasonEntry {
                reason_id: "runtime_state_reset".to_string(),
                timestamp_ms: 1_004,
            });
        let payload = build_timeline_runtime_diagnostics_changed_payload(
            &state,
            &policy,
            "runtime_requests_applied",
            1234,
        );
        assert_eq!(
            payload.mutation.reason.as_deref(),
            Some("runtime_requests_applied")
        );
        let reason_detail = payload
            .mutation
            .reason_detail
            .expect("reason detail should be present");
        assert_eq!(reason_detail.reason_id, "runtime_requests_applied");
        assert_eq!(reason_detail.severity, "info");
        let trend_summary = payload
            .mutation
            .trend_summary
            .as_ref()
            .expect("trend summary should be present");
        assert_eq!(trend_summary.minimum_severity, "warn");
        assert_eq!(trend_summary.highest_severity, "warn");
        assert_eq!(trend_summary.escalated_reason_count, 1);
        assert_eq!(trend_summary.top_reasons.len(), 1);
        assert_eq!(
            trend_summary.top_reasons[0].reason_id,
            "runtime_state_reset"
        );
        assert_eq!(trend_summary.top_reasons[0].count, 3);
        assert_eq!(payload.mutation.emitted_at_ms, Some(1234));

        let redacted = build_timeline_runtime_diagnostics_changed_payload(
            &TimelineRuntimeState::default(),
            &policy,
            "runtime_hydrated_from_take",
            5678,
        );
        assert_eq!(
            redacted.mutation.reason.as_deref(),
            Some("runtime_requests_applied")
        );
        assert_eq!(
            redacted
                .mutation
                .reason_detail
                .as_ref()
                .map(|reason| reason.reason_id.as_str()),
            Some("runtime_requests_applied")
        );
        let redacted_trend_summary = redacted
            .mutation
            .trend_summary
            .as_ref()
            .expect("trend summary should be present");
        assert_eq!(redacted_trend_summary.minimum_severity, "warn");
        assert_eq!(redacted_trend_summary.highest_severity, "info");
        assert_eq!(redacted_trend_summary.escalated_reason_count, 0);
        assert!(redacted_trend_summary.top_reasons.is_empty());
        policy.event.include_trend_summary = false;
        let no_trend_summary = build_timeline_runtime_diagnostics_changed_payload(
            &state,
            &policy,
            "runtime_requests_applied",
            6789,
        );
        assert!(no_trend_summary.mutation.trend_summary.is_none());
        assert_eq!(redacted.mutation.emitted_at_ms, Some(5678));
    }
}
// ─── Take Management Commands ─────────────────────────────────────────────────

/// List all saved takes from the ZenMocap takes directory.
/// Returns lightweight `TakeSummary` structs — no frame data loaded.
/// Called on content browser TAKES tab open and after `TakeSaved` event.
#[tauri::command]
pub fn mocap_list_takes() -> Vec<zen_mocap_engine::take::TakeSummary> {
    let base_dir = std::env::var_os("APPDATA")
        .map(std::path::PathBuf::from)
        .or_else(|| std::env::current_dir().ok())
        .unwrap_or_else(|| std::path::PathBuf::from("."));
    let takes_dir = base_dir
        .join("ZenMocap")
        .join(zen_mocap_engine::take::TAKES_SUBDIR);
    zen_mocap_engine::take::list_takes(&takes_dir).unwrap_or_default()
}

/// Delete a take file by its absolute path.
/// Returns `Ok(())` on success or an error string on failure.
#[tauri::command]
pub fn mocap_delete_take(path: String) -> Result<(), String> {
    std::fs::remove_file(&path).map_err(|e| format!("Failed to delete take: {e}"))
}

/// Rename a take (updates the file name and the `name` field inside the file).
/// Returns the new path on success.
#[tauri::command]
pub fn mocap_rename_take(path: String, new_name: String) -> Result<String, String> {
    let old_path = std::path::Path::new(&path);
    let dir = old_path.parent().ok_or("Invalid path")?;
    let new_path = dir.join(format!("{}.{}", new_name, zen_mocap_engine::take::TAKE_EXT));

    // Load, rename, save to new path, delete old
    let mut take = zen_mocap_engine::take::load_take(old_path)
        .map_err(|e| format!("Failed to load take: {e}"))?;
    take.name = new_name;
    zen_mocap_engine::take::save_take(&take, &new_path)
        .map_err(|e| format!("Failed to save renamed take: {e}"))?;
    std::fs::remove_file(old_path).ok();

    Ok(new_path.to_string_lossy().into_owned())
}

/// Load a full take by path and return all frame data.
/// Used by the timeline/playback panel to scrub through frames.
#[tauri::command]
pub fn mocap_load_take(path: String) -> Result<zen_mocap_engine::take::AnimationTake, String> {
    zen_mocap_engine::take::load_take(std::path::Path::new(&path))
        .map_err(|e| format!("Failed to load take: {e}"))
}

// ─── Phase 4: Offline Video Analysis Commands ─────────────────────────────────

use zen_mocap_engine::video_analyzer::{VideoAnalysisConfig, VideoAnalysisProgress, VideoAnalyzer};

/// Begin offline video analysis. Non-blocking — spawns a thread and returns
/// immediately. Progress events are forwarded via `mocap://video_progress`.
/// Emits `mocap://take_saved` when complete (same as live recording).
#[tauri::command]
pub async fn mocap_analyze_video(
    app: AppHandle,
    config: VideoAnalysisConfig,
) -> Result<(), String> {
    VIDEO_ANALYSIS_CANCEL.store(false, Ordering::Relaxed);
    let cancel_flag = VIDEO_ANALYSIS_CANCEL.clone();
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<VideoAnalysisProgress>();
    let (frame_tx, mut frame_rx) =
        tokio::sync::mpsc::unbounded_channel::<zen_mocap_engine::types::JointFrame>();
    let (raw_frame_tx, mut raw_frame_rx) =
        tokio::sync::mpsc::unbounded_channel::<zen_mocap_engine::types::JointFrame>();
    let app_progress = app.clone();
    let app_frames = app.clone();
    let app_raw_frames = app.clone();

    // Forward progress events to frontend
    tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            app_progress.emit("mocap://video_progress", &event).ok();
        }
    });
    // Forward analyzed frames into the same stream used by live session preview.
    tokio::spawn(async move {
        while let Some(frame) = frame_rx.recv().await {
            app_frames.emit("mocap://joint_frame", &frame).ok();
        }
    });
    // Forward raw inference joints (pre-GPU chain) for source-preview overlay.
    tokio::spawn(async move {
        while let Some(frame) = raw_frame_rx.recv().await {
            app_raw_frames.emit("mocap://raw_joint_frame", &frame).ok();
        }
    });

    // Run analysis in a blocking thread (CPU + IO bound)
    tokio::task::spawn_blocking(move || {
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            VideoAnalyzer::analyze(
                config,
                Some(tx),
                Some(frame_tx),
                Some(raw_frame_tx),
                Some(cancel_flag),
            )
        }));
        match result {
            Ok(Ok(out_path)) => {
                #[derive(serde::Serialize, Clone)]
                struct TakeSavedPayload {
                    name: String,
                    path: String,
                    frame_count: usize,
                }
                // Re-list takes so the content browser refreshes
                let path_str = out_path.to_string_lossy().into_owned();
                let name = out_path
                    .file_stem()
                    .map(|s| s.to_string_lossy().into_owned())
                    .unwrap_or_default();
                app.emit(
                    "mocap://take_saved",
                    TakeSavedPayload {
                        name,
                        path: path_str,
                        frame_count: 0, // frontend re-lists to get actual count
                    },
                )
                .ok();
            }
            Ok(Err(e)) => {
                if e.starts_with("CANCELLED:") {
                    app.emit("mocap://video_cancelled", &e).ok();
                    return;
                }
                log::error!("[zen-mocap] Video analysis failed: {}", e);
                app.emit("mocap://error", &e).ok();
            }
            Err(_) => {
                let panic_msg =
                    "Video analysis panicked. Check model output format / logs for details."
                        .to_string();
                log::error!("[zen-mocap] {}", panic_msg);
                app.emit("mocap://error", &panic_msg).ok();
            }
        }
    });

    Ok(())
}

/// Request cancellation of the current offline video analysis job.
#[tauri::command]
pub fn mocap_cancel_video_analysis() {
    VIDEO_ANALYSIS_CANCEL.store(true, Ordering::Relaxed);
}

/// Probe a video file and return its metadata (resolution, fps, duration).
/// Used by the frontend to show info before analysis starts.
#[tauri::command]
pub fn mocap_probe_video(path: String) -> Result<serde_json::Value, String> {
    let ffprobe = crate::mocap::utils::ffmpeg::ffmpeg_path("ffprobe");
    let out = std::process::Command::new(&ffprobe)
        .args([
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,nb_frames,r_frame_rate,duration",
            "-of",
            "json",
            &path,
        ])
        .output()
        .map_err(|e| {
            format!("ffprobe not found — install ffmpeg or restart app after bundling: {e}")
        })?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        return Err(format!("ffprobe error: {stderr}"));
    }

    let raw = String::from_utf8_lossy(&out.stdout).to_string();
    serde_json::from_str(&raw).map_err(|e| format!("ffprobe parse error: {e}"))
}

/// Prepare a webview-safe preview clip for the given video.
/// Some source codecs/container profiles decode fine in backend ffmpeg
/// but fail in embedded webviews. We transcode to H.264 + yuv420p + faststart.
#[tauri::command]
pub fn mocap_prepare_video_preview(path: String) -> Result<String, String> {
    use std::hash::{Hash, Hasher};
    use std::path::Path;

    let src = Path::new(&path);
    if !src.exists() {
        return Err(format!("Video file not found: {}", src.display()));
    }

    let preview_dir = dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("ZenMocap")
        .join("preview");
    std::fs::create_dir_all(&preview_dir)
        .map_err(|e| format!("Failed to create preview dir: {e}"))?;

    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    path.hash(&mut hasher);
    if let Ok(meta) = std::fs::metadata(src) {
        meta.len().hash(&mut hasher);
        if let Ok(modified) = meta.modified() {
            if let Ok(dur) = modified.duration_since(std::time::UNIX_EPOCH) {
                dur.as_secs().hash(&mut hasher);
                dur.subsec_nanos().hash(&mut hasher);
            }
        }
    }
    let key = format!("{:016x}", hasher.finish());
    let out_path = preview_dir.join(format!("preview_{}.mp4", key));

    if out_path.exists() {
        return Ok(out_path.to_string_lossy().into_owned());
    }

    let ffmpeg = crate::mocap::utils::ffmpeg::ffmpeg_path("ffmpeg");
    let out = std::process::Command::new(ffmpeg)
        .args([
            "-y",
            "-i",
            &path,
            "-an",
            "-vf",
            "scale='min(1280,iw)':-2:flags=lanczos",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "23",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            out_path.to_string_lossy().as_ref(),
        ])
        .output()
        .map_err(|e| format!("Failed to spawn ffmpeg for preview transcode: {e}"))?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        return Err(format!("ffmpeg preview transcode failed: {stderr}"));
    }

    Ok(out_path.to_string_lossy().into_owned())
}

// ─── Model Management Commands ────────────────────────────────────────────────

/// Returns the source-tree `src-tauri/resources/models/` directory.
/// Only valid in dev builds where CARGO_MANIFEST_DIR is available.
fn dev_resources_models_dir() -> Option<std::path::PathBuf> {
    // CARGO_MANIFEST_DIR is set at compile time — safe to use in dev.
    // In release builds the resource_dir() path from Tauri takes over.
    let manifest_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
    let p = manifest_dir.join("resources").join("models");
    if p.exists() {
        Some(p)
    } else {
        None
    }
}

/// Resolve the path to a model ONNX file.
///
/// Resolution order:
/// 1. `%APPDATA%/ZenMocap/models/<filename>` — user cache (seeded on first run)
/// 2. `<resource_dir>/models/<filename>`      — bundled with released app binary
/// 3. `<CARGO_MANIFEST_DIR>/resources/models/<filename>` — dev fallback (source tree)
///
/// Returns `None` if the file is not found in any location.
fn resolve_model_path(app: &AppHandle, filename: &str) -> Option<std::path::PathBuf> {
    // 1. Check %APPDATA% user cache
    let appdata = dirs::data_dir().map(|d| d.join("ZenMocap").join("models").join(filename));
    if let Some(ref p) = appdata {
        if p.exists() {
            return appdata;
        }
    }
    // 2. Check Tauri bundled resource dir
    if let Ok(res_dir) = app.path().resource_dir() {
        let bundled = res_dir.join("models").join(filename);
        if bundled.exists() {
            return Some(bundled);
        }
        let bundled2 = res_dir.join(filename);
        if bundled2.exists() {
            return Some(bundled2);
        }
    }
    // 3. Dev fallback — source tree resources (only present in dev builds)
    if let Some(dev_dir) = dev_resources_models_dir() {
        let dev_path = dev_dir.join(filename);
        if dev_path.exists() {
            return Some(dev_path);
        }
    }
    None
}

/// On first launch: copy every bundled ONNX from `<resource_dir>/models/`
/// (or the dev source tree) into `%APPDATA%/ZenMocap/models/` so the engine
/// can always use a stable writable path. Returns how many files were seeded.
#[tauri::command]
pub fn mocap_seed_bundled_models(app: AppHandle) -> usize {
    // Determine source dir: prefer Tauri's resource_dir, fall back to source tree in dev.
    let models_res = if let Ok(res_dir) = app.path().resource_dir() {
        let p = res_dir.join("models");
        if p.exists() {
            p
        } else {
            dev_resources_models_dir().unwrap_or(res_dir.join("models"))
        }
    } else {
        match dev_resources_models_dir() {
            Some(p) => p,
            None => return 0,
        }
    };

    let Some(cache_dir) = dirs::data_dir().map(|d| d.join("ZenMocap").join("models")) else {
        return 0;
    };
    if std::fs::create_dir_all(&cache_dir).is_err() {
        return 0;
    }

    let mut seeded = 0usize;
    if let Ok(entries) = std::fs::read_dir(&models_res) {
        for entry in entries.flatten() {
            let src = entry.path();
            if src.extension().and_then(|e| e.to_str()) != Some("onnx") {
                continue;
            }
            let dst = cache_dir.join(entry.file_name());
            if !dst.exists() {
                if std::fs::copy(&src, &dst).is_ok() {
                    log::info!("[zen-mocap] Seeded bundled model: {:?} -> {:?}", src, dst);
                    seeded += 1;
                }
            }
        }
    }
    seeded
}

/// Check which models are available (bundled resources OR user cache).
/// Returns a list with cached status for each manifest entry.
#[tauri::command]
pub fn mocap_check_models(app: AppHandle) -> Vec<serde_json::Value> {
    use zen_mocap_engine::models::list_models;
    list_models()
        .iter()
        .map(|entry| {
            let path = resolve_model_path(&app, &entry.filename);
            let cached = path.is_some();
            let cache_path = path
                .map(|p| p.to_string_lossy().into_owned())
                .unwrap_or_default();
            serde_json::json!({
                "model_id":   entry.id,
                "cached":     cached,
                "cache_path": cache_path,
            })
        })
        .collect()
}

/// Download a single model by ID. Streams progress events via `mocap://model_download_progress`.
/// For bundled models this should never be needed — shown here as a fallback only.
#[tauri::command]
pub async fn mocap_download_model(app: AppHandle, model_id: String) -> Result<String, String> {
    use zen_mocap_engine::models::{downloader::download_model, get_model};

    let entry = get_model(&model_id)
        .ok_or_else(|| format!("Unknown model id: {model_id}"))?
        .clone();

    // If already resolvable via bundled resources, just return that path
    if let Some(p) = resolve_model_path(&app, &entry.filename) {
        return Ok(p.to_string_lossy().into_owned());
    }

    let app_progress = app.clone();
    let model_id_clone = model_id.clone();

    tokio::task::spawn_blocking(move || {
        let progress_cb = move |downloaded: u64, total: u64| {
            #[derive(serde::Serialize, Clone)]
            struct DownloadProgress {
                model_id: String,
                downloaded: u64,
                total: u64,
                percent: f32,
            }
            let percent = if total > 0 {
                downloaded as f32 / total as f32 * 100.0
            } else {
                0.0
            };
            app_progress
                .emit(
                    "mocap://model_download_progress",
                    DownloadProgress {
                        model_id: model_id_clone.clone(),
                        downloaded,
                        total,
                        percent,
                    },
                )
                .ok();
        };

        download_model(&entry, Some(&progress_cb)).map(|p| p.to_string_lossy().into_owned())
    })
    .await
    .map_err(|e| format!("Task join: {e}"))?
}

/// Return GPU adapter info for the GPU Doctor panel.
///
/// Returns the cached adapter metadata from the active GpuChain, or a
/// "no session" placeholder if no session has been started yet.
///
/// `GPU_ADAPTER_CACHE` lives in `types` (not the feature-gated `gpu_chain`) so
/// this command compiles regardless of whether the gpu-chain feature is active.
#[tauri::command]
pub fn mocap_get_gpu_info() -> GpuInfo {
    zen_mocap_engine::types::get_gpu_adapter_info().unwrap_or_else(|| GpuInfo {
        name: "No GPU session started".to_string(),
        backend: "-".to_string(),
        driver: "-".to_string(),
        driver_info: "—".to_string(),
        vram_bytes: 0,
        device_type: "—".to_string(),
    })
}
