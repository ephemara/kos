//! AnimationTake — the `.zenmocap` file format.
//!
//! A take is a recorded or analyzed sequence of `JointFrame`s.
//! It stores the full per-frame skeleton + optional quaternion stream
//! from the livelink GPU shader, ready for playback or DCC export.
//!
//! ## Storage
//! Takes are serialized as MessagePack (via `rmp-serde`) for ~10× smaller
//! files than JSON while remaining fully schema-compatible. A 30-second
//! take at 30fps with 17 joints ≈ 220 KB on disk.
//!
//! ## Session sources
//! - `TakeSource::Live`  — captured from a live camera session
//! - `TakeSource::Video` — analyzed from an offline video file
//!
//! ## Content browser integration
//! `list_takes()` returns `TakeSummary` structs that the frontend content
//! browser renders in the TAKES tab. The content browser stores the
//! take path in its item registry and passes it back when a take is opened.

use std::{
    collections::BTreeSet,
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use anyhow::anyhow;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};

use crate::{
    models::get_model,
    timeline_event::{validate_timeline_event_log_against_take, TimelineEditEvent},
    types::{Joint, JointFrame},
};

#[derive(Debug, Clone, Deserialize)]
struct TakeValidationPolicyManifest {
    fps: FpsPolicy,
    frame_count: FrameCountPolicy,
    tags: TagPolicy,
    rotations: RotationPolicy,
    sequencing: SequencingPolicy,
    metadata: MetadataPolicy,
}

#[derive(Debug, Clone, Deserialize)]
struct FpsPolicy {
    min: f32,
    max: f32,
}

#[derive(Debug, Clone, Deserialize)]
struct FrameCountPolicy {
    min: usize,
    max: usize,
}

#[derive(Debug, Clone, Deserialize)]
struct TagPolicy {
    max_count: usize,
    max_len: usize,
}

#[derive(Debug, Clone, Deserialize)]
struct RotationPolicy {
    require_frame_alignment: bool,
    min_joints_per_frame: usize,
    max_joints_per_frame: usize,
}

#[derive(Debug, Clone, Deserialize)]
struct SequencingPolicy {
    require_strict_seq_increment: bool,
    require_monotonic_timestamps: bool,
}

#[derive(Debug, Clone, Deserialize)]
struct MetadataPolicy {
    require_model_id: bool,
    require_known_model: bool,
}

static TAKE_VALIDATION_POLICY_TOML: &str = include_str!("../resources/take_validation_policy.toml");

static TAKE_VALIDATION_POLICY: Lazy<TakeValidationPolicyManifest> = Lazy::new(|| {
    let manifest: TakeValidationPolicyManifest = toml::from_str(TAKE_VALIDATION_POLICY_TOML)
        .expect("take_validation_policy.toml is invalid - this is a compile-time bug");
    validate_validation_policy_manifest(&manifest)
        .expect("take_validation_policy.toml failed validation - this is a compile-time bug");
    manifest
});

fn validate_validation_policy_manifest(manifest: &TakeValidationPolicyManifest) -> Result<(), String> {
    if !manifest.fps.min.is_finite() || !manifest.fps.max.is_finite() {
        return Err("fps bounds must be finite".to_string());
    }
    if manifest.fps.min <= 0.0 {
        return Err("fps.min must be > 0".to_string());
    }
    if manifest.fps.max < manifest.fps.min {
        return Err("fps.max must be >= fps.min".to_string());
    }
    if manifest.frame_count.max < manifest.frame_count.min {
        return Err("frame_count.max must be >= frame_count.min".to_string());
    }
    if manifest.tags.max_len == 0 {
        return Err("tags.max_len must be > 0".to_string());
    }
    if manifest.rotations.max_joints_per_frame < manifest.rotations.min_joints_per_frame {
        return Err("rotations.max_joints_per_frame must be >= rotations.min_joints_per_frame".to_string());
    }
    Ok(())
}

