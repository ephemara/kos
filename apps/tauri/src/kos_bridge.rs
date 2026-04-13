//! K-OS Bridge - Simplified communication with Bevy using kos-proto
//!
//! This replaces the old manual leash.rs with automatic serialization.
//! Adding new messages now requires ZERO changes to this file.

use kos_proto::{KosMessage, KosReceiver, KosSender, KosState, SculptState, BrushLibrary, LogEntry};
use std::sync::Mutex;
use tauri::Emitter;

lazy_static::lazy_static! {
    /// The sender for sending messages to Bevy
    static ref SENDER: Mutex<Option<KosSender>> = Mutex::new(None);
    
    /// Cached state from Bevy (updated by listener thread)
    pub static ref BEVY_STATE: Mutex<KosState> = Mutex::new(KosState::default());
    
    /// Bevy ready flag
    pub static ref BEVY_READY: Mutex<bool> = Mutex::new(false);
    
    /// Tauri app handle for event emission (set during init)
    static ref APP_HANDLE: Mutex<Option<tauri::AppHandle<tauri::Wry>>> = Mutex::new(None);
}

/// Initialize the K-OS bridge
pub fn init_bridge(app_handle: Option<tauri::AppHandle<tauri::Wry>>) -> Result<(), String> {
    log::info!("🔍 K-OS Bridge: Starting init_bridge...");
    
    log::info!("🔍 K-OS Bridge: Creating KosSender (binding to port 42070)...");
    let sender = match KosSender::new() {
        Ok(s) => {
            log::info!("✅ K-OS Bridge: KosSender created successfully");
            s
        }
        Err(e) => {
            log::error!("❌ K-OS Bridge: Failed to create sender: {}", e);
            return Err(format!("Failed to create sender: {}", e));
        }
    };
    
    // Store app handle for event emission
    log::info!("🔍 K-OS Bridge: Storing app handle...");
    if let (Some(handle), Ok(mut guard)) = (app_handle.clone(), APP_HANDLE.lock()) {
        *guard = Some(handle);
        log::info!("✅ K-OS Bridge: App handle stored");
    } else {
        log::warn!("⚠️ K-OS Bridge: Failed to store app handle - events won't work!");
    }
    
    // Clone socket for listener thread
    log::info!("🔍 K-OS Bridge: Cloning socket for listener thread...");
    let listener_socket = sender.try_clone_socket()
        .map_err(|e| format!("Failed to clone socket: {}", e))?;
    log::info!("✅ K-OS Bridge: Socket cloned successfully");
    
    // Store sender
    if let Ok(mut guard) = SENDER.lock() {
        *guard = Some(sender);
        log::info!("✅ K-OS Bridge: Sender stored");
    }
    
    // Start listener thread for Bevy responses
    std::thread::spawn(move || {
        log::info!("🚀 K-OS Bridge: Listener thread started on port 42070");
        log::info!("🔍 K-OS Bridge: Waiting for UDP packets from Bevy...");
        let mut buf = [0u8; 65536];
        let mut packet_count = 0u64;
        loop {
            match listener_socket.recv_from(&mut buf) {
                Ok((len, addr)) => {
                    packet_count += 1;
                    log::info!("📥 K-OS Bridge: Received {} bytes from {} (packet #{})", len, addr, packet_count);
                    match KosMessage::from_bytes(&buf[..len]) {
                        Some(msg) => {
                            log::info!("🔍 K-OS Bridge: Parsed message successfully");
                            handle_bevy_message(msg);
                        }
                        None => {
                            log::warn!("⚠️ K-OS Bridge: Failed to deserialize {} bytes from {}", len, addr);
                        }
                    }
                }
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(std::time::Duration::from_millis(1));
                }
                Err(e) => {
                    log::error!("❌ K-OS Bridge: UDP Receive error: {}", e);
                    std::thread::sleep(std::time::Duration::from_millis(10));
                }
            }
        }
    });
    
    log::info!("✅ K-OS Bridge initialized - listener thread spawned");
    Ok(())
}

/// Handle incoming messages from Bevy
fn handle_bevy_message(msg: KosMessage) {
    // Log message type
    let msg_type = match &msg {
        KosMessage::StateSnapshot(_) => "StateSnapshot",
        KosMessage::SculptStateUpdate(_) => "SculptStateUpdate",
        KosMessage::LayerUpdate(_) => "LayerUpdate",
        KosMessage::BrushLibraryUpdate(_) => "BrushLibraryUpdate",
        KosMessage::LogBatch(_) => "LogBatch",
        KosMessage::GpuError { .. } => "GpuError",
        KosMessage::KruePatch(_) => "KruePatch",
        KosMessage::Pong => "Pong",
        _ => "Other",
    };
    log::info!("🔍 K-OS Bridge: Handling message type: {}", msg_type);
    
    match msg {
        KosMessage::StateSnapshot(state) => {
            if let Ok(mut guard) = BEVY_STATE.lock() {
                *guard = state;
            }
            if let Ok(mut ready) = BEVY_READY.lock() {
                *ready = true;
            }
        }
        KosMessage::SculptStateUpdate(sculpt) => {
            if let Ok(mut guard) = BEVY_STATE.lock() {
                guard.sculpt = sculpt;
            }
        }
        KosMessage::LayerUpdate(layers) => {
            if let Ok(mut guard) = BEVY_STATE.lock() {
                guard.layers = layers;
            }
        }
        KosMessage::BrushLibraryUpdate(library) => {
            if let Ok(mut guard) = BEVY_STATE.lock() {
                guard.brush_library = library;
            }
        }
        KosMessage::LogBatch(logs) => {
            // Emit logs as Tauri event for React
            emit_logs(logs);
        }
        KosMessage::GpuError { error, category, context, timestamp, error_hash } => {
            // Emit GPU error as Tauri event for React toast
            emit_gpu_error(error, category, context, timestamp, error_hash);
        }
        KosMessage::KruePatch(batch) => {
            // 🔥 KRUE: Forward patches to React
            log::info!("🔍 KRUE DEBUG: handle_bevy_message matched KruePatch with {} patches", batch.patches.len());
            emit_krue_patches(batch);
        }
        KosMessage::Pong => {
            log::debug!("Received Pong from Bevy");
        }
        _ => {
            // Other messages are commands, not responses
        }
    }
}

