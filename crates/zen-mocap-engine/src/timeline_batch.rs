use std::collections::{BTreeSet, HashMap};

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::{
    gpu_pipeline::SUPERMOTION_LIVELINK_MODES,
    timeline_edit::{
        apply_keyframe_edit, revert_keyframe_edit, AppliedKeyframeEdit, KeyframeEditError, KeyframeEditOp, TimelineTrackState,
    },
};

#[derive(Debug, Clone, Deserialize)]
struct BatchPolicy {
    allow_empty: bool,
    max_operations: usize,
}

#[derive(Debug, Clone, Deserialize)]
struct OriginPolicy {
    id: String,
    enabled: bool,
}

#[derive(Debug, Clone, Deserialize)]
struct SupermotionPolicy {
    allow_mode_override: bool,
    allowed_mode_ids: Vec<u32>,
}

#[derive(Debug, Clone, Deserialize)]
struct TimelineBatchPolicyManifest {
    batch: BatchPolicy,
    origins: Vec<OriginPolicy>,
    supermotion: SupermotionPolicy,
}

#[derive(Debug)]
struct TimelineBatchPolicy {
    batch: BatchPolicy,
    enabled_origins: BTreeSet<String>,
    allowed_supermotion_mode_ids: BTreeSet<u32>,
    allow_supermotion_mode_override: bool,
}

static TIMELINE_BATCH_POLICY_TOML: &str = include_str!("../resources/timeline_batch_policy.toml");

static TIMELINE_BATCH_POLICY: Lazy<TimelineBatchPolicy> = Lazy::new(|| {
    let manifest: TimelineBatchPolicyManifest = toml::from_str(TIMELINE_BATCH_POLICY_TOML)
        .expect("timeline_batch_policy.toml is invalid - this is a compile-time bug");
    validate_policy_manifest(&manifest)
        .expect("timeline_batch_policy.toml failed validation - this is a compile-time bug")
});

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum TimelineEditOrigin {
    SequencerUi,
    Hotkey,
    Import,
    Automation,
}

impl TimelineEditOrigin {
    pub const ALL: [TimelineEditOrigin; 4] = [
        TimelineEditOrigin::SequencerUi,
        TimelineEditOrigin::Hotkey,
        TimelineEditOrigin::Import,
        TimelineEditOrigin::Automation,
    ];

