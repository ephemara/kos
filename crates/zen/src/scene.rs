use bytemuck::{Pod, Zeroable};
use glam::{Mat4, Quat, Vec3};
use k_os_scene::{MeshHandle, SceneParentComponent, SceneTransformComponent, SceneWorld};
use std::collections::{HashMap, HashSet};

#[repr(C)]
#[derive(Clone, Copy, Debug, Pod, Zeroable)]
pub struct Vertex {
    pub position: [f32; 3],
    pub color: [f32; 3],
}

impl Vertex {
    pub fn desc<'a>() -> wgpu::VertexBufferLayout<'a> {
        wgpu::VertexBufferLayout {
            array_stride: std::mem::size_of::<Vertex>() as u64,
            step_mode: wgpu::VertexStepMode::Vertex,
            attributes: &[
                wgpu::VertexAttribute {
                    offset: 0,
                    shader_location: 0,
                    format: wgpu::VertexFormat::Float32x3,
                },
                wgpu::VertexAttribute {
                    offset: std::mem::size_of::<[f32; 3]>() as u64,
                    shader_location: 1,
                    format: wgpu::VertexFormat::Float32x3,
                },
            ],
        }
    }
}

pub struct SceneMesh {
    pub vertices: Vec<Vertex>,
    pub indices: Vec<u32>,
}

#[derive(Clone, Copy, Debug)]
pub struct SelectedObjectSummary {
    pub handle: MeshHandle,
    pub translation: [f32; 3],
    pub rotation: [f32; 4],
    pub scale: [f32; 3],
    pub vertex_count: usize,
    pub face_count: usize,
}

#[derive(Clone, Debug)]
pub struct SelectedObjectDetails {
    pub name: String,
    pub summary: SelectedObjectSummary,
}

#[derive(Clone, Debug)]
pub struct SceneObjectEntry {
    pub handle_raw: u64,
    pub name: String,
    pub selected: bool,
    pub vertex_count: usize,
    pub face_count: usize,
}

#[derive(Clone, Copy, Debug)]
pub struct SceneFocusTarget {
    pub center: [f32; 3],
    pub radius: f32,
}

#[derive(Clone, Copy, Debug)]
struct PrimitiveAppearance {
    base_color: [f32; 3],
    local_bounds: Bounds,
}

#[derive(Clone, Copy, Debug)]
struct Bounds {
    min: Vec3,
    max: Vec3,
}

pub struct ZenScene {
    world: SceneWorld,
    appearances: HashMap<MeshHandle, PrimitiveAppearance>,
    selected: Option<MeshHandle>,
}

impl ZenScene {
    pub fn new_default() -> Self {
        let mut scene = Self {
            world: SceneWorld::new(),
            appearances: HashMap::new(),
            selected: None,
        };

        scene.spawn_plane(
            "World Floor",
            [0.0, 0.0, 0.0],
            [24.0, 1.0, 24.0],
            [0.08, 0.1, 0.14],
        );
        let hero = scene.spawn_box(
            "Zen Core",
            [0.0, 1.75, 0.0],
            [1.0, 1.75, 1.0],
            [0.28, 0.74, 0.88],
        );
        scene.spawn_box(
            "Solver Cache",
            [4.0, 0.75, -4.0],
            [1.0, 0.75, 1.0],
            [0.92, 0.47, 0.26],
        );
        scene.spawn_box(
            "Rig Sandbox",
            [-4.75, 1.4, -5.75],
            [1.25, 1.4, 1.25],
            [0.56, 0.44, 0.93],
        );
        scene.spawn_box(
            "Viewport Tower",
            [8.5, 3.0, 5.5],
            [1.5, 3.0, 1.5],
            [0.18, 0.94, 0.67],
        );
        scene.selected = Some(hero);
        scene
    }

    pub fn select(&mut self, handle: Option<MeshHandle>) -> bool {
        if self.selected == handle {
            return false;
        }
        self.selected = handle;
        true
    }

