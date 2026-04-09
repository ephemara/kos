//! Window management commands
//!
//! Commands for controlling the Tauri window (position, size, focus, etc.)

use std::path::PathBuf;
use std::process::Command;
use tauri::Manager;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

// ─── Main window controls ──────────────────────────────────────────────────

/// Set window always-on-top state dynamically
#[tauri::command]
pub async fn set_window_always_on_top(
    window: tauri::Window,
    always_on_top: bool,
) -> Result<(), String> {
    window
        .set_always_on_top(always_on_top)
        .map_err(|e| e.to_string())
}

/// Focus the main Tauri window
#[tauri::command]
pub async fn focus_main_window(window: tauri::Window) -> Result<(), String> {
    window.set_focus().map_err(|e| e.to_string())
}

/// Minimize the main window
#[tauri::command]
pub async fn minimize_window(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

/// Unminimize/restore the main window
#[tauri::command]
pub async fn unminimize_window(window: tauri::Window) -> Result<(), String> {
    window.unminimize().map_err(|e| e.to_string())
}

/// Toggle maximize state
#[tauri::command]
pub async fn toggle_maximize_window(window: tauri::Window) -> Result<(), String> {
    if window.is_maximized().unwrap_or(false) {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

/// Get current window position and size
#[tauri::command]
pub async fn get_window_bounds(window: tauri::Window) -> Result<serde_json::Value, String> {
    let pos = window.outer_position().map_err(|e| e.to_string())?;
    let size = window.outer_size().map_err(|e| e.to_string())?;
    let is_maximized = window.is_maximized().unwrap_or(false);
    let is_minimized = window.is_minimized().unwrap_or(false);
    Ok(serde_json::json!({
        "x": pos.x,
        "y": pos.y,
        "width": size.width,
        "height": size.height,
        "isMaximized": is_maximized,
        "isMinimized": is_minimized
    }))
}

/// Set window position
#[tauri::command]
pub async fn set_window_position(window: tauri::Window, x: i32, y: i32) -> Result<(), String> {
    window
        .set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }))
        .map_err(|e| e.to_string())
}

/// Set window size
#[tauri::command]
pub async fn set_window_size(window: tauri::Window, width: u32, height: u32) -> Result<(), String> {
    window
        .set_size(tauri::Size::Physical(tauri::PhysicalSize { width, height }))
        .map_err(|e| e.to_string())
}

/// Center the window on screen
#[tauri::command]
pub async fn center_window(window: tauri::Window) -> Result<(), String> {
    window.center().map_err(|e| e.to_string())
}

/// Make window resizable or not
#[tauri::command]
pub async fn set_window_resizable(window: tauri::Window, resizable: bool) -> Result<(), String> {
    window.set_resizable(resizable).map_err(|e| e.to_string())
}

// ─── Floating child windows ────────────────────────────────────────────────

/// Spawn or show the webcam preview window.
/// If the window already exists, brings it to front.
/// If not, creates a new window with the webcam-window.html entry point.
#[tauri::command]
pub async fn spawn_webcam_window(app: tauri::AppHandle) -> Result<(), String> {
    // Check if window already exists
    if let Some(window) = app.get_webview_window("webcam") {
        window
            .show()
            .map_err(|e| format!("Failed to show webcam window: {e}"))?;
        window
            .set_focus()
            .map_err(|e| format!("Failed to focus webcam window: {e}"))?;
        return Ok(());
    }

    use tauri::{WebviewUrl, WebviewWindowBuilder};
    let _window =
        WebviewWindowBuilder::new(&app, "webcam", WebviewUrl::App("webcam-window.html".into()))
            .title("Webcam Preview - ZenMocap")
            .inner_size(640.0, 480.0)
            .min_inner_size(320.0, 240.0)
            .resizable(true)
            .decorations(false)
            .transparent(false)
            .always_on_top(false)
            .center()
            .visible(true)
            .build()
            .map_err(|e| format!("Failed to create webcam window: {e}"))?;

    Ok(())
}

/// Close the webcam preview window if it exists.
#[tauri::command]
pub fn close_webcam_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("webcam") {
        window
            .close()
            .map_err(|e| format!("Failed to close webcam window: {e}"))?;
    }
    Ok(())
}

