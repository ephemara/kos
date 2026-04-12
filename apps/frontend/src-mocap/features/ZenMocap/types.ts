/**
 * ZenMocap Types
 *
 * IPC contract types — mirror the Rust structs in crates/app-proto/src/messages.rs.
 * When new message variants are added to AppMessage, run:
 *   cargo test --features ts-rs
 * to regenerate shared/protocol/* bindings automatically.
 *
 * Types here are ZenMocap-specific and NOT yet part of the auto-gen flow
 * (they will be once the Rust side is wired up).
 */

// ─── Model Selection ──────────────────────────────────────────────────────────

/** AI pose estimation models supported by the onnxruntime-rs backend */
export const POSE_MODELS = {
  yolov11n_pose: { label: 'YOLO11 Nano Pose', vram_mb: 80, description: 'Fastest live capture option' },
  yolov11s_pose: { label: 'YOLO11 Small Pose', vram_mb: 130, description: 'Recommended live capture balance' },
  yolov11m_pose: { label: 'YOLO11 Medium Pose', vram_mb: 220, description: 'Stronger multi-person accuracy' },
  yolov11l_pose: { label: 'YOLO11 Large Pose', vram_mb: 350, description: 'High quality video analysis' },
  yolov11x_pose: { label: 'YOLO11 XLarge Pose', vram_mb: 500, description: 'Maximum quality offline analysis' },
  rtmw3d_l: { label: 'RTMw3D Large', vram_mb: 900, description: '133-key whole-body 3D retargeting' },
  rtmw3d_x: { label: 'RTMw3D XLarge', vram_mb: 1400, description: 'Highest quality whole-body 3D retargeting' },
} as const;

export type PoseModelId = keyof typeof POSE_MODELS;

/** Inference precision mode */
export const INFERENCE_PRECISION = {
  fp32: { label: 'FP32', description: 'Full precision — most accurate' },
  fp16: { label: 'FP16', description: 'Half precision — recommended' },
  int8: { label: 'INT8', description: 'Quantized — lowest VRAM' },
} as const;

export type InferencePrecision = keyof typeof INFERENCE_PRECISION;

// ─── DCC Targets ─────────────────────────────────────────────────────────────

/** Per-target config. Data-driven — add new DCCs here, nowhere else. */
export const DCC_TARGET_CONFIG = {
  ue5: { label: 'Unreal Engine 5', defaultPort: 11111, protocol: 'LiveLink JSON' },
  unity: { label: 'Unity', defaultPort: 11112, protocol: 'LiveLink JSON' },
  blender: { label: 'Blender', defaultPort: 11113, protocol: 'OSC JSON' },
} as const;

export type DccTarget = keyof typeof DCC_TARGET_CONFIG;

// ─── Session Config ───────────────────────────────────────────────────────────

/**
 * Full pipeline config sent to Rust on session start.
 * Mirrors: crates/app-proto/src/messages.rs → SessionConfig
 * snake_case to match serde default field naming.
 */
export interface SessionConfig {
  camera_device_id: number;  // u32 — must be a number, not a string
  model_id: PoseModelId;
  precision: InferencePrecision;
  dcc_target: DccTarget;
  target_host: string;
  target_port: number;
  enable_preview: boolean;
}

// ─── Joint Data ───────────────────────────────────────────────────────────────

/**
 * COCO 17-keypoint convention (YOLOv8-pose + RTMPose).
 * Matches index order used by both model families.
 */
export const JOINT_NAMES = [
  'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
  'left_shoulder', 'right_shoulder',
  'left_elbow', 'right_elbow',
  'left_wrist', 'right_wrist',
  'left_hip', 'right_hip',
  'left_knee', 'right_knee',
  'left_ankle', 'right_ankle',
] as const;

export type JointName = typeof JOINT_NAMES[number];

/** Bone connections for the Three.js skeleton renderer */
export const SKELETON_BONES: [JointName, JointName][] = [
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_elbow'],
  ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_wrist'],
  ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'],
  ['left_hip', 'right_hip'],
  ['left_hip', 'left_knee'],
  ['left_knee', 'left_ankle'],
  ['right_hip', 'right_knee'],
  ['right_knee', 'right_ankle'],
  ['nose', 'left_eye'],
  ['nose', 'right_eye'],
  ['left_eye', 'left_ear'],
  ['right_eye', 'right_ear'],
];

/** Joint as sent by Rust: position [x,y,z] + confidence (no rotation field) */
export interface Joint {
  position: [number, number, number];
  confidence: number; // 0–1
}

/**
 * Wire-format JointFrame as emitted by Rust `serde_json`.
 * joints is a flat Vec<Joint> in COCO index order (use JOINT_NAMES[i] for name).
 * seq is the frame counter (not frame_id).
 */
export interface RawJointFrame {
  seq: number;         // Rust field name
  timestamp_ms: number;
  joints: Joint[];     // Vec<Joint> in COCO index order
  skeleton: Array<{ name: string; position: [number, number, number]; rotation: [number, number, number, number]; world_matrix: number[] }> | null;
  model_id: string;
}

/**
 * Normalized JointFrame — joints keyed by COCO name for easy lookup.
 * Built from RawJointFrame by normalizeJointFrame().
 * This is what SessionViewport and CharacterLoader consume.
 */