    pub fn selected_details(&self) -> Option<SelectedObjectDetails> {
        let handle = self.selected?;
        let name = self.world.mesh_name(handle).ok()?.name;
        let transform = self.world.mesh_transform(handle).ok()?;
        let (vertex_count, face_count) = self.world.mesh_counts(handle).ok()?;
        Some(SelectedObjectDetails {
            name,
            summary: SelectedObjectSummary {
                handle,
                translation: transform.translation,
                rotation: transform.rotation,
                scale: transform.scale,
                vertex_count,
                face_count,
            },
        })
    }

    pub fn object_entries(&self) -> Vec<SceneObjectEntry> {
        self.sorted_handles()
            .into_iter()
            .filter_map(|handle| {
                let name = self.world.mesh_name(handle).ok()?.name;
                let (vertex_count, face_count) = self.world.mesh_counts(handle).ok()?;
                Some(SceneObjectEntry {
                    handle_raw: handle.raw(),
                    name,
                    selected: self.selected == Some(handle),
                    vertex_count,
                    face_count,
                })
            })
            .collect()
    }

    pub fn select_raw_handle(&mut self, handle_raw: u64) -> bool {
        self.select(Some(MeshHandle(handle_raw)))
    }

    pub fn clear_selection(&mut self) -> bool {
        self.select(None)
    }

    pub fn select_next(&mut self, step: isize) -> bool {
        let handles = self.sorted_handles();
        if handles.is_empty() {
            return false;
        }

        let current_index = self
            .selected
            .and_then(|selected| handles.iter().position(|handle| *handle == selected))
            .unwrap_or(0);
        let next_index =
            ((current_index as isize + step).rem_euclid(handles.len() as isize)) as usize;
        self.select(Some(handles[next_index]))
    }

    pub fn spawn_workspace_box(&mut self) -> bool {
        let existing_objects = self.sorted_handles().len() as f32;
        let column = (existing_objects % 4.0) - 1.5;
        let row = (existing_objects / 4.0).floor();
        let handle = self.spawn_box(
            &format!("Workspace Box {}", existing_objects as usize),
            [column * 2.4, 0.9 + (row * 0.15), 3.5 + row * 2.2],
            [0.85, 0.9, 0.85],
            [0.24, 0.82, 0.58],
        );
        self.select(Some(handle))
    }

    pub fn rename_selected(&mut self, new_name: String) -> Result<bool, String> {
        let Some(handle) = self.selected else {
            return Ok(false);
        };
        let trimmed = new_name.trim();
        if trimmed.is_empty() {
            return Ok(false);
        }
        let current = self
            .world
            .mesh_name(handle)
            .map_err(|err| format!("Failed to read mesh name for {}: {err}", handle.raw()))?;
        if current.name == trimmed {
            return Ok(false);
        }
        self.world
            .set_mesh_name(handle, trimmed.to_string())
            .map_err(|err| format!("Failed to rename mesh {}: {err}", handle.raw()))?;
        Ok(true)
    }

    pub fn set_selected_translation(&mut self, translation: [f32; 3]) -> Result<bool, String> {
        let Some(handle) = self.selected else {
            return Ok(false);
        };
        let mut transform = self
            .world
            .mesh_transform(handle)
            .map_err(|err| format!("Failed to read mesh transform for {}: {err}", handle.raw()))?;
        if transform.translation == translation {
            return Ok(false);
        }
        transform.translation = translation;
        self.world
            .set_mesh_transform(handle, transform)
            .map_err(|err| {
                format!(
                    "Failed to update mesh transform for {}: {err}",
                    handle.raw()
                )
            })?;
        Ok(true)
    }

    pub fn set_selected_scale(&mut self, scale: [f32; 3]) -> Result<bool, String> {
        let Some(handle) = self.selected else {
            return Ok(false);
        };
        let normalized = [scale[0].max(0.05), scale[1].max(0.05), scale[2].max(0.05)];
        let mut transform = self
            .world
            .mesh_transform(handle)
            .map_err(|err| format!("Failed to read mesh transform for {}: {err}", handle.raw()))?;
        if transform.scale == normalized {
            return Ok(false);
        }
        transform.scale = normalized;
        self.world
            .set_mesh_transform(handle, transform)
            .map_err(|err| format!("Failed to update mesh scale for {}: {err}", handle.raw()))?;
        Ok(true)
    }