// ─── Take Source ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case", tag = "type")]
pub enum TakeSource {
    /// Captured live from a camera + ONNX inference pass.
    Live { camera_index: u32 },
    /// Analyzed from an offline video file.
    Video { path: String },
}

// ─── Take Metadata ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TakeMetadata {
    /// Which ONNX model was used for inference.
    pub model_id: String,
    /// Optional subject name (filled by user in UI).
    pub subject: String,
    /// Free-form tags for content browser filtering.
    pub tags: Vec<String>,
    /// Where the keypoint data came from.
    pub source: Option<TakeSource>,
}

// ─── Animation Take ───────────────────────────────────────────────────────────

/// A complete recorded or analyzed animation take.
///
/// The `frames` vec is the canonical data source — everything else
/// (rotations, metadata) is derived or optional.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnimationTake {
    /// Stable UUID so the content browser can track renames safely.
    pub id: String,
    /// Human-readable name (default: `take_YYYYMMDD_HHMMSS`).
    pub name: String,
    /// Unix timestamp (ms) when recording started.
    pub created_at: u64,
    /// Capture frame rate (typically 30.0).
    pub fps: f32,
    /// Number of frames in this take.
    pub frame_count: usize,
    /// Total duration in milliseconds.
    pub duration_ms: u64,
    /// Per-frame joint positions + confidence scores.
    /// `frames[i].joints` is a map of COCO joint name → Joint { position, confidence }.
    pub frames: Vec<JointFrame>,
    /// Optional per-frame quaternion output from `mocap_livelink.spv`.
    /// Layout: `rotations[frame_idx][joint_idx] = [qx, qy, qz, qw]`.
    pub rotations: Option<Vec<Vec<[f32; 4]>>>,
    /// Ordered timeline edit event ledger for replay, undo, and diagnostics.
    #[serde(default)]
    pub timeline_edit_events: Vec<TimelineEditEvent>,
    pub metadata: TakeMetadata,
}

impl AnimationTake {
    /// Create a new empty take with a generated name and current timestamp.
    pub fn new(fps: f32, model_id: impl Into<String>, source: Option<TakeSource>) -> Self {
        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        // Simple UUID substitute — timestamp + random suffix
        let id = format!("{:x}-{:04x}", now_ms, (now_ms ^ (now_ms >> 16)) & 0xffff);
        let name = Self::default_name(now_ms);

        Self {
            id,
            name,
            created_at: now_ms,
            fps,
            frame_count: 0,
            duration_ms: 0,
            frames: Vec::new(),
            rotations: None,
            timeline_edit_events: Vec::new(),
            metadata: TakeMetadata {
                model_id: model_id.into(),
                source,
                ..Default::default()
            },
        }
    }

    /// Push a new frame into the take. Updates `frame_count` and `duration_ms`.
    pub fn push_frame(&mut self, frame: JointFrame) {
        self.frames.push(frame);
        self.frame_count = self.frames.len();
        self.duration_ms = ((self.frame_count as f32 / self.fps.max(1.0)) * 1000.0) as u64;
    }

    /// Push a rotation snapshot (one `[qx,qy,qz,qw]` per joint).
    pub fn push_rotations(&mut self, rots: Vec<[f32; 4]>) {
        self.rotations.get_or_insert_with(Vec::new).push(rots);
    }

