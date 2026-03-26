//! KRUE - K-OS Reactive UI Engine
//!
//! The protocol types for spawning React UI from Rust.
//! All types here are serializable and have TypeScript bindings.
//!
//! ## Architecture
//!
//! ```text
//! React → UiCommand → Bevy → UiPatch → React
//! ```
//!
//! - **UiNode**: The UI tree structure
//! - **UiCommand**: User intents (React → Bevy)
//! - **UiPatch**: State changes (Bevy → React)

mod node;
mod commands;
mod patches;
mod layout;
mod focus;
mod portal;
mod async_config;
mod animation;
mod virtual_list;

pub use node::*;
pub use commands::*;
pub use patches::*;
pub use layout::*;
pub use focus::*;
pub use portal::*;
pub use async_config::*;
pub use animation::*;
pub use virtual_list::*;

/// Node ID type - usually Entity.to_bits()
pub type NodeId = u64;
