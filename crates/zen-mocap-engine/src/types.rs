//! Core types shared across the entire mocap engine.
//!
//! All types are `Serialize + Deserialize` so they cross the Tauri IPC
//! boundary via `serde_json` with zero extra boilerplate.

use serde::{Deserialize, Serialize};

// ─── COCO Joint Index Map (data-driven, not hardcoded in logic) ──────────────

/// 17-keypoint COCO body joint names in index order.
/// Index into `JointFrame::joints` using these constants or the slice directly.
pub const COCO_JOINT_NAMES: &[&str] = &[
    "nose",          // 0
    "left_eye",      // 1
    "right_eye",     // 2
    "left_ear",      // 3
    "right_ear",     // 4
    "left_shoulder", // 5
    "right_shoulder",// 6
    "left_elbow",    // 7
    "right_elbow",   // 8
    "left_wrist",    // 9
    "right_wrist",   // 10
    "left_hip",      // 11
    "right_hip",     // 12
    "left_knee",     // 13
    "right_knee",    // 14
    "left_ankle",    // 15
    "right_ankle",   // 16
];

/// Skeleton adjacency — pairs of joint indices that form bones.
/// Used by the Three.js renderer to draw stick figure lines.
pub const SKELETON_ADJACENCY: &[(usize, usize)] = &[
    (0, 1), (0, 2), (1, 3), (2, 4),          // Head
    (5, 6),                                    // Shoulders
    (5, 7), (7, 9),                           // Left arm
    (6, 8), (8, 10),                          // Right arm
    (5, 11), (6, 12),                         // Torso sides
    (11, 12),                                  // Hips
    (11, 13), (13, 15),                       // Left leg
    (12, 14), (14, 16),                       // Right leg
];

// ─── Joint ───────────────────────────────────────────────────────────────────

/// A single body joint from pose inference.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Joint {
    /// World-space position in normalised camera coordinates [x, y, z].
    /// z is depth estimate (negative = closer to camera).
    pub position: [f32; 3],
    /// Model confidence score [0.0, 1.0]. Below ~0.3 = unreliable.
    pub confidence: f32,
}

impl Joint {
    pub fn zero() -> Self {
        Self { position: [0.0; 3], confidence: 0.0 }
    }

    pub fn is_reliable(&self) -> bool {
        self.confidence >= 0.3
    }
}

// ─── BoneTransform ───────────────────────────────────────────────────────────

/// Solved bone transform after IK pass.
/// Sent to Three.js renderer and DCC targets.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoneTransform {
    /// Bone name (matches k-os-rig Skeleton bone names)
    pub name: String,
    /// World matrix (column-major, same as Three.js Matrix4)
    pub world_matrix: [f32; 16],
    /// World position extracted for convenience
    pub position: [f32; 3],
    /// Local rotation as quaternion [x, y, z, w]
    pub rotation: [f32; 4],
}

// ─── JointFrame ──────────────────────────────────────────────────────────────

/// One frame of pose data from the inference pipeline.
/// Emitted as `mocap://joint_frame` Tauri event at ~30Hz.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JointFrame {
    /// Monotonically increasing frame counter
    pub seq: u64,
    /// Milliseconds since Unix epoch at capture time
    pub timestamp_ms: f64,
    /// Raw inference joints (17 COCO keypoints, indices = COCO_JOINT_NAMES)
    pub joints: Vec<Joint>,
    /// Solved biped skeleton bones (populated after IK pass, None before session starts)
    pub skeleton: Option<Vec<BoneTransform>>,
    /// Model ID that produced this frame (from MODEL_MANIFEST)
    pub model_id: String,
}

impl JointFrame {
    pub fn get_joint(&self, idx: usize) -> Option<&Joint> {
        self.joints.get(idx)
    }

    /// Helper: get COCO joint by name (e.g. "left_wrist")
    pub fn get_named(&self, name: &str) -> Option<&Joint> {
        let idx = COCO_JOINT_NAMES.iter().position(|&n| n == name)?;
        self.joints.get(idx)
    }
}

// ─── PipelineStats ───────────────────────────────────────────────────────────

/// 1Hz stats snapshot. Emitted as `mocap://stats` Tauri event.
/// Matches the TypeScript `PipelineStats` type in frontend/types.ts exactly.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineStats {
    pub fps: f32,
    pub avg_latency_ms: f32,
    pub frame_drops: u32,
    pub vram_mb: u32,
    pub udp_connected: bool,
    pub udp_tx_count: u32,
}

impl Default for PipelineStats {
    fn default() -> Self {
        Self {
            fps: 0.0,
            avg_latency_ms: 0.0,
            frame_drops: 0,
            vram_mb: 0,
            udp_connected: false,
            udp_tx_count: 0,
        }
    }
}

// ─── SessionConfig ────────────────────────────────────────────────────────────

