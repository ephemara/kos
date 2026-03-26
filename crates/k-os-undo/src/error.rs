//! Error types for the undo/redo system

use thiserror::Error;

/// Result type for undo/redo operations
pub type Result<T> = std::result::Result<T, UndoError>;

/// Errors that can occur during undo/redo operations
#[derive(Error, Debug)]
pub enum UndoError {
    /// Action execution failed
    #[error("Failed to execute action: {0}")]
    ExecutionFailed(String),

    /// Action undo failed
    #[error("Failed to undo action: {0}")]
    UndoFailed(String),

    /// Action redo failed
    #[error("Failed to redo action: {0}")]
    RedoFailed(String),

    /// No actions available to undo
    #[error("No actions available to undo")]
    NothingToUndo,

    /// No actions available to redo
    #[error("No actions available to redo")]
    NothingToRedo,

    /// Memory limit exceeded
    #[error("Memory limit exceeded: current {current} bytes, max {max} bytes")]
    MemoryLimitExceeded { current: usize, max: usize },

    /// Compression failed
    #[error("Failed to compress action data: {0}")]
    CompressionFailed(String),

    /// Decompression failed
    #[error("Failed to decompress action data: {0}")]
    DecompressionFailed(String),

    /// Serialization failed
    #[error("Failed to serialize action: {0}")]
    SerializationFailed(String),

    /// Deserialization failed
    #[error("Failed to deserialize action: {0}")]
    DeserializationFailed(String),

    /// Generic error
    #[error("{0}")]
    Other(String),
}