    pub fn policy_id(self) -> &'static str {
        match self {
            Self::SequencerUi => "sequencer-ui",
            Self::Hotkey => "hotkey",
            Self::Import => "import",
            Self::Automation => "automation",
        }
    }

    pub fn from_policy_id(policy_id: &str) -> Option<Self> {
        match policy_id {
            "sequencer-ui" => Some(Self::SequencerUi),
            "hotkey" => Some(Self::Hotkey),
            "import" => Some(Self::Import),
            "automation" => Some(Self::Automation),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TimelineEditEnvelope {
    pub track_id: String,
    pub origin: TimelineEditOrigin,
    pub op: KeyframeEditOp,
    pub requested_supermotion_mode_id: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AppliedTimelineEditEnvelope {
    pub envelope: TimelineEditEnvelope,
    pub applied: AppliedKeyframeEdit,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TimelineEditBatchResult {
    pub applied: Vec<AppliedTimelineEditEnvelope>,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum TimelineBatchError {
    #[error("timeline edit batch cannot be empty")]
    EmptyBatch,
    #[error("timeline edit batch has {actual} operations and exceeds max {max}")]
    BatchTooLarge { actual: usize, max: usize },
    #[error("timeline edit envelope index {index} targets track '{envelope_track_id}', expected '{expected_track_id}'")]
    TrackMismatch {
        index: usize,
        envelope_track_id: String,
        expected_track_id: String,
    },
    #[error("timeline edit origin '{origin}' is disabled by batch policy")]
    OriginDisabled { origin: String },
    #[error("supermotion mode override is disabled by batch policy")]
    SupermotionModeOverrideDisabled,
    #[error("supermotion mode id {mode_id} is not allowed by batch policy")]
    SupermotionModeNotAllowed { mode_id: u32 },
    #[error("supermotion mode id {mode_id} does not exist in Kain supermotion registry")]
    UnknownSupermotionModeId { mode_id: u32 },
    #[error("timeline edit operation at batch index {index} failed: {source}")]
    KeyframeEdit {
        index: usize,
        #[source]
        source: KeyframeEditError,
    },
}

pub fn apply_timeline_edit_batch(
    track: &mut TimelineTrackState,
    envelopes: Vec<TimelineEditEnvelope>,
) -> Result<TimelineEditBatchResult, TimelineBatchError> {
    let policy = &*TIMELINE_BATCH_POLICY;
    validate_batch_size(policy, envelopes.len())?;

    let mut applied = Vec::new();
    for (index, envelope) in envelopes.into_iter().enumerate() {
        if envelope.track_id != track.track_id {
            rollback_applied(track, &applied);
            return Err(TimelineBatchError::TrackMismatch {
                index,
                envelope_track_id: envelope.track_id,
                expected_track_id: track.track_id.clone(),
            });
        }

        validate_origin(policy, envelope.origin)?;
        validate_supermotion_mode(policy, envelope.requested_supermotion_mode_id)?;

        match apply_keyframe_edit(track, envelope.op.clone()) {
            Ok(applied_edit) => {
                applied.push(AppliedTimelineEditEnvelope {
                    envelope,
                    applied: applied_edit,
                });
            }
            Err(source) => {
                rollback_applied(track, &applied);
                return Err(TimelineBatchError::KeyframeEdit { index, source });
            }
        }
    }

    Ok(TimelineEditBatchResult { applied })
}

fn rollback_applied(track: &mut TimelineTrackState, applied: &[AppliedTimelineEditEnvelope]) {
    for entry in applied.iter().rev() {
        revert_keyframe_edit(track, &entry.applied.patch);
    }
}

fn validate_batch_size(policy: &TimelineBatchPolicy, operation_count: usize) -> Result<(), TimelineBatchError> {
    if operation_count == 0 && !policy.batch.allow_empty {
        return Err(TimelineBatchError::EmptyBatch);
    }
    if operation_count > policy.batch.max_operations {
        return Err(TimelineBatchError::BatchTooLarge {
            actual: operation_count,
            max: policy.batch.max_operations,
        });
    }
    Ok(())
}

fn validate_origin(policy: &TimelineBatchPolicy, origin: TimelineEditOrigin) -> Result<(), TimelineBatchError> {
    let origin_id = origin.policy_id();
    if policy.enabled_origins.contains(origin_id) {
        return Ok(());
    }

    Err(TimelineBatchError::OriginDisabled {
        origin: origin_id.to_string(),
    })
}

fn validate_supermotion_mode(policy: &TimelineBatchPolicy, mode_id: Option<u32>) -> Result<(), TimelineBatchError> {
    let Some(mode_id) = mode_id else {
        return Ok(());
    };

    if !policy.allow_supermotion_mode_override {
        return Err(TimelineBatchError::SupermotionModeOverrideDisabled);
    }
    if !policy.allowed_supermotion_mode_ids.contains(&mode_id) {
        return Err(TimelineBatchError::SupermotionModeNotAllowed { mode_id });
    }

    let known_ids: BTreeSet<u32> = SUPERMOTION_LIVELINK_MODES.iter().map(|(_, id)| *id).collect();
    if !known_ids.contains(&mode_id) {
        return Err(TimelineBatchError::UnknownSupermotionModeId { mode_id });
    }

    Ok(())
}

fn validate_policy_manifest(manifest: &TimelineBatchPolicyManifest) -> Result<TimelineBatchPolicy, String> {
    if manifest.batch.max_operations == 0 {
        return Err("batch.max_operations must be > 0".to_string());
    }

    let mut origins = HashMap::new();
    for origin in &manifest.origins {
        if origin.id.trim().is_empty() {
            return Err("origin id cannot be empty".to_string());
        }
        if origins.insert(origin.id.clone(), origin.enabled).is_some() {
            return Err(format!("duplicate origin id '{}'", origin.id));
        }
    }

    for required in TimelineEditOrigin::ALL {
        let origin_id = required.policy_id();
        if !origins.contains_key(origin_id) {
            return Err(format!("required origin '{}' missing from policy", origin_id));
        }
    }

    let available_mode_ids: BTreeSet<u32> = SUPERMOTION_LIVELINK_MODES.iter().map(|(_, id)| *id).collect();
    let mut allowed_supermotion_mode_ids = BTreeSet::new();
    for mode_id in &manifest.supermotion.allowed_mode_ids {
        if !available_mode_ids.contains(mode_id) {
            return Err(format!(
                "supermotion mode id '{}' is not present in SUPERMOTION_LIVELINK_MODES",
                mode_id
            ));
        }
        if !allowed_supermotion_mode_ids.insert(*mode_id) {
            return Err(format!("duplicate supermotion mode id '{}'", mode_id));
        }
    }

    if manifest.supermotion.allow_mode_override && allowed_supermotion_mode_ids.is_empty() {
        return Err("at least one supermotion mode id must be allowed when mode override is enabled".to_string());
    }

    let enabled_origins = manifest
        .origins
        .iter()
        .filter(|origin| origin.enabled)
        .map(|origin| origin.id.clone())
        .collect();

    Ok(TimelineBatchPolicy {
        batch: manifest.batch.clone(),
        enabled_origins,
        allowed_supermotion_mode_ids,
        allow_supermotion_mode_override: manifest.supermotion.allow_mode_override,
    })
}

#[cfg(test)]
mod tests {
    use serde_json::Value;

    use super::*;
    use crate::timeline_edit::{KeyframeInterpolation, KeyframeSample};

    fn sample(frame: u32, value: i64) -> KeyframeSample {
        KeyframeSample {
            frame,
            value: Value::from(value),
            interpolation: KeyframeInterpolation::Linear,
        }
    }

    fn make_envelope(track_id: &str, op: KeyframeEditOp) -> TimelineEditEnvelope {
        TimelineEditEnvelope {
            track_id: track_id.to_string(),
            origin: TimelineEditOrigin::SequencerUi,
            op,
            requested_supermotion_mode_id: None,
        }
    }

    #[test]
    fn applies_batch_and_preserves_operation_order() {
        let mut track = TimelineTrackState::new("pose_main");
        let result = apply_timeline_edit_batch(
            &mut track,
            vec![
                make_envelope(
                    "pose_main",
                    KeyframeEditOp::Upsert {
                        sample: sample(8, 1),
                    },
                ),
                make_envelope(
                    "pose_main",
                    KeyframeEditOp::Move {
                        from_frame: 8,
                        to_frame: 12,
                    },
                ),
            ],
        )
        .expect("batch should succeed");

        assert_eq!(result.applied.len(), 2);
        assert!(!track.keyframes.contains_key(&8));
        assert_eq!(track.keyframes.get(&12).and_then(|entry| entry.value.as_i64()), Some(1));
    }

    #[test]
    fn rolls_back_applied_operations_on_error() {
        let mut track = TimelineTrackState::new("pose_main");
        let error = apply_timeline_edit_batch(
            &mut track,
            vec![
                make_envelope(
                    "pose_main",
                    KeyframeEditOp::Upsert {
                        sample: sample(15, 1),
                    },
                ),
                make_envelope("pose_main", KeyframeEditOp::Remove { frame: 999 }),
            ],
        )
        .expect_err("batch should fail on missing keyframe");

        assert!(matches!(error, TimelineBatchError::KeyframeEdit { index: 1, .. }));
        assert!(track.keyframes.is_empty(), "prior upsert should be rolled back");
    }

    #[test]
    fn rejects_disabled_origin() {
        let mut track = TimelineTrackState::new("pose_main");
        let envelope = TimelineEditEnvelope {
            track_id: "pose_main".to_string(),
            origin: TimelineEditOrigin::Automation,
            op: KeyframeEditOp::Upsert {
                sample: sample(4, 99),
            },
            requested_supermotion_mode_id: None,
        };

        let error = apply_timeline_edit_batch(&mut track, vec![envelope]).expect_err("automation origin is disabled by policy");
        assert_eq!(
            error,
            TimelineBatchError::OriginDisabled {
                origin: "automation".to_string(),
            }
        );
    }

    #[test]
    fn rejects_unknown_supermotion_mode() {
        let mut track = TimelineTrackState::new("pose_main");
        let envelope = TimelineEditEnvelope {
            track_id: "pose_main".to_string(),
            origin: TimelineEditOrigin::SequencerUi,
            op: KeyframeEditOp::Upsert {
                sample: sample(4, 99),
            },
            requested_supermotion_mode_id: Some(99),
        };

        let error = apply_timeline_edit_batch(&mut track, vec![envelope]).expect_err("mode should be rejected");
        assert_eq!(error, TimelineBatchError::SupermotionModeNotAllowed { mode_id: 99 });
    }
}
