//! Multi-tier caching (Flux Cache + Memory Cache)

use crate::storage::{types::AssetHandle, Result};

/// Manages multi-tier caching strategy
pub struct CacheManager {
    // TODO: Add flux_cache and memory_cache
}

impl CacheManager {
    /// Create new cache manager
    pub fn new() -> Self {
        Self {}
    }

    /// Try to get from cache (flux -> memory -> miss)
    pub async fn get(&self, _handle: AssetHandle) -> Option<Vec<u8>> {
        todo!("Implement get")
    }

    /// Put into cache with priority hint
    pub async fn put(&self, _handle: AssetHandle, _data: Vec<u8>, _priority: CachePriority) {
        todo!("Implement put")
    }

    /// Invalidate cache entry
    pub fn invalidate(&self, _handle: AssetHandle) {
        todo!("Implement invalidate")
    }

    /// Prefetch assets into cache
    pub async fn prefetch(&self, _handles: Vec<AssetHandle>) {
        todo!("Implement prefetch")
    }
}

impl Default for CacheManager {
    fn default() -> Self {
        Self::new()
    }
}

/// GPU-resident cache using wgpu buffers
pub struct FluxCache {
    // TODO: Add wgpu device and buffer pool
}

impl FluxCache {
    /// Get asset from GPU cache (<1ms target)
    pub async fn get(&self, _handle: AssetHandle) -> Option<Vec<u8>> {
        todo!("Implement get")
    }

    /// Put asset into GPU cache
    pub async fn put(&self, _handle: AssetHandle, _data: &[u8]) -> Result<()> {
        todo!("Implement put")
    }

    /// Evict least recently used entries
    pub async fn evict_lru(&self, _target_size: u64) -> Result<()> {
        todo!("Implement evict_lru")
    }
}

#[derive(Debug, Clone, Copy)]
pub enum CachePriority {
    Critical, // Keep in Flux Cache
    High,     // Keep in memory cache
    Normal,   // Standard LRU
    Low,      // Evict first
}
