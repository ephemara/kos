//! RocksDB storage backend
//!
//! High-performance persistent storage using RocksDB with:
//! - Column families for different data types
//! - Configurable compression (Zstd, LZ4, Snappy)
//! - Write-ahead logging for crash recovery
//! - Efficient key encoding schemes
//! - Statistics and monitoring

use super::{BackendStats, StorageBackend, StorageLocation};
use crate::storage::{Result, StorageError};
use async_trait::async_trait;
use rocksdb::{ColumnFamily, ColumnFamilyDescriptor, DBCompressionType, Options, WriteBatch, DB};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

/// Column family names for different data types
const CF_ASSET_DATA: &str = "asset_data";
const CF_METADATA: &str = "metadata";
const CF_CONTENT_STORE: &str = "content_store";
const CF_VERSIONS: &str = "versions";
const CF_TRANSACTIONS: &str = "transactions";
const CF_INDEX: &str = "index";

/// RocksDB backend for local disk storage
pub struct RocksDbBackend {
    db: Arc<DB>,
    location_counter: Arc<AtomicU64>,
    _compression: DBCompressionType,
}

impl RocksDbBackend {
    /// Create new RocksDB backend with configuration
    pub fn new(path: impl AsRef<Path>, config: RocksDbConfig) -> Result<Self> {
        let path = path.as_ref();

        // Create directory if it doesn't exist
        std::fs::create_dir_all(path).map_err(|e| {
            StorageError::Backend(format!("Failed to create RocksDB directory: {}", e))
        })?;

        // Configure RocksDB options
        let mut db_opts = Options::default();
        db_opts.create_if_missing(true);
        db_opts.create_missing_column_families(true);

        // Set compression type
        let compression = match config.compression.as_str() {
            "zstd" => DBCompressionType::Zstd,
            "lz4" => DBCompressionType::Lz4,
            "snappy" => DBCompressionType::Snappy,
            "none" => DBCompressionType::None,
            _ => DBCompressionType::Zstd, // Default to Zstd
        };
        db_opts.set_compression_type(compression);

        // Configure write buffer size (in bytes)
        let write_buffer_size = (config.write_buffer_size_mb as usize) * 1024 * 1024;
        db_opts.set_write_buffer_size(write_buffer_size);

        // Set max open files
        db_opts.set_max_open_files(config.max_open_files);

        // Enable statistics if requested
        if config.enable_statistics {
            db_opts.enable_statistics();
        }

        // Optimize for point lookups (asset retrieval)
        db_opts.optimize_for_point_lookup(64); // 64MB block cache

        // Set parallelism
        db_opts.increase_parallelism(num_cpus::get() as i32);

        // Configure column families
        let cf_opts = Options::default();
        let column_families = vec![
            ColumnFamilyDescriptor::new(CF_ASSET_DATA, cf_opts.clone()),
            ColumnFamilyDescriptor::new(CF_METADATA, cf_opts.clone()),
            ColumnFamilyDescriptor::new(CF_CONTENT_STORE, cf_opts.clone()),
            ColumnFamilyDescriptor::new(CF_VERSIONS, cf_opts.clone()),
            ColumnFamilyDescriptor::new(CF_TRANSACTIONS, cf_opts.clone()),
            ColumnFamilyDescriptor::new(CF_INDEX, cf_opts),
        ];

        // Open database with column families
        let db = DB::open_cf_descriptors(&db_opts, path, column_families)
            .map_err(|e| StorageError::Backend(format!("Failed to open RocksDB: {}", e)))?;

        Ok(Self {
            db: Arc::new(db),
            location_counter: Arc::new(AtomicU64::new(1)),
            _compression: compression,
        })
    }

    /// Get column family handle
    fn cf_handle(&self, name: &str) -> Result<&ColumnFamily> {
        self.db
            .cf_handle(name)
            .ok_or_else(|| StorageError::Backend(format!("Column family not found: {}", name)))
    }

    /// Encode key for storage location
    fn encode_key(location: StorageLocation) -> Vec<u8> {
        location.0.to_be_bytes().to_vec()
    }

    /// Decode key from bytes
    #[allow(dead_code)]
    fn decode_key(bytes: &[u8]) -> Result<StorageLocation> {
        if bytes.len() != 8 {
            return Err(StorageError::Backend(
                "Invalid key length for StorageLocation".to_string(),
            ));
        }
        let mut array = [0u8; 8];
        array.copy_from_slice(bytes);
        Ok(StorageLocation(u64::from_be_bytes(array)))
    }

    /// Generate next storage location
    fn next_location(&self) -> StorageLocation {
        StorageLocation(self.location_counter.fetch_add(1, Ordering::SeqCst))
    }

    /// Put data into specific column family
    pub async fn put_cf(
        &self,
        cf_name: &str,
        _key: &[u8],
        value: &[u8],
    ) -> Result<StorageLocation> {
        let cf = self.cf_handle(cf_name)?;
        let location = self.next_location();
        let encoded_key = Self::encode_key(location);

        self.db
            .put_cf(cf, &encoded_key, value)
            .map_err(|e| StorageError::Backend(format!("RocksDB put failed: {}", e)))?;

        Ok(location)
    }