/// Spawn or show the dedicated ZenMocap window.
///
/// This keeps mocap UI isolated from the main K_OS app shell while still
/// sharing the same Tauri backend/resources.
#[tauri::command]
pub async fn spawn_mocap_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("mocap") {
        window
            .show()
            .map_err(|e| format!("Failed to show mocap window: {e}"))?;
        window
            .set_focus()
            .map_err(|e| format!("Failed to focus mocap window: {e}"))?;
        return Ok(());
    }

    use tauri::{WebviewUrl, WebviewWindowBuilder};
    let _window =
        WebviewWindowBuilder::new(&app, "mocap", WebviewUrl::App("mocap-window.html".into()))
            .title("ZenMocap - K_OS")
            .inner_size(1600.0, 940.0)
            .min_inner_size(980.0, 620.0)
            .resizable(true)
            .decorations(false)
            .always_on_top(false)
            .center()
            .visible(true)
            .build()
            .map_err(|e| format!("Failed to create mocap window: {e}"))?;

    Ok(())
}

/// Close the ZenMocap window if it exists.
#[tauri::command]
pub fn close_mocap_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("mocap") {
        window
            .close()
            .map_err(|e| format!("Failed to close mocap window: {e}"))?;
    }
    Ok(())
}

fn zen_binary_candidates(app: &tauri::AppHandle) -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    if let Ok(explicit) = std::env::var("ZEN_BIN_PATH") {
        let trimmed = explicit.trim();
        if !trimmed.is_empty() {
            candidates.push(PathBuf::from(trimmed));
        }
    }

    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(parent) = current_exe.parent() {
            candidates.push(parent.join("zen.exe"));
            candidates.push(parent.join("zen"));
        }
    }

    for relative_path in [
        "resources/bin/zen/zen",
        "resources/bin/zen/zen.exe",
        "resources/bin/zen",
        "resources/bin/zen.exe",
    ] {
        let Ok(path) = app
            .path()
            .resolve(relative_path, tauri::path::BaseDirectory::Resource)
        else {
            continue;
        };

        candidates.push(path);
    }

    let workspace = k_os_kain::workspace_root();
    candidates.push(workspace.join("target").join("release").join("zen"));
    candidates.push(workspace.join("target").join("debug").join("zen"));
    candidates.push(workspace.join("target").join("release").join("zen.exe"));
    candidates.push(workspace.join("target").join("debug").join("zen.exe"));

    candidates
}

fn resolve_zen_binary(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    zen_binary_candidates(app)
        .into_iter()
        .find(|path| path.exists())
        .ok_or_else(|| {
            "Unable to locate Zen binary. Build it with `cargo build -p zen` or set ZEN_BIN_PATH."
                .to_string()
        })
}

/// Spawn the native Zen renderer MVP as a separate Rust-owned desktop window.
#[tauri::command]
pub async fn spawn_zen_window(app: tauri::AppHandle) -> Result<(), String> {
    let binary = resolve_zen_binary(&app)?;
    let mut command = Command::new(&binary);
    if let Some(parent) = binary.parent() {
        command.current_dir(parent);
    }
    command.arg("--launched-from-kos");
    #[cfg(windows)]
    {
        command.creation_flags(0x0000_0008);
    }
    command
        .spawn()
        .map_err(|err| format!("Failed to spawn Zen binary '{}': {err}", binary.display()))?;
    Ok(())
}

/// Spawn or show the bundled legacy K_OS window.
#[tauri::command]
pub async fn spawn_legacy_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("legacy") {
        window
            .show()
            .map_err(|e| format!("Failed to show legacy window: {e}"))?;
        window
            .set_focus()
            .map_err(|e| format!("Failed to focus legacy window: {e}"))?;
        return Ok(());
    }

    use tauri::{WebviewUrl, WebviewWindowBuilder};
    let _window =
        WebviewWindowBuilder::new(&app, "legacy", WebviewUrl::App("legacy/index.html".into()))
            .title("K_OS Legacy")
            .inner_size(1540.0, 920.0)
            .min_inner_size(1024.0, 640.0)
            .resizable(true)
            .decorations(true)
            .always_on_top(false)
            .center()
            .visible(true)
            .build()
            .map_err(|e| format!("Failed to create legacy window: {e}"))?;

    Ok(())
}

/// Close the bundled legacy K_OS window if it exists.
#[tauri::command]
pub fn close_legacy_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("legacy") {
        window
            .close()
            .map_err(|e| format!("Failed to close legacy window: {e}"))?;
    }
    Ok(())
}
