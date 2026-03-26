use bytemuck::{Pod, Zeroable};
use std::collections::HashMap;
use std::sync::Mutex;
use wgpu::util::DeviceExt;

use crate::device::GpuComputeDevice;

#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
pub struct RayHit {
    pub hit: bool,
    pub point: [f32; 3],
    pub normal: [f32; 3],
    pub uv: [f32; 2],
    pub distance: f32,
    pub triangle_id: u32,
    pub mesh_id: u32,
    pub time_ms: f64,
}

#[repr(C)]
#[derive(Copy, Clone, Debug, Pod, Zeroable)]
pub struct BvhNode {
    pub aabb_min: [f32; 3],
    pub left_or_first: u32,
    pub aabb_max: [f32; 3],
    pub right_or_count: u32,
}

impl BvhNode {
    pub fn is_leaf(&self) -> bool {
        (self.right_or_count & 0x8000_0000) != 0
    }
}

#[repr(C)]
#[derive(Copy, Clone, Debug, Pod, Zeroable)]
pub struct GpuTriangle {
    pub v0: [f32; 4],
    pub v1: [f32; 4],
    pub v2: [f32; 4],
    pub uv0_uv1: [f32; 4],
    pub uv2_pad: [f32; 4],
}

#[repr(C)]
#[derive(Copy, Clone, Debug, Pod, Zeroable)]
pub struct GpuRay {
    pub origin: [f32; 4],
    pub direction: [f32; 4],
}

#[repr(C)]
#[derive(Copy, Clone, Debug, Pod, Zeroable)]
pub struct GpuRayHit {
    pub point: [f32; 4],
    pub normal: [f32; 4],
    pub uv_mesh: [f32; 4],
}

impl Default for GpuRayHit {
    fn default() -> Self {
        Self {
            point: [0.0, 0.0, 0.0, f32::MAX],
            normal: [0.0, 0.0, 0.0, 0.0],
            uv_mesh: [0.0, 0.0, 0.0, 0.0],
        }
    }
}

pub struct GpuRaycastMesh {
    pub vertex_count: u32,
    pub triangle_count: u32,
    pub bvh_node_count: u32,
    pub triangles_buffer: wgpu::Buffer,
    pub bvh_nodes_buffer: wgpu::Buffer,
}

pub struct GpuBvhRaycast {
    pipeline: wgpu::ComputePipeline,
    bind_group_layout: wgpu::BindGroupLayout,
    ray_buffer: wgpu::Buffer,
    hit_buffer: wgpu::Buffer,
    staging_buffer: wgpu::Buffer,
}

