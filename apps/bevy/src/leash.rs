//! The Leash - IPC Bridge between Tauri and Bevy
//!
//! Simple UDP-based communication for window position syncing.
//! Tauri sends position updates, Bevy receives and follows.

use std::net::UdpSocket;
use std::sync::{Arc, Mutex};
use std::thread;

/// Port for The Leash IPC
pub const LEASH_PORT: u16 = 19876;

/// Message types for The Leash
#[derive(Debug, Clone)] // Removed Copy to support String
pub enum LeashMessage {
    /// Window moved: x, y, width, height
    WindowMove {
        x: i32,
        y: i32,
        width: u32,
        height: u32,
    },
    /// Window visibility changed
    SetVisible(bool),
    /// Mouse cursor moved (x, y)
    CursorMoved {
        x: f32,
        y: f32,
    },
    /// Camera rotation delta (dx, dy)
    CameraRotate {
        dx: f32,
        dy: f32,
    },
    /// Brush stroke (tool, radius, intensity, x, y, dx, dy)
    BrushStroke {
        tool: u8,
        radius: f32,
        intensity: f32,
        x: f32,
        y: f32,
        dx: f32,
        dy: f32,
    },
    /// Camera zoom delta (positive = zoom in, negative = zoom out)
    CameraZoom {
        delta: f32,
    },
    /// Load a model from a file path
    LoadModel {
        path: String,
    },
    /// Load an evaluated viewport payload from a file path
    LoadViewportPayload {
        path: String,
    },
    /// Undo last action
    Undo,
    /// Redo last action
    Redo,
    /// Save state for undo
    Snapshot,
    /// Set symmetry mode (0=None, 1=X, 2=Y, 3=Z)
    SetSymmetry {
        axis: u8,
    },
    /// Toggle wireframe
    SetWireframe {
        enabled: bool,
    },
    /// Load primitive (0=Sphere, 1=Cube, 2=Cylinder, 3=Torus, 4=Plane, 5=Icosa)
    LoadPrimitive {
        primitive_type: u8,
    },
    SetDebugUi {
        enabled: bool,
    },
    /// Set egui-only mode (Bevy window goes AlwaysOnTop to receive click-through input)
    SetEguiOnly {
        enabled: bool,
    },
    /// Sync kernel storage from React (path to JSON file with assets)
    SyncKernelStorage {
        json_path: String,
    },
    /// Toggle asset browser visibility
    ToggleAssetBrowser,
    /// Spawn an asset in Bevy: type ("mesh", "primitive"), id (path or primitive name), position
    SpawnAsset {
        asset_type: String,
        id: String,
        position: [f32; 3],
    },
    /// Shutdown Bevy
    Shutdown,

    // =========================================================================
    // LAYER OPERATIONS (React → Bevy)
    // =========================================================================
    /// Select an entity in the scene
    SelectEntity {
        entity: u32,
        add_to_selection: bool,
    },
    /// Toggle visibility of an entity
    ToggleEntityVisibility {
        entity: u32,
    },
    /// Toggle lock state of an entity
    ToggleEntityLock {
        entity: u32,
    },
    /// Delete an entity
    DeleteEntity {
        entity: u32,
    },
    /// Rename an entity
    RenameEntity {
        entity: u32,
        name: String,
    },
}

/// Enhanced message with sequence number and timestamp for debugging
#[derive(Debug, Clone)]
pub struct LeashMessageEnvelope {
    pub message: LeashMessage,
    pub sequence: u64,
    pub timestamp_ms: u64,
}

