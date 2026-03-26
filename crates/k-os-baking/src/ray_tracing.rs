//! GPU-accelerated ray tracing for texture baking
//!
//! This module provides GPU compute shader-based ray tracing for high-performance
//! texture baking operations.

use crate::bvh::{Bvh, RayHit};
use crate::error::{BakingError, Result};
use glam::Vec3;
use std::sync::Arc;

/// GPU ray tracer for texture baking
pub struct GpuRayTracer {
    device: Arc<wgpu::Device>,
    queue: Arc<wgpu::Queue>,
}

impl GpuRayTracer {
    /// Create a new GPU ray tracer
    pub fn new(device: Arc<wgpu::Device>, queue: Arc<wgpu::Queue>) -> Self {
        Self { device, queue }
    }

    /// Initialize GPU device and queue
    pub async fn init() -> Result<Self> {
        let instance = wgpu::Instance::new(wgpu::InstanceDescriptor {
            backends: wgpu::Backends::all(),
            ..Default::default()
        });

        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                compatible_surface: None,
                force_fallback_adapter: false,
            })
            .await
            .ok_or_else(|| BakingError::GpuError("Failed to find GPU adapter".to_string()))?;

        let (device, queue) = adapter
            .request_device(
                &wgpu::DeviceDescriptor {
                    label: Some("Baking GPU Device"),
                    required_features: wgpu::Features::empty(),
                    required_limits: wgpu::Limits::default(),
                    memory_hints: wgpu::MemoryHints::Performance,
                },
                None,
            )
            .await
            .map_err(|e| BakingError::GpuError(e.to_string()))?;

        Ok(Self {
            device: Arc::new(device),
            queue: Arc::new(queue),
        })
    }

    /// Get the GPU device
    pub fn device(&self) -> &wgpu::Device {
        &self.device
    }

    /// Get the GPU queue
    pub fn queue(&self) -> &wgpu::Queue {
        &self.queue
    }
}

/// CPU-based ray tracer (fallback)
pub struct CpuRayTracer {
    bvh: Bvh,
}

impl CpuRayTracer {
    /// Create a new CPU ray tracer from a BVH
    pub fn new(bvh: Bvh) -> Self {
        Self { bvh }
    }

    /// Cast a ray and find the closest intersection
    pub fn raycast(&self, origin: Vec3, direction: Vec3) -> Option<RayHit> {
        self.bvh.raycast(origin, direction)
    }

    /// Cast multiple rays in parallel
    pub fn raycast_batch(&self, rays: &[(Vec3, Vec3)]) -> Vec<Option<RayHit>> {
        use rayon::prelude::*;

        rays.par_iter()
            .map(|(origin, direction)| self.raycast(*origin, *direction))
            .collect()
    }

    /// Get the BVH
    pub fn bvh(&self) -> &Bvh {
        &self.bvh
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cpu_ray_tracer() {
        let vertices = vec![
            Vec3::new(-1.0, -1.0, 0.0),
            Vec3::new(1.0, -1.0, 0.0),
            Vec3::new(0.0, 1.0, 0.0),
        ];
        let indices = vec![0, 1, 2];

        let bvh = Bvh::from_mesh(&vertices, &indices).unwrap();
        let tracer = CpuRayTracer::new(bvh);

        let hit = tracer.raycast(Vec3::new(0.0, 0.0, -1.0), Vec3::new(0.0, 0.0, 1.0));
        assert!(hit.is_some());
    }

    #[test]
    fn test_raycast_batch() {
        let vertices = vec![
            Vec3::new(-1.0, -1.0, 0.0),
            Vec3::new(1.0, -1.0, 0.0),
            Vec3::new(0.0, 1.0, 0.0),
        ];
        let indices = vec![0, 1, 2];

        let bvh = Bvh::from_mesh(&vertices, &indices).unwrap();
        let tracer = CpuRayTracer::new(bvh);

        let rays = vec![
            (Vec3::new(0.0, 0.0, -1.0), Vec3::new(0.0, 0.0, 1.0)),
            (Vec3::new(10.0, 10.0, -1.0), Vec3::new(0.0, 0.0, 1.0)),
        ];

        let hits = tracer.raycast_batch(&rays);
        assert_eq!(hits.len(), 2);
        assert!(hits[0].is_some());
        assert!(hits[1].is_none());
    }
}
