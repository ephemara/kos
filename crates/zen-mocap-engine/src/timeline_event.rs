use std::collections::{BTreeMap, BTreeSet};

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::timeline_edit::{AppliedKeyframeEdit, KeyframeEditOp, TimelineTrackPatch};

#[derive(Debug, Clone, Deserialize)]
struct FrameBounds {
    min: u32,
    max: u32,
}

#[derive(Debug, Clone, Deserialize)]
struct SourcePolicy {
    id: String,
    enabled: bool,
}

#[derive(Debug, Clone, Deserialize)]
struct TimelineEventPolicyManifest {
    session_frame_bounds: FrameBounds,
    max_events_per_take: usize,
    max_events_per_track: usize,
    require_monotonic_timestamp_ms: bool,
    sources: Vec<SourcePolicy>,
}

#[derive(Debug)]
struct TimelineEventPolicy {
    session_frame_bounds: FrameBounds,
    max_events_per_take: usize,
    max_events_per_track: usize,
    require_monotonic_timestamp_ms: bool,
    source_enabled: BTreeMap<String, bool>,
}

static TIMELINE_EVENT_POLICY_TOML: &str = include_str!("../resources/timeline_event_policy.toml");

static TIMELINE_EVENT_POLICY: Lazy<TimelineEventPolicy> = Lazy::new(|| {
    let manifest: TimelineEventPolicyManifest = toml::from_str(TIMELINE_EVENT_POLICY_TOML)
        .expect("timeline_event_policy.toml is invalid - this is a compile-time bug");
    validate_policy_manifest(&manifest)
        .expect("timeline_event_policy.toml failed validation - this is a compile-time bug")
});

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TimelineEditEvent {
    pub event_id: String,
    pub track_id: String,
    pub source_id: String,
    pub session_frame: u32,
    pub timestamp_ms: u64,
    pub op: KeyframeEditOp,
    pub patch: TimelineTrackPatch,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TimelineEventValidationIssue {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum TimelineEventError {
    #[error("timeline track id must not be empty")]
    EmptyTrackId,
    #[error("source '{source_id}' is not declared by timeline event policy")]
    UnknownSource { source_id: String },
    #[error("source '{source_id}' is disabled by timeline event policy")]
    SourceDisabled { source_id: String },
    #[error("session frame {frame} is out of bounds [{min}, {max}]")]
    SessionFrameOutOfBounds { frame: u32, min: u32, max: u32 },
}

pub fn enabled_timeline_event_sources() -> Vec<String> {
    TIMELINE_EVENT_POLICY
        .source_enabled
        .iter()
        .filter_map(|(id, enabled)| enabled.then_some(id.clone()))
        .collect()
}

pub fn build_timeline_edit_event(
    track_id: impl Into<String>,
    source_id: impl Into<String>,
    session_frame: u32,
    timestamp_ms: u64,
    applied: AppliedKeyframeEdit,
) -> Result<TimelineEditEvent, TimelineEventError> {
    let track_id = track_id.into();
    if track_id.trim().is_empty() {
        return Err(TimelineEventError::EmptyTrackId);
    }

    validate_session_frame(session_frame)?;

    let source_id = source_id.into();
    validate_source_id(&source_id)?;

    let event_id = format!(
        "{}:{}:{}:{}",
        source_id,
        track_id,
        timestamp_ms,
        session_frame
    );

    Ok(TimelineEditEvent {
        event_id,
        track_id,
        source_id,
        session_frame,
        timestamp_ms,
        op: applied.op,
        patch: applied.patch,
    })
}

pub fn validate_timeline_event_log(events: &[TimelineEditEvent]) -> Vec<TimelineEventValidationIssue> {
    let policy = &*TIMELINE_EVENT_POLICY;
    let mut issues = Vec::new();

    if events.len() > policy.max_events_per_take {
        push_issue(
            &mut issues,
            "timeline_event_count_exceeded",
            format!(
                "timeline edit event count {} exceeds max {}",
                events.len(), policy.max_events_per_take
            ),
        );
    }

    let mut per_track_counts: BTreeMap<&str, usize> = BTreeMap::new();

    for (index, event) in events.iter().enumerate() {
        if event.event_id.trim().is_empty() {
            push_issue(
                &mut issues,
                "timeline_event_id_empty",
                format!("timeline edit event index {} has empty event_id", index),
            );
        }

        if event.track_id.trim().is_empty() {
            push_issue(
                &mut issues,
                "timeline_event_track_id_empty",
                format!("timeline edit event index {} has empty track_id", index),
            );
        }

        if let Err(err) = validate_source_id(&event.source_id) {
            push_issue(
                &mut issues,
                "timeline_event_source_invalid",
                format!("timeline edit event index {} source error: {err}", index),
            );
        }

        if let Err(err) = validate_session_frame(event.session_frame) {
            push_issue(
                &mut issues,
                "timeline_event_session_frame_invalid",
                format!("timeline edit event index {} session frame error: {err}", index),
            );
        }

        let entry = per_track_counts.entry(&event.track_id).or_insert(0);
        *entry += 1;
        if *entry > policy.max_events_per_track {
            push_issue(
                &mut issues,
                "timeline_event_track_limit_exceeded",
                format!(
                    "track '{}' has {} timeline events and exceeds max {}",
                    event.track_id, entry, policy.max_events_per_track
                ),
            );
        }

        validate_op_frames(&event.op, &mut issues, index);
    }

    if policy.require_monotonic_timestamp_ms {
        for pair in events.windows(2) {
            let previous = &pair[0];
            let current = &pair[1];
            if current.timestamp_ms < previous.timestamp_ms {
                push_issue(
                    &mut issues,
                    "timeline_event_timestamp_regression",
                    format!(
                        "timeline event timestamp regression detected: {} -> {}",
                        previous.timestamp_ms, current.timestamp_ms
                    ),
                );
                break;
            }
        }
    }

    issues
}

pub fn validate_timeline_event_log_against_take(
    events: &[TimelineEditEvent],
    frame_count: usize,
) -> Vec<TimelineEventValidationIssue> {
    let mut issues = validate_timeline_event_log(events);

    if frame_count == 0 {
        if !events.is_empty() {
            push_issue(
                &mut issues,
                "timeline_events_without_frames",
                format!(
                    "take has no frames but contains {} timeline edit events",
                    events.len()
                ),
            );
        }
        return issues;
    }

    for (index, event) in events.iter().enumerate() {
        if event.session_frame as usize >= frame_count {
            push_issue(
                &mut issues,
                "timeline_event_outside_take_frame_range",
                format!(
                    "timeline edit event index {} targets session frame {} but take frame_count is {}",
                    index, event.session_frame, frame_count
                ),
            );
        }
    }

    issues
}

fn validate_source_id(source_id: &str) -> Result<(), TimelineEventError> {
    let Some(enabled) = TIMELINE_EVENT_POLICY.source_enabled.get(source_id) else {
        return Err(TimelineEventError::UnknownSource {
            source_id: source_id.to_string(),
        });
    };

    if !enabled {
        return Err(TimelineEventError::SourceDisabled {
            source_id: source_id.to_string(),
        });
    }

    Ok(())
}

fn validate_session_frame(frame: u32) -> Result<(), TimelineEventError> {
    let bounds = &TIMELINE_EVENT_POLICY.session_frame_bounds;
    if frame < bounds.min || frame > bounds.max {
        return Err(TimelineEventError::SessionFrameOutOfBounds {
            frame,
            min: bounds.min,
            max: bounds.max,
        });
    }
    Ok(())
}

fn validate_op_frames(op: &KeyframeEditOp, issues: &mut Vec<TimelineEventValidationIssue>, event_index: usize) {
    match op {
        KeyframeEditOp::Upsert { sample } => validate_op_frame(sample.frame, issues, event_index, "upsert.sample.frame"),
        KeyframeEditOp::Remove { frame } => validate_op_frame(*frame, issues, event_index, "remove.frame"),
        KeyframeEditOp::Move { from_frame, to_frame } => {
            validate_op_frame(*from_frame, issues, event_index, "move.from_frame");
            validate_op_frame(*to_frame, issues, event_index, "move.to_frame");
        }
    }
}

fn validate_op_frame(
    frame: u32,
    issues: &mut Vec<TimelineEventValidationIssue>,
    event_index: usize,
    field: &str,
) {
    if let Err(err) = validate_session_frame(frame) {
        push_issue(
            issues,
            "timeline_event_op_frame_invalid",
            format!("timeline edit event index {} field '{}' error: {}", event_index, field, err),
        );
    }
}

fn push_issue(issues: &mut Vec<TimelineEventValidationIssue>, code: impl Into<String>, message: impl Into<String>) {
    issues.push(TimelineEventValidationIssue {
        code: code.into(),
        message: message.into(),
    });
}

fn validate_policy_manifest(manifest: &TimelineEventPolicyManifest) -> Result<TimelineEventPolicy, String> {
    if manifest.session_frame_bounds.max < manifest.session_frame_bounds.min {
        return Err("session_frame_bounds.max must be >= session_frame_bounds.min".to_string());
    }

    if manifest.max_events_per_take == 0 {
        return Err("max_events_per_take must be > 0".to_string());
    }

    if manifest.max_events_per_track == 0 {
        return Err("max_events_per_track must be > 0".to_string());
    }

    if manifest.max_events_per_track > manifest.max_events_per_take {
        return Err("max_events_per_track must be <= max_events_per_take".to_string());
    }

    let mut seen_source_ids = BTreeSet::new();
    let mut source_enabled = BTreeMap::new();
    for source in &manifest.sources {
        if source.id.trim().is_empty() {
            return Err("timeline event source id cannot be empty".to_string());
        }
        if !seen_source_ids.insert(source.id.clone()) {
            return Err(format!("duplicate timeline event source id '{}'", source.id));
        }

        source_enabled.insert(source.id.clone(), source.enabled);
    }

    if source_enabled.values().all(|enabled| !enabled) {
        return Err("at least one timeline event source must be enabled".to_string());
    }

    Ok(TimelineEventPolicy {
        session_frame_bounds: manifest.session_frame_bounds.clone(),
        max_events_per_take: manifest.max_events_per_take,
        max_events_per_track: manifest.max_events_per_track,
        require_monotonic_timestamp_ms: manifest.require_monotonic_timestamp_ms,
        source_enabled,
    })
}

#[cfg(test)]
mod tests {
    use serde_json::Value;

    use crate::timeline_edit::{
        apply_keyframe_edit, KeyframeInterpolation, KeyframeSample, TimelineTrackState,
    };

    use super::*;

    fn sample(frame: u32, value: i64) -> KeyframeSample {
        KeyframeSample {
            frame,
            value: Value::from(value),
            interpolation: KeyframeInterpolation::Linear,
        }
    }

    #[test]
    fn manifest_exposes_enabled_sources() {
        let sources = enabled_timeline_event_sources();
        assert!(sources.contains(&"sequencer-ui".to_string()));
        assert!(sources.contains(&"take-import".to_string()));
        assert!(sources.contains(&"automation-replay".to_string()));
        assert!(!sources.contains(&"legacy-replay".to_string()));
    }

    #[test]
    fn build_event_rejects_disabled_source() {
        let mut track = TimelineTrackState::new("pose_main");
        let applied = apply_keyframe_edit(
            &mut track,
            KeyframeEditOp::Upsert {
                sample: sample(10, 1),
            },
        )
        .expect("upsert should succeed");

        let error = build_timeline_edit_event("pose_main", "legacy-replay", 10, 1000, applied)
            .expect_err("disabled source must fail");

        assert_eq!(
            error,
            TimelineEventError::SourceDisabled {
                source_id: "legacy-replay".to_string(),
            }
        );
    }

    #[test]
    fn validate_log_detects_op_frame_bounds_issue() {
        let event = TimelineEditEvent {
            event_id: "e1".to_string(),
            track_id: "pose_main".to_string(),
            source_id: "sequencer-ui".to_string(),
            session_frame: 5,
            timestamp_ms: 1000,
            op: KeyframeEditOp::Remove { frame: 500_000 },
            patch: TimelineTrackPatch {
                prior_keyframes: Vec::new(),
            },
        };

        let issues = validate_timeline_event_log(&[event]);
        assert!(
            issues
                .iter()
                .any(|issue| issue.code == "timeline_event_op_frame_invalid")
        );
    }

    #[test]
    fn validate_against_take_detects_out_of_range_frame() {
        let event = TimelineEditEvent {
            event_id: "e1".to_string(),
            track_id: "pose_main".to_string(),
            source_id: "sequencer-ui".to_string(),
            session_frame: 24,
            timestamp_ms: 1000,
            op: KeyframeEditOp::Remove { frame: 24 },
            patch: TimelineTrackPatch {
                prior_keyframes: Vec::new(),
            },
        };

        let issues = validate_timeline_event_log_against_take(&[event], 10);
        assert!(
            issues
                .iter()
                .any(|issue| issue.code == "timeline_event_outside_take_frame_range")
        );
    }
}
