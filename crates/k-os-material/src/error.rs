//! Error types for the material system

use thiserror::Error;
use uuid::Uuid;

/// Result type for material operations
pub type Result<T> = std::result::Result<T, MaterialError>;

/// Errors that can occur in the material system
#[derive(Error, Debug, Clone)]
pub enum MaterialError {
    /// Material not found in library
    #[error("Material not found: {0}")]
    MaterialNotFound(Uuid),

    /// Invalid material name
    #[error("Invalid material name: {0}")]
    InvalidName(String),

    /// Invalid texture path
    #[error("Invalid texture path: {0}")]
    InvalidTexturePath(String),

    /// Texture file not found
    #[error("Texture file not found: {0}")]
    TextureNotFound(String),

    /// Invalid PBR property value
    #[error("Invalid PBR property value: {0}")]
    InvalidPropertyValue(String),

    /// Serialization error
    #[error("Serialization error: {0}")]
    SerializationError(String),

    /// Deserialization error
    #[error("Deserialization error: {0}")]
    DeserializationError(String),

    /// IO error
    #[error("IO error: {0}")]
    IoError(String),

    /// Validation error
    #[error("Validation error: {0}")]
    ValidationError(String),

    /// Generic error
    #[error("{0}")]
    Other(String),
}

impl From<std::io::Error> for MaterialError {
    fn from(err: std::io::Error) -> Self {
        MaterialError::IoError(err.to_string())
    }
}

impl From<serde_json::Error> for MaterialError {
    fn from(err: serde_json::Error) -> Self {
        MaterialError::SerializationError(err.to_string())
    }
}
