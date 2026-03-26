//! MocapSession — top-level state machine for a capture session.
//!
//! One session = one camera + one model + one DCC target.
//!
//! The session runs the full pipeline in a `tokio::task` and broadcasts
//! `PipelineEvent`s over a `tokio::sync::broadcast` channel.
//! Tauri commands subscribe to this channel and re-emit events to the frontend.
//!
//! ## State Machine
//!
//! ```text
//! Stopped
//!   → start() → Initializing
//!       → camera opens, model loads → Running
//!           → pause() → Paused → resume() → Running
//!           → start_recording() → Recording → stop_recording() → Running
//!           → stop() → Stopped
//!       → error → Error(msg) → start() → Initializing
//! ```

use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};

use parking_lot::Mutex;
use ringbuf::traits::Consumer;
use tokio::sync::broadcast;

use crate::{
    camera::{CameraCapture, CameraFrame},
    dcc::Broadcaster,
    inference::InferenceEngine,
    models::{downloader, get_model, is_model_cached},
    rig::{RetargetSurface, RigRetargeter, resolve_retarget_contract},
    take::{AnimationTake, TakeSource, save_take, TAKE_EXT, TAKES_SUBDIR},
    types::*,
};

#[cfg(feature = "gpu-chain")]
use crate::gpu_chain::GpuChain;

// ─── Session State Enum ───────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionState {
    Idle,
    Initializing,
    Running,
    Paused,
    Recording,
    Error(String),
}

// ─── MocapSession ─────────────────────────────────────────────────────────────

/// Owns the entire pipeline. Created once and managed by a `lazy_static!` Mutex
/// in the Tauri command layer.
pub struct MocapSession {
    state: Arc<Mutex<SessionState>>,
    config: Arc<Mutex<Option<SessionConfig>>>,
    ik_params: Arc<Mutex<IkConstraintParams>>,
    running: Arc<AtomicBool>,
    paused: Arc<AtomicBool>,
    recording: Arc<AtomicBool>,
    /// Frame buffer populated during `SessionState::Recording`.
    /// Flushed to `.zenmocap` on `set_recording(false)`.
    recording_buffer: Arc<Mutex<Vec<JointFrame>>>,
    tx: broadcast::Sender<PipelineEvent>,
}

impl MocapSession {
    /// Create a new (idle) mocap session.
    pub fn new() -> (Self, broadcast::Receiver<PipelineEvent>) {
        let (tx, rx) = broadcast::channel(64);
        let session = Self {
            state: Arc::new(Mutex::new(SessionState::Idle)),
            config: Arc::new(Mutex::new(None)),
            ik_params: Arc::new(Mutex::new(IkConstraintParams::default())),
            running: Arc::new(AtomicBool::new(false)),
            paused: Arc::new(AtomicBool::new(false)),
            recording: Arc::new(AtomicBool::new(false)),
            recording_buffer: Arc::new(Mutex::new(Vec::new())),
            tx,
        };
        (session, rx)
    }

    pub fn subscribe(&self) -> broadcast::Receiver<PipelineEvent> {
        self.tx.subscribe()
    }

    pub fn current_state(&self) -> SessionState {
        self.state.lock().clone()
    }

    // ─── Control commands ─────────────────────────────────────────────────────

    /// Start the pipeline with the given config.
    pub async fn start(&self, config: SessionConfig) -> Result<(), String> {
        {
            let mut state = self.state.lock();
            match *state {
                SessionState::Running | SessionState::Recording | SessionState::Initializing => {
                    return Err("Session already running — call stop() first".into());
                }
                _ => {}
            }
            *state = SessionState::Initializing;
        }

        *self.config.lock() = Some(config.clone());
        self.running.store(true, Ordering::SeqCst);
        self.paused.store(false, Ordering::SeqCst);
        self.recording.store(false, Ordering::SeqCst);
        self.recording_buffer.lock().clear();

        let state = self.state.clone();
        let ik_params = self.ik_params.clone();
        let running = self.running.clone();
        let paused = self.paused.clone();
        let recording = self.recording.clone();
        let recording_buffer = self.recording_buffer.clone();
        let tx = self.tx.clone();

        tokio::spawn(async move {
            if let Err(e) = run_pipeline(config, state.clone(), ik_params, running, paused, recording, recording_buffer, tx.clone()).await {
                log::error!("[zen-mocap] Pipeline error: {}", e);
                *state.lock() = SessionState::Error(e.clone());
                tx.send(PipelineEvent::Error(e)).ok();
            }
        });

        Ok(())
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
        *self.state.lock() = SessionState::Idle;
        self.tx.send(PipelineEvent::SessionStopped).ok();
        log::info!("[zen-mocap] Session stopped");
    }

    pub fn set_paused(&self, paused: bool) {
        self.paused.store(paused, Ordering::Relaxed);
        *self.state.lock() = if paused { SessionState::Paused } else { SessionState::Running };
    }

