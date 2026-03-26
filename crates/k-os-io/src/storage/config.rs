//! Storage configuration and registry

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Storage engine configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageConfig {
    /// Path to storage directory
    pub storage_path: PathBuf,

    /// Path to Storage_Registry JSON
    pub registry_path: PathBuf,

    /// Maximum cache size in bytes
    pub max_cache_size: u64,

    /// Maximum GPU cache size in bytes
    pub max_gpu_cache_size: u64,

    /// Enable compression
    pub enable_compression: bool,

    /// Enable entanglement (deduplication)
    pub enable_entanglement: bool,

    /// Enable versioning
    pub enable_versioning: bool,

    /// GC interval in seconds
    pub gc_interval_secs: u64,
}

impl Default for StorageConfig {
    fn default() -> Self {
        Self {
            storage_path: PathBuf::from("./storage"),
            registry_path: PathBuf::from("./storage_registry.json"),
            max_cache_size: 4 * 1024 * 1024 * 1024,     // 4GB
            max_gpu_cache_size: 2 * 1024 * 1024 * 1024, // 2GB
            enable_compression: true,
            enable_entanglement: true,
            enable_versioning: true,
            gc_interval_secs: 3600, // 1 hour
        }
    }
}

/// Storage registry defining backends and policies
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageRegistry {
    /// Available storage backends
    pub backends: Vec<BackendConfig>,

    /// Cache policies
    pub cache_policy: CachePolicy,

    /// Compression policies per asset type
    pub compression_policies: Vec<CompressionPolicy>,

    /// Entanglement policies
    pub entanglement_policy: EntanglementPolicy,

    /// Version retention policies
    pub retention_policies: Vec<RetentionPolicy>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackendConfig {
    pub name: String,
    pub backend_type: String, // "rocksdb", "memory", "remote"
    pub priority: u32,
    pub config: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachePolicy {
    pub eviction_strategy: String, // "lru", "lfu", "arc"
    pub size_limit_bytes: u64,
    pub gpu_size_limit_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompressionPolicy {
    pub asset_type: String,
    pub enabled: bool,
    pub algorithm: String, // "gpu_quantize", "zstd", "lz4"
    pub level: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntanglementPolicy {
    pub auto_dedupe: bool,
    pub min_size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetentionPolicy {
    pub asset_type: String,
    pub policy: String, // "keep_all", "keep_last_n", "keep_since", "keep_major"
    pub value: serde_json::Value,
}

impl Default for StorageRegistry {
    fn default() -> Self {
        Self {
            backends: vec![BackendConfig {
                name: "primary".to_string(),
                backend_type: "rocksdb".to_string(),
                priority: 1,
                config: serde_json::json!({
                    "path": "./storage/rocksdb"
                }),
            }],
            cache_policy: CachePolicy {
                eviction_strategy: "lru".to_string(),
                size_limit_bytes: 4 * 1024 * 1024 * 1024,
                gpu_size_limit_bytes: 2 * 1024 * 1024 * 1024,
            },
            compression_policies: vec![CompressionPolicy {
                asset_type: "Mesh".to_string(),
                enabled: true,
                algorithm: "gpu_quantize".to_string(),
                level: 1,
            }],
            entanglement_policy: EntanglementPolicy {
                auto_dedupe: true,
                min_size_bytes: 1024 * 1024, // 1MB
            },
            retention_policies: vec![RetentionPolicy {
                asset_type: "Mesh".to_string(),
                policy: "keep_last_n".to_string(),
                value: serde_json::json!(10),
            }],
        }
    }
}
