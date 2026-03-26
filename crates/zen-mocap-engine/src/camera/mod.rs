//! Camera capture module — wraps nokhwa for cross-platform frame grab.
//!
//! On Windows this uses the Media Foundation (MSMF) backend.
//! Frames are pushed into a `ringbuf` SPSC ring buffer so the
//! inference loop can consume them without blocking the capture thread.

use nokhwa::{
    pixel_format::RgbFormat,
    utils::{CameraFormat, CameraIndex, FrameFormat, RequestedFormat, RequestedFormatType},
    Camera,
};
use ringbuf::{HeapProd, HeapRb};
use ringbuf::traits::{Producer, Split};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

use crate::types::CameraInfo;

// ─── CameraFrame ─────────────────────────────────────────────────────────────

/// Raw camera frame — RGB byte buffer from nokhwa.
#[derive(Clone)]
pub struct CameraFrame {
    pub data: Vec<u8>,
    pub width: u32,
    pub height: u32,
    pub timestamp_ms: f64,
}

// ─── CameraCapture ────────────────────────────────────────────────────────────

/// Owns the camera and pushes frames to a lock-free ring buffer.
pub struct CameraCapture {
    device_index: u32,
    width: u32,
    height: u32,
    fps: u32,
    running: Arc<AtomicBool>,
}

impl CameraCapture {
    pub fn new(device_index: u32, width: u32, height: u32, fps: u32) -> Self {
        Self {
            device_index,
            width,
            height,
            fps,
            running: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Enumerate all available cameras.
    /// Wrapped in `catch_unwind` — nokhwa's Windows MSMF backend can hard-fault
    /// if COM is not initialized on this thread. We return empty rather than crash.
    pub fn enumerate() -> Vec<CameraInfo> {
        let result = std::panic::catch_unwind(|| {
            nokhwa::query(nokhwa::utils::ApiBackend::Auto).unwrap_or_default()
        });
        match result {
            Ok(cameras) => cameras
                .into_iter()
                .map(|info| CameraInfo {
                    index: match info.index() {
                        CameraIndex::Index(i) => *i,
                        _ => 0,
                    },
                    name: info.human_name().to_string(),
                })
                .collect(),
            Err(e) => {
                log::warn!(
                    "[zen-mocap] nokhwa::query panicked (MSMF COM init issue): {:?}",
                    e
                );
                Vec::new()
            }
        }
    }

    /// Start the capture loop. Returns the consumer end of the ring buffer.
    pub fn start(&mut self) -> Result<ringbuf::HeapCons<CameraFrame>, String> {
        if self.running.load(Ordering::Relaxed) {
            return Err("Camera already running".into());
        }

        let fmt = RequestedFormat::new::<RgbFormat>(
            RequestedFormatType::Closest(CameraFormat::new(
                nokhwa::utils::Resolution::new(self.width, self.height),
                FrameFormat::MJPEG,
                self.fps,
            )),
        );

        let mut camera = Camera::new(CameraIndex::Index(self.device_index), fmt)
            .map_err(|e| format!("Camera open failed: {e}"))?;

        camera.open_stream().map_err(|e| format!("Stream open failed: {e}"))?;

        log::info!(
            "[zen-mocap] Camera {} opened: {}x{}@{}fps",
            self.device_index, self.width, self.height, self.fps
        );

        let rb = HeapRb::<CameraFrame>::new(8);
        let (mut producer, consumer) = rb.split();

        let width = self.width;
        let height = self.height;
        let running = self.running.clone();
        self.running.store(true, Ordering::SeqCst);

        std::thread::spawn(move || {
            while running.load(Ordering::Relaxed) {
                match camera.frame() {
                    Ok(buffer) => {
                        let now = std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_secs_f64() * 1000.0;

                        let frame = CameraFrame {
                            data: buffer.buffer().to_vec(),
                            width,
                            height,
                            timestamp_ms: now,
                        };

                        // Push — if full, drop oldest (ring buffer semantics)
                        if producer.try_push(frame).is_err() {
                            log::trace!("[zen-mocap] Frame dropped — ring buffer full");
                        }
                    }
                    Err(e) => {
                        log::warn!("[zen-mocap] Camera frame error: {e}");
                    }
                }
            }
            camera.stop_stream().ok();
            log::info!("[zen-mocap] Camera capture thread exited");
        });

        Ok(consumer)
    }

    pub fn stop(&mut self) {
        self.running.store(false, Ordering::SeqCst);
    }
}