    /// Get data from specific column family
    pub async fn get_cf(&self, cf_name: &str, location: StorageLocation) -> Result<Vec<u8>> {
        let cf = self.cf_handle(cf_name)?;
        let encoded_key = Self::encode_key(location);

        self.db
            .get_cf(cf, &encoded_key)
            .map_err(|e| StorageError::Backend(format!("RocksDB get failed: {}", e)))?
            .ok_or_else(|| {
                StorageError::Backend(format!("Key not found at location: {:?}", location))
            })
    }

    /// Delete data from specific column family
    pub async fn delete_cf(&self, cf_name: &str, location: StorageLocation) -> Result<()> {
        let cf = self.cf_handle(cf_name)?;
        let encoded_key = Self::encode_key(location);

        self.db
            .delete_cf(cf, &encoded_key)
            .map_err(|e| StorageError::Backend(format!("RocksDB delete failed: {}", e)))?;

        Ok(())
    }

    /// Check if key exists in specific column family
    pub async fn exists_cf(&self, cf_name: &str, location: StorageLocation) -> Result<bool> {
        let cf = self.cf_handle(cf_name)?;
        let encoded_key = Self::encode_key(location);

        Ok(self
            .db
            .get_cf(cf, &encoded_key)
            .map_err(|e| StorageError::Backend(format!("RocksDB exists check failed: {}", e)))?
            .is_some())
    }

    /// Perform atomic batch write
    pub async fn batch_write(&self, operations: Vec<BatchOperation>) -> Result<()> {
        let mut batch = WriteBatch::default();

        for op in operations {
            match op {
                BatchOperation::Put {
                    cf_name,
                    location,
                    value,
                } => {
                    let cf = self.cf_handle(&cf_name)?;
                    let encoded_key = Self::encode_key(location);
                    batch.put_cf(cf, &encoded_key, &value);
                }
                BatchOperation::Delete { cf_name, location } => {
                    let cf = self.cf_handle(&cf_name)?;
                    let encoded_key = Self::encode_key(location);
                    batch.delete_cf(cf, &encoded_key);
                }
            }
        }

        self.db
            .write(batch)
            .map_err(|e| StorageError::Backend(format!("RocksDB batch write failed: {}", e)))?;

        Ok(())
    }

    /// Get database statistics
    pub fn get_statistics(&self) -> Option<String> {
        self.db.property_value("rocksdb.stats").ok().flatten()
    }

    /// Compact database to reclaim space
    pub fn compact(&self) -> Result<()> {
        self.db.compact_range::<&[u8], &[u8]>(None, None);
        Ok(())
    }

    /// Flush memtable to disk
    pub fn flush(&self) -> Result<()> {
        self.db
            .flush()
            .map_err(|e| StorageError::Backend(format!("RocksDB flush failed: {}", e)))?;
        Ok(())
    }
}

#[async_trait]
impl StorageBackend for RocksDbBackend {
    async fn put(&self, key: &[u8], value: &[u8]) -> Result<StorageLocation> {
        // Default to asset_data column family
        self.put_cf(CF_ASSET_DATA, key, value).await
    }

    async fn get(&self, location: StorageLocation) -> Result<Vec<u8>> {
        // Default to asset_data column family
        self.get_cf(CF_ASSET_DATA, location).await
    }

    async fn delete(&self, location: StorageLocation) -> Result<()> {
        // Default to asset_data column family
        self.delete_cf(CF_ASSET_DATA, location).await
    }

    async fn exists(&self, location: StorageLocation) -> Result<bool> {
        // Default to asset_data column family
        self.exists_cf(CF_ASSET_DATA, location).await
    }

    fn stats(&self) -> BackendStats {
        // Get approximate sizes for all column families
        let mut total_size = 0u64;
        let mut item_count = 0u64;

        // Try to get statistics from RocksDB
        if let Some(stats_str) = self.get_statistics() {
            // Parse statistics string for size information
            // This is a simplified version - real implementation would parse the stats string
            log::debug!("RocksDB stats: {}", stats_str);
        }

        // Estimate item count by iterating (expensive, should be cached)
        for cf_name in &[
            CF_ASSET_DATA,
            CF_METADATA,
            CF_CONTENT_STORE,
            CF_VERSIONS,
            CF_TRANSACTIONS,
            CF_INDEX,
        ] {
            if let Ok(cf) = self.cf_handle(cf_name) {
                let iter = self.db.iterator_cf(cf, rocksdb::IteratorMode::Start);
                let count = iter.count() as u64;
                item_count += count;

                // Get approximate size for this CF
                if let Ok(Some(size_str)) = self
                    .db
                    .property_int_value_cf(cf, "rocksdb.estimate-live-data-size")
                {
                    total_size += size_str;
                }
            }
        }

        BackendStats {
            total_size,
            item_count,
        }
    }
}

