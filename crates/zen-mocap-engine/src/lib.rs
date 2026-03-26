//! zen-mocap-engine
//!
//! GPU-accelerated real-time pose inference, IK solving, and DCC broadcast pipeline.
//!
//! ## Pipeline at a glance
//!
//! ```text
//! nokhwa (camera)
//!     ↓ raw BGR frame
//! inference::pipeline (ort — CUDA/TRT EP)
//!     ↓ 17 COCO keypoints  
//! filter::one_euro (per-joint jitter suppression)
//!     ↓ smoothed joints
//! rig::retarget (k-os-rig FABRIK/two-bone IK)
//!     ↓ solved 19-bone biped Skeleton
//! dcc::broadcaster (UE5 LiveLink / OSC / JSON UDP)
//!     ↓ UDP packets
//! DCC target (UE5, Unity, Blender, Maya, C4D, Resolve)
//! ```
//!
//! ## Public surface
//!
//! The main entry point is [`session::MocapSession`].
//! Call [`session::MocapSession::start()`] from Tauri commands.
//! Events are emitted via a `tokio::sync::broadcast` channel.

#![allow(dead_code)]
#![allow(unused_imports)]

#[cfg(not(feature = "gpu-chain"))]
compile_error!("zen-mocap-engine requires feature `gpu-chain`. CPU fallback is removed.");

pub mod camera;
pub mod animator_plan;
pub mod dcc;
pub mod filter;
pub mod gpu_pipeline;
pub mod inference;
pub mod models;
pub mod rig;
pub mod session;
pub mod take;
pub mod timeline_batch;
pub mod timeline_bridge_contract;
pub mod timeline_bridge_runtime;
pub mod timeline_edit;
pub mod timeline_event;
pub mod timeline_runtime;
pub mod timeline_runtime_diagnostics_policy;
pub mod timeline_surface_contract;
pub mod types;
pub mod video_analyzer;

/// wgpu GPU compute chain — 5-pass SPIR-V dispatch.
/// Enabled when the "gpu-chain" feature is active.
#[cfg(feature = "gpu-chain")]
pub mod gpu_chain;

// KAIN-generated modules — compiled from imported C libraries.
// Gated behind `kain-generated` feature until KAIN Rust codegen
// handles all expression forms. Reference only for now.
#[cfg(feature = "kain-generated")]
pub mod generated;

pub use session::MocapSession;
pub use types::{JointFrame, PipelineEvent, PipelineStats, SessionConfig};
