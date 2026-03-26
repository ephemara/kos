use std::collections::{BTreeMap, BTreeSet};

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use thiserror::Error;

#[derive(Debug, Clone, Deserialize)]
struct FrameBounds {
    min: u32,
    max: u32,
}

#[derive(Debug, Clone, Deserialize)]
struct InterpolationModePolicy {
    id: String,
    enabled: bool,
}

#[derive(Debug, Clone, Deserialize)]
struct OperationPolicy {
    id: String,
    enabled: bool,
    allow_frame_overwrite: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
struct KeyframeEditPolicyManifest {
    frame_bounds: FrameBounds,
    interpolation_modes: Vec<InterpolationModePolicy>,
    operations: Vec<OperationPolicy>,
}

#[derive(Debug)]
struct KeyframeEditPolicy {
    frame_bounds: FrameBounds,
    enabled_interpolation_ids: BTreeSet<String>,
    operations: BTreeMap<String, OperationPolicy>,
}

static KEYFRAME_EDIT_POLICY_TOML: &str = include_str!("../resources/keyframe_edit_policy.toml");

static KEYFRAME_EDIT_POLICY: Lazy<KeyframeEditPolicy> = Lazy::new(|| {
    let manifest: KeyframeEditPolicyManifest = toml::from_str(KEYFRAME_EDIT_POLICY_TOML)
        .expect("keyframe_edit_policy.toml is invalid - this is a compile-time bug");
    validate_policy_manifest(&manifest)
        .expect("keyframe_edit_policy.toml failed validation - this is a compile-time bug")
});

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "kebab-case")]
pub enum KeyframeInterpolation {
    Linear,
    EaseIn,
    EaseOut,
    EaseInOut,
    Step,
}