/// Configuration passed to `MocapSession::start()`.
/// Serialised through Tauri IPC from PipelineControls panel.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionConfig {
    /// Camera device index (from enumerate_cameras())
    pub camera_device_id: u32,
    /// Model identifier — must match a model id in models_manifest.toml
    pub model_id: String,
    /// Inference precision: "fp32" | "fp16"
    pub precision: String,
    /// DCC target: "ue5" | "unity" | "blender" | "maya" | "c4d" | "resolve"
    pub dcc_target: String,
    /// Target host for DCC broadcast (usually "127.0.0.1")
    pub target_host: String,
    /// Target port for DCC broadcast
    pub target_port: u16,
    /// Whether to enable live viewport preview (emits joint_frame events)
    pub enable_preview: bool,
}

impl Default for SessionConfig {
    fn default() -> Self {
        Self {
            camera_device_id: 0,
            model_id: "yolov11s_pose".into(),
            precision: "fp32".into(),
            dcc_target: "ue5".into(),
            target_host: "127.0.0.1".into(),
            target_port: 11111,
            enable_preview: true,
        }
    }
}

// ─── IkConstraintParams ──────────────────────────────────────────────────────

/// IK solver tuning knobs — hot-reloadable while session is running.
/// Maps directly to IKConstraintPanel sliders on the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IkConstraintParams {
    /// Foot lock strength [0.0, 1.0]. 1.0 = feet never slide.
    pub foot_lock_strength: f32,
    /// Bone length tolerance (FABRIK convergence threshold)
    pub bone_length_tolerance: f32,
    /// One Euro Filter: minimum cutoff frequency (lower = smoother, more lag)
    pub filter_min_cutoff: f32,
    /// One Euro Filter: speed coefficient (higher = less lag when moving fast)
    pub filter_beta: f32,
}

impl Default for IkConstraintParams {
    fn default() -> Self {
        Self {
            foot_lock_strength: 0.75,
            bone_length_tolerance: 0.01,
            filter_min_cutoff: 1.0,
            filter_beta: 0.007,
        }
    }
}

// ─── PipelineEvent ───────────────────────────────────────────────────────────

/// Events broadcast on the internal tokio channel (not Tauri events).
/// Tauri commands subscribe to this and emit the appropriate frontend events.
#[derive(Debug, Clone)]
pub enum PipelineEvent {
    Frame(JointFrame),
    Stats(PipelineStats),
    Error(String),
    SessionStarted,
    SessionStopped,
    /// Emitted when a recording is flushed to a `.zenmocap` file.
    TakeSaved { name: String, path: String, frame_count: usize },
    /// GPU device-level error — emitted by the wgpu uncaptured error handler.
    GpuHealth(GpuHealthEvent),
    /// Raw camera frame for preview window (BGR format)
    CameraFrame { data: Vec<u8>, width: u32, height: u32, timestamp_ms: f64 },
}

// ─── GpuInfo ─────────────────────────────────────────────────────────────────

/// GPU adapter metadata — returned by `mocap_get_gpu_info` command.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuInfo {
    /// Human-readable adapter name ("NVIDIA GeForce RTX 4090", etc.)
    pub name: String,
    /// wgpu backend: Vulkan, Dx12, Metal, Gl, BrowserWebGpu, Empty
    pub backend: String,
    /// Driver string from wgpu adapter info
    pub driver: String,
    /// Driver info (version, etc.)
    pub driver_info: String,
    /// Dedicated VRAM in bytes (0 if unknown)
    pub vram_bytes: u64,
    /// Device type: DiscreteGpu | IntegratedGpu | Cpu | Unknown
    pub device_type: String,
}

// ─── GpuHealthEvent ───────────────────────────────────────────────────────────

/// GPU-level error classification emitted as `mocap://gpu_health`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuHealthEvent {
    /// "device_lost" | "out_of_memory" | "validation" | "internal" | "unknown"
    pub kind: String,
    /// Human-readable description
    pub message: String,
    /// Unix timestamp ms
    pub timestamp_ms: f64,
}

// ─── CameraInfo ──────────────────────────────────────────────────────────────

/// Camera descriptor for the device list endpoint.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CameraInfo {
    pub index: u32,
    pub name: String,
}

// ─── GPU Adapter Cache (feature-agnostic) ────────────────────────────────────
// Written by GpuChain::new() when the gpu-chain feature is active.
// Read by the mocap_get_gpu_info Tauri command at any time.
// Stored here (not in gpu_chain.rs) so the command compiles regardless of feature.

use parking_lot::Mutex as PkMutex;
use std::sync::OnceLock;

fn gpu_adapter_cache() -> &'static PkMutex<Option<GpuInfo>> {
    static CACHE: OnceLock<PkMutex<Option<GpuInfo>>> = OnceLock::new();
    CACHE.get_or_init(|| PkMutex::new(None))
}

/// Write the GPU adapter info (called by GpuChain::new).
pub fn set_gpu_adapter_info(info: GpuInfo) {
    *gpu_adapter_cache().lock() = Some(info);
}

/// Read the GPU adapter info (called by mocap_get_gpu_info command).
pub fn get_gpu_adapter_info() -> Option<GpuInfo> {
    gpu_adapter_cache().lock().clone()
}
