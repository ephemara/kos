use crate::mesh_state::SCENE_WORLD;
use k_os_animation::AnimationClipAsset;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IngestMocapTakeResult {
    pub take_handle: u64,
    pub animation_handle: u64,
    pub animation_asset: AnimationClipAsset,
}

pub fn ingest_mocap_take_cmd(
    name: String,
    path: String,
    model_id: String,
    frame_count: usize,
    fps: Option<f32>,
) -> Result<IngestMocapTakeResult, String> {
    let fps = fps.unwrap_or(30.0);
    let animation_asset = AnimationClipAsset::from_mocap_take(
        name.clone(),
        path.clone(),
        model_id.clone(),
        frame_count,
        fps,
    );

    let mut scene = SCENE_WORLD
        .write()
        .map_err(|_| "Failed to lock scene world".to_string())?;

    let take = scene.insert_take(name.clone(), path.clone(), model_id, frame_count);
    let animation = scene.insert_animation(
        animation_asset.name.clone(),
        Some(take),
        animation_asset.external_path.clone(),
    );

    Ok(IngestMocapTakeResult {
        take_handle: take.raw(),
        animation_handle: animation.raw(),
        animation_asset,
    })
}
