//! K_OS Python Bridge
//! ==================
//! Spawns and communicates with the Python sidecar for AI/ML operations.
//! Uses JSON-RPC over stdin/stdout for IPC.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use tauri::Manager;
use tauri::State;

/// Global request ID counter
static REQUEST_ID: AtomicU64 = AtomicU64::new(1);

/// Python process state
pub struct PythonBridge {
    process: Mutex<Option<Child>>,
}

impl PythonBridge {
    pub fn new() -> Self {
        Self {
            process: Mutex::new(None),
        }
    }
}

impl Default for PythonBridge {
    fn default() -> Self {
        Self::new()
    }
}

/// JSON-RPC request
#[derive(Serialize)]
struct JsonRpcRequest {
    jsonrpc: &'static str,
    method: String,
    params: Value,
    id: u64,
}

/// JSON-RPC response
#[derive(Deserialize)]
struct JsonRpcResponse {
    #[allow(dead_code)]
    jsonrpc: String,
    result: Option<Value>,
    error: Option<JsonRpcError>,
    #[allow(dead_code)]
    id: u64,
}

#[derive(Deserialize)]
struct JsonRpcError {
    code: i32,
    message: String,
    data: Option<String>,
}

enum PythonLaunchTarget {
    Sidecar(PathBuf),
    Script {
        interpreter: String,
        script: PathBuf,
    },
}

fn bundled_python_sidecar_candidates(app: &tauri::AppHandle) -> Vec<PathBuf> {
    [
        "resources/bin/kos_python/kos_python",
        "resources/bin/kos_python/kos_python.exe",
        "resources/bin/kos_python",
        "resources/bin/kos_python.exe",
    ]
    .into_iter()
    .filter_map(|relative_path| {
        app.path()
            .resolve(relative_path, tauri::path::BaseDirectory::Resource)
            .ok()
    })
    .collect()
}

fn resolve_python_launch_target(app: &tauri::AppHandle) -> Result<PythonLaunchTarget, String> {
    if let Ok(sidecar_path) = std::env::var("KOS_PYTHON_SIDECAR") {
        let trimmed = sidecar_path.trim();
        if !trimmed.is_empty() {
            let candidate = PathBuf::from(trimmed);
            if candidate.exists() {
                return Ok(PythonLaunchTarget::Sidecar(candidate));
            }
        }
    }

    for bundled_sidecar in bundled_python_sidecar_candidates(app) {
        if bundled_sidecar.exists() {
            return Ok(PythonLaunchTarget::Sidecar(bundled_sidecar));
        }
    }

    if let Ok(script_path) = std::env::var("KOS_PYTHON_MAIN") {
        let trimmed = script_path.trim();
        if !trimmed.is_empty() {
            let candidate = PathBuf::from(trimmed);
            if candidate.exists() {
                return Ok(PythonLaunchTarget::Script {
                    interpreter: "python".to_string(),
                    script: candidate,
                });
            }
        }
    }

    if let Ok(bundled_script) = app.path().resolve(
        "resources/runtime/python-source/main.py",
        tauri::path::BaseDirectory::Resource,
    ) {
        if bundled_script.exists() {
            return Ok(PythonLaunchTarget::Script {
                interpreter: "python".to_string(),
                script: bundled_script,
            });
        }
    }

    let dev_script = std::env::current_dir()
        .map_err(|e| e.to_string())?
        .parent()
        .ok_or("No parent dir")?
        .join("src-python")
        .join("main.py");

    if dev_script.exists() {
        return Ok(PythonLaunchTarget::Script {
            interpreter: "python".to_string(),
            script: dev_script,
        });
    }

    Err("Unable to locate Python sidecar or source entry point".to_string())
}

