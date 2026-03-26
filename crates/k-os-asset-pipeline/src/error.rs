//! Error types for the asset pipeline

use std::path::PathBuf;
use thiserror::Error;

/// Result type for asset pipeline operations
pub type Result<T> = std::result::Result<T, AssetError>;

/// Errors that can occur during asset pipeline operations
#[derive(Error, Debug)]
pub enum AssetError {
    #[error("Unsupported file format: {extension}. Supported formats: {supported}")]
    UnsupportedFormat {
        extension: String,
        supported: String,
    },

    #[error("Failed to import asset from {path}: {source}")]
    ImportFailed {
        path: PathBuf,
        source: anyhow::Error,
    },

    #[error("Failed to export asset to {path}: {source}")]
    ExportFailed {
        path: PathBuf,
        source: anyhow::Error,
    },

    #[error("Failed to process asset: {0}")]
    ProcessingFailed(String),

    #[error("Failed to generate thumbnail: {0}")]
    ThumbnailFailed(String),

    #[error("Failed to extract metadata: {0}")]
    MetadataFailed(String),

    #[error("Cache error: {0}")]
    CacheError(String),

    #[error("File not found: {0}")]
    FileNotFound(PathBuf),

    #[error("Invalid asset data: {0}")]
    InvalidAsset(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Image processing error: {0}")]
    ImageError(#[from] image::ImageError),

    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),
}
