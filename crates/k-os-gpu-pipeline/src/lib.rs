//! K_OS GPU Pipeline Manager
//!
//! Centralized GPU compute pipeline management with:
//! - Pipeline caching for efficient reuse
//! - Buffer pooling to reduce allocations
//! - Performance monitoring (GPU time, memory usage)
//! - Hot-reloading of WGSL shaders during development
//!
//! # Example
//!
//! ```no_run
//! use k_os_gpu_pipeline::{GPUPipelineManager, BufferPoolConfig};
//! use std::sync::Arc;
//!
//! # async fn example() -> Result<(), Box<dyn std::error::Error>> {
//! // Initialize wgpu device and queue
//! let instance = wgpu::Instance::default();
//! let adapter = instance.request_adapter(&wgpu::RequestAdapterOptions::default()).await.unwrap();
//! let (device, queue) = adapter.request_device(&wgpu::DeviceDescriptor::default(), None).await?;
//! let device = Arc::new(device);
//! let queue = Arc::new(queue);
//!
//! // Create pipeline manager
//! let mut manager = GPUPipelineManager::new(device, queue);
//!
//! // Get or create a pipeline
//! let pipeline = manager.get_or_create_pipeline("my_shader")?;
//!
//! // Get a buffer from the pool
//! let buffer = manager.get_buffer(1024, wgpu::BufferUsages::STORAGE)?;
//!
//! // Return buffer to pool when done
//! manager.return_buffer(buffer);
//!
//! // Get performance stats
//! let stats = manager.get_performance_stats();
//! println!("GPU Memory: {} bytes", stats.total_memory_bytes);
//! # Ok(())
//! # }
//! ```

pub mod atlas;
pub mod brush;
pub mod buffer_pool;
pub mod device;
pub mod error;
pub mod hot_reload;
pub mod mesh_bridge;
pub mod normals;
pub mod performance;
pub mod pipeline_cache;
pub mod pipelines;
pub mod raycast;
pub mod sculpt;
pub mod spatial;
pub mod spirv_loader;
pub mod staging;
pub mod svt;

pub use atlas::{
    detect_islands, gpu_atlas_dispose, gpu_atlas_init, gpu_atlas_pack, gpu_atlas_project,
    gpu_atlas_project_oneshot, pack_islands_gpu, GpuAtlasPacker, GpuAtlasProjector, Island,
};
pub use brush::{
    generate_procedural, generate_procedural_alpha, AlphaHandle, AlphaInfo, AlphaSource,
    AlphaTexture, AlphaTexturePool, ProceduralParams, ProceduralType, ALPHA_POOL,
};
pub use buffer_pool::{BufferPool, BufferPoolConfig};
pub use device::{register_gpu_error_handler, GpuComputeDevice};
pub use error::{GPUPipelineError, Result};
pub use hot_reload::ShaderHotReloader;
pub use mesh_bridge::{
    next_buffer_capacity, next_buffer_capacity_with_policy, GpuMeshBridge,
    GpuMeshBufferGrowthPolicy, GpuMeshBufferHandles, GpuMeshBufferSizing, GpuMeshUploadPlan,
    GpuMeshUploadSummary,
};
pub use normals::{GpuNormalBuffers, GpuNormalCompute, NormalParams};
pub use performance::{PerformanceMonitor, PerformanceStats};
pub use pipeline_cache::PipelineCache;
pub use raycast::{
    gpu_raycast, gpu_raycast_dispose, gpu_raycast_init, GpuBvhRaycast, GpuRaycastMesh, RayHit,
};
pub use sculpt::{
    BrushParams, GpuCandidates, GpuMeshBuffers, GpuSculptCompute, KernelFamily, SculptOp,
    SparsePositionReadback,
};
pub use spatial::GpuSpatialGrid;
pub use spirv_loader::{get_shader_count, get_shaders_by_family, SpirvShader, SPIRV_SHADERS};
pub use staging::StagingBufferPool;
pub use svt::{BlendMode, PageTableManager, PbrBrushParams, PbrChannel, SvtEngine, SvtPbrEngine};

// Centralized compatibility surface for older internal `crate::gpu::*` imports.
pub mod gpu {
    pub use crate::atlas;
    pub use crate::brush;
    pub use crate::device;
    pub use crate::pipelines;
    pub use crate::raycast;
    pub use crate::spatial;
    pub use crate::staging;
    pub use crate::svt;
    pub use crate::{GpuComputeDevice, GpuSpatialGrid, StagingBufferPool};
}

use std::sync::Arc;
use wgpu::util::DeviceExt;
use wgpu::{Buffer, BufferUsages, ComputePipeline, Device, Queue};

/// Main GPU Pipeline Manager
///
/// Provides centralized management of GPU compute pipelines with automatic
/// resource pooling, pipeline caching, and performance monitoring.
pub struct GPUPipelineManager {
    device: Arc<Device>,
    queue: Arc<Queue>,
    pipeline_cache: PipelineCache,
    buffer_pool: BufferPool,
    performance_monitor: PerformanceMonitor,
    #[cfg(debug_assertions)]
    hot_reloader: Option<ShaderHotReloader>,
}

impl GPUPipelineManager {
    /// Create a new GPU Pipeline Manager
    ///
    /// # Arguments
    ///
    /// * `device` - Shared wgpu device
    /// * `queue` - Shared wgpu queue
    pub fn new(device: Arc<Device>, queue: Arc<Queue>) -> Self {
        Self {
            device: device.clone(),
            queue,
            pipeline_cache: PipelineCache::new(device.clone()),
            buffer_pool: BufferPool::new(BufferPoolConfig::default()),
            performance_monitor: PerformanceMonitor::new(),
            #[cfg(debug_assertions)]
            hot_reloader: None,
        }
    }

