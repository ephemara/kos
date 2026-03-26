use k_os_renderer::{ViewportConfig, ViewportHandle};
use std::net::UdpSocket;

pub fn create_native_viewport_session(
    _app: &tauri::AppHandle,
    _viewport: ViewportHandle,
    _config: &ViewportConfig,
) -> Result<(), String> {
    // Native viewport presentation is currently brokered by the Bevy/WGPU host
    // tether from the frontend side instead of a Tauri webview shell.
    Ok(())
}

pub fn close_native_viewport_session(
    _app: &tauri::AppHandle,
    _viewport: ViewportHandle,
) -> Result<(), String> {
    Ok(())
}

pub fn send_viewport_payload_path(path: &str) -> Result<(), String> {
    let socket = UdpSocket::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    socket
        .connect("127.0.0.1:19876")
        .map_err(|e| e.to_string())?;

    let path_bytes = path.as_bytes();
    let mut bytes = Vec::with_capacity(5 + path_bytes.len());
    bytes.push(24);
    bytes.extend_from_slice(&(path_bytes.len() as u32).to_le_bytes());
    bytes.extend_from_slice(path_bytes);
    socket.send(&bytes).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn send_primitive_load(primitive_type: u8) -> Result<(), String> {
    let socket = UdpSocket::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    socket
        .connect("127.0.0.1:19876")
        .map_err(|e| e.to_string())?;
    let bytes = [13u8, primitive_type];
    socket.send(&bytes).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn send_cursor_ndc(x: f32, y: f32) -> Result<(), String> {
    let socket = UdpSocket::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    socket
        .connect("127.0.0.1:19876")
        .map_err(|e| e.to_string())?;
    let mut bytes = Vec::with_capacity(9);
    bytes.push(3);
    bytes.extend_from_slice(&x.to_le_bytes());
    bytes.extend_from_slice(&y.to_le_bytes());
    socket.send(&bytes).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn send_camera_rotate(dx: f32, dy: f32) -> Result<(), String> {
    let socket = UdpSocket::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    socket
        .connect("127.0.0.1:19876")
        .map_err(|e| e.to_string())?;
    let mut bytes = Vec::with_capacity(9);
    bytes.push(4);
    bytes.extend_from_slice(&dx.to_le_bytes());
    bytes.extend_from_slice(&dy.to_le_bytes());
    socket.send(&bytes).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn send_camera_zoom(delta: f32) -> Result<(), String> {
    let socket = UdpSocket::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    socket
        .connect("127.0.0.1:19876")
        .map_err(|e| e.to_string())?;
    let mut bytes = Vec::with_capacity(5);
    bytes.push(6);
    bytes.extend_from_slice(&delta.to_le_bytes());
    socket.send(&bytes).map_err(|e| e.to_string())?;
    Ok(())
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
    let socket = UdpSocket::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    socket
        .connect("127.0.0.1:19876")
        .map_err(|e| e.to_string())?;
    let mut bytes = Vec::with_capacity(26);
    bytes.push(5);
    bytes.push(tool);
    bytes.extend_from_slice(&radius.to_le_bytes());
    bytes.extend_from_slice(&intensity.to_le_bytes());
    bytes.extend_from_slice(&x.to_le_bytes());
    bytes.extend_from_slice(&y.to_le_bytes());
    bytes.extend_from_slice(&dx.to_le_bytes());
    bytes.extend_from_slice(&dy.to_le_bytes());
    socket.send(&bytes).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn send_snapshot() -> Result<(), String> {
    let socket = UdpSocket::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    socket
        .connect("127.0.0.1:19876")
        .map_err(|e| e.to_string())?;
    socket.send(&[10u8]).map_err(|e| e.to_string())?;
    Ok(())
}
