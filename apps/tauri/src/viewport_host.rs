use k_os_renderer::{ViewportConfig, ViewportHandle};
use std::net::UdpSocket;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::{Mutex, OnceLock};
use tauri::Manager;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

static NATIVE_VIEWPORT_HOST: OnceLock<Mutex<Option<Child>>> = OnceLock::new();
static NATIVE_VIEWPORT_SESSION_COUNT: OnceLock<Mutex<u32>> = OnceLock::new();
const LEASH_PORT: &str = "127.0.0.1:19876";

fn native_viewport_host_slot() -> &'static Mutex<Option<Child>> {
    NATIVE_VIEWPORT_HOST.get_or_init(|| Mutex::new(None))
}

fn native_viewport_session_count() -> &'static Mutex<u32> {
    NATIVE_VIEWPORT_SESSION_COUNT.get_or_init(|| Mutex::new(0))
}

fn resolve_bevy_binary(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Ok(path) = std::env::var("KOS_BEVY_BIN_PATH") {
        let candidate = PathBuf::from(path);
        if candidate.exists() {
            return Ok(candidate);
        }
    }

    let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let mut candidates = Vec::new();
    if let Some(dir) = current_exe.parent() {
        candidates.push(dir.join(binary_name("k-os-bevy")));
    }

    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("bin").join(binary_name("k-os-bevy")));
        candidates.push(
            resource_dir
                .join("bin")
                .join("k-os-bevy")
                .join(binary_name("k-os-bevy")),
        );
    }

    for candidate in candidates {
        if candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(format!(
        "Unable to locate k-os-bevy binary. Build it with `cargo build -p k-os-bevy` or set KOS_BEVY_BIN_PATH."
    ))
}

fn binary_name(base: &str) -> String {
    #[cfg(windows)]
    {
        format!("{base}.exe")
    }
    #[cfg(not(windows))]
    {
        base.to_string()
    }
}

fn ensure_native_viewport_host(app: &tauri::AppHandle) -> Result<(), String> {
    let slot = native_viewport_host_slot();
    let mut guard = slot.lock().map_err(|e| e.to_string())?;

    if let Some(child) = guard.as_mut() {
        match child.try_wait() {
            Ok(None) => return Ok(()),
            Ok(Some(_)) | Err(_) => {
                *guard = None;
            }
        }
    }

    let binary = resolve_bevy_binary(app)?;
    let mut command = Command::new(&binary);
    if let Some(parent) = binary.parent() {
        command.current_dir(parent);
    }
    #[cfg(windows)]
    {
        command.creation_flags(0x0000_0008);
    }
    let child = command
        .spawn()
        .map_err(|err| format!("Failed to spawn k-os-bevy '{}': {err}", binary.display()))?;

    *guard = Some(child);
    drop(guard);
    std::thread::sleep(std::time::Duration::from_millis(350));
    Ok(())
}

fn send_leash(bytes: &[u8]) -> Result<(), String> {
    let socket = UdpSocket::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    socket.connect(LEASH_PORT).map_err(|e| e.to_string())?;
    socket.send(bytes).map_err(|e| e.to_string())?;
    Ok(())
}

fn shutdown_native_viewport_host() -> Result<(), String> {
    let _ = send_leash(&[255u8]);
    let slot = native_viewport_host_slot();
    let mut guard = slot.lock().map_err(|e| e.to_string())?;
    if let Some(child) = guard.as_mut() {
        let _ = child.try_wait();
        let _ = child.kill();
        let _ = child.wait();
    }
    *guard = None;
    Ok(())
}

pub fn create_native_viewport_session(
    app: &tauri::AppHandle,
    _viewport: ViewportHandle,
    _config: &ViewportConfig,
) -> Result<(), String> {
    ensure_native_viewport_host(app)?;
    let count = native_viewport_session_count();
    let mut guard = count.lock().map_err(|e| e.to_string())?;
    *guard = guard.saturating_add(1);
    Ok(())
}

pub fn close_native_viewport_session(
    _app: &tauri::AppHandle,
    _viewport: ViewportHandle,
) -> Result<(), String> {
    let count = native_viewport_session_count();
    let mut guard = count.lock().map_err(|e| e.to_string())?;
    if *guard > 0 {
        *guard -= 1;
    }
    let should_shutdown = *guard == 0;
    drop(guard);

    if should_shutdown {
        shutdown_native_viewport_host()?;
    }

    Ok(())
}