    pub fn build_render_mesh(&self) -> Result<SceneMesh, String> {
        let mut vertices = Vec::new();
        let mut indices = Vec::new();

        for handle in self.sorted_handles() {
            let source = self.world.mesh_source(handle).map_err(|err| {
                format!("Failed to fetch mesh source for {}: {err}", handle.raw())
            })?;
            let appearance = self
                .appearances
                .get(&handle)
                .copied()
                .ok_or_else(|| format!("Missing appearance for mesh {}", handle.raw()))?;
            let world = self.world_transform(handle, &mut HashSet::new())?;
            let color = if self.selected == Some(handle) {
                brighten(appearance.base_color, 0.22)
            } else {
                appearance.base_color
            };

            let base_index = vertices.len() as u32;
            for position in source.positions.chunks_exact(3) {
                let local = Vec3::new(position[0], position[1], position[2]);
                let world_position = world.transform_point3(local);
                vertices.push(Vertex {
                    position: world_position.to_array(),
                    color,
                });
            }
            indices.extend(source.indices.iter().map(|index| base_index + *index));
        }

        append_world_axes(&mut vertices, &mut indices);
        if let Some(handle) = self.selected {
            self.append_selection_outline(handle, &mut vertices, &mut indices)?;
            self.append_selection_axes(handle, &mut vertices, &mut indices)?;
        }

        Ok(SceneMesh { vertices, indices })
    }

    pub fn pick(&self, ray_origin: Vec3, ray_direction: Vec3) -> Option<MeshHandle> {
        let mut best: Option<(f32, MeshHandle)> = None;

        for handle in self.sorted_handles() {
            let Some(appearance) = self.appearances.get(&handle) else {
                continue;
            };
            let Ok(world) = self.world_transform(handle, &mut HashSet::new()) else {
                continue;
            };
            let bounds = transform_bounds(appearance.local_bounds, world);
            if let Some(distance) = ray_aabb_intersection(ray_origin, ray_direction, bounds) {
                let replace = match best {
                    Some((best_distance, _)) => distance < best_distance,
                    None => true,
                };
                if replace {
                    best = Some((distance, handle));
                }
            }
        }

        best.map(|(_, handle)| handle)
    }

    pub fn selected_focus_target(&self) -> Option<SceneFocusTarget> {
        self.selected
            .and_then(|handle| self.focus_target_for_handles([handle]))
    }

    pub fn scene_focus_target(&self) -> Option<SceneFocusTarget> {
        let mut subject_handles = Vec::new();
        for handle in self.sorted_handles() {
            let Some(appearance) = self.appearances.get(&handle).copied() else {
                continue;
            };
            let Ok(world) = self.world_transform(handle, &mut HashSet::new()) else {
                continue;
            };
            let bounds = transform_bounds(appearance.local_bounds, world);
            let size = bounds.max - bounds.min;
            let is_ground_plane = size.y <= 0.2 && size.x.max(size.z) >= 12.0;
            if !is_ground_plane {
                subject_handles.push(handle);
            }
        }

        if subject_handles.is_empty() {
            subject_handles = self.sorted_handles();
        }

        self.focus_target_for_handles(subject_handles)
    }

    fn sorted_handles(&self) -> Vec<MeshHandle> {
        let mut handles = self.world.mesh_handles();
        handles.sort_by_key(|handle| handle.raw());
        handles
    }

    fn focus_target_for_handles(
        &self,
        handles: impl IntoIterator<Item = MeshHandle>,
    ) -> Option<SceneFocusTarget> {
        let mut min = Vec3::splat(f32::INFINITY);
        let mut max = Vec3::splat(f32::NEG_INFINITY);
        let mut found_any = false;

        for handle in handles {
            let Some(appearance) = self.appearances.get(&handle).copied() else {
                continue;
            };
            let Ok(world) = self.world_transform(handle, &mut HashSet::new()) else {
                continue;
            };
            let bounds = transform_bounds(appearance.local_bounds, world);
            min = min.min(bounds.min);
            max = max.max(bounds.max);
            found_any = true;
        }

        if !found_any {
            return None;
        }

        let center = (min + max) * 0.5;
        let radius = ((max - min) * 0.5).max(Vec3::splat(0.45)).length();
        Some(SceneFocusTarget {
            center: center.to_array(),
            radius,
        })
    }