/// Configuration for RocksDB backend
#[derive(Debug, Clone)]
pub struct RocksDbConfig {
    pub compression: String,
    pub write_buffer_size_mb: u32,
    pub max_open_files: i32,
    pub enable_statistics: bool,
}

impl Default for RocksDbConfig {
    fn default() -> Self {
        Self {
            compression: "zstd".to_string(),
            write_buffer_size_mb: 64,
            max_open_files: 1000,
            enable_statistics: true,
        }
    }
}

/// Batch operation for atomic writes
#[derive(Debug, Clone)]
pub enum BatchOperation {
    Put {
        cf_name: String,
        location: StorageLocation,
        value: Vec<u8>,
    },
    Delete {
        cf_name: String,
        location: StorageLocation,
    },
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_rocksdb_basic_operations() {
        let temp_dir = TempDir::new().unwrap();
        let config = RocksDbConfig::default();
        let backend = RocksDbBackend::new(temp_dir.path(), config).unwrap();

        // Test put
        let key = b"test_key";
        let value = b"test_value";
        let location = backend.put(key, value).await.unwrap();

        // Test exists
        assert!(backend.exists(location).await.unwrap());

        // Test get
        let retrieved = backend.get(location).await.unwrap();
        assert_eq!(retrieved, value);

        // Test delete
        backend.delete(location).await.unwrap();
        assert!(!backend.exists(location).await.unwrap());
    }

    #[tokio::test]
    async fn test_rocksdb_column_families() {
        let temp_dir = TempDir::new().unwrap();
        let config = RocksDbConfig::default();
        let backend = RocksDbBackend::new(temp_dir.path(), config).unwrap();

        // Test put in different column families
        let value = b"test_value";
        let loc1 = backend.put_cf(CF_ASSET_DATA, b"key1", value).await.unwrap();
        let loc2 = backend.put_cf(CF_METADATA, b"key2", value).await.unwrap();

        // Verify data in correct column families
        assert!(backend.exists_cf(CF_ASSET_DATA, loc1).await.unwrap());
        assert!(backend.exists_cf(CF_METADATA, loc2).await.unwrap());

        // Verify isolation between column families
        assert!(!backend.exists_cf(CF_METADATA, loc1).await.unwrap());
        assert!(!backend.exists_cf(CF_ASSET_DATA, loc2).await.unwrap());
    }

    #[tokio::test]
    async fn test_rocksdb_batch_operations() {
        let temp_dir = TempDir::new().unwrap();
        let config = RocksDbConfig::default();
        let backend = RocksDbBackend::new(temp_dir.path(), config).unwrap();

        // Create batch operations
        let loc1 = backend.next_location();
        let loc2 = backend.next_location();

        let operations = vec![
            BatchOperation::Put {
                cf_name: CF_ASSET_DATA.to_string(),
                location: loc1,
                value: b"value1".to_vec(),
            },
            BatchOperation::Put {
                cf_name: CF_ASSET_DATA.to_string(),
                location: loc2,
                value: b"value2".to_vec(),
            },
        ];

        // Execute batch
        backend.batch_write(operations).await.unwrap();

        // Verify both writes succeeded
        assert!(backend.exists(loc1).await.unwrap());
        assert!(backend.exists(loc2).await.unwrap());
    }

    #[tokio::test]
    async fn test_rocksdb_concurrent_access() {
        let temp_dir = TempDir::new().unwrap();
        let config = RocksDbConfig::default();
        let backend = Arc::new(RocksDbBackend::new(temp_dir.path(), config).unwrap());

        // Spawn multiple concurrent writes
        let mut handles = vec![];
        for i in 0..10 {
            let backend_clone = Arc::clone(&backend);
            let handle = tokio::spawn(async move {
                let key = format!("key_{}", i).into_bytes();
                let value = format!("value_{}", i).into_bytes();
                backend_clone.put(&key, &value).await
            });
            handles.push(handle);
        }

        // Wait for all writes to complete
        let locations: Vec<_> = futures::future::join_all(handles)
            .await
            .into_iter()
            .map(|r| r.unwrap().unwrap())
            .collect();

        // Verify all writes succeeded
        for location in locations {
            assert!(backend.exists(location).await.unwrap());
        }
    }

    #[tokio::test]
    async fn test_rocksdb_stats() {
        let temp_dir = TempDir::new().unwrap();
        let config = RocksDbConfig::default();
        let backend = RocksDbBackend::new(temp_dir.path(), config).unwrap();

        // Write some data
        for i in 0..100 {
            let key = format!("key_{}", i).into_bytes();
            let value = vec![0u8; 1024]; // 1KB per entry
            backend.put(&key, &value).await.unwrap();
        }

        // Get stats
        let stats = backend.stats();
        assert!(stats.item_count > 0);
        assert!(stats.total_size > 0);
    }
}