impl LeashMessage {
    /// Serialize to bytes (simple binary format)
    pub fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(32);
        match self {
            LeashMessage::WindowMove {
                x,
                y,
                width,
                height,
            } => {
                bytes.push(1); // Message type
                bytes.extend_from_slice(&x.to_le_bytes());
                bytes.extend_from_slice(&y.to_le_bytes());
                bytes.extend_from_slice(&width.to_le_bytes());
                bytes.extend_from_slice(&height.to_le_bytes());
            }
            LeashMessage::SetVisible(visible) => {
                bytes.push(2);
                bytes.push(if *visible { 1 } else { 0 });
            }
            LeashMessage::CursorMoved { x, y } => {
                bytes.push(3);
                bytes.extend_from_slice(&x.to_le_bytes());
                bytes.extend_from_slice(&y.to_le_bytes());
            }
            LeashMessage::CameraRotate { dx, dy } => {
                bytes.push(4);
                bytes.extend_from_slice(&dx.to_le_bytes());
                bytes.extend_from_slice(&dy.to_le_bytes());
            }
            LeashMessage::BrushStroke {
                tool,
                radius,
                intensity,
                x,
                y,
                dx,
                dy,
            } => {
                bytes.push(5);
                bytes.push(*tool);
                bytes.extend_from_slice(&radius.to_le_bytes());
                bytes.extend_from_slice(&intensity.to_le_bytes());
                bytes.extend_from_slice(&x.to_le_bytes());
                bytes.extend_from_slice(&y.to_le_bytes());
                bytes.extend_from_slice(&dx.to_le_bytes());
                bytes.extend_from_slice(&dy.to_le_bytes());
            }
            LeashMessage::CameraZoom { delta } => {
                bytes.push(6);
                bytes.extend_from_slice(&delta.to_le_bytes());
            }
            LeashMessage::LoadModel { path } => {
                bytes.push(7);
                let path_bytes = path.as_bytes();
                bytes.extend_from_slice(&(path_bytes.len() as u32).to_le_bytes());
                bytes.extend_from_slice(path_bytes);
            }
            LeashMessage::LoadViewportPayload { path } => {
                bytes.push(24);
                let path_bytes = path.as_bytes();
                bytes.extend_from_slice(&(path_bytes.len() as u32).to_le_bytes());
                bytes.extend_from_slice(path_bytes);
            }
            LeashMessage::Undo => bytes.push(8),
            LeashMessage::Redo => bytes.push(9),
            LeashMessage::Snapshot => bytes.push(10),
            LeashMessage::SetSymmetry { axis } => {
                bytes.push(11);
                bytes.push(*axis);
            }
            LeashMessage::SetWireframe { enabled } => {
                bytes.push(12);
                bytes.push(if *enabled { 1 } else { 0 });
            }
            LeashMessage::LoadPrimitive { primitive_type } => {
                bytes.push(13);
                bytes.push(*primitive_type);
            }
            LeashMessage::SetDebugUi { enabled } => {
                bytes.push(14);
                bytes.push(if *enabled { 1 } else { 0 });
            }
            LeashMessage::SetEguiOnly { enabled } => {
                bytes.push(15);
                bytes.push(if *enabled { 1 } else { 0 });
            }
            LeashMessage::SyncKernelStorage { json_path } => {
                bytes.push(16);
                let path_bytes = json_path.as_bytes();
                bytes.extend_from_slice(&(path_bytes.len() as u32).to_le_bytes());
                bytes.extend_from_slice(path_bytes);
            }
            LeashMessage::ToggleAssetBrowser => {
                bytes.push(17);
            }
            LeashMessage::SpawnAsset {
                asset_type,
                id,
                position,
            } => {
                bytes.push(18);
                let type_bytes = asset_type.as_bytes();
                bytes.extend_from_slice(&(type_bytes.len() as u32).to_le_bytes());
                bytes.extend_from_slice(type_bytes);
                let id_bytes = id.as_bytes();
                bytes.extend_from_slice(&(id_bytes.len() as u32).to_le_bytes());
                bytes.extend_from_slice(id_bytes);
                bytes.extend_from_slice(&position[0].to_le_bytes());
                bytes.extend_from_slice(&position[1].to_le_bytes());
                bytes.extend_from_slice(&position[2].to_le_bytes());
            }
            LeashMessage::Shutdown => {
                bytes.push(255);
            }

            // Layer operations (codes 19-23) - not typically serialized by Bevy
            // but need to match for exhaustiveness
            LeashMessage::SelectEntity {
                entity,
                add_to_selection,
            } => {
                bytes.push(19);
                bytes.extend_from_slice(&entity.to_le_bytes());
                bytes.push(if *add_to_selection { 1 } else { 0 });
            }
            LeashMessage::ToggleEntityVisibility { entity } => {
                bytes.push(20);
                bytes.extend_from_slice(&entity.to_le_bytes());
            }
            LeashMessage::ToggleEntityLock { entity } => {
                bytes.push(21);
                bytes.extend_from_slice(&entity.to_le_bytes());
            }
            LeashMessage::DeleteEntity { entity } => {
                bytes.push(22);
                bytes.extend_from_slice(&entity.to_le_bytes());
            }
            LeashMessage::RenameEntity { entity, name } => {
                bytes.push(23);
                bytes.extend_from_slice(&entity.to_le_bytes());
                let name_bytes = name.as_bytes();
                bytes.extend_from_slice(&(name_bytes.len() as u32).to_le_bytes());
                bytes.extend_from_slice(name_bytes);
            }
        }
        bytes
    }

    /// Deserialize from bytes
    pub fn from_bytes(bytes: &[u8]) -> Option<Self> {
        if bytes.is_empty() {
            return None;
        }

        match bytes[0] {
            1 if bytes.len() >= 17 => {
                let x = i32::from_le_bytes(bytes[1..5].try_into().ok()?);
                let y = i32::from_le_bytes(bytes[5..9].try_into().ok()?);
                let width = u32::from_le_bytes(bytes[9..13].try_into().ok()?);
                let height = u32::from_le_bytes(bytes[13..17].try_into().ok()?);
                Some(LeashMessage::WindowMove {
                    x,
                    y,
                    width,
                    height,
                })
            }
            2 if bytes.len() >= 2 => Some(LeashMessage::SetVisible(bytes[1] != 0)),
            3 if bytes.len() >= 9 => {
                let x = f32::from_le_bytes(bytes[1..5].try_into().ok()?);
                let y = f32::from_le_bytes(bytes[5..9].try_into().ok()?);
                Some(LeashMessage::CursorMoved { x, y })
            }
            4 if bytes.len() >= 9 => {
                let dx = f32::from_le_bytes(bytes[1..5].try_into().ok()?);
                let dy = f32::from_le_bytes(bytes[5..9].try_into().ok()?);
                Some(LeashMessage::CameraRotate { dx, dy })
            }
            5 if bytes.len() >= 30 => {
                let tool = bytes[1];
                let radius = f32::from_le_bytes(bytes[2..6].try_into().ok()?);
                let intensity = f32::from_le_bytes(bytes[6..10].try_into().ok()?);
                let x = f32::from_le_bytes(bytes[10..14].try_into().ok()?);
                let y = f32::from_le_bytes(bytes[14..18].try_into().ok()?);
                let dx = f32::from_le_bytes(bytes[18..22].try_into().ok()?);
                let dy = f32::from_le_bytes(bytes[22..26].try_into().ok()?);
                Some(LeashMessage::BrushStroke {
                    tool,
                    radius,
                    intensity,
                    x,
                    y,
                    dx,
                    dy,
                })
            }
            6 if bytes.len() >= 5 => {
                let delta = f32::from_le_bytes(bytes[1..5].try_into().ok()?);
                Some(LeashMessage::CameraZoom { delta })
            }
            7 if bytes.len() >= 5 => {
                let len = u32::from_le_bytes(bytes[1..5].try_into().ok()?) as usize;
                if bytes.len() >= 5 + len {
                    let path = String::from_utf8(bytes[5..5 + len].to_vec()).ok()?;
                    Some(LeashMessage::LoadModel { path })
                } else {
                    None
                }
            }
            24 if bytes.len() >= 5 => {
                let len = u32::from_le_bytes(bytes[1..5].try_into().ok()?) as usize;
                if bytes.len() >= 5 + len {
                    let path = String::from_utf8(bytes[5..5 + len].to_vec()).ok()?;
                    Some(LeashMessage::LoadViewportPayload { path })
                } else {
                    None
                }
            }
            8 => Some(LeashMessage::Undo),
            9 => Some(LeashMessage::Redo),
            10 => Some(LeashMessage::Snapshot),
            11 if bytes.len() >= 2 => Some(LeashMessage::SetSymmetry { axis: bytes[1] }),
            12 if bytes.len() >= 2 => Some(LeashMessage::SetWireframe {
                enabled: bytes[1] != 0,
            }),
            13 if bytes.len() >= 2 => Some(LeashMessage::LoadPrimitive {
                primitive_type: bytes[1],
            }),
            14 if bytes.len() >= 2 => Some(LeashMessage::SetDebugUi {
                enabled: bytes[1] != 0,
            }),
            15 if bytes.len() >= 2 => Some(LeashMessage::SetEguiOnly {
                enabled: bytes[1] != 0,
            }),
            16 if bytes.len() >= 5 => {
                let len = u32::from_le_bytes(bytes[1..5].try_into().ok()?) as usize;
                if bytes.len() >= 5 + len {
                    let json_path = String::from_utf8(bytes[5..5 + len].to_vec()).ok()?;
                    Some(LeashMessage::SyncKernelStorage { json_path })
                } else {
                    None
                }
            }
            17 => Some(LeashMessage::ToggleAssetBrowser),
            18 if bytes.len() >= 21 => {
                let mut pos = 1;
                let type_len = u32::from_le_bytes(bytes[pos..pos + 4].try_into().ok()?) as usize;
                pos += 4;
                if bytes.len() < pos + type_len {
                    return None;
                }
                let asset_type = String::from_utf8(bytes[pos..pos + type_len].to_vec()).ok()?;
                pos += type_len;
                if bytes.len() < pos + 4 {
                    return None;
                }
                let id_len = u32::from_le_bytes(bytes[pos..pos + 4].try_into().ok()?) as usize;
                pos += 4;
                if bytes.len() < pos + id_len {
                    return None;
                }
                let id = String::from_utf8(bytes[pos..pos + id_len].to_vec()).ok()?;
                pos += id_len;
                if bytes.len() < pos + 12 {
                    return None;
                }
                let x = f32::from_le_bytes(bytes[pos..pos + 4].try_into().ok()?);
                let y = f32::from_le_bytes(bytes[pos + 4..pos + 8].try_into().ok()?);
                let z = f32::from_le_bytes(bytes[pos + 8..pos + 12].try_into().ok()?);
                Some(LeashMessage::SpawnAsset {
                    asset_type,
                    id,
                    position: [x, y, z],
                })
            }
            255 => Some(LeashMessage::Shutdown),

            // Layer operations (codes 19-23)
            19 if bytes.len() >= 6 => {
                let entity = u32::from_le_bytes(bytes[1..5].try_into().ok()?);
                let add_to_selection = bytes[5] != 0;
                Some(LeashMessage::SelectEntity {
                    entity,
                    add_to_selection,
                })
            }
            20 if bytes.len() >= 5 => {
                let entity = u32::from_le_bytes(bytes[1..5].try_into().ok()?);
                Some(LeashMessage::ToggleEntityVisibility { entity })
            }
            21 if bytes.len() >= 5 => {
                let entity = u32::from_le_bytes(bytes[1..5].try_into().ok()?);
                Some(LeashMessage::ToggleEntityLock { entity })
            }
            22 if bytes.len() >= 5 => {
                let entity = u32::from_le_bytes(bytes[1..5].try_into().ok()?);
                Some(LeashMessage::DeleteEntity { entity })
            }
            23 if bytes.len() >= 9 => {
                let entity = u32::from_le_bytes(bytes[1..5].try_into().ok()?);
                let len = u32::from_le_bytes(bytes[5..9].try_into().ok()?) as usize;
                if bytes.len() >= 9 + len {
                    let name = String::from_utf8(bytes[9..9 + len].to_vec()).ok()?;
                    Some(LeashMessage::RenameEntity { entity, name })
                } else {
                    None
                }
            }

            _ => None,
        }
    }
}