    fn spawn_plane(
        &mut self,
        name: &str,
        translation: [f32; 3],
        scale: [f32; 3],
        color: [f32; 3],
    ) -> MeshHandle {
        let (positions, indices) = unit_plane();
        let handle = self.world.create_mesh(positions, indices, None);
        let _ = self.world.set_mesh_name(handle, name);
        let _ = self.world.set_mesh_transform(
            handle,
            SceneTransformComponent {
                translation,
                rotation: [0.0, 0.0, 0.0, 1.0],
                scale,
            },
        );
        self.appearances.insert(
            handle,
            PrimitiveAppearance {
                base_color: color,
                local_bounds: Bounds {
                    min: Vec3::new(-1.0, 0.0, -1.0),
                    max: Vec3::new(1.0, 0.0, 1.0),
                },
            },
        );
        handle
    }

    fn spawn_box(
        &mut self,
        name: &str,
        translation: [f32; 3],
        scale: [f32; 3],
        color: [f32; 3],
    ) -> MeshHandle {
        let (positions, indices) = unit_box();
        let handle = self.world.create_mesh(positions, indices, None);
        let _ = self.world.set_mesh_name(handle, name);
        let _ = self.world.set_mesh_transform(
            handle,
            SceneTransformComponent {
                translation,
                rotation: [0.0, 0.0, 0.0, 1.0],
                scale,
            },
        );
        self.appearances.insert(
            handle,
            PrimitiveAppearance {
                base_color: color,
                local_bounds: Bounds {
                    min: Vec3::splat(-1.0),
                    max: Vec3::splat(1.0),
                },
            },
        );
        handle
    }

    fn world_transform(
        &self,
        handle: MeshHandle,
        visited: &mut HashSet<MeshHandle>,
    ) -> Result<Mat4, String> {
        if !visited.insert(handle) {
            return Err(format!(
                "Cycle detected while resolving scene transform {}",
                handle.raw()
            ));
        }

        let local = self
            .world
            .mesh_transform(handle)
            .map_err(|err| format!("Missing transform for {}: {err}", handle.raw()))?;
        let local_matrix = transform_component_to_mat4(local);
        let parent = self
            .world
            .mesh_parent(handle)
            .unwrap_or(SceneParentComponent { parent: None })
            .parent;

        let result = if let Some(parent_handle) = parent {
            self.world_transform(parent_handle, visited)? * local_matrix
        } else {
            local_matrix
        };

        visited.remove(&handle);
        Ok(result)
    }

    fn append_selection_outline(
        &self,
        handle: MeshHandle,
        vertices: &mut Vec<Vertex>,
        indices: &mut Vec<u32>,
    ) -> Result<(), String> {
        let Some(appearance) = self.appearances.get(&handle).copied() else {
            return Ok(());
        };
        let world = self.world_transform(handle, &mut HashSet::new())?;
        let bounds = transform_bounds(appearance.local_bounds, world);
        let color = [1.0, 0.95, 0.45];
        let thickness = 0.045;

        let center = (bounds.min + bounds.max) * 0.5;
        let extents = (bounds.max - bounds.min) * 0.5 + Vec3::splat(thickness);

        append_box_mesh(vertices, indices, center, extents, color);
        append_box_mesh(
            vertices,
            indices,
            center,
            (extents - Vec3::splat(thickness * 1.75)).max(Vec3::splat(0.01)),
            [0.03, 0.04, 0.05],
        );
        Ok(())
    }

