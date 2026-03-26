//! ONNX Runtime inference pipeline — ort v2.0.0-rc.11 API.
//!
//! ## Execution Provider Priority
//! 1. TensorRT EP (if `tensorrt` feature + TRT installed at runtime)
//! 2. CUDA EP (if `cuda` feature + CUDA runtime installed)
//! 3. CPU EP (always available — zero-config fallback)
//!
//! `load-dynamic` feature = ONNX Runtime DLL loaded at runtime.
//! Binary compiles on any machine regardless of CUDA SDK presence.
//!
//! ## Model Format Detection (auto-dispatch)
//! - 2 outputs  → SimCC / RTMPose (x logits + y logits)
//! - 1 output, shape [1, 56, A] → YOLO11-pose / YOLOv8-pose (detection + keypoints)
//! - 1 output, shape [1, K, H, W] → Generic heatmap

use std::path::{Path, PathBuf};
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::process::Command;

use ort::{
    execution_providers::{CPUExecutionProvider, CUDAExecutionProvider},
    session::{
        builder::GraphOptimizationLevel,
        Session,
    },
    value::Tensor,
};
use image::imageops;
use ndarray::Array4;

use crate::types::Joint;

// ─── ImageNet Normalization ────────────────────────────────────────────────────

const IMAGENET_MEAN: [f32; 3] = [0.485, 0.456, 0.406];
const IMAGENET_STD:  [f32; 3] = [0.229, 0.224, 0.225];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PreprocessMode {
    ZeroToOne,
    ImageNet,
}

impl PreprocessMode {
    fn from_config(value: &str) -> Self {
        match value.trim().to_ascii_lowercase().as_str() {
            "zero_to_one" | "zero-to-one" | "yolo" => Self::ZeroToOne,
            "imagenet" => Self::ImageNet,
            _ => Self::ImageNet,
        }
    }
}

// ─── InferenceEngine ──────────────────────────────────────────────────────────

pub struct InferenceEngine {
    session: Session,
    input_h: usize,
    input_w: usize,
    num_keypoints: usize,
    input_name: String,
    num_outputs: usize,
    preprocess_mode: PreprocessMode,
}

impl InferenceEngine {
    pub fn load(
        model_path: &Path,
        input_h: usize,
        input_w: usize,
        num_keypoints: usize,
        preprocess: &str,
    ) -> Result<Self, String> {
        log::info!("[zen-mocap] Loading ONNX model: {:?}", model_path);
        ensure_ort_dylib_path();

        let mut eps = vec![];

        #[cfg(feature = "tensorrt")]
        {
            use ort::execution_providers::TensorRTExecutionProvider;
            eps.push(TensorRTExecutionProvider::default().build());
            log::info!("[zen-mocap] TensorRT EP enabled");
        }

        #[cfg(feature = "cuda")]
        {
            eps.push(CUDAExecutionProvider::default().build());
            log::info!("[zen-mocap] CUDA EP enabled");
        }

        eps.push(CPUExecutionProvider::default().build());

        // ort may panic if an incompatible onnxruntime.dll is resolved from PATH.
        // Catch that panic and convert it into a normal error with diagnostics.
        let session = catch_unwind(AssertUnwindSafe(|| {
            Session::builder()
                .map_err(|e| format!("ORT builder: {e}"))?
                .with_execution_providers(&eps)
                .map_err(|e| format!("ORT EP: {e}"))?
                .with_optimization_level(GraphOptimizationLevel::Level3)
                .map_err(|e| format!("ORT opt: {e}"))?
                .commit_from_file(model_path)
                .map_err(|e| format!("ORT load: {e}"))
        }))
        .map_err(|_| {
            format!(
                "ONNX Runtime initialization panicked (likely DLL version mismatch). {}",
                ort_dylib_diagnostics()
            )
        })??;

        let input_name = session.inputs()
            .first()
            .map(|o| o.name().to_string())
            .ok_or("Model has no inputs")?;

        let num_outputs = session.outputs().len();

        log::info!(
            "[zen-mocap] Model ready. Input='{}', {} output(s), {}kp, preprocess='{}'",
            input_name, num_outputs, num_keypoints, preprocess
        );

        Ok(Self {
            session,
            input_h,
            input_w,
            num_keypoints,
            input_name,
            num_outputs,
            preprocess_mode: PreprocessMode::from_config(preprocess),
        })
    }

