use lazy_static::lazy_static;
use serde_json::Value;
use std::sync::Mutex;
use tauri::Emitter;

const MOCAP_INTEROP_EVENT: &str = "kos:mocap:interop";

lazy_static! {
    static ref APP_HANDLE: Mutex<Option<tauri::AppHandle<tauri::Wry>>> = Mutex::new(None);
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct MocapInteropEnvelope {
    pub topic: String,
    pub payload: Value,
}

pub fn set_app_handle(handle: tauri::AppHandle<tauri::Wry>) {
    if let Ok(mut guard) = APP_HANDLE.lock() {
        *guard = Some(handle);
    }
}

fn validate_topic(topic: &str) -> Result<(), String> {
    if topic.is_empty() {
        return Err("Interop topic cannot be empty".to_string());
    }

    if topic
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_')
    {
        Ok(())
    } else {
        Err(format!("Invalid interop topic: {}", topic))
    }
}

#[tauri::command]
pub fn mocap_bridge_publish(topic: String, payload: Value) -> Result<(), String> {
    validate_topic(&topic)?;

    let envelope = MocapInteropEnvelope { topic, payload };
    let guard = APP_HANDLE
        .lock()
        .map_err(|_| "Failed to acquire app handle lock".to_string())?;
    let handle = guard
        .as_ref()
        .ok_or_else(|| "Interop bridge not initialized".to_string())?;

    handle
        .emit(MOCAP_INTEROP_EVENT, &envelope)
        .map_err(|e| format!("Failed to emit interop event: {}", e))
}