impl GpuBvhRaycast {
    pub fn new(device: &wgpu::Device) -> Self {
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("gpu_bvh_raycast"),
            source: wgpu::ShaderSource::Wgsl(BVH_TRAVERSE_WGSL.into()),
        });

        let bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("gpu_bvh_raycast_bgl"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: true },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: false },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 2,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: true },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 3,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: true },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
            ],
        });

        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("gpu_bvh_raycast_pl"),
            bind_group_layouts: &[&bind_group_layout],
            push_constant_ranges: &[],
        });

        let pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("gpu_bvh_raycast_pipeline"),
            layout: Some(&pipeline_layout),
            module: &shader,
            entry_point: Some("main"),
            compilation_options: Default::default(),
            cache: None,
        });

        let ray_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("gpu_ray_input"),
            size: std::mem::size_of::<GpuRay>() as u64,
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        let hit_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("gpu_ray_hit"),
            size: std::mem::size_of::<GpuRayHit>() as u64,
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_SRC,
            mapped_at_creation: false,
        });

        let staging_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("gpu_ray_hit_staging"),
            size: std::mem::size_of::<GpuRayHit>() as u64,
            usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        Self {
            pipeline,
            bind_group_layout,
            ray_buffer,
            hit_buffer,
            staging_buffer,
        }
    }

    pub fn build_mesh_bvh(
        &self,
        device: &wgpu::Device,
        positions: &[f32],
        indices: &[u32],
        uvs: Option<&[f32]>,
    ) -> Result<GpuRaycastMesh, String> {
        let vertex_count = positions.len() / 3;
        let triangle_count = indices.len() / 3;
        let mut triangles = Vec::with_capacity(triangle_count);

        for i in 0..triangle_count {
            let i0 = indices[i * 3] as usize;
            let i1 = indices[i * 3 + 1] as usize;
            let i2 = indices[i * 3 + 2] as usize;

            if i0 * 3 + 2 >= positions.len()
                || i1 * 3 + 2 >= positions.len()
                || i2 * 3 + 2 >= positions.len()
            {
                log::warn!(
                    "[GPU BVH] Skipping triangle {} with out-of-bounds indices: {}, {}, {} (max={})",
                    i, i0, i1, i2, vertex_count
                );
                continue;
            }

            let v0 = [
                positions[i0 * 3],
                positions[i0 * 3 + 1],
                positions[i0 * 3 + 2],
                0.0,
            ];
            let v1 = [
                positions[i1 * 3],
                positions[i1 * 3 + 1],
                positions[i1 * 3 + 2],
                0.0,
            ];
            let v2 = [
                positions[i2 * 3],
                positions[i2 * 3 + 1],
                positions[i2 * 3 + 2],
                0.0,
            ];

            let uv0_uv1 = if let Some(uvs) = uvs {
                if i0 * 2 + 1 < uvs.len() && i1 * 2 + 1 < uvs.len() {
                    [uvs[i0 * 2], uvs[i0 * 2 + 1], uvs[i1 * 2], uvs[i1 * 2 + 1]]
                } else {
                    [0.0, 0.0, 0.0, 0.0]
                }
            } else {
                [0.0, 0.0, 0.0, 0.0]
            };

            let uv2_pad = if let Some(uvs) = uvs {
                if i2 * 2 + 1 < uvs.len() {
                    [uvs[i2 * 2], uvs[i2 * 2 + 1], 0.0, 0.0]
                } else {
                    [0.0, 0.0, 0.0, 0.0]
                }
            } else {
                [0.0, 0.0, 0.0, 0.0]
            };

            triangles.push(GpuTriangle {
                v0,
                v1,
                v2,
                uv0_uv1,
                uv2_pad,
            });
        }

        let bvh_nodes = self.build_lbvh(&triangles)?;

        let triangles_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("gpu_triangles"),
            contents: bytemuck::cast_slice(&triangles),
            usage: wgpu::BufferUsages::STORAGE,
        });

        let bvh_nodes_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("gpu_bvh_nodes"),
            contents: bytemuck::cast_slice(&bvh_nodes),
            usage: wgpu::BufferUsages::STORAGE,
        });

        Ok(GpuRaycastMesh {
            vertex_count: vertex_count as u32,
            triangle_count: triangle_count as u32,
            bvh_node_count: bvh_nodes.len() as u32,
            triangles_buffer,
            bvh_nodes_buffer,
        })
    }

    fn build_lbvh(&self, triangles: &[GpuTriangle]) -> Result<Vec<BvhNode>, String> {
        if triangles.is_empty() {
            return Err("No triangles to build BVH".into());
        }

        let mut scene_min = [f32::MAX; 3];
        let mut scene_max = [f32::MIN; 3];

        for tri in triangles {
            for v in [&tri.v0, &tri.v1, &tri.v2] {
                for i in 0..3 {
                    scene_min[i] = scene_min[i].min(v[i]);
                    scene_max[i] = scene_max[i].max(v[i]);
                }
            }
        }

        let mut morton_prims: Vec<(u32, usize)> = triangles
            .iter()
            .enumerate()
            .map(|(idx, tri)| {
                let cx = (tri.v0[0] + tri.v1[0] + tri.v2[0]) / 3.0;
                let cy = (tri.v0[1] + tri.v1[1] + tri.v2[1]) / 3.0;
                let cz = (tri.v0[2] + tri.v1[2] + tri.v2[2]) / 3.0;
                let nx = (cx - scene_min[0]) / (scene_max[0] - scene_min[0] + 1e-6);
                let ny = (cy - scene_min[1]) / (scene_max[1] - scene_min[1] + 1e-6);
                let nz = (cz - scene_min[2]) / (scene_max[2] - scene_min[2] + 1e-6);
                (Self::morton_3d(nx, ny, nz), idx)
            })
            .collect();

        morton_prims.sort_by_key(|(m, _)| *m);

        let n = triangles.len();
        let mut nodes = Vec::with_capacity(2 * n);

        for (_, prim_idx) in &morton_prims {
            let tri = &triangles[*prim_idx];
            let mut aabb_min = [f32::MAX; 3];
            let mut aabb_max = [f32::MIN; 3];
            for v in [&tri.v0, &tri.v1, &tri.v2] {
                for i in 0..3 {
                    aabb_min[i] = aabb_min[i].min(v[i]);
                    aabb_max[i] = aabb_max[i].max(v[i]);
                }
            }
            nodes.push(BvhNode {
                aabb_min,
                left_or_first: *prim_idx as u32,
                aabb_max,
                right_or_count: 0x8000_0001,
            });
        }

        if n > 1 {
            let mut level_start = 0;
            let mut level_count = n;
            while level_count > 1 {
                let next_level_count = (level_count + 1) / 2;
                for i in 0..next_level_count {
                    let left_idx = level_start + i * 2;
                    let right_idx = if i * 2 + 1 < level_count {
                        level_start + i * 2 + 1
                    } else {
                        left_idx
                    };
                    let left = &nodes[left_idx];
                    let right = &nodes[right_idx];
                    let aabb_min = [
                        left.aabb_min[0].min(right.aabb_min[0]),
                        left.aabb_min[1].min(right.aabb_min[1]),
                        left.aabb_min[2].min(right.aabb_min[2]),
                    ];
                    let aabb_max = [
                        left.aabb_max[0].max(right.aabb_max[0]),
                        left.aabb_max[1].max(right.aabb_max[1]),
                        left.aabb_max[2].max(right.aabb_max[2]),
                    ];
                    nodes.push(BvhNode {
                        aabb_min,
                        left_or_first: left_idx as u32,
                        aabb_max,
                        right_or_count: right_idx as u32,
                    });
                }
                level_start = nodes.len() - next_level_count;
                level_count = next_level_count;
            }
        }

        Ok(nodes)
    }

    fn morton_3d(x: f32, y: f32, z: f32) -> u32 {
        let x = ((x * 1023.0) as u32).min(1023);
        let y = ((y * 1023.0) as u32).min(1023);
        let z = ((z * 1023.0) as u32).min(1023);
        Self::expand_bits(x) | (Self::expand_bits(y) << 1) | (Self::expand_bits(z) << 2)
    }

    fn expand_bits(v: u32) -> u32 {
        let mut v = v;
        v = (v | (v << 16)) & 0x0300_00FF;
        v = (v | (v << 8)) & 0x0300_F00F;
        v = (v | (v << 4)) & 0x030C_30C3;
        v = (v | (v << 2)) & 0x0924_9249;
        v
    }

    pub fn raycast(
        &self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        mesh: &GpuRaycastMesh,
        origin: [f32; 3],
        direction: [f32; 3],
    ) -> Result<RayHit, String> {
        let start = std::time::Instant::now();
        let ray = GpuRay {
            origin: [origin[0], origin[1], origin[2], 0.0],
            direction: [direction[0], direction[1], direction[2], f32::MAX],
        };
        queue.write_buffer(&self.ray_buffer, 0, bytemuck::bytes_of(&ray));

        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("gpu_raycast_bg"),
            layout: &self.bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: self.ray_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: self.hit_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: mesh.bvh_nodes_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 3,
                    resource: mesh.triangles_buffer.as_entire_binding(),
                },
            ],
        });

        let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("gpu_raycast_encoder"),
        });
        {
            let mut pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("gpu_raycast_pass"),
                timestamp_writes: None,
            });
            pass.set_pipeline(&self.pipeline);
            pass.set_bind_group(0, &bind_group, &[]);
            pass.dispatch_workgroups(1, 1, 1);
        }
        encoder.copy_buffer_to_buffer(
            &self.hit_buffer,
            0,
            &self.staging_buffer,
            0,
            std::mem::size_of::<GpuRayHit>() as u64,
        );
        queue.submit(std::iter::once(encoder.finish()));

        let buffer_slice = self.staging_buffer.slice(..);
        let (tx, rx) = std::sync::mpsc::channel();
        buffer_slice.map_async(wgpu::MapMode::Read, move |result| {
            tx.send(result).unwrap();
        });
        let _ = device.poll(wgpu::PollType::Wait);
        rx.recv().unwrap().map_err(|e| format!("{e:?}"))?;

        let data = buffer_slice.get_mapped_range();
        let gpu_hit: GpuRayHit = *bytemuck::from_bytes(&data[..std::mem::size_of::<GpuRayHit>()]);
        drop(data);
        self.staging_buffer.unmap();

        Ok(RayHit {
            hit: gpu_hit.uv_mesh[3] > 0.5,
            point: [gpu_hit.point[0], gpu_hit.point[1], gpu_hit.point[2]],
            normal: [gpu_hit.normal[0], gpu_hit.normal[1], gpu_hit.normal[2]],
            uv: [gpu_hit.uv_mesh[0], gpu_hit.uv_mesh[1]],
            distance: gpu_hit.point[3],
            triangle_id: gpu_hit.normal[3] as u32,
            mesh_id: gpu_hit.uv_mesh[2] as u32,
            time_ms: start.elapsed().as_secs_f64() * 1000.0,
        })
    }
}