// =============================================================================
// TAURI SIDE (Master)
// =============================================================================

/// Sender for Tauri to send window updates to Bevy
pub struct LeashMaster {
    socket: UdpSocket,
    sequence_counter: std::sync::atomic::AtomicU64,
}

#[allow(dead_code)]
impl LeashMaster {
    /// Create a new LeashMaster that sends to Bevy
    pub fn new() -> std::io::Result<Self> {
        let socket = UdpSocket::bind("127.0.0.1:0")?; // Bind to any port
        socket.connect(format!("127.0.0.1:{}", LEASH_PORT))?;
        socket.set_nonblocking(true)?;
        Ok(Self {
            socket,
            sequence_counter: std::sync::atomic::AtomicU64::new(0),
        })
    }

    /// Send window position update
    pub fn send_window_move(&self, x: i32, y: i32, width: u32, height: u32) {
        let msg = LeashMessage::WindowMove {
            x,
            y,
            width,
            height,
        };
        let _ = self.socket.send(&msg.to_bytes());
    }

    /// Send visibility change
    pub fn send_visibility(&self, visible: bool) {
        let msg = LeashMessage::SetVisible(visible);
        let _ = self.socket.send(&msg.to_bytes());
    }

    /// Send shutdown signal
    #[allow(dead_code)]
    pub fn send_shutdown(&self) {
        let msg = LeashMessage::Shutdown;
        let _ = self.socket.send(&msg.to_bytes());
    }