    /// Run inference on an RGB frame. Returns keypoints.
    pub fn infer(&mut self, rgb_frame: &[u8], frame_w: u32, frame_h: u32) -> Result<Vec<Joint>, String> {
        let ndarray_tensor = self.preprocess(rgb_frame, frame_w as usize, frame_h as usize)?;

        let shape: Vec<i64> = ndarray_tensor.shape().iter().map(|&d| d as i64).collect();
        let flat_data: Vec<f32> = ndarray_tensor.into_raw_vec_and_offset().0;

        let ort_tensor = Tensor::from_array((shape, flat_data))
            .map_err(|e| format!("Tensor::from_array: {e}"))?;

        let num_outputs = self.num_outputs;
        let num_keypoints = self.num_keypoints;
        let input_w = self.input_w;

        let input_name = self.input_name.clone();
        let outputs = self.session.run(
            ort::inputs![input_name.as_str() => ort_tensor]
        ).map_err(|e| format!("ORT run: {e}"))?;

        postprocess(&outputs, num_outputs, num_keypoints, input_w)
    }

    // ─── Preprocessing ────────────────────────────────────────────────────────

    fn preprocess(&self, rgb: &[u8], src_w: usize, src_h: usize) -> Result<Array4<f32>, String> {
        let img = image::RgbImage::from_raw(src_w as u32, src_h as u32, rgb.to_vec())
            .ok_or("Invalid RGB buffer")?;

        let resized = imageops::resize(
            &img,
            self.input_w as u32,
            self.input_h as u32,
            imageops::FilterType::Triangle,
        );

        let mut tensor = Array4::<f32>::zeros([1, 3, self.input_h, self.input_w]);
        for (y, row) in resized.rows().enumerate() {
            for (x, pixel) in row.enumerate() {
                let r = pixel[0] as f32 / 255.0;
                let g = pixel[1] as f32 / 255.0;
                let b = pixel[2] as f32 / 255.0;
                match self.preprocess_mode {
                    PreprocessMode::ZeroToOne => {
                        tensor[[0, 0, y, x]] = r;
                        tensor[[0, 1, y, x]] = g;
                        tensor[[0, 2, y, x]] = b;
                    }
                    PreprocessMode::ImageNet => {
                        tensor[[0, 0, y, x]] = (r - IMAGENET_MEAN[0]) / IMAGENET_STD[0];
                        tensor[[0, 1, y, x]] = (g - IMAGENET_MEAN[1]) / IMAGENET_STD[1];
                        tensor[[0, 2, y, x]] = (b - IMAGENET_MEAN[2]) / IMAGENET_STD[2];
                    }
                }
            }
        }

        Ok(tensor)
    }
}

fn ort_dylib_diagnostics() -> String {
    let mut details: Vec<String> = Vec::new();

    if let Ok(v) = std::env::var("ORT_DYLIB_PATH") {
        details.push(format!("ORT_DYLIB_PATH={v}"));
    } else {
        details.push("ORT_DYLIB_PATH not set".to_string());
    }

    if let Ok(path_var) = std::env::var("PATH") {
        let mut hits: Vec<String> = Vec::new();
        for p in std::env::split_paths(&path_var) {
            let dll = p.join("onnxruntime.dll");
            if dll.exists() {
                hits.push(dll.to_string_lossy().into_owned());
            }
            if hits.len() >= 4 {
                break;
            }
        }
        if hits.is_empty() {
            details.push("No onnxruntime.dll found directly in PATH dirs".to_string());
        } else {
            details.push(format!("PATH onnxruntime.dll candidates: {}", hits.join(" | ")));
        }
    }

    if let Ok(out) = Command::new("where").arg("onnxruntime.dll").output() {
        if out.status.success() {
            let found = String::from_utf8_lossy(&out.stdout).replace('\n', " | ").replace('\r', "");
            if !found.trim().is_empty() {
                details.push(format!("where onnxruntime.dll => {}", found.trim()));
            }
        }
    }

    details.push("Expected ONNX Runtime >= 1.23.x for ort 2.0.0-rc.11".to_string());
    details.join("; ")
}