#[cfg(not(target_arch = "wasm32"))]
static GPU_RAYCAST: once_cell::sync::OnceCell<Mutex<Option<GpuBvhRaycast>>> =
    once_cell::sync::OnceCell::new();
#[cfg(not(target_arch = "wasm32"))]
static RAYCAST_MESHES: once_cell::sync::Lazy<Mutex<HashMap<u64, GpuRaycastMesh>>> =
    once_cell::sync::Lazy::new(|| Mutex::new(HashMap::new()));
#[cfg(not(target_arch = "wasm32"))]
static NEXT_HANDLE: once_cell::sync::Lazy<Mutex<u64>> =
    once_cell::sync::Lazy::new(|| Mutex::new(1));

#[cfg(target_arch = "wasm32")]
mod wasm_state {
    use super::*;
    use std::cell::RefCell;

    thread_local! {
        pub static GPU_RAYCAST_WASM: RefCell<Option<GpuBvhRaycast>> = RefCell::new(None);
        pub static RAYCAST_MESHES_WASM: RefCell<HashMap<u64, GpuRaycastMesh>> = RefCell::new(HashMap::new());
        pub static NEXT_HANDLE_WASM: RefCell<u64> = RefCell::new(1);
    }
}

pub fn gpu_raycast_init(
    positions: Vec<f32>,
    indices: Vec<u32>,
    uvs: Option<Vec<f32>>,
) -> Result<u64, String> {
    let gpu = GpuComputeDevice::get_or_init_blocking()?;
    let gpu_guard = gpu.lock();
    let device = &gpu_guard.device;

    #[cfg(not(target_arch = "wasm32"))]
    let mesh = {
        let raycast_cell = GPU_RAYCAST.get_or_init(|| Mutex::new(Some(GpuBvhRaycast::new(device))));
        let raycast_guard = raycast_cell.lock().unwrap();
        let raycast = raycast_guard
            .as_ref()
            .ok_or("GPU raycast not initialized")?;
        raycast.build_mesh_bvh(device, &positions, &indices, uvs.as_deref())?
    };

    #[cfg(target_arch = "wasm32")]
    let mesh = {
        use wasm_state::*;
        GPU_RAYCAST_WASM.with(|cell| {
            if cell.borrow().is_none() {
                *cell.borrow_mut() = Some(GpuBvhRaycast::new(device));
            }
        });
        GPU_RAYCAST_WASM.with(|cell| {
            let rc = cell.borrow();
            let rc_ref = rc
                .as_ref()
                .ok_or("GPU raycast not initialized".to_string())?;
            rc_ref.build_mesh_bvh(device, &positions, &indices, uvs.as_deref())
        })?
    };

    #[cfg(not(target_arch = "wasm32"))]
    let handle = {
        let mut next = NEXT_HANDLE.lock().unwrap();
        let h = *next;
        *next += 1;
        h
    };

    #[cfg(target_arch = "wasm32")]
    let handle = wasm_state::NEXT_HANDLE_WASM.with(|cell| {
        let h = *cell.borrow();
        *cell.borrow_mut() = h + 1;
        h
    });

    #[cfg(not(target_arch = "wasm32"))]
    RAYCAST_MESHES.lock().unwrap().insert(handle, mesh);

    #[cfg(target_arch = "wasm32")]
    wasm_state::RAYCAST_MESHES_WASM.with(|cell| {
        cell.borrow_mut().insert(handle, mesh);
    });

    Ok(handle)
}

