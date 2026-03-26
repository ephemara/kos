//! Video Analysis Pipeline — Phase 4
//!
//! Decodes a video file frame-by-frame, runs each frame through the existing
//! ONNX inference + filter + IK pipeline, and saves the output as a
//! `.zenmocap` take. No new GPU shaders needed — reuses the exact same
//! `InferenceEngine`, `JointFilterBank`, `RigRetargeter` and `save_take`
//! infrastructure from the live session path.
//!
//! ## Approach
//! Uses the `video-rs` crate (FFmpeg bindings) for decoding. Falls back to
//! frame-by-frame JPEG extraction via `std::process::Command` + ffmpeg CLI
//! if the native bindings are not available (zero extra Cargo deps needed).
//!
//! ## Progress Events
//! Emits `VideoAnalysisProgress { frame, total, fps_actual }` on a
//! `tokio::sync::mpsc` channel so the Tauri command layer can forward
//! progress to the frontend without blocking the thread pool.

use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

/// Resolve the path to ffmpeg or ffprobe.
/// Checks next to the running executable first (works for both Tauri sidecar
/// prod layout and dev with ffmpeg.exe copied locally), then falls back to PATH.
fn resolve_tool(name: &str) -> String {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            // Tauri sidecar (prod) or plain copy (dev)
            let plain = dir.join(format!("{}.exe", name));
            if plain.exists() { return plain.to_string_lossy().into_owned(); }
            // Tauri sidecar uses <name>-<target_triple>.exe naming
            let triple = dir.join(format!("{}-x86_64-pc-windows-msvc.exe", name));
            if triple.exists() { return triple.to_string_lossy().into_owned(); }
        }
    }
    name.to_string() // fallback: system PATH
}
use std::time::Instant;

use crate::{
    inference::InferenceEngine,
    models::{downloader, get_model, is_model_cached, ModelEntry},
    rig::{RetargetSurface, RigRetargeter, resolve_retarget_contract},
    take::{AnimationTake, TakeSource, save_take, TAKE_EXT, TAKES_SUBDIR},
    types::{IkConstraintParams, Joint, JointFrame},
};
#[cfg(feature = "gpu-chain")]
use crate::gpu_chain::GpuChain;

// ─── Progress Event ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, serde::Serialize)]
pub struct VideoAnalysisProgress {
    pub frame:      u64,
    pub total:      u64,   // 0 = unknown (stream without duration)
    pub fps_actual: f32,   // processing rate, not video FPS
    pub phase:      String, // "decoding" | "inference" | "saving"
}

// ─── Analysis Config ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, serde::Deserialize)]
pub struct VideoAnalysisConfig {
    pub video_path:  String,
    pub model_id:    String,
    /// Downsample factor: analyse every Nth frame (1 = every frame, 2 = every other, etc.)
    pub frame_step:  u32,
    /// Output FPS for the resulting take (independent of source video FPS)
    pub output_fps:  f32,
    /// Optional tags to attach to the saved take
    pub tags:        Vec<String>,
    /// Subject name for take metadata
    pub subject:     String,
}

impl Default for VideoAnalysisConfig {
    fn default() -> Self {
        Self {
            video_path:  String::new(),
            model_id:    "yolov11n_pose".into(),
            frame_step:  1,
            output_fps:  30.0,
            tags:        vec![],
            subject:     "unknown".into(),
        }
    }
}

// ─── VideoAnalyzer ────────────────────────────────────────────────────────────

pub struct VideoAnalyzer;

/// Temporal subject tracker for offline analysis.
///
/// Keeps one coherent subject over time by:
/// - filling low-confidence joints from previous frame
/// - clamping impossible per-frame joint jumps
/// - rejecting whole-frame identity jumps (person switch / partial-body lock)
struct TemporalJointTracker {
    previous: Option<Vec<Joint>>,
}