/// Start the Python sidecar process
#[tauri::command]
pub async fn python_start(
    app: tauri::AppHandle,
    bridge: State<'_, PythonBridge>,
) -> Result<String, String> {
    let mut proc_guard = bridge.process.lock().map_err(|e| e.to_string())?;

    if proc_guard.is_some() {
        return Ok("Python already running".to_string());
    }

    let launch_target = resolve_python_launch_target(&app)?;
    let mut command = match &launch_target {
        PythonLaunchTarget::Sidecar(path) => {
            log::info!("[python] launching bundled sidecar: {}", path.display());
            let mut command = Command::new(path);
            if let Some(parent) = path.parent() {
                command.current_dir(parent);
            }
            command
        }
        PythonLaunchTarget::Script {
            interpreter,
            script,
        } => {
            log::info!(
                "[python] launching script via {}: {}",
                interpreter,
                script.display()
            );
            let mut command = Command::new(interpreter);
            command.arg(script);
            if let Some(parent) = script.parent() {
                command.current_dir(parent);
            }
            command
        }
    };

    let child = command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn Python bridge: {}", e))?;

    *proc_guard = Some(child);

    // Wait for ready signal
    // (In practice, you'd read the first line from stdout)
    std::thread::sleep(std::time::Duration::from_millis(500));

    Ok("Python started".to_string())
}

/// Stop the Python sidecar
#[tauri::command]
pub async fn python_stop(bridge: State<'_, PythonBridge>) -> Result<String, String> {
    let mut proc_guard = bridge.process.lock().map_err(|e| e.to_string())?;

    if let Some(mut child) = proc_guard.take() {
        child.kill().map_err(|e| e.to_string())?;
        Ok("Python stopped".to_string())
    } else {
        Ok("Python not running".to_string())
    }
}

/// Call a Python function via JSON-RPC
/// Includes 30-second timeout to prevent app freeze if Python hangs
#[tauri::command]
pub async fn python_call(
    bridge: State<'_, PythonBridge>,
    method: String,
    params: Value,
) -> Result<Value, String> {
    use std::process::ChildStdout;
    use std::sync::mpsc;
    use std::time::Duration;

    // Type alias for the channel payload
    type ReadResult = (Result<String, std::io::Error>, ChildStdout);

    let mut proc_guard = bridge.process.lock().map_err(|e| e.to_string())?;

    let child = proc_guard
        .as_mut()
        .ok_or("Python not running. Call python_start first.")?;

    // Build request
    let request_id = REQUEST_ID.fetch_add(1, Ordering::SeqCst);
    let request = JsonRpcRequest {
        jsonrpc: "2.0",
        method: method.clone(),
        params,
        id: request_id,
    };

    // Send request
    let stdin = child.stdin.as_mut().ok_or("No stdin")?;
    let request_json = serde_json::to_string(&request).map_err(|e| e.to_string())?;
    writeln!(stdin, "{}", request_json).map_err(|e| e.to_string())?;
    stdin.flush().map_err(|e| e.to_string())?;

    // Read response with timeout
    // We use a channel + thread to implement timeout on blocking read
    let stdout = child.stdout.take().ok_or("No stdout (already taken?)")?;

    let (tx, rx) = mpsc::channel::<ReadResult>();
    std::thread::spawn(move || {
        let mut reader = BufReader::new(stdout);
        let mut response_line = String::new();
        let result = reader.read_line(&mut response_line);
        let stdout_back = reader.into_inner();
        // Send result through channel (ignore send errors if receiver dropped)
        let _ = tx.send((result.map(|_| response_line), stdout_back));
    });

    // Wait for response with 30-second timeout
    const TIMEOUT_SECS: u64 = 30;
    match rx.recv_timeout(Duration::from_secs(TIMEOUT_SECS)) {
        Ok((read_result, stdout_back)) => {
            // Restore stdout to child process for future calls
            let child = proc_guard.as_mut().ok_or("Process disappeared")?;
            child.stdout = Some(stdout_back);

            let response_line = read_result.map_err(|e| format!("Read error: {}", e))?;

            // Parse response
            let response: JsonRpcResponse = serde_json::from_str(&response_line)
                .map_err(|e| format!("Parse error: {} - Response: {}", e, response_line))?;

            // Validate response ID matches request
            if response.id != request_id {
                log::warn!(
                    "Python response ID mismatch: expected {}, got {}",
                    request_id,
                    response.id
                );
            }

            if let Some(error) = response.error {
                return Err(format!(
                    "Python error ({}): {}\n{}",
                    error.code,
                    error.message,
                    error.data.unwrap_or_default()
                ));
            }

            Ok(response.result.unwrap_or(Value::Null))
        }
        Err(mpsc::RecvTimeoutError::Timeout) => {
            // Thread is still running but we timed out
            // The thread will eventually finish but stdout is orphaned
            // This is acceptable - Python needs to be restarted anyway
            Err(format!(
                "Python call '{}' timed out after {} seconds. Python may be hanging - consider restarting.",
                method, TIMEOUT_SECS
            ))
        }
        Err(mpsc::RecvTimeoutError::Disconnected) => {
            Err("Python reader thread crashed unexpectedly".to_string())
        }
    }
}