    fn default_name(ts_ms: u64) -> String {
        let secs = ts_ms / 1000;
        let s = secs % 60;
        let m = (secs / 60) % 60;
        let h = (secs / 3600) % 24;
        // Date from epoch — good enough for a default name
        let days = secs / 86400;
        let y = 1970 + days / 365;
        let doy = days % 365;
        let mo = doy / 30 + 1;
        let d = doy % 30 + 1;
        format!("take_{y:04}{mo:02}{d:02}_{h:02}{m:02}{s:02}")
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TakeValidationIssue {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TakeValidationReport {
    pub issues: Vec<TakeValidationIssue>,
}

impl TakeValidationReport {
    pub fn is_valid(&self) -> bool {
        self.issues.is_empty()
    }
}

pub fn validate_take(take: &AnimationTake) -> TakeValidationReport {
    let policy = &*TAKE_VALIDATION_POLICY;
    let mut issues = Vec::new();

    if take.id.trim().is_empty() {
        push_issue(&mut issues, "empty_take_id", "take id must not be empty");
    }

    if take.name.trim().is_empty() {
        push_issue(&mut issues, "empty_take_name", "take name must not be empty");
    }

    if !take.fps.is_finite() {
        push_issue(&mut issues, "fps_not_finite", "fps must be a finite number");
    } else if take.fps < policy.fps.min || take.fps > policy.fps.max {
        push_issue(
            &mut issues,
            "fps_out_of_range",
            format!(
                "fps {} is out of allowed range [{}, {}]",
                take.fps, policy.fps.min, policy.fps.max
            ),
        );
    }

    if take.frame_count < policy.frame_count.min || take.frame_count > policy.frame_count.max {
        push_issue(
            &mut issues,
            "frame_count_out_of_range",
            format!(
                "frame_count {} is out of allowed range [{}, {}]",
                take.frame_count, policy.frame_count.min, policy.frame_count.max
            ),
        );
    }

    if take.frame_count != take.frames.len() {
        push_issue(
            &mut issues,
            "frame_count_mismatch",
            format!(
                "frame_count {} does not match frames.len() {}",
                take.frame_count,
                take.frames.len()
            ),
        );
    }

    let expected_duration = ((take.frame_count as f32 / take.fps.max(1.0)) * 1000.0) as u64;
    if take.duration_ms != expected_duration {
        push_issue(
            &mut issues,
            "duration_mismatch",
            format!(
                "duration_ms {} does not match expected {} from frame_count/fps",
                take.duration_ms, expected_duration
            ),
        );
    }

    if policy.metadata.require_model_id && take.metadata.model_id.trim().is_empty() {
        push_issue(&mut issues, "empty_model_id", "metadata.model_id must not be empty");
    }

    let known_model = if take.metadata.model_id.trim().is_empty() {
        None
    } else {
        get_model(&take.metadata.model_id)
    };

    if policy.metadata.require_known_model && known_model.is_none() {
        push_issue(
            &mut issues,
            "unknown_model_id",
            format!("metadata.model_id '{}' is not present in models manifest", take.metadata.model_id),
        );
    }

    if take.metadata.tags.len() > policy.tags.max_count {
        push_issue(
            &mut issues,
            "too_many_tags",
            format!(
                "metadata.tags has {} entries and exceeds max {}",
                take.metadata.tags.len(),
                policy.tags.max_count
            ),
        );
    }

    let mut seen_tags = BTreeSet::new();
    for tag in &take.metadata.tags {
        if tag.trim().is_empty() {
            push_issue(&mut issues, "empty_tag", "metadata.tags entries must not be empty");
        }
        if tag.len() > policy.tags.max_len {
            push_issue(
                &mut issues,
                "tag_too_long",
                format!("tag '{}' exceeds max length {}", tag, policy.tags.max_len),
            );
        }
        if !seen_tags.insert(tag) {
            push_issue(&mut issues, "duplicate_tag", format!("duplicate tag '{}'", tag));
        }
    }

    for (index, frame) in take.frames.iter().enumerate() {
        validate_joint_frame(index, frame, known_model.map(|entry| entry.keypoints), &mut issues);

        if !take.metadata.model_id.trim().is_empty() && frame.model_id != take.metadata.model_id {
            push_issue(
                &mut issues,
                "frame_model_mismatch",
                format!(
                    "frame index {} has model_id '{}' but take metadata model_id is '{}'",
                    index, frame.model_id, take.metadata.model_id
                ),
            );
        }
    }

    if policy.sequencing.require_strict_seq_increment {
        for pair in take.frames.windows(2) {
            let previous = &pair[0];
            let current = &pair[1];
            if current.seq != previous.seq + 1 {
                push_issue(
                    &mut issues,
                    "non_strict_frame_sequence",
                    format!(
                        "frame seq jump detected: {} -> {} (expected +1)",
                        previous.seq, current.seq
                    ),
                );
                break;
            }
        }
    }

    if policy.sequencing.require_monotonic_timestamps {
        for pair in take.frames.windows(2) {
            let previous = &pair[0];
            let current = &pair[1];
            if current.timestamp_ms < previous.timestamp_ms {
                push_issue(
                    &mut issues,
                    "non_monotonic_timestamps",
                    format!(
                        "timestamp regression detected: {} -> {}",
                        previous.timestamp_ms, current.timestamp_ms
                    ),
                );
                break;
            }
        }
    }

    if let Some(rotations) = &take.rotations {
        if policy.rotations.require_frame_alignment && rotations.len() != take.frame_count {
            push_issue(
                &mut issues,
                "rotation_frame_mismatch",
                format!(
                    "rotations has {} frames but take frame_count is {}",
                    rotations.len(),
                    take.frame_count
                ),
            );
        }

        for (frame_index, frame_rotations) in rotations.iter().enumerate() {
            let joint_count = frame_rotations.len();
            if joint_count < policy.rotations.min_joints_per_frame
                || joint_count > policy.rotations.max_joints_per_frame
            {
                push_issue(
                    &mut issues,
                    "rotation_joint_count_out_of_range",
                    format!(
                        "rotation frame {} has {} joints, allowed range is [{}, {}]",
                        frame_index,
                        joint_count,
                        policy.rotations.min_joints_per_frame,
                        policy.rotations.max_joints_per_frame
                    ),
                );
            }
        }
    }

    for issue in validate_timeline_event_log_against_take(&take.timeline_edit_events, take.frame_count) {
        push_issue(&mut issues, issue.code, issue.message);
    }

    TakeValidationReport { issues }
}

fn validate_joint_frame(
    frame_index: usize,
    frame: &JointFrame,
    expected_keypoints: Option<usize>,
    issues: &mut Vec<TakeValidationIssue>,
) {
    if !frame.timestamp_ms.is_finite() {
        push_issue(
            issues,
            "frame_timestamp_not_finite",
            format!("frame index {} has non-finite timestamp", frame_index),
        );
    }

    if frame.joints.is_empty() {
        push_issue(
            issues,
            "empty_frame_joints",
            format!("frame index {} has no joints", frame_index),
        );
    }

    if let Some(expected) = expected_keypoints {
        if frame.joints.len() != expected {
            push_issue(
                issues,
                "joint_count_mismatch",
                format!(
                    "frame index {} has {} joints but model expects {}",
                    frame_index,
                    frame.joints.len(),
                    expected
                ),
            );
        }
    }

    for (joint_index, joint) in frame.joints.iter().enumerate() {
        validate_joint(frame_index, joint_index, joint, issues);
    }
}

fn validate_joint(
    frame_index: usize,
    joint_index: usize,
    joint: &Joint,
    issues: &mut Vec<TakeValidationIssue>,
) {
    if !joint.confidence.is_finite() {
        push_issue(
            issues,
            "joint_confidence_not_finite",
            format!(
                "frame index {} joint {} has non-finite confidence",
                frame_index, joint_index
            ),
        );
    } else if !(0.0..=1.0).contains(&joint.confidence) {
        push_issue(
            issues,
            "joint_confidence_out_of_range",
            format!(
                "frame index {} joint {} has confidence {} outside [0, 1]",
                frame_index, joint_index, joint.confidence
            ),
        );
    }

    for (axis, value) in [
        ("x", joint.position[0]),
        ("y", joint.position[1]),
        ("z", joint.position[2]),
    ] {
        if !value.is_finite() {
            push_issue(
                issues,
                "joint_position_not_finite",
                format!(
                    "frame index {} joint {} axis {} has non-finite position",
                    frame_index, joint_index, axis
                ),
            );
        }
    }
}

fn push_issue(issues: &mut Vec<TakeValidationIssue>, code: impl Into<String>, message: impl Into<String>) {
    issues.push(TakeValidationIssue {
        code: code.into(),
        message: message.into(),
    });
}

fn ensure_take_valid(take: &AnimationTake, path: Option<&Path>) -> anyhow::Result<()> {
    let report = validate_take(take);
    if report.is_valid() {
        return Ok(());
    }

    let mut lines = Vec::new();
    if let Some(path) = path {
        lines.push(format!("take '{}' failed validation for path {}", take.name, path.display()));
    } else {
        lines.push(format!("take '{}' failed validation", take.name));
    }

    for issue in report.issues {
        lines.push(format!("- {}: {}", issue.code, issue.message));
    }

    Err(anyhow!(lines.join("\n")))
}

// ─── Disk I/O ────────────────────────────────────────────────────────────────

/// Default directory for storing takes (relative to app data dir).
/// Resolved at runtime by the Tauri command layer.
pub const TAKES_SUBDIR: &str = "takes";

/// Extension used for take files.
pub const TAKE_EXT: &str = "zenmocap";

/// Save a take to disk as MessagePack.
pub fn save_take(take: &AnimationTake, path: &Path) -> anyhow::Result<()> {
    ensure_take_valid(take, Some(path))?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let bytes = rmp_serde::to_vec_named(take)?;
    fs::write(path, bytes)?;
    Ok(())
}

/// Load a take from a `.zenmocap` file.
pub fn load_take(path: &Path) -> anyhow::Result<AnimationTake> {
    let bytes = fs::read(path)?;
    let take: AnimationTake = rmp_serde::from_slice(&bytes)?;
    ensure_take_valid(&take, Some(path))?;
    Ok(take)
}

// ─── Take Summary (for content browser listing) ────────────────────────────────

/// Lightweight view returned by `list_takes()` — no frame data.
/// The content browser renders this; full `AnimationTake` is only
/// loaded when the user opens a take for playback.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TakeSummary {
    pub id: String,
    pub name: String,
    pub created_at: u64,
    pub fps: f32,
    pub frame_count: usize,
    pub duration_ms: u64,
    pub path: String,
    pub source_type: String, // "live" | "video"
    pub model_id: String,
    pub tags: Vec<String>,
}

/// Scan a directory for `.zenmocap` files and return lightweight summaries.
pub fn list_takes(dir: &Path) -> anyhow::Result<Vec<TakeSummary>> {
    if !dir.exists() {
        return Ok(vec![]);
    }

    let mut summaries = Vec::new();

    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some(TAKE_EXT) {
            continue;
        }

        match load_take(&path) {
            Ok(take) => {
                let source_type = match &take.metadata.source {
                    Some(TakeSource::Video { .. }) => "video",
                    _ => "live",
                };
                summaries.push(TakeSummary {
                    id: take.id,
                    name: take.name,
                    created_at: take.created_at,
                    fps: take.fps,
                    frame_count: take.frame_count,
                    duration_ms: take.duration_ms,
                    path: path.to_string_lossy().into_owned(),
                    source_type: source_type.into(),
                    model_id: take.metadata.model_id,
                    tags: take.metadata.tags,
                });
            }
            Err(e) => {
                eprintln!("[takes] skipping {:?}: {e}", path.file_name());
            }
        }
    }

    // Sort newest-first
    summaries.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(summaries)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};
    use crate::{timeline_edit::KeyframeEditOp, timeline_event::TimelineEditEvent};