impl TemporalJointTracker {
    const JOINT_COUNT: usize = 17;
    const MIN_CONFIDENCE: f32 = 0.22;
    const HISTORY_CONFIDENCE_FLOOR: f32 = 0.18;
    const MAX_JOINT_DELTA: f32 = 0.20;
    const MAX_CENTER_JUMP: f32 = 0.30;
    const MIN_VISIBLE_JOINTS: usize = 7;
    const BLEND_ALPHA: f32 = 0.80;

    fn new() -> Self {
        Self { previous: None }
    }

    fn stabilize(&mut self, input: Vec<Joint>) -> Vec<Joint> {
        let mut current = Self::sanitize_joints(input);
        if current.len() != Self::JOINT_COUNT {
            self.previous = Some(current.clone());
            return current;
        }

        if let Some(prev) = &self.previous {
            if prev.len() == Self::JOINT_COUNT {
                if Self::should_hold_previous(prev, &current) {
                    return prev.clone();
                }

                for i in 0..Self::JOINT_COUNT {
                    let cur = &mut current[i];
                    let old = &prev[i];

                    if cur.confidence < Self::MIN_CONFIDENCE {
                        cur.position = old.position;
                        cur.confidence = old.confidence.max(Self::HISTORY_CONFIDENCE_FLOOR);
                        continue;
                    }

                    let dx = cur.position[0] - old.position[0];
                    let dy = cur.position[1] - old.position[1];
                    let dz = cur.position[2] - old.position[2];
                    let dist = (dx * dx + dy * dy + dz * dz).sqrt();
                    if dist > Self::MAX_JOINT_DELTA && old.confidence >= Self::MIN_CONFIDENCE {
                        let t = (Self::MAX_JOINT_DELTA / dist).clamp(0.0, 1.0);
                        cur.position[0] = old.position[0] + dx * t;
                        cur.position[1] = old.position[1] + dy * t;
                        cur.position[2] = old.position[2] + dz * t;
                    }

                    // Confidence-weighted temporal blend to reduce flicker while
                    // keeping quick motions responsive.
                    let alpha = (cur.confidence * Self::BLEND_ALPHA).clamp(0.0, 1.0);
                    cur.position[0] = old.position[0] * (1.0 - alpha) + cur.position[0] * alpha;
                    cur.position[1] = old.position[1] * (1.0 - alpha) + cur.position[1] * alpha;
                    cur.position[2] = old.position[2] * (1.0 - alpha) + cur.position[2] * alpha;
                }
            }
        }

        self.previous = Some(current.clone());
        current
    }

    fn sanitize_joints(mut joints: Vec<Joint>) -> Vec<Joint> {
        for j in &mut joints {
            j.position[0] = if j.position[0].is_finite() { j.position[0].clamp(0.0, 1.0) } else { 0.0 };
            j.position[1] = if j.position[1].is_finite() { j.position[1].clamp(0.0, 1.0) } else { 0.0 };
            j.position[2] = if j.position[2].is_finite() { j.position[2].clamp(-1.0, 1.0) } else { 0.0 };
            j.confidence = if j.confidence.is_finite() { j.confidence.clamp(0.0, 1.0) } else { 0.0 };
        }
        joints
    }

    fn should_hold_previous(prev: &[Joint], curr: &[Joint]) -> bool {
        let prev_center = Self::body_center(prev);
        let curr_center = Self::body_center(curr);
        if let (Some(a), Some(b)) = (prev_center, curr_center) {
            let dx = a[0] - b[0];
            let dy = a[1] - b[1];
            let dz = a[2] - b[2];
            let center_jump = (dx * dx + dy * dy + dz * dz).sqrt();
            let prev_visible = Self::visible_count(prev);
            let curr_visible = Self::visible_count(curr);
            let curr_conf = Self::avg_confidence(curr);
            if center_jump > Self::MAX_CENTER_JUMP
                && (
                    curr_visible < Self::MIN_VISIBLE_JOINTS
                    || curr_visible + 2 < prev_visible
                    || curr_conf < 0.45
                )
            {
                return true;
            }
        }
        false
    }