fn ensure_ort_dylib_path() {
    if std::env::var("ORT_DYLIB_PATH").ok().is_some() {
        return;
    }
    if let Some(path) = discover_ort_dylib() {
        log::info!("[zen-mocap] ORT_DYLIB_PATH auto-set => {}", path.display());
        std::env::set_var("ORT_DYLIB_PATH", path);
    }
}

fn discover_ort_dylib() -> Option<PathBuf> {
    // 1) Adjacent to current executable (packaged app / sidecar layouts)
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let candidate = dir.join("onnxruntime.dll");
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }

    // 2) Python-installed onnxruntime (often present in dev environments)
    let py_expr = "import pathlib, onnxruntime as ort; print((pathlib.Path(ort.__file__).resolve().parent / 'capi' / 'onnxruntime.dll').as_posix())";
    let python_cmds: &[(&str, &[&str])] = &[
        ("python", &["-c", py_expr]),
        ("py", &["-3.11", "-c", py_expr]),
        ("py", &["-3.13", "-c", py_expr]),
    ];
    for (bin, args) in python_cmds {
        if let Ok(out) = Command::new(bin).args(*args).output() {
            if out.status.success() {
                let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !s.is_empty() {
                    let p = PathBuf::from(s);
                    if p.exists() {
                        return Some(p);
                    }
                }
            }
        }
    }

    // 3) PATH candidates, but never prefer stale System32 copy
    if let Ok(path_var) = std::env::var("PATH") {
        for dir in std::env::split_paths(&path_var) {
            let dll = dir.join("onnxruntime.dll");
            if dll.exists() {
                let lower = dll.to_string_lossy().to_ascii_lowercase();
                if lower.contains("\\windows\\system32\\") {
                    continue;
                }
                return Some(dll);
            }
        }
    }

    None
}

// ─── Format dispatcher ────────────────────────────────────────────────────────

fn postprocess(
    outputs: &ort::session::SessionOutputs,
    num_outputs: usize,
    num_keypoints: usize,
    input_w: usize,
) -> Result<Vec<Joint>, String> {
    if num_outputs == 2 {
        // SimCC / RTMPose: two output tensors (x logits + y logits)
        return decode_simcc(outputs, num_keypoints);
    }

    // Single-output — figure out format from tensor shape
    let arr = outputs[0].try_extract_array::<f32>()
        .map_err(|e| format!("Output tensor: {e}"))?;
    let shape: Vec<usize> = arr.shape().to_vec();
    let data: Vec<f32> = arr.iter().copied().collect();

    // YOLO11-pose / YOLOv8-pose can be exported as either:
    //   - [1, C, A] where C=4+1+K*3 and A=num_anchors
    //   - [1, A, C] same channels but transposed
    //
    // For 17kp, C == 56.
    let yolo_ch = 4 + 1 + num_keypoints * 3;
    if shape.len() == 3 && (shape[1] == yolo_ch || shape[2] == yolo_ch) {
        return decode_yolo_pose(&data, &shape, num_keypoints, input_w);
    }

    // Fallback: generic heatmap [1, K, H, W]
    decode_heatmap(&data, &shape, num_keypoints)
}

// ─── SimCC decoder (RTMPose) ──────────────────────────────────────────────────

