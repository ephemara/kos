use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AnimationSourceKind {
    MocapTake,
    Procedural,
    Imported,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AnimationClipAsset {
    pub name: String,
    pub source_kind: AnimationSourceKind,
    pub external_path: Option<String>,
    pub source_model_id: Option<String>,
    pub frame_count: usize,
    pub fps: f32,
    pub duration_ms: u64,
    pub format: String,
    pub channels: Vec<String>,
}

impl AnimationClipAsset {
    pub fn from_mocap_take(
        name: impl Into<String>,
        path: impl Into<String>,
        model_id: impl Into<String>,
        frame_count: usize,
        fps: f32,
    ) -> Self {
        let fps = if fps <= 0.0 { 30.0 } else { fps };
        let duration_ms = ((frame_count as f32 / fps) * 1000.0) as u64;

        Self {
            name: name.into(),
            source_kind: AnimationSourceKind::MocapTake,
            external_path: Some(path.into()),
            source_model_id: Some(model_id.into()),
            frame_count,
            fps,
            duration_ms,
            format: "zenmocap-external".to_string(),
            channels: vec![
                "root".to_string(),
                "skeleton".to_string(),
                "retarget".to_string(),
            ],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_animation_asset_from_mocap_take() {
        let clip = AnimationClipAsset::from_mocap_take(
            "Walk",
            "C:/takes/walk.zenmocap",
            "yolov11s_pose",
            90,
            30.0,
        );

        assert_eq!(clip.name, "Walk");
        assert_eq!(clip.source_kind, AnimationSourceKind::MocapTake);
        assert_eq!(clip.duration_ms, 3000);
        assert_eq!(clip.channels.len(), 3);
    }
}