pub fn gpu_raycast(handle: u64, origin: [f32; 3], direction: [f32; 3]) -> Result<RayHit, String> {
    let gpu = GpuComputeDevice::get_or_init_blocking()?;
    let gpu_guard = gpu.lock();
    let device = &gpu_guard.device;
    let queue = &gpu_guard.queue;

    #[cfg(not(target_arch = "wasm32"))]
    {
        let raycast_cell = GPU_RAYCAST.get().ok_or("GPU raycast not initialized")?;
        let raycast_guard = raycast_cell.lock().unwrap();
        let raycast = raycast_guard
            .as_ref()
            .ok_or("GPU raycast not initialized")?;
        let meshes = RAYCAST_MESHES.lock().unwrap();
        let mesh = meshes.get(&handle).ok_or("Invalid mesh handle")?;
        raycast.raycast(device, queue, mesh, origin, direction)
    }

    #[cfg(target_arch = "wasm32")]
    {
        use wasm_state::*;
        GPU_RAYCAST_WASM.with(|rc_cell| {
            let rc = rc_cell.borrow();
            let rc_ref = rc
                .as_ref()
                .ok_or("GPU raycast not initialized".to_string())?;
            RAYCAST_MESHES_WASM.with(|m_cell| {
                let m_borrow = m_cell.borrow();
                let mesh = m_borrow
                    .get(&handle)
                    .ok_or("Invalid mesh handle".to_string())?;
                rc_ref.raycast(device, queue, mesh, origin, direction)
            })
        })
    }
}