    /// Send cursor position (NDC or Screen)
    pub fn send_cursor(&self, x: f32, y: f32) {
        let msg = LeashMessage::CursorMoved { x, y };
        let _ = self.socket.send(&msg.to_bytes());
    }

    /// Send camera rotation delta
    pub fn send_camera_rotate(&self, dx: f32, dy: f32) {
        let msg = LeashMessage::CameraRotate { dx, dy };
        let _ = self.socket.send(&msg.to_bytes());
    }

    /// Send camera zoom delta
    pub fn send_zoom(&self, delta: f32) {
        let msg = LeashMessage::CameraZoom { delta };
        let _ = self.socket.send(&msg.to_bytes());
    }

    /// Send brush stroke
    pub fn send_brush(
        &self,
        tool: u8,
        radius: f32,
        intensity: f32,
        x: f32,
        y: f32,
        dx: f32,
        dy: f32,
    ) {
        let msg = LeashMessage::BrushStroke {
            tool,
            radius,
            intensity,
            x,
            y,
            dx,
            dy,
        };
        let _ = self.socket.send(&msg.to_bytes());
    }

    /// Send undo
    pub fn send_undo(&self) {
        let _ = self.socket.send(&LeashMessage::Undo.to_bytes());
    }

    /// Send redo
    pub fn send_redo(&self) {
        let _ = self.socket.send(&LeashMessage::Redo.to_bytes());
    }