    fn visible_count(joints: &[Joint]) -> usize {
        joints.iter().filter(|j| j.confidence >= Self::MIN_CONFIDENCE).count()
    }

    fn avg_confidence(joints: &[Joint]) -> f32 {
        if joints.is_empty() {
            return 0.0;
        }
        joints.iter().map(|j| j.confidence).sum::<f32>() / joints.len() as f32
    }

    fn body_center(joints: &[Joint]) -> Option<[f32; 3]> {
        // torso anchors: shoulders + hips (COCO 5,6,11,12)
        const ANCHORS: [usize; 4] = [5, 6, 11, 12];
        let mut sx = 0.0;
        let mut sy = 0.0;
        let mut sz = 0.0;
        let mut n = 0.0;
        for idx in ANCHORS {
            if let Some(j) = joints.get(idx) {
                if j.confidence >= Self::MIN_CONFIDENCE {
                    sx += j.position[0];
                    sy += j.position[1];
                    sz += j.position[2];
                    n += 1.0;
                }
            }
        }
        if n < 2.0 {
            return None;
        }
        Some([sx / n, sy / n, sz / n])
    }
}

impl VideoAnalyzer {
    /// Analyse a video file and save a `.zenmocap` take.
    ///
    /// `progress_tx`: optional channel for progress events (`None` = no reporting).
    /// Returns the path of the saved take on success.
    pub fn analyze(
        config:      VideoAnalysisConfig,
        progress_tx: Option<tokio::sync::mpsc::UnboundedSender<VideoAnalysisProgress>>,
        frame_tx:    Option<tokio::sync::mpsc::UnboundedSender<JointFrame>>,
        raw_frame_tx: Option<tokio::sync::mpsc::UnboundedSender<JointFrame>>,
        cancel_flag: Option<Arc<AtomicBool>>,
    ) -> Result<PathBuf, String> {
        let video_path = Path::new(&config.video_path);
        if !video_path.exists() {
            return Err(format!("Video file not found: {:?}", video_path));
        }

        // ── Load model ──────────────────────────────────────────────────────
        let model_entry = get_model(&config.model_id)
            .ok_or_else(|| format!("Unknown model id: {}", config.model_id))?;

        let resolved_retarget = resolve_retarget_contract(
            &model_entry.id,
            model_entry.keypoints,
            RetargetSurface::OfflineVideo,
        )?;
        let topology_profile = resolved_retarget.topology_profile;
        let retarget_contract = resolved_retarget.live_retarget_contract;

        let model_path = if is_model_cached(model_entry) {
            crate::models::model_cache_path(model_entry)
        } else {
            log::info!("[video-analyzer] Downloading model '{}'…", model_entry.id);
            downloader::download_model(model_entry, None)?
        };

        let mut engine = InferenceEngine::load(
            &model_path,
            model_entry.input_height(),
            model_entry.input_width(),
            model_entry.keypoints,
            &model_entry.preprocess,
        )?;

        // ── IK retargeter (consumes GPU-solved joints) ────────────────────
        let ik_params = IkConstraintParams::default();
        let mut retargeter = RigRetargeter::new(ik_params, retarget_contract);

        // ── GPU chain init (same path as live session) ─────────────────────
        #[cfg(feature = "gpu-chain")]
        let gpu_chain: GpuChain = {
            let rt = tokio::runtime::Handle::current();
            let chain = rt
                .block_on(async { GpuChain::new(model_entry.keypoints * 8, None).await })
                .map_err(|e| format!("GPU chain init failed for video analysis: {e}"))?;

            chain.upload_topology(&topology_profile.parents, &topology_profile.rest_lengths);
            chain
        };

        // ── Frame extraction via ffmpeg CLI ─────────────────────────────────
        // Strategy: pipe raw RGB24 frames from ffmpeg stdout. No temp files,
        // no disk I/O, no intermediate JPEG encode/decode.
        //
        // ffmpeg -i <input> -vf <fps_filter> -f rawvideo -pix_fmt rgb24
        //        -vframes <max> pipe:1
        //
        // Frame size = width × height × 3 bytes (determined from probe first).
        let (frame_w, frame_h, total_frames, video_fps) =
            Self::probe_video(video_path)?;

        let effective_fps = video_fps / config.frame_step.max(1) as f64;
        let emit = |frame: u64, phase: &str, fps_actual: f32| {
            if let Some(tx) = &progress_tx {
                tx.send(VideoAnalysisProgress {
                    frame,
                    total: total_frames,
                    fps_actual,
                    phase: phase.to_string(),
                }).ok();
            }
        };
        let emit_frame = |frame: JointFrame| {
            if let Some(tx) = &frame_tx {
                tx.send(frame).ok();
            }
        };
        let emit_raw_frame = |frame: JointFrame| {
            if let Some(tx) = &raw_frame_tx {
                tx.send(frame).ok();
            }
        };

        // Use passthrough timing to avoid ffmpeg FPS interpolation loops.
        // frame_step == 1: decode native frames as-is.
        // frame_step > 1: drop frames with select() only, no fps() stage.
        let mut ffmpeg_args: Vec<String> = vec![
            "-i".into(), config.video_path.clone(),
            "-an".into(),
            "-sn".into(),
            "-dn".into(),
            "-vsync".into(), "0".into(),
        ];
        if config.frame_step > 1 {
            ffmpeg_args.push("-vf".into());
            ffmpeg_args.push(format!("select='not(mod(n\\,{}))'", config.frame_step));
        }
        ffmpeg_args.extend([
            "-f".into(),
            "rawvideo".into(),
            "-pix_fmt".into(),
            "rgb24".into(),
            "pipe:1".into(),
        ]);

        let mut ffmpeg = Command::new(resolve_tool("ffmpeg"))
            .args(ffmpeg_args)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to spawn ffmpeg: {e}. Is ffmpeg in PATH?"))?;

        let frame_bytes = frame_w * frame_h * 3;
        let mut frame_buf = vec![0u8; frame_bytes];

        // ── Take accumulator ─────────────────────────────────────────────────
        let mut take = AnimationTake::new(
            config.output_fps,
            config.model_id.clone(),
            Some(TakeSource::Video { path: config.video_path.clone() }),
        );
        take.metadata.subject = config.subject.clone();
        take.metadata.tags    = config.tags.clone();

        let mut frame_seq: u64 = 0;
        let mut perf_timer    = Instant::now();
        let mut perf_count: u32 = 0;
        let mut tracker = TemporalJointTracker::new();
        emit(0, "decoding", 0.0);

        // ── Read pipe ────────────────────────────────────────────────────────
        use std::io::Read;
        let stdout = ffmpeg.stdout.take().ok_or("No ffmpeg stdout")?;
        let mut stdout = std::io::BufReader::with_capacity(frame_bytes * 4, stdout);

        loop {
            if let Some(flag) = &cancel_flag {
                if flag.load(Ordering::Relaxed) {
                    let _ = ffmpeg.kill();
                    let _ = ffmpeg.wait();
                    return Err("CANCELLED: video analysis stopped by user".into());
                }
            }
            // Read exactly one frame
            match stdout.read_exact(&mut frame_buf) {
                Ok(()) => {}
                Err(e) if e.kind() == std::io::ErrorKind::UnexpectedEof => break,
                Err(e) => return Err(format!("ffmpeg pipe read error: {e}")),
            }

            // Emit optimistic progress as soon as a frame has been decoded.
            emit(frame_seq + 1, "inference", 0.0);

            // ── Inference ───────────────────────────────────────────────────
            let raw_joints = match engine.infer(&frame_buf, frame_w as u32, frame_h as u32) {
                Ok(j) => j,
                Err(e) => {
                    log::warn!("[video-analyzer] Inference error on frame {}: {}", frame_seq, e);
                    frame_seq += 1;
                    emit(frame_seq, "inference", 0.0);
                    continue;
                }
            };
            let tracked_joints = tracker.stabilize(raw_joints.clone());
            let timestamp_s = frame_seq as f64 / effective_fps.max(1.0);
            let raw_frame = JointFrame {
                seq:          frame_seq,
                timestamp_ms: timestamp_s * 1000.0,
                joints:       raw_joints.clone(),
                skeleton:     None,
                model_id:     config.model_id.clone(),
            };
            emit_raw_frame(raw_frame);

            // GPU path (same as live): denoise -> skeleton -> physics -> supermotion -> livelink
            #[cfg(feature = "gpu-chain")]
            let joints = {
                let dt = (1.0 / effective_fps.max(1.0)) as f32;
                let time_sec = (frame_seq as f64 / effective_fps.max(1.0)) as f32;
                let rt = tokio::runtime::Handle::current();
                rt.block_on(async { gpu_chain.process_frame(&tracked_joints, dt, time_sec).await })
                    .map_err(|e| format!("GPU chain frame {} failed in video analysis: {e}", frame_seq))?
            };

            #[cfg(not(feature = "gpu-chain"))]
            let joints = tracked_joints;

            let skeleton = retargeter.retarget(&joints);

            let frame = JointFrame {
                seq:          frame_seq,
                timestamp_ms: timestamp_s * 1000.0,
                joints,
                skeleton,
                model_id:     config.model_id.clone(),
            };
            emit_frame(frame.clone());
            take.push_frame(frame);

            frame_seq  += 1;
            perf_count += 1;

            // Emit actual processing FPS every 30 frames
            if perf_count >= 30 {
                let elapsed = perf_timer.elapsed().as_secs_f32();
                let fps_actual = perf_count as f32 / elapsed.max(0.001);
                emit(frame_seq, "inference", fps_actual);
                perf_timer = Instant::now();
                perf_count = 0;
            }
        }

        ffmpeg.wait().ok();

        if take.frame_count == 0 {
            return Err("No frames were successfully analysed".into());
        }

        // ── Save take ─────────────────────────────────────────────────────
        emit(frame_seq, "saving", 0.0);

        let takes_dir = dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("ZenMocap")
            .join(TAKES_SUBDIR);
        std::fs::create_dir_all(&takes_dir)
            .map_err(|e| format!("Failed to create takes dir: {e}"))?;

        let out_path = takes_dir.join(format!("{}.{}", take.name, TAKE_EXT));
        save_take(&take, &out_path)
            .map_err(|e| format!("Failed to save take: {e}"))?;

        log::info!(
            "[video-analyzer] Saved '{}' — {} frames from {:?}",
            take.name, take.frame_count, video_path
        );

        emit(frame_seq, "done", 0.0);
        Ok(out_path)
    }