impl KeyframeInterpolation {
    fn policy_id(self) -> &'static str {
        match self {
            Self::Linear => "linear",
            Self::EaseIn => "ease-in",
            Self::EaseOut => "ease-out",
            Self::EaseInOut => "ease-in-out",
            Self::Step => "step",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct KeyframeSample {
    pub frame: u32,
    pub value: Value,
    pub interpolation: KeyframeInterpolation,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TimelineTrackState {
    pub track_id: String,
    pub keyframes: BTreeMap<u32, KeyframeSample>,
}

impl TimelineTrackState {
    pub fn new(track_id: impl Into<String>) -> Self {
        Self {
            track_id: track_id.into(),
            keyframes: BTreeMap::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case", tag = "type")]
pub enum KeyframeEditOp {
    Upsert { sample: KeyframeSample },
    Remove { frame: u32 },
    Move { from_frame: u32, to_frame: u32 },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PriorKeyframeState {
    pub frame: u32,
    pub sample: Option<KeyframeSample>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TimelineTrackPatch {
    pub prior_keyframes: Vec<PriorKeyframeState>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AppliedKeyframeEdit {
    pub op: KeyframeEditOp,
    pub patch: TimelineTrackPatch,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum KeyframeEditError {
    #[error("operation '{operation}' is disabled by keyframe edit policy")]
    OperationDisabled { operation: String },
    #[error("frame {frame} is out of bounds [{min}, {max}]")]
    FrameOutOfBounds { frame: u32, min: u32, max: u32 },
    #[error("interpolation mode '{mode}' is disabled by keyframe edit policy")]
    InterpolationDisabled { mode: String },
    #[error("keyframe frame {frame} does not exist on track '{track_id}'")]
    MissingKeyframe { track_id: String, frame: u32 },
    #[error("target frame {frame} already exists on track '{track_id}'")]
    FrameCollision { track_id: String, frame: u32 },
    #[error("cannot move keyframe to the same frame {frame}")]
    SameFrameMove { frame: u32 },
}

pub fn apply_keyframe_edit(track: &mut TimelineTrackState, op: KeyframeEditOp) -> Result<AppliedKeyframeEdit, KeyframeEditError> {
    match &op {
        KeyframeEditOp::Upsert { sample } => {
            validate_operation_enabled("upsert")?;
            validate_frame_bounds(sample.frame)?;
            validate_interpolation_enabled(sample.interpolation)?;

            let patch = TimelineTrackPatch {
                prior_keyframes: vec![PriorKeyframeState {
                    frame: sample.frame,
                    sample: track.keyframes.get(&sample.frame).cloned(),
                }],
            };

            track.keyframes.insert(sample.frame, sample.clone());
            Ok(AppliedKeyframeEdit { op, patch })
        }
        KeyframeEditOp::Remove { frame } => {
            validate_operation_enabled("remove")?;
            validate_frame_bounds(*frame)?;

            let Some(previous) = track.keyframes.remove(frame) else {
                return Err(KeyframeEditError::MissingKeyframe {
                    track_id: track.track_id.clone(),
                    frame: *frame,
                });
            };

            let patch = TimelineTrackPatch {
                prior_keyframes: vec![PriorKeyframeState {
                    frame: *frame,
                    sample: Some(previous),
                }],
            };
            Ok(AppliedKeyframeEdit { op, patch })
        }
        KeyframeEditOp::Move {
            from_frame,
            to_frame,
        } => {
            validate_operation_enabled("move")?;
            validate_frame_bounds(*from_frame)?;
            validate_frame_bounds(*to_frame)?;

            if from_frame == to_frame {
                return Err(KeyframeEditError::SameFrameMove { frame: *from_frame });
            }

            let allow_overwrite = KEYFRAME_EDIT_POLICY
                .operations
                .get("move")
                .and_then(|policy| policy.allow_frame_overwrite)
                .unwrap_or(false);

            let Some(mut source_sample) = track.keyframes.remove(from_frame) else {
                return Err(KeyframeEditError::MissingKeyframe {
                    track_id: track.track_id.clone(),
                    frame: *from_frame,
                });
            };

            let target_existing = track.keyframes.get(to_frame).cloned();
            if target_existing.is_some() && !allow_overwrite {
                track.keyframes.insert(*from_frame, source_sample);
                return Err(KeyframeEditError::FrameCollision {
                    track_id: track.track_id.clone(),
                    frame: *to_frame,
                });
            }

            let source_before_move = source_sample.clone();
            source_sample.frame = *to_frame;
            let prior_keyframes = vec![
                PriorKeyframeState {
                    frame: *from_frame,
                    sample: Some(source_before_move),
                },
                PriorKeyframeState {
                    frame: *to_frame,
                    sample: target_existing,
                },
            ];

            track.keyframes.insert(*to_frame, source_sample);

            Ok(AppliedKeyframeEdit {
                op,
                patch: TimelineTrackPatch { prior_keyframes },
            })
        }
    }
}

pub fn revert_keyframe_edit(track: &mut TimelineTrackState, patch: &TimelineTrackPatch) {
    for prior in &patch.prior_keyframes {
        match &prior.sample {
            Some(sample) => {
                track.keyframes.insert(prior.frame, sample.clone());
            }
            None => {
                track.keyframes.remove(&prior.frame);
            }
        }
    }
}

pub fn enabled_keyframe_operations() -> Vec<String> {
    KEYFRAME_EDIT_POLICY
        .operations
        .values()
        .filter(|policy| policy.enabled)
        .map(|policy| policy.id.clone())
        .collect()
}

pub fn enabled_interpolation_modes() -> Vec<String> {
    KEYFRAME_EDIT_POLICY
        .enabled_interpolation_ids
        .iter()
        .cloned()
        .collect()
}

fn validate_operation_enabled(operation: &str) -> Result<(), KeyframeEditError> {
    let Some(policy) = KEYFRAME_EDIT_POLICY.operations.get(operation) else {
        return Err(KeyframeEditError::OperationDisabled {
            operation: operation.to_string(),
        });
    };

    if !policy.enabled {
        return Err(KeyframeEditError::OperationDisabled {
            operation: operation.to_string(),
        });
    }

    Ok(())
}

fn validate_frame_bounds(frame: u32) -> Result<(), KeyframeEditError> {
    let bounds = &KEYFRAME_EDIT_POLICY.frame_bounds;
    if frame < bounds.min || frame > bounds.max {
        return Err(KeyframeEditError::FrameOutOfBounds {
            frame,
            min: bounds.min,
            max: bounds.max,
        });
    }
    Ok(())
}

fn validate_interpolation_enabled(interpolation: KeyframeInterpolation) -> Result<(), KeyframeEditError> {
    let mode = interpolation.policy_id();
    if !KEYFRAME_EDIT_POLICY.enabled_interpolation_ids.contains(mode) {
        return Err(KeyframeEditError::InterpolationDisabled {
            mode: mode.to_string(),
        });
    }
    Ok(())
}

fn validate_policy_manifest(manifest: &KeyframeEditPolicyManifest) -> Result<KeyframeEditPolicy, String> {
    if manifest.frame_bounds.max < manifest.frame_bounds.min {
        return Err("frame_bounds.max must be >= frame_bounds.min".to_string());
    }

    let mut interpolation_ids = BTreeSet::new();
    for mode in &manifest.interpolation_modes {
        if mode.id.trim().is_empty() {
            return Err("interpolation mode id cannot be empty".to_string());
        }

        if !interpolation_ids.insert(mode.id.clone()) {
            return Err(format!("duplicate interpolation mode id '{}'", mode.id));
        }
    }

    let enabled_interpolation_ids: BTreeSet<String> = manifest
        .interpolation_modes
        .iter()
        .filter(|mode| mode.enabled)
        .map(|mode| mode.id.clone())
        .collect();
    if enabled_interpolation_ids.is_empty() {
        return Err("at least one interpolation mode must be enabled".to_string());
    }

    let mut operations = BTreeMap::new();
    for operation in &manifest.operations {
        if operation.id.trim().is_empty() {
            return Err("operation id cannot be empty".to_string());
        }

        if operations.insert(operation.id.clone(), operation.clone()).is_some() {
            return Err(format!("duplicate operation id '{}'", operation.id));
        }
    }

    for required in ["upsert", "remove", "move"] {
        if !operations.contains_key(required) {
            return Err(format!("required operation '{}' missing from policy", required));
        }
    }

    Ok(KeyframeEditPolicy {
        frame_bounds: manifest.frame_bounds.clone(),
        enabled_interpolation_ids,
        operations,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample(frame: u32, value: i64, interpolation: KeyframeInterpolation) -> KeyframeSample {
        KeyframeSample {
            frame,
            value: Value::from(value),
            interpolation,
        }
    }

    #[test]
    fn manifest_exposes_enabled_operations_and_interpolations() {
        let operations = enabled_keyframe_operations();
        assert!(operations.contains(&"upsert".to_string()));
        assert!(operations.contains(&"remove".to_string()));
        assert!(operations.contains(&"move".to_string()));
        assert!(!operations.contains(&"scale-range".to_string()));

        let interpolation = enabled_interpolation_modes();
        assert!(interpolation.contains(&"linear".to_string()));
        assert!(interpolation.contains(&"ease-in".to_string()));
    }

    #[test]
    fn upsert_and_revert_restores_previous_state() {
        let mut track = TimelineTrackState::new("pose_main");
        track.keyframes.insert(10, sample(10, 1, KeyframeInterpolation::Linear));

        let applied = apply_keyframe_edit(
            &mut track,
            KeyframeEditOp::Upsert {
                sample: sample(10, 42, KeyframeInterpolation::EaseInOut),
            },
        )
        .expect("upsert should succeed");

        assert_eq!(track.keyframes.get(&10).and_then(|sample| sample.value.as_i64()), Some(42));

        revert_keyframe_edit(&mut track, &applied.patch);
        assert_eq!(track.keyframes.get(&10).and_then(|sample| sample.value.as_i64()), Some(1));
    }

    #[test]
    fn move_returns_collision_when_overwrite_disabled() {
        let mut track = TimelineTrackState::new("pose_main");
        track.keyframes.insert(10, sample(10, 1, KeyframeInterpolation::Linear));
        track.keyframes.insert(20, sample(20, 2, KeyframeInterpolation::Linear));

        let error = apply_keyframe_edit(
            &mut track,
            KeyframeEditOp::Move {
                from_frame: 10,
                to_frame: 20,
            },
        )
        .expect_err("move should fail when target frame already exists");

        assert_eq!(
            error,
            KeyframeEditError::FrameCollision {
                track_id: "pose_main".to_string(),
                frame: 20,
            }
        );

        assert!(track.keyframes.contains_key(&10));
        assert!(track.keyframes.contains_key(&20));
    }

    #[test]
    fn move_and_revert_restores_both_frames() {
        let mut track = TimelineTrackState::new("pose_main");
        track.keyframes.insert(10, sample(10, 7, KeyframeInterpolation::Linear));

        let applied = apply_keyframe_edit(
            &mut track,
            KeyframeEditOp::Move {
                from_frame: 10,
                to_frame: 16,
            },
        )
        .expect("move should succeed");

        assert!(!track.keyframes.contains_key(&10));
        assert_eq!(track.keyframes.get(&16).and_then(|sample| sample.value.as_i64()), Some(7));

        revert_keyframe_edit(&mut track, &applied.patch);
        assert_eq!(track.keyframes.get(&10).and_then(|sample| sample.value.as_i64()), Some(7));
        assert!(!track.keyframes.contains_key(&16));
    }

    #[test]
    fn remove_requires_existing_frame() {
        let mut track = TimelineTrackState::new("pose_main");
        let error = apply_keyframe_edit(&mut track, KeyframeEditOp::Remove { frame: 45 })
            .expect_err("remove should fail for missing frame");

        assert_eq!(
            error,
            KeyframeEditError::MissingKeyframe {
                track_id: "pose_main".to_string(),
                frame: 45,
            }
        );
    }
}
