//! Thin Tauri adapters for scene state commands.

use k_os_scene_runtime::scene_state::IngestMocapTakeResult;

#[tauri::command]
pub fn ingest_mocap_take_cmd(
    name: String,
    path: String,
    model_id: String,
    frame_count: usize,
    fps: Option<f32>,
) -> Result<IngestMocapTakeResult, String> {
    k_os_scene_runtime::scene_state::ingest_mocap_take_cmd(name, path, model_id, frame_count, fps)
}