    fn append_selection_axes(
        &self,
        handle: MeshHandle,
        vertices: &mut Vec<Vertex>,
        indices: &mut Vec<u32>,
    ) -> Result<(), String> {
        let transform = self
            .world
            .mesh_transform(handle)
            .map_err(|err| format!("Missing transform for {}: {err}", handle.raw()))?;
        let origin = Vec3::from_array(transform.translation);
        append_axis_tripod(vertices, indices, origin, 1.4, 0.04);
        Ok(())
    }
}

fn transform_component_to_mat4(transform: SceneTransformComponent) -> Mat4 {
    Mat4::from_scale_rotation_translation(
        Vec3::from_array(transform.scale),
        Quat::from_array(transform.rotation),
        Vec3::from_array(transform.translation),
    )
}

fn transform_bounds(bounds: Bounds, transform: Mat4) -> Bounds {
    let corners = [
        Vec3::new(bounds.min.x, bounds.min.y, bounds.min.z),
        Vec3::new(bounds.min.x, bounds.min.y, bounds.max.z),
        Vec3::new(bounds.min.x, bounds.max.y, bounds.min.z),
        Vec3::new(bounds.min.x, bounds.max.y, bounds.max.z),
        Vec3::new(bounds.max.x, bounds.min.y, bounds.min.z),
        Vec3::new(bounds.max.x, bounds.min.y, bounds.max.z),
        Vec3::new(bounds.max.x, bounds.max.y, bounds.min.z),
        Vec3::new(bounds.max.x, bounds.max.y, bounds.max.z),
    ];

    let mut min = Vec3::splat(f32::INFINITY);
    let mut max = Vec3::splat(f32::NEG_INFINITY);
    for corner in corners {
        let point = transform.transform_point3(corner);
        min = min.min(point);
        max = max.max(point);
    }

    Bounds { min, max }
}

fn ray_aabb_intersection(origin: Vec3, direction: Vec3, bounds: Bounds) -> Option<f32> {
    let inv = Vec3::new(
        safe_inverse(direction.x),
        safe_inverse(direction.y),
        safe_inverse(direction.z),
    );

    let t1 = (bounds.min - origin) * inv;
    let t2 = (bounds.max - origin) * inv;
    let t_min = t1.min(t2);
    let t_max = t1.max(t2);

    let near = t_min.x.max(t_min.y).max(t_min.z);
    let far = t_max.x.min(t_max.y).min(t_max.z);

    if far >= near.max(0.0) {
        Some(near.max(0.0))
    } else {
        None
    }
}

fn safe_inverse(value: f32) -> f32 {
    if value.abs() <= f32::EPSILON {
        f32::INFINITY
    } else {
        1.0 / value
    }
}

fn brighten(color: [f32; 3], amount: f32) -> [f32; 3] {
    [
        (color[0] + amount).min(1.0),
        (color[1] + amount).min(1.0),
        (color[2] + amount).min(1.0),
    ]
}

fn unit_plane() -> (Vec<f32>, Vec<u32>) {
    (
        vec![
            -1.0, 0.0, -1.0, //
            1.0, 0.0, -1.0, //
            1.0, 0.0, 1.0, //
            -1.0, 0.0, 1.0, //
        ],
        vec![0, 1, 2, 0, 2, 3],
    )
}

fn unit_box() -> (Vec<f32>, Vec<u32>) {
    let positions = vec![
        -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 1.0, //
        1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, //
        -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0, //
        1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, //
        -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0, //
        -1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, -1.0, -1.0, 1.0, //
    ];
    let indices = vec![
        0, 1, 2, 0, 2, 3, //
        4, 5, 6, 4, 6, 7, //
        8, 9, 10, 8, 10, 11, //
        12, 13, 14, 12, 14, 15, //
        16, 17, 18, 16, 18, 19, //
        20, 21, 22, 20, 22, 23, //
    ];
    (positions, indices)
}

fn append_world_axes(vertices: &mut Vec<Vertex>, indices: &mut Vec<u32>) {
    append_axis_tripod(vertices, indices, Vec3::ZERO, 2.5, 0.03);
}