    /// Create a new GPU Pipeline Manager with custom buffer pool configuration
    pub fn with_config(
        device: Arc<Device>,
        queue: Arc<Queue>,
        buffer_config: BufferPoolConfig,
    ) -> Self {
        Self {
            device: device.clone(),
            queue,
            pipeline_cache: PipelineCache::new(device.clone()),
            buffer_pool: BufferPool::new(buffer_config),
            performance_monitor: PerformanceMonitor::new(),
            #[cfg(debug_assertions)]
            hot_reloader: None,
        }
    }

    /// Enable shader hot-reloading for development
    ///
    /// Only available in debug builds. Watches shader files and automatically
    /// recompiles pipelines when they change.
    #[cfg(debug_assertions)]
    pub fn enable_hot_reload(&mut self, shader_dir: impl Into<std::path::PathBuf>) -> Result<()> {
        let hot_reloader = ShaderHotReloader::new(shader_dir.into())?;
        self.hot_reloader = Some(hot_reloader);
        Ok(())
    }

    /// Get or create a compute pipeline by shader name
    ///
    /// If the pipeline is already cached, returns the cached version.
    /// Otherwise, compiles the shader and caches the result.
    ///
    /// # Arguments
    ///
    /// * `shader_name` - Name of the shader file (without extension)
    ///
    /// # Returns
    ///
    /// Reference to the cached compute pipeline
    pub fn get_or_create_pipeline(&mut self, shader_name: &str) -> Result<&ComputePipeline> {
        // Check if hot-reloader has updates
        #[cfg(debug_assertions)]
        if let Some(ref mut reloader) = self.hot_reloader {
            if reloader.check_for_updates(shader_name)? {
                log::info!("Hot-reloading shader: {}", shader_name);
                self.pipeline_cache.invalidate(shader_name);
            }
        }

        self.pipeline_cache.get_or_create(shader_name)
    }

    /// Execute a compute shader
    ///
    /// # Arguments
    ///
    /// * `pipeline` - The compute pipeline to execute
    /// * `workgroups` - Number of workgroups in (x, y, z) dimensions
    pub fn execute_compute(
        &self,
        pipeline: &ComputePipeline,
        workgroups: (u32, u32, u32),
    ) -> Result<()> {
        let mut encoder = self
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("GPU Pipeline Compute Encoder"),
            });

        {
            let mut compute_pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("GPU Pipeline Compute Pass"),
                timestamp_writes: None,
            });

            compute_pass.set_pipeline(pipeline);
            compute_pass.dispatch_workgroups(workgroups.0, workgroups.1, workgroups.2);
        }

        self.queue.submit(Some(encoder.finish()));

        Ok(())
    }

    /// Upload raw bytes into an existing GPU buffer.
    ///
    /// This is the sanctioned bridge write path used by evaluator-derived upload plans.
    pub fn upload_bytes(&self, buffer: &Buffer, offset: u64, data: &[u8]) -> Result<()> {
        if data.is_empty() {
            return Ok(());
        }

        self.queue.write_buffer(buffer, offset, data);
        Ok(())
    }

    /// Upload raw bytes into an existing GPU buffer through an explicit staging buffer copy.
    pub fn upload_bytes_with_staging(
        &self,
        buffer: &Buffer,
        offset: u64,
        data: &[u8],
    ) -> Result<()> {
        if data.is_empty() {
            return Ok(());
        }

        let staging = self
            .device
            .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("gpu-upload-staging"),
                contents: data,
                usage: BufferUsages::COPY_SRC,
            });

        let mut encoder = self
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("gpu-upload-staging-encoder"),
            });
        encoder.copy_buffer_to_buffer(&staging, 0, buffer, offset, data.len() as u64);
        self.queue.submit(Some(encoder.finish()));
        Ok(())
    }

    /// Get a buffer from the pool
    ///
    /// Returns an available buffer of at least the requested size, or creates
    /// a new one if none are available.
    ///
    /// # Arguments
    ///
    /// * `size` - Minimum size in bytes
    /// * `usage` - Buffer usage flags
    pub fn get_buffer(&mut self, size: u64, usage: BufferUsages) -> Result<Buffer> {
        let buffer = self.buffer_pool.get_buffer(&self.device, size, usage)?;
        self.performance_monitor.record_buffer_allocation(size);
        Ok(buffer)
    }

    /// Return a buffer to the pool for reuse
    ///
    /// # Arguments
    ///
    /// * `buffer` - Buffer to return to the pool
    pub fn return_buffer(&mut self, buffer: Buffer) {
        let size = buffer.size();
        self.buffer_pool.return_buffer(buffer);
        self.performance_monitor.record_buffer_deallocation(size);
    }

    /// Get current performance statistics
    pub fn get_performance_stats(&self) -> PerformanceStats {
        self.performance_monitor.get_stats()
    }

    /// Clear all cached pipelines
    ///
    /// Useful for forcing recompilation of all shaders
    pub fn clear_pipeline_cache(&mut self) {
        self.pipeline_cache.clear();
    }

    /// Clear the buffer pool
    ///
    /// Releases all pooled buffers. They will be recreated as needed.
    pub fn clear_buffer_pool(&mut self) {
        self.buffer_pool.clear();
    }

    /// Get the number of cached pipelines
    pub fn cached_pipeline_count(&self) -> usize {
        self.pipeline_cache.len()
    }

    /// Get the number of pooled buffers
    pub fn pooled_buffer_count(&self) -> usize {
        self.buffer_pool.len()
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_manager_creation() {
        // This test requires async runtime and GPU access
        // Actual tests are in integration tests
    }
}
