//! External tool integrations
//!
//! This module wraps external executables for features that would be
//! too complex to implement natively (for now).

pub mod instant_meshes;

pub use instant_meshes::{
    instant_meshes_available, instant_meshes_remesh, InstantMeshesParams, InstantMeshesResult,
};
