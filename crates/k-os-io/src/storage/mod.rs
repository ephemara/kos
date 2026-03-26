//! OptiMatrix Storage System
//!
//! GPU-accelerated, matrix-based storage system for K_OS providing sub-millisecond
//! asset access through intelligent caching and content-addressable deduplication.
//!
//! # Architecture
//!
//! - **Storage Engine**: Core orchestration of all storage operations
//! - **Matrix Database**: Multi-dimensional asset indexing and queries
//! - **Entanglement Layer**: Content-addressable storage with deduplication
//! - **Version Manager**: Asset versioning with delta compression
//! - **Cache Manager**: Multi-tier caching (GPU → RAM → Disk)
//! - **Transaction Manager**: ACID guarantees with write-ahead logging
//! - **GPU Compression**: wgpu compute pipelines for compression/decompression
//!
//! # Performance Targets
//!
//! - <1ms retrieval from Flux Cache (GPU)
//! - <10ms store latency for assets <100MB
//! - <50ms cold retrieval from disk
//! - >500 MB/s compression throughput
//! - >80% cache hit rate
//!
//! # Example Usage
//!
//! ```rust,no_run
//! use k_os_io::storage::{StorageEngine, StorageConfig, Asset};
//!
//! # async fn example() -> anyhow::Result<()> {
//! // Initialize storage engine
//! let config = StorageConfig::default();
//! let gpu = todo!(); // GpuComputeDevice
//! let engine = StorageEngine::new(config, gpu).await?;
//!
//! // Store an asset
//! let asset = Asset::Mesh(todo!());
//! let handle = engine.store(asset).await?;
//!
//! // Retrieve an asset
//! let retrieved = engine.retrieve(handle).await?;
//!
//! // Query assets
//! let query = AssetQuery::default()
//!     .with_type("Mesh")
//!     .with_project("my-project");
//! let results = engine.query(query).await?;
//! # Ok(())
//! # }
//! ```

// Core types and handles
pub mod types;

// Storage engine core
pub mod engine;

// Matrix database for structured asset organization
pub mod matrix_db;

// Content-addressable storage (quantum entanglement)
pub mod entanglement;

// Asset versioning with delta compression
pub mod version;

// Multi-tier caching (Flux Cache + Memory Cache)
pub mod cache;

// GPU compression pipelines
pub mod compression;

// Transaction management with ACID guarantees
pub mod transaction;

// Import/export for standard formats
pub mod import_export;

// Storage backends (RocksDB, Memory, Remote)
pub mod backends;

// Configuration and registry
pub mod config;

// Performance metrics
pub mod metrics;

// Test utilities
#[cfg(test)]
mod tests;

// Re-export public API
pub use backends::StorageBackend;
pub use cache::{CacheManager, CachePriority, FluxCache};
pub use config::{StorageConfig, StorageRegistry};
pub use engine::StorageEngine;
pub use matrix_db::{AssetQuery, MatrixDatabase};
pub use metrics::StorageMetrics;
pub use transaction::{Transaction, TransactionManager};
pub use types::{
    AnimationAsset, Asset, AssetHandle, AssetMetadata, AssetType, MaterialAsset, MeshAsset,
    SceneGraphAsset, TextureAsset,
};

/// Result type for storage operations
pub type Result<T> = std::result::Result<T, StorageError>;

/// Error types for storage operations
#[derive(Debug, thiserror::Error)]
pub enum StorageError {
    #[error("Asset not found: {0}")]
    AssetNotFound(AssetHandle),

    #[error("Invalid asset type: {0}")]
    InvalidAssetType(String),

    #[error("Serialization error: {0}")]
    Serialization(#[from] bincode::Error),

    #[error("Backend error: {0}")]
    Backend(String),

    #[error("Compression error: {0}")]
    Compression(String),

    #[error("Transaction error: {0}")]
    Transaction(String),

    #[error("Cache error: {0}")]
    Cache(String),

    #[error("Version error: {0}")]
    Version(String),

    #[error("Import/export error: {0}")]
    ImportExport(String),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Other error: {0}")]
    Other(#[from] anyhow::Error),
}
