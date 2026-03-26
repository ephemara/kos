//! # K-OS Proto
//!
//! The **Single Source of Truth** for all communication between:
//! - **Bevy** (3D Engine)
//! - **Tauri** (Desktop Bridge)
//! - **React** (UI)
//!
//! ## Philosophy
//!
//! 1. **Define Once**: All state and messages are defined here.
//! 2. **Auto-Serialize**: `bincode` handles binary encoding (no manual bytes).
//! 3. **Auto-TypeScript**: `ts-rs` generates React types automatically.
//!
//! ## Usage
//!
//! ```rust
//! use kos_proto::{KosMessage, SculptState};
//!
//! // Send a message (auto-serialized)
//! let bytes = KosMessage::UpdateSculptState(state).to_bytes();
//!
//! // Receive a message (auto-deserialized)
//! let msg = KosMessage::from_bytes(&bytes)?;
//! ```

mod messages;
mod state;
mod transport;
pub mod krue;
#[cfg(test)]
mod ts_gen;

pub use messages::*;
pub use state::*;
pub use transport::*;
pub use krue::*;

// Re-export for convenience
pub use bincode;
pub use serde;