fn decode_simcc(outputs: &ort::session::SessionOutputs, num_keypoints: usize) -> Result<Vec<Joint>, String> {
    let x_arr = outputs[0].try_extract_array::<f32>().map_err(|e| format!("SimCC x: {e}"))?;
    let y_arr = outputs[1].try_extract_array::<f32>().map_err(|e| format!("SimCC y: {e}"))?;

    let simcc_w = *x_arr.shape().last().unwrap_or(&1);
    let simcc_h = *y_arr.shape().last().unwrap_or(&1);
    let x_data: Vec<f32> = x_arr.iter().copied().collect();
    let y_data: Vec<f32> = y_arr.iter().copied().collect();
    let avail_x = if simcc_w == 0 { 0 } else { x_data.len() / simcc_w };
    let avail_y = if simcc_h == 0 { 0 } else { y_data.len() / simcc_h };
    let usable_kp = num_keypoints.min(avail_x).min(avail_y);

    let mut joints = Vec::with_capacity(num_keypoints);
    for k in 0..usable_kp {
        let xs = &x_data[k * simcc_w..(k + 1) * simcc_w];
        let ys = &y_data[k * simcc_h..(k + 1) * simcc_h];
        let (xi, xv) = argmax_f32(xs);
        let (yi, yv) = argmax_f32(ys);
        joints.push(Joint {
            position: [xi as f32 / simcc_w as f32, yi as f32 / simcc_h as f32, 0.0],
            confidence: (sigmoid(xv) + sigmoid(yv)) / 2.0,
        });
    }
    if usable_kp < num_keypoints {
        log::warn!(
            "[zen-mocap] SimCC output has fewer keypoints than requested (usable={}, requested={}). Padding missing joints.",
            usable_kp,
            num_keypoints
        );
        for _ in usable_kp..num_keypoints {
            joints.push(Joint { position: [0.0, 0.0, 0.0], confidence: 0.0 });
        }
    }
    Ok(joints)
}

// ─── YOLO11-pose / YOLOv8-pose decoder ───────────────────────────────────────
//
// Tensor layout: [1, C, A]
//   C = 4 (cx,cy,w,h) + 1 (obj_conf) + K*3 (kp_x, kp_y, kp_conf)
//   A = num_anchors (8400 for 640px input)
//
// Strategy: pick the single anchor with highest object confidence,
// return its K keypoints. This gives correct behaviour for single-person
// capture. Multi-person support can be added later via NMS.

