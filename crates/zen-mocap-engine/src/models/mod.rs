//! Model manifest — parses models_manifest.toml at runtime.
//! All model metadata is data-driven. Nothing hardcoded in source.
//!
//! The manifest is embedded at compile time via `include_str!` so it
//! ships inside the binary. At first run, the actual ONNX weights are
//! downloaded and cached in the user's app data directory.

use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use once_cell::sync::Lazy;

// ─── Manifest Types ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelEntry {
    /// Internal ID — matches frontend model selector IDs
    pub id: String,
    /// Human-readable name shown in the UI
    pub name: String,
    /// Download URL (empty = must be provided by user)
    pub url: String,
    /// Expected SHA-256 hex digest (empty = skip verification)
    pub sha256: String,
    /// Local filename under the models cache dir
    pub filename: String,
    /// ONNX input tensor shape [batch, channels, height, width]
    pub input_shape: [usize; 4],
    /// Number of keypoints in the output
    pub keypoints: usize,
    /// "fp32" | "fp16"
    pub precision: String,
    /// Preprocess strategy before ONNX run.
    /// - "zero_to_one": RGB/255 only (YOLO pose exports)
    /// - "imagenet":    ImageNet mean/std normalization
    #[serde(default = "default_preprocess")]
    pub preprocess: String,
    /// Description shown in UI
    pub description: String,
}

impl ModelEntry {
    pub fn is_fp16(&self) -> bool {
        self.precision == "fp16"
    }

    pub fn input_height(&self) -> usize { self.input_shape[2] }
    pub fn input_width(&self) -> usize { self.input_shape[3] }
    pub fn input_channels(&self) -> usize { self.input_shape[1] }
}

fn default_preprocess() -> String {
    "imagenet".to_string()
}

#[derive(Debug, Deserialize)]
struct ManifestFile {
    models: Vec<ModelEntry>,
}

// ─── Embedded manifest (compile-time) ────────────────────────────────────────

/// The model manifest embedded in the binary.
/// Edit `resources/models_manifest.toml` to add or update models.
static MANIFEST_TOML: &str = include_str!("../../resources/models_manifest.toml");

/// Parsed model manifest — initialised once.
pub static MODEL_MANIFEST: Lazy<Vec<ModelEntry>> = Lazy::new(|| {
    let manifest: ManifestFile = toml::from_str(MANIFEST_TOML)
        .expect("models_manifest.toml is invalid — this is a compile-time bug");
    manifest.models
});

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/// Get a model entry by ID.
pub fn get_model(id: &str) -> Option<&'static ModelEntry> {
    MODEL_MANIFEST.iter().find(|m| m.id == id)
}

/// List all models (for the UI model selector).
pub fn list_models() -> &'static [ModelEntry] {
    &MODEL_MANIFEST
}

// ─── Cache path resolution ────────────────────────────────────────────────────

/// Returns the path where a model ONNX file should be cached locally.
/// e.g. `C:\Users\<user>\AppData\Roaming\ZenMocap\models\rtmpose_m_256x192.onnx`
pub fn model_cache_path(entry: &ModelEntry) -> PathBuf {
    let base = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("ZenMocap")
        .join("models");

    base.join(&entry.filename)
}

/// Returns true if the model ONNX file exists in the cache.
pub fn is_model_cached(entry: &ModelEntry) -> bool {
    model_cache_path(entry).exists()
}

// ─── Downloader ───────────────────────────────────────────────────────────────

pub mod downloader {
    use super::*;
    use sha2::{Digest, Sha256};
    use std::{fs, io::Read};

    const CHUNK_SIZE: usize = 256 * 1024; // 256 KiB per chunk for progress granularity
    const USER_AGENT: &str = "ZenMocap/1.0 (model-downloader; +https://github.com/zenmocap)";

    /// Download a model with real streaming progress.
    ///
    /// Progress callback receives `(bytes_downloaded, total_bytes)`.
    /// Called every `CHUNK_SIZE` bytes so the UI gets smooth progress updates.
    pub fn download_model(
        entry: &ModelEntry,
        progress: Option<&dyn Fn(u64, u64)>,
    ) -> Result<PathBuf, String> {
        let dest = model_cache_path(entry);

        // Ensure cache directory exists
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        // Already cached — verify if sha256 provided, skip otherwise
        if dest.exists() && !entry.sha256.is_empty() {
            let existing = fs::read(&dest).map_err(|e| e.to_string())?;
            if verify_sha256(&existing, &entry.sha256) {
                log::info!("[zen-mocap] Model '{}' already cached and verified", entry.id);
                return Ok(dest);
            }
            log::warn!("[zen-mocap] Cached model '{}' failed SHA-256 — re-downloading", entry.id);
        } else if dest.exists() {
            log::info!("[zen-mocap] Model '{}' cached (no sha256 to verify)", entry.id);
            return Ok(dest);
        }

        if entry.url.is_empty() {
            return Err(format!(
                "Model '{}' has no download URL. Place '{}' manually in: %APPDATA%/ZenMocap/models/",
                entry.id, entry.filename
            ));
        }

        log::info!("[zen-mocap] Downloading '{}' from {}", entry.id, entry.url);

        // Build client with proper User-Agent and redirect following
        let client = reqwest::blocking::Client::builder()
            .user_agent(USER_AGENT)
            .redirect(reqwest::redirect::Policy::limited(10))
            .timeout(std::time::Duration::from_secs(600)) // 10 min for large models
            .build()
            .map_err(|e| format!("HTTP client build error: {e}"))?;

        let mut resp = client
            .get(&entry.url)
            .send()
            .map_err(|e| format!("Download request failed: {e}"))?;

        if !resp.status().is_success() {
            return Err(format!(
                "HTTP {} for model '{}' — check URL in models_manifest.toml\nURL: {}",
                resp.status(), entry.id, entry.url
            ));
        }

        let total = resp.content_length().unwrap_or(0);
        let mut data: Vec<u8> = if total > 0 { Vec::with_capacity(total as usize) } else { Vec::new() };
        let mut downloaded: u64 = 0;
        let mut buf = vec![0u8; CHUNK_SIZE];

        // Stream in chunks — fire progress callback each chunk
        loop {
            let n = resp.read(&mut buf).map_err(|e| format!("Read error: {e}"))?;
            if n == 0 { break; }
            data.extend_from_slice(&buf[..n]);
            downloaded += n as u64;
            if let Some(cb) = progress {
                cb(downloaded, total);
            }
        }

        // Verify integrity
        if !entry.sha256.is_empty() && !verify_sha256(&data, &entry.sha256) {
            return Err(format!(
                "SHA-256 mismatch for model '{}'. Expected: {}",
                entry.id, entry.sha256
            ));
        }

        fs::write(&dest, &data).map_err(|e| e.to_string())?;
        log::info!("[zen-mocap] Model '{}' saved → {:?}", entry.id, dest);

        Ok(dest)
    }

    fn verify_sha256(data: &[u8], expected_hex: &str) -> bool {
        let mut hasher = Sha256::new();
        hasher.update(data);
        let actual = hex::encode(hasher.finalize());
        actual.eq_ignore_ascii_case(expected_hex)
    }
}