    pub fn set_recording(&self, recording: bool) {
        if !recording && self.recording.load(Ordering::Relaxed) {
            // Flush buffer → .zenmocap file
            let frames: Vec<JointFrame> = {
                let mut buf = self.recording_buffer.lock();
                std::mem::take(&mut *buf)
            };
            if !frames.is_empty() {
                let config = self.config.lock();
                let model_id = config.as_ref()
                    .map(|c| c.model_id.clone())
                    .unwrap_or_default();
                drop(config);

                let mut take = AnimationTake::new(30.0, model_id, Some(TakeSource::Live { camera_index: 0 }));
                let frame_count = frames.len();
                for f in frames {
                    take.push_frame(f);
                }

                // Save to <app_data>/takes/<name>.zenmocap
                let takes_dir = dirs::data_dir()
                    .unwrap_or_else(|| std::path::PathBuf::from("."))
                    .join("ZenMocap")
                    .join(TAKES_SUBDIR);
                let path = takes_dir.join(format!("{}.{}", take.name, TAKE_EXT));

                match save_take(&take, &path) {
                    Ok(()) => {
                        log::info!("[zen-mocap] Saved take '{}' ({} frames) → {:?}", take.name, frame_count, path);
                        self.tx.send(PipelineEvent::TakeSaved {
                            name: take.name,
                            path: path.to_string_lossy().into_owned(),
                            frame_count,
                        }).ok();
                    }
                    Err(e) => log::error!("[zen-mocap] Failed to save take: {}", e),
                }
            }
        }

        self.recording.store(recording, Ordering::Relaxed);
        *self.state.lock() = if recording { SessionState::Recording } else { SessionState::Running };
    }

    pub fn update_ik_params(&self, params: IkConstraintParams) {
        *self.ik_params.lock() = params;
    }

    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::Relaxed)
    }
}

impl Default for MocapSession {
    fn default() -> Self {
        let (session, _) = Self::new();
        session
    }
}

// ─── Pipeline Loop ────────────────────────────────────────────────────────────