    /// Send load model command
    pub fn send_load_model(&self, path: &str) {
        let msg = LeashMessage::LoadModel {
            path: path.to_string(),
        };
        let _ = self.socket.send(&msg.to_bytes());
    }

    /// Send evaluated viewport payload path
    pub fn send_viewport_payload(&self, path: &str) {
        let msg = LeashMessage::LoadViewportPayload {
            path: path.to_string(),
        };
        let _ = self.socket.send(&msg.to_bytes());
    }

    /// Send snapshot
    pub fn send_snapshot(&self) {
        let _ = self.socket.send(&LeashMessage::Snapshot.to_bytes());
    }

    /// Send symmetry mode
    pub fn send_symmetry(&self, axis: u8) {
        let msg = LeashMessage::SetSymmetry { axis };
        let _ = self.socket.send(&msg.to_bytes());
    }

    /// Send wireframe toggle
    pub fn send_wireframe(&self, enabled: bool) {
        let msg = LeashMessage::SetWireframe { enabled };
        let _ = self.socket.send(&msg.to_bytes());
    }

    /// Send load primitive command
    pub fn send_load_primitive(&self, primitive_type: u8) {
        let msg = LeashMessage::LoadPrimitive { primitive_type };
        let _ = self.socket.send(&msg.to_bytes());
    }