    // ─── Video probe (ffprobe) ────────────────────────────────────────────────

    fn probe_video(path: &Path) -> Result<(usize, usize, u64, f64), String> {
        // Use JSON output and parse by field name (CSV field order is not stable
        // across ffprobe builds and can swap nb_frames/r_frame_rate).
        let out = Command::new(resolve_tool("ffprobe"))
            .args([
                "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "stream=width,height,nb_frames,r_frame_rate,duration",
                "-of", "json",
                path.to_str().unwrap_or(""),
            ])
            .output()
            .map_err(|e| format!("ffprobe failed: {e}. Is ffprobe in PATH?"))?;

        let raw = String::from_utf8_lossy(&out.stdout).to_string();
        let json: serde_json::Value =
            serde_json::from_str(&raw).map_err(|e| format!("ffprobe parse error: {e}"))?;
        let stream = json
            .get("streams")
            .and_then(|v| v.as_array())
            .and_then(|arr| arr.first())
            .ok_or_else(|| "ffprobe returned no video stream".to_string())?;

        let w: usize = stream.get("width").and_then(|v| v.as_u64()).unwrap_or(1280) as usize;
        let h: usize = stream.get("height").and_then(|v| v.as_u64()).unwrap_or(720) as usize;
        let n: u64 = stream
            .get("nb_frames")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0);

