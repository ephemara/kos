//! File operation commands
//!
//! Commands for saving and loading files

/// Save binary data to a temp file and return the path
#[tauri::command]
pub fn save_temp_glb(data: Vec<u8>) -> Result<String, String> {
    use std::io::Write;
    let cwd = std::env::current_dir().map_err(|e| e.to_string())?;
    // Move UP one level to avoid triggering the watcher in src-tauri
    let assets_dir = cwd.parent().unwrap_or(&cwd).join("assets");
    if !assets_dir.exists() {
        std::fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;
    }
    let file_path = assets_dir.join("k_sculpt_sync.glb");
    let mut file = std::fs::File::create(&file_path).map_err(|e| e.to_string())?;
    file.write_all(&data).map_err(|e| e.to_string())?;
    Ok("k_sculpt_sync.glb".to_string())
}

/// Save kernel artifact GLB file
#[tauri::command]
pub fn save_kernel_artifact_glb(id: String, data: Vec<u8>) -> Result<String, String> {
    use std::io::Write;
    let cwd = std::env::current_dir().map_err(|e| e.to_string())?;
    let assets_dir = cwd.parent().unwrap_or(&cwd).join("assets");

    let kernel_dir = assets_dir.join("Imports").join("kernel");
    if !kernel_dir.exists() {
        std::fs::create_dir_all(&kernel_dir).map_err(|e| e.to_string())?;
    }

    let safe_id = id.replace('/', "_").replace('\\', "_");
    let file_name = format!("{}.glb", safe_id);
    let file_path = kernel_dir.join(&file_name);

    let mut file = std::fs::File::create(&file_path).map_err(|e| e.to_string())?;
    file.write_all(&data).map_err(|e| e.to_string())?;

    Ok(format!("Imports/kernel/{}", file_name))
}

/// Open a native file-open dialog filtered to video files.
/// Returns the chosen absolute path as a string, or null if cancelled.
#[tauri::command]
pub fn mocap_open_video_dialog(app: tauri::AppHandle) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;
    app.dialog()
        .file()
        .add_filter("Video Files", &["mp4", "mov", "avi", "mkv", "webm", "m4v"])
        .blocking_pick_file()
        .and_then(|fp| Some(fp.to_string()))
}

/// Open a native file-open dialog filtered to ZenMocap take files.
#[tauri::command]
pub fn mocap_open_take_dialog(app: tauri::AppHandle) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;
    app.dialog()
        .file()
        .add_filter("ZenMocap Take", &["zenmocap", "json"])
        .blocking_pick_file()
        .and_then(|fp| Some(fp.to_string()))
}

/// Open a native file-save dialog for ZenMocap take files.
#[tauri::command]
pub fn mocap_save_take_dialog(
    app: tauri::AppHandle,
    default_name: Option<String>,
) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;
    let suggested = default_name.unwrap_or_else(|| "take_001.zenmocap".to_string());
    app.dialog()
        .file()
        .add_filter("ZenMocap Take", &["zenmocap"])
        .set_file_name(&suggested)
        .blocking_save_file()
        .and_then(|fp| Some(fp.to_string()))
}
