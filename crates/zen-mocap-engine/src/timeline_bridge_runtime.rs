use serde::{Deserialize, Serialize};
use serde_json::Value;
use thiserror::Error;

use crate::{
    timeline_batch::TimelineEditEnvelope,
    timeline_bridge_contract::timeline_bridge_binding_for_action,
    timeline_edit::{KeyframeEditOp, KeyframeInterpolation, KeyframeSample},
    timeline_runtime::TimelineRuntimeRequest,
};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SequencerActionCommand {
    pub action_id: String,
    pub track_id: String,
    pub requested_supermotion_mode_id: Option<u32>,
    pub payload: SequencerActionPayload,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case", tag = "type")]
pub enum SequencerActionPayload {
    Upsert {
        frame: u32,
        value: Value,
        interpolation: KeyframeInterpolation,
    },
    Remove {
        frame: u32,
    },
    Move {
        from_frame: u32,
        to_frame: u32,
    },
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum TimelineBridgeRuntimeError {
    #[error("unknown timeline action id '{action_id}'")]
    UnknownActionId { action_id: String },
    #[error("timeline action '{action_id}' expects op '{expected_op}' but received '{actual_op}'")]
    ActionPayloadMismatch {
        action_id: String,
        expected_op: String,
        actual_op: String,
    },
}

pub fn runtime_request_from_sequencer_actions(
    session_frame: u32,
    timestamp_ms: u64,
    actions: Vec<SequencerActionCommand>,
) -> Result<TimelineRuntimeRequest, TimelineBridgeRuntimeError> {
    let envelopes = actions
        .into_iter()
        .map(envelope_from_sequencer_action)
        .collect::<Result<Vec<_>, _>>()?;

    Ok(TimelineRuntimeRequest {
        session_frame,
        timestamp_ms,
        envelopes,
    })
}

pub fn envelope_from_sequencer_action(
    action: SequencerActionCommand,
) -> Result<TimelineEditEnvelope, TimelineBridgeRuntimeError> {
    let Some(binding) = timeline_bridge_binding_for_action(&action.action_id) else {
        return Err(TimelineBridgeRuntimeError::UnknownActionId {
            action_id: action.action_id,
        });
    };

    let (actual_op, op) = payload_to_op(action.payload);
    if binding.operation_id != actual_op {
        return Err(TimelineBridgeRuntimeError::ActionPayloadMismatch {
            action_id: binding.action_id,
            expected_op: binding.operation_id,
            actual_op,
        });
    }

    Ok(TimelineEditEnvelope {
        track_id: action.track_id,
        origin: binding.origin,
        op,
        requested_supermotion_mode_id: action.requested_supermotion_mode_id,
    })
}

fn payload_to_op(payload: SequencerActionPayload) -> (String, KeyframeEditOp) {
    match payload {
        SequencerActionPayload::Upsert {
            frame,
            value,
            interpolation,
        } => (
            "upsert".to_string(),
            KeyframeEditOp::Upsert {
                sample: KeyframeSample {
                    frame,
                    value,
                    interpolation,
                },
            },
        ),
        SequencerActionPayload::Remove { frame } => {
            ("remove".to_string(), KeyframeEditOp::Remove { frame })
        }
        SequencerActionPayload::Move {
            from_frame,
            to_frame,
        } => (
            "move".to_string(),
            KeyframeEditOp::Move {
                from_frame,
                to_frame,
            },
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        timeline_batch::TimelineEditOrigin,
        timeline_edit::{KeyframeEditOp, KeyframeInterpolation},
    };

    fn upsert_action() -> SequencerActionCommand {
        SequencerActionCommand {
            action_id: "sequencer-add-keyframe".to_string(),
            track_id: "pose_main".to_string(),
            requested_supermotion_mode_id: None,
            payload: SequencerActionPayload::Upsert {
                frame: 24,
                value: Value::from(7),
                interpolation: KeyframeInterpolation::Linear,
            },
        }
    }

    #[test]
    fn maps_add_keyframe_action_into_timeline_envelope() {
        let envelope = envelope_from_sequencer_action(upsert_action())
            .expect("add action should map into envelope");
        assert_eq!(envelope.track_id, "pose_main");
        assert_eq!(envelope.origin, TimelineEditOrigin::SequencerUi);
        assert_eq!(
            envelope.op,
            KeyframeEditOp::Upsert {
                sample: KeyframeSample {
                    frame: 24,
                    value: Value::from(7),
                    interpolation: KeyframeInterpolation::Linear,
                },
            }
        );
    }

    #[test]
    fn rejects_action_payload_shape_that_does_not_match_contract_operation() {
        let action = SequencerActionCommand {
            action_id: "sequencer-remove-keyframe".to_string(),
            track_id: "pose_main".to_string(),
            requested_supermotion_mode_id: None,
            payload: SequencerActionPayload::Upsert {
                frame: 9,
                value: Value::from(3),
                interpolation: KeyframeInterpolation::Step,
            },
        };

        let error = envelope_from_sequencer_action(action)
            .expect_err("mismatched payload should fail");
        assert_eq!(
            error,
            TimelineBridgeRuntimeError::ActionPayloadMismatch {
                action_id: "sequencer-remove-keyframe".to_string(),
                expected_op: "remove".to_string(),
                actual_op: "upsert".to_string(),
            }
        );
    }

    #[test]
    fn builds_runtime_request_from_multiple_actions() {
        let remove = SequencerActionCommand {
            action_id: "sequencer-remove-keyframe".to_string(),
            track_id: "pose_main".to_string(),
            requested_supermotion_mode_id: None,
            payload: SequencerActionPayload::Remove { frame: 24 },
        };
        let request = runtime_request_from_sequencer_actions(
            120,
            10_000,
            vec![upsert_action(), remove],
        )
        .expect("action batch should map into runtime request");

        assert_eq!(request.session_frame, 120);
        assert_eq!(request.timestamp_ms, 10_000);
        assert_eq!(request.envelopes.len(), 2);
        assert_eq!(request.envelopes[0].origin, TimelineEditOrigin::SequencerUi);
        assert_eq!(request.envelopes[1].origin, TimelineEditOrigin::SequencerUi);
    }
}