        let fps = stream
            .get("r_frame_rate")
            .and_then(|v| v.as_str())
            .and_then(|s| {
                let mut f = s.trim().split('/');
                let num: f64 = f.next()?.parse().ok()?;
                let den: f64 = f.next().and_then(|d| d.parse().ok()).unwrap_or(1.0);
                Some(num / den.max(1.0))
            })
            .filter(|v| v.is_finite() && *v > 0.0)
            .unwrap_or(30.0);

        log::info!("[video-analyzer] Probe: {}×{} @{:.2}fps {} frames", w, h, fps, n);
        Ok((w, h, n, fps))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn make_joint(x: f32, y: f32, z: f32, confidence: f32) -> Joint {
        Joint { position: [x, y, z], confidence }
    }

    fn make_base_pose(center_x: f32, center_y: f32, confidence: f32) -> Vec<Joint> {
        let mut joints = vec![make_joint(center_x, center_y, 0.0, confidence); 17];
        // torso anchors
        joints[5] = make_joint(center_x - 0.05, center_y - 0.10, 0.0, confidence);
        joints[6] = make_joint(center_x + 0.05, center_y - 0.10, 0.0, confidence);
        joints[11] = make_joint(center_x - 0.04, center_y + 0.10, 0.0, confidence);
        joints[12] = make_joint(center_x + 0.04, center_y + 0.10, 0.0, confidence);
        joints
    }

