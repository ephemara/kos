//! Error types for mesh processing operations

use thiserror::Error;

/// Result type for mesh processing operations
pub type Result<T> = std::result::Result<T, MeshError>;

/// Errors that can occur during mesh processing
#[derive(Error, Debug)]
pub enum MeshError {
    #[error("Invalid mesh: {0}")]
    InvalidMesh(String),

    #[error("Empty mesh")]
    EmptyMesh,

    #[error("Invalid indices: {0}")]
    InvalidIndices(String),

    #[error("Non-manifold geometry detected: {0}")]
    NonManifold(String),

    #[error("Invalid topology: {0}")]
    InvalidTopology(String),

    #[error("Self-intersection detected")]
    SelfIntersection,

    #[error("Invalid parameter: {0}")]
    InvalidParameter(String),

    #[error("Operation failed: {0}")]
    OperationFailed(String),

    #[error("UV unwrapping failed: {0}")]
    UVUnwrapFailed(String),

    #[error("Optimization failed: {0}")]
    OptimizationFailed(String),

    #[error("Analysis failed: {0}")]
    AnalysisFailed(String),

    #[error("Subdivision failed: {0}")]
    SubdivisionFailed(String),

    #[error("Decimation failed: {0}")]
    DecimationFailed(String),

    #[error("Smoothing failed: {0}")]
    SmoothingFailed(String),

    #[error("Repair failed: {0}")]
    RepairFailed(String),

    #[error("Spatial query failed: {0}")]
    SpatialQueryFailed(String),
}
