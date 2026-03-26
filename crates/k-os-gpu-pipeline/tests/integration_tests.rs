//! Integration tests for k-os-gpu-pipeline
//!
//! These tests require GPU access and may be skipped in CI environments.

use k_os_gpu_pipeline::{BufferPoolConfig, GPUPipelineManager, PerformanceMonitor};
use std::sync::Arc;
use wgpu::{BufferUsages, Device, Instance, Queue};

/// Helper to create a GPU device and queue for testing
async fn create_test_device() -> Option<(Arc<Device>, Arc<Queue>)> {
    let instance = Instance::default();
    let adapter = instance
        .request_adapter(&wgpu::RequestAdapterOptions {
            power_preference: wgpu::PowerPreference::HighPerformance,
            force_fallback_adapter: false,
            compatible_surface: None,
        })
        .await
        .ok()?;

    let (device, queue) = adapter
        .request_device(&wgpu::DeviceDescriptor {
            label: Some("Test Device"),
            required_features: wgpu::Features::empty(),
            required_limits: wgpu::Limits::default(),
            memory_hints: Default::default(),
            trace: wgpu::Trace::default(),
        })
        .await
        .ok()?;

    Some((Arc::new(device), Arc::new(queue)))
}

#[test]
fn test_manager_creation() {
    pollster::block_on(async {
        if let Some((device, queue)) = create_test_device().await {
            let manager = GPUPipelineManager::new(device, queue);
            assert_eq!(manager.cached_pipeline_count(), 0);
            assert_eq!(manager.pooled_buffer_count(), 0);
        } else {
            println!("Skipping test: No GPU available");
        }
    });
}

#[test]
fn test_buffer_pool() {
    pollster::block_on(async {
        if let Some((device, queue)) = create_test_device().await {
            let mut manager = GPUPipelineManager::new(device, queue);

            // Allocate a buffer
            let buffer = manager
                .get_buffer(1024, BufferUsages::STORAGE | BufferUsages::COPY_DST)
                .expect("Failed to allocate buffer");

            assert_eq!(buffer.size(), 4096); // Rounded to bucket size

            // Return buffer to pool
            manager.return_buffer(buffer);
            assert_eq!(manager.pooled_buffer_count(), 1);

            // Get another buffer - should reuse
            let buffer2 = manager
                .get_buffer(1024, BufferUsages::STORAGE | BufferUsages::COPY_DST)
                .expect("Failed to allocate buffer");

            assert_eq!(buffer2.size(), 4096);
            assert_eq!(manager.pooled_buffer_count(), 0); // Buffer was reused
        } else {
            println!("Skipping test: No GPU available");
        }
    });
}

#[test]
fn test_buffer_pool_different_usages() {
    pollster::block_on(async {
        if let Some((device, queue)) = create_test_device().await {
            let mut manager = GPUPipelineManager::new(device, queue);

            // Allocate buffers with different usages
            let buffer1 = manager
                .get_buffer(1024, BufferUsages::STORAGE)
                .expect("Failed to allocate buffer");
            let buffer2 = manager
                .get_buffer(1024, BufferUsages::UNIFORM)
                .expect("Failed to allocate buffer");

            manager.return_buffer(buffer1);
            manager.return_buffer(buffer2);

            // Pool should have 2 buffers (different usage flags)
            assert_eq!(manager.pooled_buffer_count(), 2);

            // Get buffer with STORAGE usage - should reuse
            let buffer3 = manager
                .get_buffer(1024, BufferUsages::STORAGE)
                .expect("Failed to allocate buffer");
            assert_eq!(manager.pooled_buffer_count(), 1);

            manager.return_buffer(buffer3);
        } else {
            println!("Skipping test: No GPU available");
        }
    });
}

#[test]
fn test_buffer_pool_size_bucketing() {
    pollster::block_on(async {
        if let Some((device, queue)) = create_test_device().await {
            let mut manager = GPUPipelineManager::new(device, queue);

            // Request different sizes that should map to same bucket
            let buffer1 = manager
                .get_buffer(1024, BufferUsages::STORAGE)
                .expect("Failed to allocate buffer");
            let size1 = buffer1.size();

            manager.return_buffer(buffer1);

            let buffer2 = manager
                .get_buffer(2048, BufferUsages::STORAGE)
                .expect("Failed to allocate buffer");
            let size2 = buffer2.size();

            manager.return_buffer(buffer2);

            // Both should be rounded to bucket size (4096 by default)
            assert_eq!(size1, 4096);
            assert_eq!(size2, 4096);
        } else {
            println!("Skipping test: No GPU available");
        }
    });
}

#[test]
fn test_performance_monitoring() {
    pollster::block_on(async {
        if let Some((device, queue)) = create_test_device().await {
            let mut manager = GPUPipelineManager::new(device, queue);

            // Allocate some buffers
            let buffer1 = manager
                .get_buffer(1024, BufferUsages::STORAGE)
                .expect("Failed to allocate buffer");
            let buffer2 = manager
                .get_buffer(2048, BufferUsages::STORAGE)
                .expect("Failed to allocate buffer");

            let stats = manager.get_performance_stats();
            assert_eq!(stats.buffer_allocations, 2);
            assert!(stats.total_memory_bytes >= 3072);

            // Return buffers
            manager.return_buffer(buffer1);
            manager.return_buffer(buffer2);

            let stats = manager.get_performance_stats();
            assert_eq!(stats.buffer_deallocations, 2);
        } else {
            println!("Skipping test: No GPU available");
        }
    });
}