/// Quick helper to check if Python is ready
#[tauri::command]
pub async fn python_ping(bridge: State<'_, PythonBridge>) -> Result<String, String> {
    let result = python_call(bridge, "ping".to_string(), json!({})).await?;
    Ok(result.as_str().unwrap_or("unknown").to_string())
}

/// List available Python functions
#[tauri::command]
pub async fn python_list_functions(bridge: State<'_, PythonBridge>) -> Result<Vec<String>, String> {
    let result = python_call(bridge, "list_functions".to_string(), json!({})).await?;
    let functions: Vec<String> = serde_json::from_value(result).map_err(|e| e.to_string())?;
    Ok(functions)
}

/// Execute arbitrary Python code (for scripting/REPL)
#[tauri::command]
pub async fn python_exec(bridge: State<'_, PythonBridge>, code: String) -> Result<Value, String> {
    python_call(bridge, "exec_code".to_string(), json!({ "code": code })).await
}

/// Run a user script from the scripts folder
#[tauri::command]
pub async fn python_run_script(
    bridge: State<'_, PythonBridge>,
    script_name: String,
    function: Option<String>,
    kwargs: Option<Value>,
) -> Result<Value, String> {
    let params = json!({
        "script_name": script_name,
        "function": function.unwrap_or_else(|| "main".to_string()),
        "kwargs": kwargs.unwrap_or(json!({}))
    });
    python_call(bridge, "run_script".to_string(), params).await
}

/// Hot-reload a script
#[tauri::command]
pub async fn python_reload_script(
    bridge: State<'_, PythonBridge>,
    script_name: String,
) -> Result<String, String> {
    let result = python_call(
        bridge,
        "reload_script".to_string(),
        json!({ "script_name": script_name }),
    )
    .await?;
    Ok(result.as_str().unwrap_or("unknown").to_string())
}

// ============================================================================
// BEVY-COMPATIBLE DATA STRUCTURES
// ============================================================================
// These structs match what Bevy expects for mesh creation and can be sent
// via The Leash UDP bridge or used directly in k-os-bevy

#[allow(dead_code)]

/// Mesh data in Bevy-compatible format
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BevyMeshData {
    pub positions: Vec<[f32; 3]>,
    pub normals: Option<Vec<[f32; 3]>>,
    pub uvs: Option<Vec<[f32; 2]>>,
    pub indices: Vec<u32>,
}

/// Heightmap/texture data for Bevy Image assets
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BevyImageData {
    pub width: u32,
    pub height: u32,
    pub data: Vec<u8>,  // RGBA or grayscale
    pub format: String, // "rgba8", "r8", "r32f"
}

