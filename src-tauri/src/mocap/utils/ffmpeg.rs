//! FFmpeg path resolution.
//!
//! In production (bundled app) ffmpeg and ffprobe are Tauri sidecars.
//! In development we fall back to whatever is on the system PATH.
//!
//! Usage:
//! ```
//! let ffprobe = ffmpeg_path("ffprobe")?;
//! let output = std::process::Command::new(ffprobe).args([...]).output()?;
//! ```

use std::path::PathBuf;

/// Return the absolute path to `tool` (either "ffmpeg" or "ffprobe").
///
/// Resolution order:
/// 1. `<app_dir>/binaries/<tool>-<target-triple>.exe`  — bundled sidecar (production)
/// 2. `<exe_dir>/<tool>.exe`                           — next to the binary (dev workaround)
/// 3. `<tool>` with no path                            — rely on system PATH (dev)
pub fn ffmpeg_path(tool: &str) -> String {
    // Try sidecar path: next to the executable
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            // In dev: target/debug/app-backend.exe → look in target/debug/
            // In prod: resources/app.asar.unpacked/... Tauri places sidecars next to the exe
            let candidate = dir.join(format!("{}.exe", tool));
            if candidate.exists() {
                return candidate.to_string_lossy().into_owned();
            }

            // Tauri names sidecars with target-triple suffix during bundle
            let candidate_triple = dir.join(format!("{}-x86_64-pc-windows-msvc.exe", tool));
            if candidate_triple.exists() {
                return candidate_triple.to_string_lossy().into_owned();
            }
        }
    }

    // Final fallback: system PATH (dev only — will error if not installed)
    tool.to_string()
}