fn decode_yolo_pose(
    data: &[f32],
    shape: &[usize],
    num_keypoints: usize,
    input_w: usize,
) -> Result<Vec<Joint>, String> {
    let channels = 4 + 1 + num_keypoints * 3;
    let layout_cxa = shape[1] == channels;
    let (num_anchors, num_channels) = if layout_cxa {
        (shape[2], shape[1])
    } else {
        (shape[1], shape[2])
    };
    let input_size = input_w as f32; // model runs at square input (640)
    let model_keypoints = num_channels.saturating_sub(5) / 3;
    let usable_kp = num_keypoints.min(model_keypoints);

    let get = |channel: usize, anchor: usize| -> f32 {
        if layout_cxa {
            // [1, C, A]
            data[channel * num_anchors + anchor]
        } else {
            // [1, A, C]
            data[anchor * num_channels + channel]
        }
    };

    let decode_conf = |v: f32| {
        if (0.0..=1.0).contains(&v) { v } else { sigmoid(v) }
    };

    // Find anchor with best full-body score.
    // Using objectness alone often selects partial detections (e.g. head-only).
    // We bias toward torso/leg confidence and plausible body box coverage.
    const TORSO_KP: &[usize] = &[5, 6, 11, 12];
    const LIMB_KP: &[usize] = &[7, 8, 9, 10, 13, 14, 15, 16];
    const VISIBLE_CONF: f32 = 0.20;
    let mut best_qualified_score = f32::NEG_INFINITY;
    let mut best_qualified_a = 0usize;
    let mut best_fallback_score = f32::NEG_INFINITY;
    let mut best_fallback_a = 0usize;
    for a in 0..num_anchors {
        let obj = decode_conf(get(4, a));
        let mut kp_sum = 0.0f32;
        let mut kp_n = 0usize;
        let mut body_visible = 0usize;
        let mut torso_visible = 0usize;
        let mut limb_visible = 0usize;
        for k in 0..usable_kp {
            let base = 5 + (k * 3);
            let c = decode_conf(get(base + 2, a));
            kp_sum += c;
            if c > VISIBLE_CONF {
                body_visible += 1;
            }
            kp_n += 1;
        }
        let kp_mean = if kp_n > 0 { kp_sum / kp_n as f32 } else { 0.0 };
        let mut torso_sum = 0.0f32;
        let mut torso_n = 0usize;
        for &k in TORSO_KP {
            if k >= usable_kp { continue; }
            let base = 5 + (k * 3);
            let c = decode_conf(get(base + 2, a));
            torso_sum += c;
            if c > VISIBLE_CONF {
                torso_visible += 1;
            }
            torso_n += 1;
        }
        let torso_mean = if torso_n > 0 { torso_sum / torso_n as f32 } else { kp_mean };

        let mut limb_sum = 0.0f32;
        let mut limb_n = 0usize;
        for &k in LIMB_KP {
            if k >= usable_kp { continue; }
            let base = 5 + (k * 3);
            let c = decode_conf(get(base + 2, a));
            limb_sum += c;
            if c > VISIBLE_CONF {
                limb_visible += 1;
            }
            limb_n += 1;
        }
        let limb_mean = if limb_n > 0 { limb_sum / limb_n as f32 } else { kp_mean };

        // BBox channels are either normalized [0..1] or pixel-space [0..input].
        let mut bw = get(2, a).abs();
        let mut bh = get(3, a).abs();
        if bw > 2.0 || bh > 2.0 {
            bw /= input_size.max(1.0);
            bh /= input_size.max(1.0);
        }
        let area = (bw * bh).clamp(0.0, 1.0);
        let coverage = if kp_n > 0 { body_visible as f32 / kp_n as f32 } else { 0.0 };

        // Primary ranking term explicitly favors complete body topology.
        // This avoids head-only anchors winning on objectness alone.
        let visibility_score =
            (torso_visible as f32) * 8.0 +
            (limb_visible as f32) * 3.0 +
            (body_visible as f32);
        let structure_score = 0.40 * kp_mean + 0.35 * torso_mean + 0.25 * limb_mean;
        let quality_score = obj
            * structure_score
            * (0.4 + 0.6 * coverage)
            * (0.6 + 0.4 * area.sqrt());
        let score = visibility_score + quality_score;
        let full_body_candidate = torso_visible >= 2 && body_visible >= 6;
        if full_body_candidate && score > best_qualified_score {
            best_qualified_score = score;
            best_qualified_a = a;
        }
        if score > best_fallback_score {
            best_fallback_score = score;
            best_fallback_a = a;
        }
    }
    let best_a = if best_qualified_score.is_finite() {
        best_qualified_a
    } else {
        best_fallback_a
    };

    // Keypoints packed from channel 5 onward: kx, ky, kconf per joint
    //
    // Export variance note:
    // - some YOLO pose exports emit kx/ky in pixels (0..input_size)
    // - others emit normalized coordinates (0..1)
    // We detect scale from the selected anchor and normalize accordingly.
    let mut max_coord = 0.0f32;
    for k in 0..usable_kp {
        let base = 5 + (k * 3);
        max_coord = max_coord.max(get(base, best_a).abs());
        max_coord = max_coord.max(get(base + 1, best_a).abs());
    }
    let coord_scale = if max_coord <= 2.0 { 1.0 } else { input_size };

    let mut joints = Vec::with_capacity(num_keypoints);
    for k in 0..usable_kp {
        let base = 5 + (k * 3);
        let kx = get(base, best_a);
        let ky = get(base + 1, best_a);
        let kc = get(base + 2, best_a);
        joints.push(Joint {
            // Normalise pixel coords to [0,1]
            position: [
                (kx / coord_scale).clamp(0.0, 1.0),
                (ky / coord_scale).clamp(0.0, 1.0),
                0.0
            ],
            confidence: decode_conf(kc),
        });
    }

    // Confidence scale from different exports can vary dramatically.
    // If very few joints survive downstream confidence gates, boost low-range
    // confidence while preserving ordering so full-body retarget can still run.
    let visible_at_base = joints.iter().filter(|j| j.confidence >= 0.08).count();
    if visible_at_base < 5 {
        let max_conf = joints
            .iter()
            .map(|j| j.confidence)
            .fold(0.0f32, |acc, v| acc.max(v));
        if max_conf > 0.0001 {
            for j in &mut joints {
                let norm = (j.confidence / max_conf).clamp(0.0, 1.0);
                let boosted = norm * 0.65;
                j.confidence = j.confidence.max(boosted).clamp(0.0, 1.0);
            }
        }
    }
    if usable_kp < num_keypoints {
        log::warn!(
            "[zen-mocap] YOLO pose output has fewer keypoints than requested (usable={}, requested={}). Padding missing joints.",
            usable_kp,
            num_keypoints
        );
        for _ in usable_kp..num_keypoints {
            joints.push(Joint { position: [0.0, 0.0, 0.0], confidence: 0.0 });
        }
    }
    Ok(joints)
}