fn append_axis_tripod(
    vertices: &mut Vec<Vertex>,
    indices: &mut Vec<u32>,
    origin: Vec3,
    axis_length: f32,
    radius: f32,
) {
    append_box_mesh(
        vertices,
        indices,
        origin + Vec3::new(axis_length * 0.5, 0.0, 0.0),
        Vec3::new(axis_length * 0.5, radius, radius),
        [0.95, 0.2, 0.2],
    );
    append_box_mesh(
        vertices,
        indices,
        origin + Vec3::new(0.0, axis_length * 0.5, 0.0),
        Vec3::new(radius, axis_length * 0.5, radius),
        [0.2, 0.95, 0.35],
    );
    append_box_mesh(
        vertices,
        indices,
        origin + Vec3::new(0.0, 0.0, axis_length * 0.5),
        Vec3::new(radius, radius, axis_length * 0.5),
        [0.24, 0.56, 1.0],
    );
}

fn append_box_mesh(
    vertices: &mut Vec<Vertex>,
    indices: &mut Vec<u32>,
    center: Vec3,
    extents: Vec3,
    color: [f32; 3],
) {
    let min = center - extents;
    let max = center + extents;
    let positions = [
        [min.x, min.y, max.z],
        [max.x, min.y, max.z],
        [max.x, max.y, max.z],
        [min.x, max.y, max.z],
        [max.x, min.y, min.z],
        [min.x, min.y, min.z],
        [min.x, max.y, min.z],
        [max.x, max.y, min.z],
        [min.x, min.y, min.z],
        [min.x, min.y, max.z],
        [min.x, max.y, max.z],
        [min.x, max.y, min.z],
        [max.x, min.y, max.z],
        [max.x, min.y, min.z],
        [max.x, max.y, min.z],
        [max.x, max.y, max.z],
        [min.x, max.y, max.z],
        [max.x, max.y, max.z],
        [max.x, max.y, min.z],
        [min.x, max.y, min.z],
        [min.x, min.y, min.z],
        [max.x, min.y, min.z],
        [max.x, min.y, max.z],
        [min.x, min.y, max.z],
    ];

    let base = vertices.len() as u32;
    for position in positions {
        vertices.push(Vertex { position, color });
    }

    indices.extend_from_slice(&[
        base,
        base + 1,
        base + 2,
        base,
        base + 2,
        base + 3,
        base + 4,
        base + 5,
        base + 6,
        base + 4,
        base + 6,
        base + 7,
        base + 8,
        base + 9,
        base + 10,
        base + 8,
        base + 10,
        base + 11,
        base + 12,
        base + 13,
        base + 14,
        base + 12,
        base + 14,
        base + 15,
        base + 16,
        base + 17,
        base + 18,
        base + 16,
        base + 18,
        base + 19,
        base + 20,
        base + 21,
        base + 22,
        base + 20,
        base + 22,
        base + 23,
    ]);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scene_selects_and_reports_metadata() {
        let scene = ZenScene::new_default();
        let details = scene
            .selected_details()
            .expect("selected details should exist");
        assert!(details.summary.handle.raw() > 0);
        assert!(details.summary.face_count > 0);
    }

    #[test]
    fn scene_mesh_contains_renderable_geometry() {
        let scene = ZenScene::new_default();
        let mesh = scene
            .build_render_mesh()
            .expect("scene should build render mesh");
        assert!(!mesh.vertices.is_empty());
        assert!(!mesh.indices.is_empty());
    }

    #[test]
    fn scene_ray_pick_hits_default_selection_cluster() {
        let scene = ZenScene::new_default();
        let hit = scene.pick(
            Vec3::new(0.0, 2.0, 8.0),
            Vec3::new(0.0, -0.12, -1.0).normalize(),
        );
        assert!(
            hit.is_some(),
            "ray should hit one of the default scene meshes"
        );
    }

    #[test]
    fn scene_reports_focus_targets() {
        let scene = ZenScene::new_default();
        let selected = scene
            .selected_focus_target()
            .expect("selected focus target should exist");
        let full_scene = scene
            .scene_focus_target()
            .expect("scene focus target should exist");
        assert!(selected.radius > 0.0);
        assert!(full_scene.radius >= selected.radius);
    }
}