pub fn gpu_raycast_dispose(handle: u64) -> Result<(), String> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        RAYCAST_MESHES.lock().unwrap().remove(&handle);
    }

    #[cfg(target_arch = "wasm32")]
    {
        wasm_state::RAYCAST_MESHES_WASM.with(|cell| {
            cell.borrow_mut().remove(&handle);
        });
    }

    Ok(())
}

const BVH_TRAVERSE_WGSL: &str = r#"
struct Ray { origin: vec4<f32>, direction: vec4<f32>, }
struct RayHit { point: vec4<f32>, normal: vec4<f32>, uv_mesh: vec4<f32>, }
struct BvhNode { aabb_min: vec3<f32>, left_or_first: u32, aabb_max: vec3<f32>, right_or_count: u32, }
struct Triangle { v0: vec4<f32>, v1: vec4<f32>, v2: vec4<f32>, uv0_uv1: vec4<f32>, uv2_pad: vec4<f32>, }
@group(0) @binding(0) var<storage, read> rays: array<Ray>;
@group(0) @binding(1) var<storage, read_write> hits: array<RayHit>;
@group(0) @binding(2) var<storage, read> bvh_nodes: array<BvhNode>;
@group(0) @binding(3) var<storage, read> triangles: array<Triangle>;
const EPSILON: f32 = 0.000001;
const INF: f32 = 1e30;
const STACK_SIZE: u32 = 32u;
fn intersect_aabb(ray_origin: vec3<f32>, ray_dir_inv: vec3<f32>, aabb_min: vec3<f32>, aabb_max: vec3<f32>) -> f32 {
  let t1 = (aabb_min - ray_origin) * ray_dir_inv;
  let t2 = (aabb_max - ray_origin) * ray_dir_inv;
  let tmin_v = min(t1, t2);
  let tmax_v = max(t1, t2);
  let tmin = max(max(tmin_v.x, tmin_v.y), tmin_v.z);
  let tmax = min(min(tmax_v.x, tmax_v.y), tmax_v.z);
  if (tmax >= tmin && tmax > 0.0) { return max(tmin, 0.0); }
  return INF;
}
var<private> g_bary_u: f32;
var<private> g_bary_v: f32;
fn intersect_triangle(ray_origin: vec3<f32>, ray_dir: vec3<f32>, tri: Triangle) -> vec4<f32> {
  let v0 = tri.v0.xyz;
  let v1 = tri.v1.xyz;
  let v2 = tri.v2.xyz;
  let edge1 = v1 - v0;
  let edge2 = v2 - v0;
  let h = cross(ray_dir, edge2);
  let a = dot(edge1, h);
  if (abs(a) < EPSILON) { return vec4<f32>(0.0, 0.0, 0.0, -1.0); }
  let f = 1.0 / a;
  let s = ray_origin - v0;
  let u = f * dot(s, h);
  if (u < 0.0 || u > 1.0) { return vec4<f32>(0.0, 0.0, 0.0, -1.0); }
  let q = cross(s, edge1);
  let v = f * dot(ray_dir, q);
  if (v < 0.0 || u + v > 1.0) { return vec4<f32>(0.0, 0.0, 0.0, -1.0); }
  let t = f * dot(edge2, q);
  if (t > EPSILON) {
    g_bary_u = u;
    g_bary_v = v;
    let normal = normalize(cross(edge1, edge2));
    return vec4<f32>(normal, t);
  }
  return vec4<f32>(0.0, 0.0, 0.0, -1.0);
}
@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let ray_idx = gid.x;
  let ray = rays[ray_idx];
  let ray_origin = ray.origin.xyz;
  let ray_dir = normalize(ray.direction.xyz);
  let ray_dir_inv = 1.0 / ray_dir;
  let root_idx = arrayLength(&bvh_nodes) - 1u;
  var stack: array<u32, STACK_SIZE>;
  var stack_ptr: u32 = 1u;
  stack[0] = root_idx;
  var closest_t = ray.direction.w;
  var closest_tri_id: u32 = 0u;
  var closest_normal = vec3<f32>(0.0);
  var closest_uv = vec2<f32>(0.0);
  while (stack_ptr > 0u) {
    stack_ptr -= 1u;
    let node_idx = stack[stack_ptr];
    let node = bvh_nodes[node_idx];
    let t_aabb = intersect_aabb(ray_origin, ray_dir_inv, node.aabb_min, node.aabb_max);
    if (t_aabb >= closest_t) { continue; }
    if ((node.right_or_count & 0x80000000u) != 0u) {
      let tri_idx = node.left_or_first;
      let tri = triangles[tri_idx];
      let result = intersect_triangle(ray_origin, ray_dir, tri);
      let t = result.w;
      if (t > 0.0 && t < closest_t) {
        closest_t = t;
        closest_tri_id = tri_idx;
        closest_normal = result.xyz;
        let w = 1.0 - g_bary_u - g_bary_v;
        let uv0 = tri.uv0_uv1.xy;
        let uv1 = tri.uv0_uv1.zw;
        let uv2 = tri.uv2_pad.xy;
        closest_uv = uv0 * w + uv1 * g_bary_u + uv2 * g_bary_v;
      }
    } else {
      let left_idx = node.left_or_first;
      let right_idx = node.right_or_count;
      let left_node = bvh_nodes[left_idx];
      let right_node = bvh_nodes[right_idx];
      let t_left = intersect_aabb(ray_origin, ray_dir_inv, left_node.aabb_min, left_node.aabb_max);
      let t_right = intersect_aabb(ray_origin, ray_dir_inv, right_node.aabb_min, right_node.aabb_max);
      if (t_left < t_right) {
        if (t_right < closest_t && stack_ptr < STACK_SIZE) { stack[stack_ptr] = right_idx; stack_ptr += 1u; }
        if (t_left < closest_t && stack_ptr < STACK_SIZE) { stack[stack_ptr] = left_idx; stack_ptr += 1u; }
      } else {
        if (t_left < closest_t && stack_ptr < STACK_SIZE) { stack[stack_ptr] = left_idx; stack_ptr += 1u; }
        if (t_right < closest_t && stack_ptr < STACK_SIZE) { stack[stack_ptr] = right_idx; stack_ptr += 1u; }
      }
    }
  }
  if (closest_t < INF) {
    let hit_point = ray_origin + ray_dir * closest_t;
    hits[ray_idx].point = vec4<f32>(hit_point, closest_t);
    hits[ray_idx].normal = vec4<f32>(closest_normal, f32(closest_tri_id));
    hits[ray_idx].uv_mesh = vec4<f32>(closest_uv, 0.0, 1.0);
  } else {
    hits[ray_idx].point = vec4<f32>(0.0, 0.0, 0.0, INF);
    hits[ray_idx].normal = vec4<f32>(0.0, 0.0, 0.0, 0.0);
    hits[ray_idx].uv_mesh = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  }
}
"#;
