//! File Operations Module
///!
///! Simple file I/O operations for export functionality.
use std::fs;
use std::path::Path;

/// Write binary data to a file
#[tauri::command]
pub fn write_file(path: String, contents: Vec<u8>) -> Result<(), String> {
    let byte_count = contents.len();
    fs::write(&path, contents).map_err(|e| format!("Failed to write file {}: {}", path, e))?;

    log::info!("[FileOps] Wrote {} bytes to {}", byte_count, path);
    Ok(())
}

/// Read binary data from a file
#[tauri::command]
pub fn read_file(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path).map_err(|e| format!("Failed to read file {}: {}", path, e))
}

/// Check if a file exists
#[tauri::command]
pub fn file_exists(path: String) -> bool {
    Path::new(&path).exists()
}

/// Export texture as EXR format
///
/// This is a placeholder - full EXR export requires the `exr` crate
#[tauri::command]
pub fn export_texture_exr(
    path: String,
    _width: u32,
    _height: u32,
    data: Vec<u8>,
    _compression: String,
    _bit_depth: String,
) -> Result<(), String> {
    // TODO: Implement proper EXR export using the `exr` crate
    // For now, just save as raw data with .exr extension

    log::warn!("[FileOps] EXR export not fully implemented - saving as raw data");

    write_file(path, data)
}