    #[test]
    fn analyze_rejects_models_without_live_retarget_topology_contract() {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let temp_path = std::env::temp_dir().join(format!("zenmocap_dummy_{stamp}.mp4"));
        std::fs::write(&temp_path, b"dummy").expect("failed to create temp video placeholder");

        let cfg = VideoAnalysisConfig {
            video_path: temp_path.to_string_lossy().into_owned(),
            model_id: "rtmw3d_l".to_string(),
            ..Default::default()
        };
        let err = VideoAnalyzer::analyze(cfg, None, None, None, None)
            .expect_err("expected non-COCO model rejection");
        assert!(
            err.contains("not offline-retarget compatible")
                || err.contains("No rig topology profile is configured"),
            "expected topology compatibility error, got: {err}"
        );

        let _ = std::fs::remove_file(temp_path);
    }

    #[test]
    fn temporal_tracker_holds_previous_on_large_identity_jump() {
        let mut tracker = TemporalJointTracker::new();
        let stable = make_base_pose(0.45, 0.50, 0.9);
        let out_a = tracker.stabilize(stable.clone());

        // Simulate detector jumping to a different subject/partial body.
        let jumped = make_base_pose(0.92, 0.15, 0.25);
        let out_b = tracker.stabilize(jumped);

        // Should keep prior tracked subject, not jump.
        assert!(
            (out_b[11].position[0] - out_a[11].position[0]).abs() < 1e-5,
            "tracker should preserve previous subject center on identity jump"
        );
    }

    #[test]
    fn temporal_tracker_backfills_low_confidence_joints() {
        let mut tracker = TemporalJointTracker::new();
        let base = make_base_pose(0.50, 0.55, 0.9);
        let out_a = tracker.stabilize(base.clone());

        let mut degraded = make_base_pose(0.51, 0.56, 0.9);
        // left wrist (9) drops out hard
        degraded[9] = make_joint(0.0, 0.0, 0.0, 0.01);
        let out_b = tracker.stabilize(degraded);

        assert!(
            (out_b[9].position[0] - out_a[9].position[0]).abs() < 1e-5
                && out_b[9].confidence >= TemporalJointTracker::HISTORY_CONFIDENCE_FLOOR,
            "tracker should hold previous joint for low-confidence dropout"
        );
    }
}
