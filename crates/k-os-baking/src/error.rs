//! Error types for the K_OS baking system

use thiserror::Error;

/// Result type for baking operations
pub type Result<T> = std::result::Result<T, BakingError>;

/// Errors that can occur during texture baking operations
#[derive(Error, Debug)]
pub enum BakingError {
    /// GPU device or queue error
    #[error("GPU error: {0}")]
    GpuError(String),

    /// Shader compilation or execution error
    #[error("Shader error: {0}")]
    ShaderError(String),

    /// Invalid mesh data
    #[error("Invalid mesh: {0}")]
    InvalidMesh(String),

    /// Invalid bake settings
    #[error("Invalid settings: {0}")]
    InvalidSettings(String),

    /// Ray tracing error
    #[error("Ray tracing error: {0}")]
    RayTracingError(String),

    /// BVH construction error
    #[error("BVH construction error: {0}")]
    BvhError(String),

    /// Image processing error
    #[error("Image error: {0}")]
    ImageError(#[from] image::ImageError),

    /// Buffer size mismatch
    #[error("Buffer size mismatch: expected {expected}, got {actual}")]
    BufferSizeMismatch { expected: usize, actual: usize },

    /// Unsupported operation
    #[error("Unsupported operation: {0}")]
    Unsupported(String),

    /// IO error
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    /// Generic error
    #[error("{0}")]
    Other(String),
}

impl From<wgpu::Error> for BakingError {
    fn from(err: wgpu::Error) -> Self {
        BakingError::GpuError(err.to_string())
    }
}

impl From<String> for BakingError {
    fn from(s: String) -> Self {
        BakingError::Other(s)
    }
}

impl From<&str> for BakingError {
    fn from(s: &str) -> Self {
        BakingError::Other(s.to_string())
    }
}