    fn valid_joint() -> Joint {
        Joint {
            position: [0.1, 0.2, 0.3],
            confidence: 0.95,
        }
    }

    fn valid_frame(seq: u64, ts_ms: f64, model_id: &str, joints: usize) -> JointFrame {
        JointFrame {
            seq,
            timestamp_ms: ts_ms,
            joints: vec![valid_joint(); joints],
            skeleton: None,
            model_id: model_id.to_string(),
        }
    }

    fn valid_take() -> AnimationTake {
        let model_id = "yolov11s_pose";
        let mut take = AnimationTake::new(30.0, model_id, Some(TakeSource::Live { camera_index: 0 }));
        let joints = get_model(model_id)
            .map(|entry| entry.keypoints)
            .expect("test model id must exist in manifest");

        take.push_frame(valid_frame(1, 1000.0, model_id, joints));
        take.push_frame(valid_frame(2, 1033.0, model_id, joints));
        take
    }

    fn temp_take_path(prefix: &str) -> PathBuf {
        static COUNTER: AtomicU64 = AtomicU64::new(0);
        let nonce = COUNTER.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!("zenmocap_take_test_{prefix}_{nonce}.zenmocap"))
    }

    #[test]
    fn validate_take_accepts_valid_take() {
        let take = valid_take();
        let report = validate_take(&take);
        assert!(
            report.is_valid(),
            "expected valid take, got issues: {:?}",
            report.issues
        );
    }

    #[test]
    fn validate_take_rejects_unknown_model() {
        let mut take = valid_take();
        take.metadata.model_id = "unknown_model".to_string();
        for frame in &mut take.frames {
            frame.model_id = "unknown_model".to_string();
        }

        let report = validate_take(&take);
        assert!(!report.is_valid());
        assert!(report.issues.iter().any(|issue| issue.code == "unknown_model_id"));
    }

    #[test]
    fn validate_take_rejects_sequence_gap() {
        let mut take = valid_take();
        take.frames[1].seq = 4;

        let report = validate_take(&take);
        assert!(!report.is_valid());
        assert!(
            report
                .issues
                .iter()
                .any(|issue| issue.code == "non_strict_frame_sequence")
        );
    }

    #[test]
    fn save_take_rejects_invalid_payload() {
        let mut take = valid_take();
        take.frame_count = 999;
        let path = temp_take_path("invalid");

        let error = save_take(&take, &path).expect_err("invalid take must fail save");
        assert!(error.to_string().contains("frame_count_mismatch"));

        let _ = fs::remove_file(path);
    }

    #[test]
    fn load_take_rejects_corrupt_duration() {
        let mut take = valid_take();
        let path = temp_take_path("corrupt_duration");
        save_take(&take, &path).expect("baseline take should save");

        take.duration_ms += 100;
        let bytes = rmp_serde::to_vec_named(&take).expect("serialize modified take");
        fs::write(&path, bytes).expect("write modified take");

        let error = load_take(&path).expect_err("load should reject invalid duration");
        assert!(error.to_string().contains("duration_mismatch"));

        let _ = fs::remove_file(path);
    }

    #[test]
    fn validate_take_rejects_timeline_event_outside_frame_count() {
        let mut take = valid_take();
        take.timeline_edit_events.push(TimelineEditEvent {
            event_id: "event_1".to_string(),
            track_id: "pose_main".to_string(),
            source_id: "sequencer-ui".to_string(),
            session_frame: 42,
            timestamp_ms: 1000,
            op: KeyframeEditOp::Remove { frame: 42 },
            patch: crate::timeline_edit::TimelineTrackPatch {
                prior_keyframes: Vec::new(),
            },
        });

        let report = validate_take(&take);
        assert!(!report.is_valid());
        assert!(
            report
                .issues
                .iter()
                .any(|issue| issue.code == "timeline_event_outside_take_frame_range")
        );
    }
}