    pub fn send_debug_ui(&self, enabled: bool) {
        let msg = LeashMessage::SetDebugUi { enabled };
        let _ = self.socket.send(&msg.to_bytes());
    }

    pub fn send_egui_only(&self, enabled: bool) {
        let msg = LeashMessage::SetEguiOnly { enabled };
        let _ = self.socket.send(&msg.to_bytes());
    }

    /// Send kernel storage sync (path to JSON file)
    pub fn send_sync_kernel_storage(&self, json_path: &str) {
        let msg = LeashMessage::SyncKernelStorage {
            json_path: json_path.to_string(),
        };
        let _ = self.socket.send(&msg.to_bytes());
    }

    /// Toggle asset browser visibility
    pub fn send_toggle_asset_browser(&self) {
        let _ = self
            .socket
            .send(&LeashMessage::ToggleAssetBrowser.to_bytes());
    }
}

// =============================================================================
// BEVY SIDE (Dog) - Uses Arc<Mutex> for thread safety
// =============================================================================

/// Thread-safe message buffer for Bevy
pub struct LeashDog {
    messages: Arc<Mutex<Vec<LeashMessage>>>,
}

impl LeashDog {
    /// Create a new LeashDog that listens for Tauri commands
    pub fn new() -> std::io::Result<Self> {
        let socket = UdpSocket::bind(format!("127.0.0.1:{}", LEASH_PORT))?;
        socket.set_nonblocking(true)?;

        let messages = Arc::new(Mutex::new(Vec::new()));
        let messages_clone = Arc::clone(&messages);

        thread::spawn(move || {
            let mut buf = [0u8; 1024]; // Increased for longer paths
            loop {
                match socket.recv(&mut buf) {
                    Ok(len) => {
                        if let Some(msg) = LeashMessage::from_bytes(&buf[..len]) {
                            let is_shutdown = matches!(msg, LeashMessage::Shutdown);
                            if let Ok(mut msgs) = messages_clone.lock() {
                                msgs.push(msg);
                            }
                            if is_shutdown {
                                break;
                            }
                        }
                    }
                    Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        // No data available, sleep briefly
                        std::thread::sleep(std::time::Duration::from_millis(1));
                    }
                    Err(_) => {
                        std::thread::sleep(std::time::Duration::from_millis(10));
                    }
                }
            }
        });

        Ok(Self { messages })
    }

    /// Drain all pending messages (non-blocking)
    pub fn drain_messages(&self) -> Vec<LeashMessage> {
        if let Ok(mut msgs) = self.messages.lock() {
            std::mem::take(&mut *msgs)
        } else {
            Vec::new()
        }
    }
}

// Note: LeashDog is automatically Send + Sync because:
// - Arc<Mutex<Vec<LeashMessage>>> is Send + Sync
// - LeashMessage derives Clone (String-containing variants are fine)
// No unsafe impl needed!

// =============================================================================
// REVERSE CHANNEL (Bevy -> Tauri)
// =============================================================================

/// Port for reverse channel (Bevy -> Tauri)
pub const LEASH_REVERSE_PORT: u16 = 19877;

