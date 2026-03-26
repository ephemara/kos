//! Storage backends (RocksDB, Memory, Remote)

use crate::storage::Result;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

pub mod rocksdb;

pub use rocksdb::{BatchOperation, RocksDbBackend, RocksDbConfig};

/// Trait for pluggable storage backends
#[async_trait]
pub trait StorageBackend: Send + Sync {
    /// Store data and return location
    async fn put(&self, key: &[u8], value: &[u8]) -> Result<StorageLocation>;

    /// Retrieve data by location
    async fn get(&self, location: StorageLocation) -> Result<Vec<u8>>;

    /// Delete data at location
    async fn delete(&self, location: StorageLocation) -> Result<()>;

    /// Check if location exists
    async fn exists(&self, location: StorageLocation) -> Result<bool>;

    /// Get backend statistics
    fn stats(&self) -> BackendStats;
}

/// Storage location identifier
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct StorageLocation(pub u64);

/// Backend statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackendStats {
    pub total_size: u64,
    pub item_count: u64,
}
