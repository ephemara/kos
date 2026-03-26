//! Sparse Virtual Texturing Engine (SVT)
//!
//! GPU-accelerated virtual texturing for 16K+ texture painting
//! Uses 128px tiles with LRU eviction to fit in 4K VRAM cache
//!
//! Handle-based API:
//!   svt_init     -> handle
//!   svt_stroke   -> small params only
//!   svt_read_tile -> binary bytes
//!   svt_export   -> base64 PNG
//!   svt_dispose  -> cleanup
//!
//! PBR API (multi-channel):
//!   svt_pbr_init    -> handle (creates 5 channels)
//!   svt_pbr_stroke  -> paint to multiple channels at once
//!   svt_pbr_export  -> export all channels

#[cfg(not(target_arch = "wasm32"))]
pub mod commands;
pub mod engine;
pub mod manager;
#[cfg(not(target_arch = "wasm32"))]
pub mod pbr_commands;
pub mod pbr_engine;

#[cfg(not(target_arch = "wasm32"))]
pub use commands::{svt_dispose, svt_export, svt_init, svt_read_tile, svt_stats, svt_stroke};
pub use engine::SvtEngine;
pub use manager::{PageTableManager, PageUpdate};
#[cfg(not(target_arch = "wasm32"))]
pub use pbr_commands::*;
pub use pbr_engine::{BlendMode, PbrBrushParams, PbrChannel, SvtPbrEngine};