/// Response message types (Bevy -> Tauri)
#[derive(Debug, Clone)]
pub enum LeashResponse {
    /// Raycast hit result from Bevy sculpting
    RaycastHit {
        hit: bool,
        point: [f32; 3],
        normal: [f32; 3],
        distance: f32,
    },
    /// Brush stroke applied - returns affected vertex count
    BrushApplied { affected_count: u32, time_ms: f32 },
    /// Status update from Bevy
    Status {
        vertex_count: u32,
        face_count: u32,
        fps: f32,
    },
    /// Error from Bevy
    Error { code: u32, message: String },
    /// Request to toggle asset browser
    ToggleAssetBrowser,
    /// Bevy window moved/resized - Tauri overlay should follow
    WindowMoved {
        x: i32,
        y: i32,
        width: u32,
        height: u32,
    },
}

impl LeashResponse {
    /// Serialize to bytes
    pub fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(32);
        match self {
            LeashResponse::RaycastHit {
                hit,
                point,
                normal,
                distance,
            } => {
                bytes.push(1);
                bytes.push(if *hit { 1 } else { 0 });
                bytes.extend_from_slice(&point[0].to_le_bytes());
                bytes.extend_from_slice(&point[1].to_le_bytes());
                bytes.extend_from_slice(&point[2].to_le_bytes());
                bytes.extend_from_slice(&normal[0].to_le_bytes());
                bytes.extend_from_slice(&normal[1].to_le_bytes());
                bytes.extend_from_slice(&normal[2].to_le_bytes());
                bytes.extend_from_slice(&distance.to_le_bytes());
            }
            LeashResponse::BrushApplied {
                affected_count,
                time_ms,
            } => {
                bytes.push(2);
                bytes.extend_from_slice(&affected_count.to_le_bytes());
                bytes.extend_from_slice(&time_ms.to_le_bytes());
            }
            LeashResponse::Status {
                vertex_count,
                face_count,
                fps,
            } => {
                bytes.push(3);
                bytes.extend_from_slice(&vertex_count.to_le_bytes());
                bytes.extend_from_slice(&face_count.to_le_bytes());
                bytes.extend_from_slice(&fps.to_le_bytes());
            }
            LeashResponse::Error { code, message } => {
                bytes.push(255);
                bytes.extend_from_slice(&code.to_le_bytes());
                let msg_bytes = message.as_bytes();
                bytes.extend_from_slice(&(msg_bytes.len() as u32).to_le_bytes());
                bytes.extend_from_slice(msg_bytes);
            }
            LeashResponse::ToggleAssetBrowser => {
                bytes.push(4);
            }
            LeashResponse::WindowMoved {
                x,
                y,
                width,
                height,
            } => {
                bytes.push(5);
                bytes.extend_from_slice(&x.to_le_bytes());
                bytes.extend_from_slice(&y.to_le_bytes());
                bytes.extend_from_slice(&width.to_le_bytes());
                bytes.extend_from_slice(&height.to_le_bytes());
            }
        }
        bytes
    }
}

/// Sender for reverse channel responses (runs in Bevy)
pub struct LeashResponseSender {
    socket: UdpSocket,
}

impl LeashResponseSender {
    /// Create a new sender to Tauri
    pub fn new() -> std::io::Result<Self> {
        let socket = UdpSocket::bind("127.0.0.1:0")?; // Bind to any port
        socket.connect(format!("127.0.0.1:{}", LEASH_REVERSE_PORT))?;
        socket.set_nonblocking(true)?;
        Ok(Self { socket })
    }

    /// Send a response to Tauri
    pub fn send(&self, msg: LeashResponse) {
        let _ = self.socket.send(&msg.to_bytes());
    }

    /// Send window moved/resized notification to Tauri overlay
    pub fn send_window_moved(&self, x: i32, y: i32, width: u32, height: u32) {
        self.send(LeashResponse::WindowMoved {
            x,
            y,
            width,
            height,
        });
    }
}