export interface JointFrame {
  frame_id: number;       // = seq, renamed for internal clarity
  timestamp_ms: number;
  joints: Record<JointName, Joint>;
  model_id: string;
  skeleton: RawJointFrame['skeleton'];
}

/**
 * Convert the Rust wire frame (array joints) to the named-map form
 * that CharacterLoader and SessionViewport use.
 * O(17) — runs once per frame, zero heap pressure.
 */
export function normalizeJointFrame(raw: RawJointFrame): JointFrame {
  const joints = {} as Record<JointName, Joint>;
  JOINT_NAMES.forEach((name, i) => {
    if (raw.joints[i]) joints[name] = raw.joints[i];
  });
  return {
    frame_id: Number(raw.seq),
    timestamp_ms: raw.timestamp_ms,
    joints,
    model_id: raw.model_id,
    skeleton: raw.skeleton,
  };
}

// ─── Pipeline Stats ───────────────────────────────────────────────────────────

export interface PipelineStats {
  fps: number;
  avg_latency_ms: number;
  peak_latency_ms: number;
  frame_drops: number;
  vram_mb: number;
  udp_tx_count: number;
  udp_connected: boolean;
}

// ─── IK Constraints ───────────────────────────────────────────────────────────

export interface IKConstraints {
  foot_lock_strength: number;
  bone_length_tolerance: number;
  filter_min_cutoff: number;
  filter_beta: number;
}

export const DEFAULT_IK_CONSTRAINTS: IKConstraints = {
  foot_lock_strength: 0.85,
  bone_length_tolerance: 0.02,
  filter_min_cutoff: 1.0,
  filter_beta: 0.007,
};

// ─── Session State ────────────────────────────────────────────────────────────

export type SessionStatus =
  | 'idle'
  | 'initializing'
  | 'running'
  | 'paused'
  | 'recording'
  | 'error';

export interface SessionState {
  status: SessionStatus;
  config: SessionConfig | null;
  error: string | null;
}

// ─── Camera & Model Inventory (from Rust via Tauri IPC) ──────────────────────

/** Mirrors zen_mocap_engine::types::CameraInfo */
export interface CameraInfo {
  index: number;
  name: string;  // human-readable device name from nokhwa
}

/** Mirrors zen_mocap_engine::models::ModelEntry (snake_case — serde default) */
export interface ModelEntry {
  id: string;
  name: string;
  description: string;
  url: string;
  sha256: string;
  filename: string;
  input_shape: [number, number, number, number]; // [batch, C, H, W]
  keypoints: number;
  precision: 'fp32' | 'fp16';
}

/** Download status for a model from mocap_check_models */
export interface ModelStatus {
  model_id: string;
  cached: boolean;
  cache_path: string;
}

// ─── Take Library Types ────────────────────────────────────────────────────────
// Mirror of Rust `zen_mocap_engine::take::{TakeSummary, AnimationTake}`
// Keep field names identical (snake_case) — Tauri serialises Rust structs as-is.

export interface TakeSummary {
  id: string;
  name: string;
  created_at: number;     // unix ms
  fps: number;
  frame_count: number;
  duration_ms: number;
  path: string;
  source_type: 'live' | 'video';
  model_id: string;
  tags: string[];
}

/** Single frame stored in an AnimationTake — compatible with the GPU JointFrame shape */
export interface StoredJointFrame {
  seq: number;
  timestamp_ms: number;
  joints: Joint[];
  skeleton: Record<string, unknown>;
  model_id: string;
}

export interface TimelineEditEvent {
  event_id: string;
  track_id: string;
  source_id: string;
  session_frame: number;
  timestamp_ms: number;
  op: Record<string, unknown>;
  patch: {
    prior_keyframes: Array<{
      frame: number;
      sample: Record<string, unknown> | null;
    }>;
  };
}

/**
 * Full animation take with all frame data.
 * Only loaded by the timeline panel — not stored in the content browser list.
 */
export interface AnimationTake {
  id: string;
  name: string;
  created_at: number;
  fps: number;
  frame_count: number;
  duration_ms: number;
  frames: JointFrame[];
  rotations: [number, number, number, number][][] | null;
  timeline_edit_events: TimelineEditEvent[];
  metadata: {
    model_id: string;
    subject: string;
    tags: string[];
    source: { type: 'live'; camera_index: number }
    | { type: 'video'; path: string }
    | null;
  };
}
// ─── Video Analysis Types ─────────────────────────────────────────────────────

export interface VideoAnalysisConfig {
  video_path: string;
  model_id: string;
  /** Analyse every Nth frame (1 = every frame). Higher = faster but lower temporal resolution. */
  frame_step: number;
  /** Output FPS for the saved take */
  output_fps: number;
  tags: string[];
  subject: string;
}

export interface VideoAnalysisProgress {
  frame: number;
  total: number;   // 0 = unknown
  fps_actual: number;   // processing rate
  phase: 'decoding' | 'inference' | 'saving' | 'done';
}

export interface VideoProbeResult {
  streams?: Array<{
    width?: number;
    height?: number;
    nb_frames?: string;
    r_frame_rate?: string;  // "30/1"
    duration?: string;  // seconds as string
  }>;
}