#[test]
fn test_buffer_pool_config() {
    pollster::block_on(async {
        if let Some((device, queue)) = create_test_device().await {
            let config = BufferPoolConfig {
                max_buffers_per_bucket: 2,
                max_pool_memory: 10 * 1024, // 10 KB
                size_bucket_granularity: 1024,
            };

            let mut manager = GPUPipelineManager::with_config(device, queue, config);

            // Allocate and return multiple buffers
            for _ in 0..5 {
                let buffer = manager
                    .get_buffer(1024, BufferUsages::STORAGE)
                    .expect("Failed to allocate buffer");
                manager.return_buffer(buffer);
            }

            // Pool should be limited by max_buffers_per_bucket
            assert!(manager.pooled_buffer_count() <= 2);
        } else {
            println!("Skipping test: No GPU available");
        }
    });
}

#[test]
fn test_buffer_pool_memory_limit() {
    pollster::block_on(async {
        if let Some((device, queue)) = create_test_device().await {
            let config = BufferPoolConfig {
                max_buffers_per_bucket: 100,
                max_pool_memory: 8192, // 8 KB limit
                size_bucket_granularity: 1024,
            };

            let mut manager = GPUPipelineManager::with_config(device, queue, config);

            // Allocate and return buffers until we hit memory limit
            let mut buffers = Vec::new();
            for _ in 0..10 {
                let buffer = manager
                    .get_buffer(1024, BufferUsages::STORAGE)
                    .expect("Failed to allocate buffer");
                buffers.push(buffer);
            }

            // Return all buffers
            for buffer in buffers {
                manager.return_buffer(buffer);
            }

            // Pool should respect memory limit
            let stats = manager.get_performance_stats();
            // Note: Some buffers may not be pooled due to memory limit
            assert!(manager.pooled_buffer_count() <= 8); // 8KB / 1KB per buffer
        } else {
            println!("Skipping test: No GPU available");
        }
    });
}

#[test]
fn test_pipeline_cache_embedded_shader() {
    pollster::block_on(async {
        if let Some((device, queue)) = create_test_device().await {
            let mut manager = GPUPipelineManager::new(device.clone(), queue);

            // Register an embedded shader
            let shader_source = r#"
                @compute @workgroup_size(64)
                fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
                    // Simple test shader
                }
            "#;

            // Access the pipeline cache directly to register shader
            // (In real usage, this would be done through the manager)
            // For now, we just verify the manager was created successfully
            assert_eq!(manager.cached_pipeline_count(), 0);
        } else {
            println!("Skipping test: No GPU available");
        }
    });
}

#[test]
fn test_clear_pipeline_cache() {
    pollster::block_on(async {
        if let Some((device, queue)) = create_test_device().await {
            let mut manager = GPUPipelineManager::new(device, queue);

            // Clear empty cache
            manager.clear_pipeline_cache();
            assert_eq!(manager.cached_pipeline_count(), 0);

            // Note: We can't easily test with actual pipelines without shader files
        } else {
            println!("Skipping test: No GPU available");
        }
    });
}

#[test]
fn test_clear_buffer_pool() {
    pollster::block_on(async {
        if let Some((device, queue)) = create_test_device().await {
            let mut manager = GPUPipelineManager::new(device, queue);

            // Allocate and return some buffers
            let buffer1 = manager
                .get_buffer(1024, BufferUsages::STORAGE)
                .expect("Failed to allocate buffer");
            let buffer2 = manager
                .get_buffer(2048, BufferUsages::STORAGE)
                .expect("Failed to allocate buffer");

            manager.return_buffer(buffer1);
            manager.return_buffer(buffer2);

            assert!(manager.pooled_buffer_count() > 0);

            // Clear the pool
            manager.clear_buffer_pool();
            assert_eq!(manager.pooled_buffer_count(), 0);
        } else {
            println!("Skipping test: No GPU available");
        }
    });
}

#[test]
fn test_performance_monitor_standalone() {
    let monitor = PerformanceMonitor::new();

    monitor.record_buffer_allocation(1024);
    monitor.record_buffer_allocation(2048);

    let stats = monitor.get_stats();
    assert_eq!(stats.buffer_allocations, 2);
    assert_eq!(stats.total_memory_bytes, 3072);
    assert_eq!(stats.peak_memory_bytes, 3072);

    monitor.record_buffer_deallocation(1024);
    let stats = monitor.get_stats();
    assert_eq!(stats.buffer_deallocations, 1);
    assert_eq!(stats.total_memory_bytes, 2048);
    assert_eq!(stats.peak_memory_bytes, 3072); // Peak doesn't decrease
}

#[test]
fn test_zero_size_buffer_error() {
    pollster::block_on(async {
        if let Some((device, queue)) = create_test_device().await {
            let mut manager = GPUPipelineManager::new(device, queue);

            // Try to allocate zero-size buffer
            let result = manager.get_buffer(0, BufferUsages::STORAGE);
            assert!(result.is_err());
        } else {
            println!("Skipping test: No GPU available");
        }
    });
}

#[test]
fn test_manager_with_custom_config() {
    pollster::block_on(async {
        if let Some((device, queue)) = create_test_device().await {
            let config = BufferPoolConfig {
                max_buffers_per_bucket: 8,
                max_pool_memory: 256 * 1024 * 1024,
                size_bucket_granularity: 2048,
            };

            let manager = GPUPipelineManager::with_config(device, queue, config);
            assert_eq!(manager.cached_pipeline_count(), 0);
            assert_eq!(manager.pooled_buffer_count(), 0);
        } else {
            println!("Skipping test: No GPU available");
        }
    });
}