// ─── Heatmap decoder ─────────────────────────────────────────────────────────

fn decode_heatmap(data: &[f32], shape: &[usize], num_keypoints: usize) -> Result<Vec<Joint>, String> {
    if shape.len() < 3 {
        return Err(format!("Heatmap output rank too small: {:?}", shape));
    }

    let (channel_dim, hm_h, hm_w) = if shape.len() >= 4 {
        (shape[shape.len() - 3], shape[shape.len() - 2], shape[shape.len() - 1])
    } else {
        // [K, H, W]
        (shape[0], shape[1], shape[2])
    };
    let plane = hm_h.saturating_mul(hm_w);
    if plane == 0 {
        return Err(format!("Heatmap output has invalid spatial size: {:?}", shape));
    }

    let available_planes = data.len() / plane;
    let usable_kp = num_keypoints.min(channel_dim).min(available_planes);

    let mut joints = Vec::with_capacity(num_keypoints);
    for k in 0..usable_kp {
        let start = k * plane;
        let end = start + plane;
        let slice = &data[start..end];
        let (flat, max_val) = argmax_f32(slice);
        joints.push(Joint {
            position: [(flat % hm_w) as f32 / hm_w as f32, (flat / hm_w) as f32 / hm_h as f32, 0.0],
            confidence: sigmoid(max_val),
        });
    }
    if usable_kp < num_keypoints {
        log::warn!(
            "[zen-mocap] Heatmap output has fewer channels than requested keypoints (usable={}, requested={}, shape={:?}). Padding missing joints.",
            usable_kp,
            num_keypoints,
            shape
        );
        for _ in usable_kp..num_keypoints {
            joints.push(Joint { position: [0.0, 0.0, 0.0], confidence: 0.0 });
        }
    }
    Ok(joints)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn argmax_f32(vals: &[f32]) -> (usize, f32) {
    vals.iter().enumerate()
        .fold((0, f32::NEG_INFINITY), |(bi, bv), (i, &v)| if v > bv { (i, v) } else { (bi, bv) })
}

fn sigmoid(x: f32) -> f32 {
    1.0 / (1.0 + (-x).exp())
}

#[cfg(test)]
mod tests;