/// Emit KRUE patches to React via Tauri event
fn emit_krue_patches(batch: kos_proto::krue::UiPatchBatch) {
    log::info!("🔍 KRUE DEBUG: emit_krue_patches called with {} patches (seq: {})", 
        batch.patches.len(), batch.seq);
    
    // Log first patch type for debugging
    if let Some(first) = batch.patches.first() {
        log::info!("🔍 KRUE DEBUG: First patch type: {:?}", 
            std::mem::discriminant(first));
    }
    
    if let Ok(guard) = APP_HANDLE.lock() {
        log::info!("🔍 KRUE DEBUG: Got APP_HANDLE lock");
        if let Some(handle) = guard.as_ref() {
            log::info!("🔍 KRUE DEBUG: APP_HANDLE is Some, attempting emit...");
            
            // Try to serialize first to catch any serialization issues
            match serde_json::to_string(&batch) {
                Ok(json) => {
                    log::info!("🔍 KRUE DEBUG: Serialized batch OK ({} bytes)", json.len());
                }
                Err(e) => {
                    log::error!("❌ KRUE: Failed to serialize batch: {:?}", e);
                    return;
                }
            }
            
            // Emit as "krue-patches" event
            match handle.emit("krue-patches", &batch) {
                Ok(_) => log::info!("📤 KRUE: Emitted {} patches to React (seq: {})", batch.patches.len(), batch.seq),
                Err(e) => log::error!("❌ KRUE: Failed to emit patches: {:?}", e),
            }
        } else {
            log::warn!("⚠️ KRUE: Cannot emit patches - APP_HANDLE is None!");
        }
    } else {
        log::error!("❌ KRUE: Cannot emit patches - failed to lock APP_HANDLE");
    }
}

/// Emit logs to React via Tauri event
fn emit_logs(logs: Vec<LogEntry>) {
    if logs.is_empty() {
        return;
    }
    
    if let Ok(guard) = APP_HANDLE.lock() {
        if let Some(handle) = guard.as_ref() {
            // Emit as "kos-logs" event
            let _ = handle.emit("kos-logs", &logs);
        }
    }
}

/// GPU Error payload for React
#[derive(serde::Serialize)]
struct GpuErrorPayload {
    error: String,
    category: String,
    context: String,
    timestamp: f64,
    error_hash: u64,
}

/// Emit GPU error to React via Tauri event
fn emit_gpu_error(
    error: String, 
    category: kos_proto::GpuErrorCategory, 
    context: String, 
    timestamp: f64, 
    error_hash: u64
) {
    log::warn!("🔥 GPU Error intercepted: {} - {:?}", context, category);
    
    if let Ok(guard) = APP_HANDLE.lock() {
        if let Some(handle) = guard.as_ref() {
            let payload = GpuErrorPayload {
                error,
                category: format!("{:?}", category),
                context,
                timestamp,
                error_hash,
            };
            // Emit as "kos-gpu-error" event
            let _ = handle.emit("kos-gpu-error", &payload);
        }
    }
}

/// Send a message to Bevy
pub fn send(msg: KosMessage) -> Result<(), String> {
    if let Ok(guard) = SENDER.lock() {
        if let Some(sender) = guard.as_ref() {
            sender.send(&msg).map_err(|e| format!("Send failed: {}", e))?;
            Ok(())
        } else {
            Err("Bridge not initialized".to_string())
        }
    } else {
        Err("Failed to acquire lock".to_string())
    }
}

// =============================================================================
// CONVENIENCE FUNCTIONS (Used by Tauri commands)
// =============================================================================

/// Get the current state (from cache)
pub fn get_state() -> KosState {
    BEVY_STATE.lock().map(|g| g.clone()).unwrap_or_default()
}

/// Get sculpt state
pub fn get_sculpt_state() -> SculptState {
    get_state().sculpt
}

/// Get brush library
pub fn get_brush_library() -> BrushLibrary {
    get_state().brush_library
}

/// Check if Bevy is ready
pub fn is_bevy_ready() -> bool {
    BEVY_READY.lock().map(|g| *g).unwrap_or(false)
}

/// Set the app handle for event emission (call from setup)
pub fn set_app_handle(handle: tauri::AppHandle<tauri::Wry>) {
    if let Ok(mut guard) = APP_HANDLE.lock() {
        *guard = Some(handle);
        log::info!("✅ K-OS Bridge app handle set for log streaming");
    }
}