/// Terrain data from Python procedural generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BevyTerrainData {
    pub heightmap: Vec<f32>,
    pub width: u32,
    pub height: u32,
    pub biome_map: Option<Vec<u8>>,
}

/// Convert Python mesh output to Bevy-compatible format
pub fn python_mesh_to_bevy(result: &Value) -> Result<BevyMeshData, String> {
    let vertices = result
        .get("vertices")
        .and_then(|v| v.as_array())
        .ok_or("Missing vertices")?;

    let faces = result
        .get("faces")
        .and_then(|v| v.as_array())
        .ok_or("Missing faces")?;

    // Convert vertices: [[x,y,z], ...] -> Vec<[f32;3]>
    let positions: Vec<[f32; 3]> = vertices
        .iter()
        .filter_map(|v| {
            let arr = v.as_array()?;
            Some([
                arr.get(0)?.as_f64()? as f32,
                arr.get(1)?.as_f64()? as f32,
                arr.get(2)?.as_f64()? as f32,
            ])
        })
        .collect();

    // Convert faces to flat indices: [[a,b,c], ...] -> Vec<u32>
    let indices: Vec<u32> = faces
        .iter()
        .filter_map(|f| f.as_array())
        .flat_map(|arr| arr.iter().filter_map(|i| i.as_u64().map(|n| n as u32)))
        .collect();

    // Optional normals
    let normals = result
        .get("vertex_normals")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|n| {
                    let a = n.as_array()?;
                    Some([
                        a.get(0)?.as_f64()? as f32,
                        a.get(1)?.as_f64()? as f32,
                        a.get(2)?.as_f64()? as f32,
                    ])
                })
                .collect()
        });

    Ok(BevyMeshData {
        positions,
        normals,
        uvs: None,
        indices,
    })
}

/// Convert Python heightmap to Bevy-compatible image data
pub fn python_heightmap_to_bevy(result: &Value) -> Result<BevyImageData, String> {
    let data = result
        .get("data")
        .and_then(|v| v.as_array())
        .ok_or("Missing data")?;

    let width = result
        .get("width")
        .and_then(|v| v.as_u64())
        .ok_or("Missing width")? as u32;

    let height = result
        .get("height")
        .and_then(|v| v.as_u64())
        .ok_or("Missing height")? as u32;

    // Flatten 2D array and convert to u8 (0-255)
    let bytes: Vec<u8> = data
        .iter()
        .filter_map(|row| row.as_array())
        .flat_map(|row| {
            row.iter().filter_map(|v| {
                let val = v.as_f64().unwrap_or(0.0);
                Some((val.clamp(0.0, 1.0) * 255.0) as u8)
            })
        })
        .collect();

    Ok(BevyImageData {
        width,
        height,
        data: bytes,
        format: "r8".to_string(),
    })
}

/// Convert Python terrain to Bevy-compatible format
pub fn python_terrain_to_bevy(result: &Value) -> Result<BevyTerrainData, String> {
    let heightmap = result
        .get("heightmap")
        .and_then(|v| v.as_array())
        .ok_or("Missing heightmap")?;

    let width = result
        .get("width")
        .and_then(|v| v.as_u64())
        .ok_or("Missing width")? as u32;

    let height = result
        .get("height")
        .and_then(|v| v.as_u64())
        .ok_or("Missing height")? as u32;

    // Flatten 2D heightmap to 1D Vec<f32>
    let heights: Vec<f32> = heightmap
        .iter()
        .filter_map(|row| row.as_array())
        .flat_map(|row| row.iter().filter_map(|v| v.as_f64().map(|n| n as f32)))
        .collect();

    // Optional biome map
    let biome_map = result
        .get("biome_map")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|row| row.as_array())
                .flat_map(|row| row.iter().filter_map(|v| v.as_u64().map(|n| n as u8)))
                .collect()
        });

    Ok(BevyTerrainData {
        heightmap: heights,
        width,
        height,
        biome_map,
    })
}
