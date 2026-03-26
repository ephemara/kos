//! Path utilities
//!
//! Helper functions for working with file paths

use std::path::PathBuf;

/// Get the assets directory path
pub fn get_assets_dir() -> Result<PathBuf, String> {
    let cwd = std::env::current_dir().map_err(|e| e.to_string())?;
    let assets_dir = cwd.parent().unwrap_or(&cwd).join("assets");
    Ok(assets_dir)
}

/// Ensure a directory exists, creating it if necessary
pub fn ensure_dir_exists(path: &PathBuf) -> Result<(), String> {
    if !path.exists() {
        std::fs::create_dir_all(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Sanitize a filename by replacing invalid characters
pub fn sanitize_filename(name: &str) -> String {
    name.replace('/', "_")
        .replace('\\', "_")
        .replace(':', "_")
        .replace('*', "_")
        .replace('?', "_")
        .replace('"', "_")
        .replace('<', "_")
        .replace('>', "_")
        .replace('|', "_")
}