async fn run_pipeline(
    config: SessionConfig,
    state: Arc<Mutex<SessionState>>,
    ik_params: Arc<Mutex<IkConstraintParams>>,
    running: Arc<AtomicBool>,
    paused: Arc<AtomicBool>,
    recording: Arc<AtomicBool>,
    recording_buffer: Arc<Mutex<Vec<JointFrame>>>,
    tx: broadcast::Sender<PipelineEvent>,
) -> Result<(), String> {
    log::info!("[zen-mocap] Pipeline starting: model={}, target={}:{}", config.model_id, config.dcc_target, config.target_port);

    // ── Load / verify model ─────────────────────────────────────────────────
    let model_entry = get_model(&config.model_id)
        .ok_or_else(|| format!("Unknown model id: {}", config.model_id))?;

    let resolved_retarget = resolve_retarget_contract(
        &model_entry.id,
        model_entry.keypoints,
        RetargetSurface::LiveSession,
    )?;
    let topology_profile = resolved_retarget.topology_profile;
    let retarget_contract = resolved_retarget.live_retarget_contract;

    let model_path = if is_model_cached(model_entry) {
        crate::models::model_cache_path(model_entry)
    } else {
        log::info!("[zen-mocap] Downloading model '{}'...", model_entry.id);
        downloader::download_model(model_entry, None)?
    };

    // ── Inference engine (ORT session) ──────────────────────────────────────
    let mut engine = InferenceEngine::load(
        &model_path,
        model_entry.input_height(),
        model_entry.input_width(),
        model_entry.keypoints,
        &model_entry.preprocess,
    )?;

    // ── Camera (now owns the ring buffer internally, returns consumer) ──────
    let mut camera = CameraCapture::new(config.camera_device_id, 640, 480, 30);
    let mut consumer = camera.start()?;

    // ── DCC broadcaster ─────────────────────────────────────────────────────
    let mut broadcaster = Broadcaster::connect(&config.dcc_target, &config.target_host, config.target_port)?;

    // ── Retarget stage (reads GPU-solved joints) ───────────────────────────────
    let initial_params = ik_params.lock().clone();
    let mut retargeter = RigRetargeter::new(initial_params, retarget_contract);

    // ── GPU chain init (mandatory) ────────────────────────────────────────────
    // max_joints = model_keypoints * max_persons. Pre-allocate for 8 people.
    #[cfg(feature = "gpu-chain")]
    let gpu_chain: GpuChain = {
        let chain = GpuChain::new(model_entry.keypoints * 8, Some(tx.clone()))
            .await
            .map_err(|e| format!("GPU chain init failed (CPU fallback disabled): {e}"))?;

        chain.upload_topology(&topology_profile.parents, &topology_profile.rest_lengths);
        log::info!(
            "[zen-mocap] GPU chain ready — 5 SPIR-V passes active (topology='{}')",
            topology_profile.id
        );
        chain
    };

    // ── Stats tracking ──────────────────────────────────────────────────────
    let mut frame_seq: u64 = 0;
    let frame_times: &mut Vec<f64> = &mut Vec::with_capacity(30);
    let mut stats_timer = std::time::Instant::now();
    let mut drop_count: u32 = 0;
    #[allow(unused_variables)]
    let pipeline_start = std::time::Instant::now();

    // Transition to Running
    *state.lock() = SessionState::Running;
    tx.send(PipelineEvent::SessionStarted).ok();

    // ── Hot loop ─────────────────────────────────────────────────────────────
    while running.load(Ordering::Relaxed) {
        if paused.load(Ordering::Relaxed) {
            tokio::time::sleep(std::time::Duration::from_millis(16)).await;
            continue;
        }

        // Grab latest frame from ring buffer
        let camera_frame = match consumer.try_pop() {
            Some(f) => f,
            None => {
                drop_count += 1;
                tokio::time::sleep(std::time::Duration::from_millis(2)).await;
                continue;
            }
        };

        // Emit camera frame for preview window (every 3rd frame to reduce bandwidth)
        if frame_seq % 3 == 0 {
            tx.send(PipelineEvent::CameraFrame {
                data: camera_frame.data.clone(),
                width: camera_frame.width,
                height: camera_frame.height,
                timestamp_ms: camera_frame.timestamp_ms,
            }).ok();
        }

        let t0 = std::time::Instant::now();

        // Hot-reload IK params if changed from the sliders
        let current_params = ik_params.lock().clone();
        retargeter.update_params(current_params);

        // ── Inference (ONNX → raw COCO joints) ─────────────────────────────
        let raw_joints = match engine.infer(&camera_frame.data, camera_frame.width, camera_frame.height) {
            Ok(j) => j,
            Err(e) => {
                log::warn!("[zen-mocap] Inference error: {}", e);
                continue;
            }
        };

        // ── GPU chain (5 SPIR-V passes), no CPU fallback ─────────────────────
        #[cfg(feature = "gpu-chain")]
        let (joints, skeleton) = {
            let dt = (t0.elapsed().as_secs_f32()).max(0.001);
            let time_sec = pipeline_start.elapsed().as_secs_f32();

            // GPU path: denoise → skeleton → physics → supermotion_livelink → livelink
            let solved = gpu_chain
                .process_frame(&raw_joints, dt, time_sec)
                .await
                .map_err(|e| format!("GPU frame error (CPU fallback disabled): {e}"))?;

            // IK retarget is still CPU-side (reads GPU-solved positions)
            let current_params = ik_params.lock().clone();
            retargeter.update_params(current_params);
            let skeleton = retargeter.retarget(&solved);
            (solved, skeleton)
        };

        #[cfg(not(feature = "gpu-chain"))]
        let (joints, skeleton): (Vec<Joint>, Option<Vec<BoneTransform>>) = {
            unreachable!("GPU chain feature is required for ZenMocap")
        };

        // Build frame
        let frame = JointFrame {
            seq: frame_seq,
            timestamp_ms: camera_frame.timestamp_ms,
            joints,
            skeleton,
            model_id: config.model_id.clone(),
        };

        // Broadcast to frontend preview
        if config.enable_preview {
            tx.send(PipelineEvent::Frame(frame.clone())).ok();
        }
        // Capture frames into take buffer while recording
        if recording.load(Ordering::Relaxed) {
            recording_buffer.lock().push(frame.clone());
        }
        broadcaster.send_frame(&frame).ok();

        // Stats
        let elapsed_ms = t0.elapsed().as_secs_f64() * 1000.0;
        frame_times.push(elapsed_ms);
        frame_seq += 1;

        // Emit 1Hz stats
        if stats_timer.elapsed().as_secs_f32() >= 1.0 {
            let fps = frame_times.len() as f32;
            let avg_lat = frame_times.iter().sum::<f64>() as f32 / fps.max(1.0);
            let stats = PipelineStats {
                fps,
                avg_latency_ms: avg_lat,
                frame_drops: drop_count,
                // GPU adapter memory queries aren't exposed by wgpu yet;
                // use WIN DXGI or Vulkan VmaBudget in a follow-up.
                vram_mb: 0,
                udp_connected: broadcaster.is_connected(),
                udp_tx_count: broadcaster.tx_count(),
            };
            tx.send(PipelineEvent::Stats(stats)).ok();
            frame_times.clear();
            drop_count = 0;
            stats_timer = std::time::Instant::now();
        }
    }

    camera.stop();
    log::info!("[zen-mocap] Pipeline loop exited cleanly");
    Ok(())
}
