//! Sculpt-domain brush implementations.
//!
//! This keeps sculpt-specific experimental brushes with the sculpt owner crate
//! instead of leaving them under the engine compatibility tree.

pub mod clay_strips;

pub use clay_strips::apply_clay_strips;