pub fn send_viewport_payload_path(path: &str) -> Result<(), String> {
    let path_bytes = path.as_bytes();
    let mut bytes = Vec::with_capacity(5 + path_bytes.len());
    bytes.push(24);
    bytes.extend_from_slice(&(path_bytes.len() as u32).to_le_bytes());
    bytes.extend_from_slice(path_bytes);
    send_leash(&bytes)
}

pub fn send_model_load(path: &str) -> Result<(), String> {
    let path_bytes = path.as_bytes();
    let mut bytes = Vec::with_capacity(5 + path_bytes.len());
    bytes.push(7);
    bytes.extend_from_slice(&(path_bytes.len() as u32).to_le_bytes());
    bytes.extend_from_slice(path_bytes);
    send_leash(&bytes)
}

pub fn send_primitive_load(primitive_type: u8) -> Result<(), String> {
    let bytes = [13u8, primitive_type];
    send_leash(&bytes)
}

pub fn send_cursor_ndc(x: f32, y: f32) -> Result<(), String> {
    let mut bytes = Vec::with_capacity(9);
    bytes.push(3);
    bytes.extend_from_slice(&x.to_le_bytes());
    bytes.extend_from_slice(&y.to_le_bytes());
    send_leash(&bytes)
}

pub fn send_camera_rotate(dx: f32, dy: f32) -> Result<(), String> {
    let mut bytes = Vec::with_capacity(9);
    bytes.push(4);
    bytes.extend_from_slice(&dx.to_le_bytes());
    bytes.extend_from_slice(&dy.to_le_bytes());
    send_leash(&bytes)
}

pub fn send_camera_zoom(delta: f32) -> Result<(), String> {
    let mut bytes = Vec::with_capacity(5);
    bytes.push(6);
    bytes.extend_from_slice(&delta.to_le_bytes());
    send_leash(&bytes)
}

pub fn send_brush_stroke(
    tool: u8,
    radius: f32,
    intensity: f32,
    x: f32,
    y: f32,
    dx: f32,
    dy: f32,
) -> Result<(), String> {
    let mut bytes = Vec::with_capacity(26);
    bytes.push(5);
    bytes.push(tool);
    bytes.extend_from_slice(&radius.to_le_bytes());
    bytes.extend_from_slice(&intensity.to_le_bytes());
    bytes.extend_from_slice(&x.to_le_bytes());
    bytes.extend_from_slice(&y.to_le_bytes());
    bytes.extend_from_slice(&dx.to_le_bytes());
    bytes.extend_from_slice(&dy.to_le_bytes());
    send_leash(&bytes)
}

pub fn send_snapshot() -> Result<(), String> {
    send_leash(&[10u8])
}

pub fn send_window_move(x: i32, y: i32, width: u32, height: u32) -> Result<(), String> {
    let mut bytes = Vec::with_capacity(17);
    bytes.push(1);
    bytes.extend_from_slice(&x.to_le_bytes());
    bytes.extend_from_slice(&y.to_le_bytes());
    bytes.extend_from_slice(&width.to_le_bytes());
    bytes.extend_from_slice(&height.to_le_bytes());
    send_leash(&bytes)
}

pub fn send_set_visible(visible: bool) -> Result<(), String> {
    send_leash(&[2u8, if visible { 1 } else { 0 }])
}

pub fn send_set_debug_ui(enabled: bool) -> Result<(), String> {
    send_leash(&[14u8, if enabled { 1 } else { 0 }])
}

pub fn send_set_egui_only(enabled: bool) -> Result<(), String> {
    send_leash(&[15u8, if enabled { 1 } else { 0 }])
}

#[tauri::command]
pub async fn set_bevy_visible(app: tauri::AppHandle, visible: bool) -> Result<(), String> {
    if visible {
        ensure_native_viewport_host(&app)?;
    }
    send_set_visible(visible)
}

#[tauri::command]
pub async fn sync_bevy_window(
    app: tauri::AppHandle,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> Result<(), String> {
    ensure_native_viewport_host(&app)?;
    send_window_move(x, y, width, height)
}

#[tauri::command]
pub async fn leash_debug_ui(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    ensure_native_viewport_host(&app)?;
    send_set_debug_ui(enabled)
}

#[tauri::command]
pub async fn leash_egui_only(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    ensure_native_viewport_host(&app)?;
    send_set_egui_only(enabled)
}

#[tauri::command]
pub async fn leash_load_model(app: tauri::AppHandle, path: String) -> Result<(), String> {
    ensure_native_viewport_host(&app)?;
    send_model_load(&path)
}
