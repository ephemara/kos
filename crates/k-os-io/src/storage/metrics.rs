//! Performance metrics for storage operations

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

/// Storage performance metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageMetrics {
    /// Operation latency statistics
    pub operation_latency: LatencyStats,

    /// Throughput statistics
    pub throughput: ThroughputStats,

    /// Cache hit rate (0.0 to 1.0)
    pub cache_hit_rate: f64,

    /// Storage utilization per backend
    pub storage_utilization: Vec<BackendUtilization>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatencyStats {
    pub min_ms: f64,
    pub max_ms: f64,
    pub avg_ms: f64,
    pub p95_ms: f64,
    pub p99_ms: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThroughputStats {
    pub ops_per_second: f64,
    pub bytes_per_second: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackendUtilization {
    pub backend_name: String,
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub item_count: u64,
}

impl Default for StorageMetrics {
    fn default() -> Self {
        Self {
            operation_latency: LatencyStats {
                min_ms: 0.0,
                max_ms: 0.0,
                avg_ms: 0.0,
                p95_ms: 0.0,
                p99_ms: 0.0,
            },
            throughput: ThroughputStats {
                ops_per_second: 0.0,
                bytes_per_second: 0.0,
            },
            cache_hit_rate: 0.0,
            storage_utilization: vec![],
        }
    }
}

/// Internal metrics collector
pub struct MetricsCollector {
    total_ops: Arc<AtomicU64>,
    cache_hits: Arc<AtomicU64>,
    cache_misses: Arc<AtomicU64>,
}

impl MetricsCollector {
    pub fn new() -> Self {
        Self {
            total_ops: Arc::new(AtomicU64::new(0)),
            cache_hits: Arc::new(AtomicU64::new(0)),
            cache_misses: Arc::new(AtomicU64::new(0)),
        }
    }

    pub fn record_operation(&self) {
        self.total_ops.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_cache_hit(&self) {
        self.cache_hits.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_cache_miss(&self) {
        self.cache_misses.fetch_add(1, Ordering::Relaxed);
    }

    pub fn get_cache_hit_rate(&self) -> f64 {
        let hits = self.cache_hits.load(Ordering::Relaxed) as f64;
        let misses = self.cache_misses.load(Ordering::Relaxed) as f64;
        let total = hits + misses;
        if total > 0.0 {
            hits / total
        } else {
            0.0
        }
    }
}

impl Default for MetricsCollector {
    fn default() -> Self {
        Self::new()
    }
}
