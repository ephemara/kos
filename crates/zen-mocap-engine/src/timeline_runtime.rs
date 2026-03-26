use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::{
    timeline_batch::{apply_timeline_edit_batch, TimelineBatchError, TimelineEditBatchResult, TimelineEditEnvelope},
    timeline_edit::{revert_keyframe_edit, TimelineTrackState},
    timeline_event::{
        build_timeline_edit_event, validate_timeline_event_log, TimelineEditEvent, TimelineEventError, TimelineEventValidationIssue,
    },
    timeline_surface_contract::timeline_event_source_for_origin,
};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TimelineRuntimeRequest {
    pub session_frame: u32,
    pub timestamp_ms: u64,
    pub envelopes: Vec<TimelineEditEnvelope>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TimelineRuntimeResult {
    pub batch: TimelineEditBatchResult,
    pub emitted_events: Vec<TimelineEditEvent>,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum TimelineRuntimeError {
    #[error("timeline edit batch failed: {source}")]
    Batch {
        #[from]
        source: TimelineBatchError,
    },
    #[error("timeline event build failed at index {index}: {source}")]
    EventBuild {
        index: usize,
        #[source]
        source: TimelineEventError,
    },
    #[error("timeline event timestamp overflow at batch index {index}")]
    TimestampOverflow { index: usize },
    #[error("timeline event log validation failed after applying batch")]
    EventLogValidation {
        issues: Vec<TimelineEventValidationIssue>,
    },
}

pub fn apply_timeline_runtime_request(
    track: &mut TimelineTrackState,
    existing_event_log: &[TimelineEditEvent],
    request: TimelineRuntimeRequest,
) -> Result<TimelineRuntimeResult, TimelineRuntimeError> {
    let batch = apply_timeline_edit_batch(track, request.envelopes)?;
    let mut emitted_events = Vec::with_capacity(batch.applied.len());

    for (index, applied_entry) in batch.applied.iter().enumerate() {
        let timestamp_ms = request
            .timestamp_ms
            .checked_add(index as u64)
            .ok_or(TimelineRuntimeError::TimestampOverflow { index })?;
        let source_id = timeline_event_source_for_origin(applied_entry.envelope.origin);
        let applied = applied_entry.applied.clone();
        match build_timeline_edit_event(
            &applied_entry.envelope.track_id,
            source_id,
            request.session_frame,
            timestamp_ms,
            applied,
        ) {
            Ok(event) => emitted_events.push(event),
            Err(source) => {
                rollback_batch(track, &batch);
                return Err(TimelineRuntimeError::EventBuild { index, source });
            }
        }
    }

    let mut merged_event_log = Vec::with_capacity(existing_event_log.len() + emitted_events.len());
    merged_event_log.extend_from_slice(existing_event_log);
    merged_event_log.extend(emitted_events.iter().cloned());
    let issues = validate_timeline_event_log(&merged_event_log);
    if !issues.is_empty() {
        rollback_batch(track, &batch);
        return Err(TimelineRuntimeError::EventLogValidation { issues });
    }

    Ok(TimelineRuntimeResult {
        batch,
        emitted_events,
    })
}

fn rollback_batch(track: &mut TimelineTrackState, batch: &TimelineEditBatchResult) {
    for entry in batch.applied.iter().rev() {
        revert_keyframe_edit(track, &entry.applied.patch);
    }
}

#[cfg(test)]
mod tests {
    use serde_json::Value;

    use super::*;
    use crate::{
        timeline_batch::{TimelineEditOrigin, TimelineEditEnvelope},
        timeline_edit::{KeyframeEditOp, KeyframeInterpolation, KeyframeSample},
    };

    fn sample(frame: u32, value: i64) -> KeyframeSample {
        KeyframeSample {
            frame,
            value: Value::from(value),
            interpolation: KeyframeInterpolation::Linear,
        }
    }

    fn upsert_envelope(track_id: &str, frame: u32, value: i64) -> TimelineEditEnvelope {
        TimelineEditEnvelope {
            track_id: track_id.to_string(),
            origin: TimelineEditOrigin::SequencerUi,
            op: KeyframeEditOp::Upsert {
                sample: sample(frame, value),
            },
            requested_supermotion_mode_id: None,
        }
    }

    #[test]
    fn applies_batch_and_emits_origin_bound_events() {
        let mut track = TimelineTrackState::new("pose_main");
        let request = TimelineRuntimeRequest {
            session_frame: 12,
            timestamp_ms: 1_000,
            envelopes: vec![
                upsert_envelope("pose_main", 8, 11),
                upsert_envelope("pose_main", 10, 22),
            ],
        };

        let result = apply_timeline_runtime_request(&mut track, &[], request).expect("request should succeed");
        assert_eq!(result.batch.applied.len(), 2);
        assert_eq!(result.emitted_events.len(), 2);
        assert_eq!(result.emitted_events[0].source_id, "sequencer-ui");
        assert_eq!(result.emitted_events[0].timestamp_ms, 1_000);
        assert_eq!(result.emitted_events[1].timestamp_ms, 1_001);
        assert_eq!(track.keyframes.get(&8).and_then(|entry| entry.value.as_i64()), Some(11));
        assert_eq!(track.keyframes.get(&10).and_then(|entry| entry.value.as_i64()), Some(22));
    }

    #[test]
    fn event_build_failure_rolls_back_track_state() {
        let mut track = TimelineTrackState::new("pose_main");
        let request = TimelineRuntimeRequest {
            session_frame: 300_000,
            timestamp_ms: 50,
            envelopes: vec![upsert_envelope("pose_main", 8, 11)],
        };

        let error = apply_timeline_runtime_request(&mut track, &[], request).expect_err("out-of-range session frame should fail");
        assert!(matches!(error, TimelineRuntimeError::EventBuild { index: 0, .. }));
        assert!(track.keyframes.is_empty(), "applied keyframe should be rolled back");
    }

    #[test]
    fn log_validation_failure_rolls_back_track_state() {
        let mut track = TimelineTrackState::new("pose_main");
        let existing = TimelineEditEvent {
            event_id: "e1".to_string(),
            track_id: "pose_main".to_string(),
            source_id: "sequencer-ui".to_string(),
            session_frame: 4,
            timestamp_ms: 10_000,
            op: KeyframeEditOp::Upsert {
                sample: sample(4, 1),
            },
            patch: crate::timeline_edit::TimelineTrackPatch {
                prior_keyframes: Vec::new(),
            },
        };
        let request = TimelineRuntimeRequest {
            session_frame: 6,
            timestamp_ms: 9_000,
            envelopes: vec![upsert_envelope("pose_main", 6, 2)],
        };

        let error = apply_timeline_runtime_request(&mut track, &[existing], request)
            .expect_err("timestamp regression should fail merged log validation");
        match error {
            TimelineRuntimeError::EventLogValidation { issues } => {
                assert!(
                    issues
                        .iter()
                        .any(|issue| issue.code == "timeline_event_timestamp_regression")
                );
            }
            other => panic!("unexpected error: {other:?}"),
        }
        assert!(
            !track.keyframes.contains_key(&6),
            "runtime should roll back applied keyframe on event log validation failure"
        );
    }
}
