use crate::{
    AnimationHandle, AnimationHandleComponent, AnimationSourceComponent,
    MaterialAssignmentComponent, MaterialHandle, MeshEditStackComponent, MeshHandle,
    MeshHandleComponent, MeshSourceComponent, RigReferenceComponent, SceneHandle,
    SceneNameComponent, SceneParentComponent, SceneTransformComponent,
    SubdivisionSettingsComponent, TakeHandle, TakeHandleComponent, TakeSourceComponent,
    ViewportStateComponent,
};
use bevy_ecs::entity::Entity;
use bevy_ecs::world::World;
use std::collections::HashMap;
use std::sync::Arc;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum SceneError {
    #[error("mesh handle not found: {0:?}")]
    MeshHandleNotFound(MeshHandle),
    #[error("take handle not found: {0:?}")]
    TakeHandleNotFound(TakeHandle),
    #[error("animation handle not found: {0:?}")]
    AnimationHandleNotFound(AnimationHandle),
}

pub struct SceneWorld {
    scene_handle: SceneHandle,
    world: World,
    next_handle: u64,
    mesh_entities: HashMap<MeshHandle, Entity>,
    take_entities: HashMap<TakeHandle, Entity>,
    animation_entities: HashMap<AnimationHandle, Entity>,
}

impl Default for SceneWorld {
    fn default() -> Self {
        Self::new()
    }
}

impl SceneWorld {
    pub fn new() -> Self {
        Self {
            scene_handle: SceneHandle(1),
            world: World::new(),
            next_handle: 2,
            mesh_entities: HashMap::new(),
            take_entities: HashMap::new(),
            animation_entities: HashMap::new(),
        }
    }

    pub fn scene_handle(&self) -> SceneHandle {
        self.scene_handle
    }

    pub fn world(&self) -> &World {
        &self.world
    }

    pub fn world_mut(&mut self) -> &mut World {
        &mut self.world
    }

    fn allocate_handle(&mut self) -> u64 {
        let raw = self.next_handle;
        self.next_handle += 1;
        raw
    }

    pub fn create_mesh(
        &mut self,
        positions: Vec<f32>,
        indices: Vec<u32>,
        normals: Option<Vec<f32>>,
    ) -> MeshHandle {
        let handle = MeshHandle(self.allocate_handle());
        let entity = self
            .world
            .spawn((
                MeshHandleComponent(handle),
                SceneNameComponent::new(format!("Mesh {}", handle.raw())),
                SceneTransformComponent::default(),
                SceneParentComponent::default(),
                MeshSourceComponent::from_vectors(positions, indices, normals),
                MeshEditStackComponent {
                    base_mesh: Some(handle),
                    edits: Vec::new(),
                },
                SubdivisionSettingsComponent::default(),
                ViewportStateComponent::default(),
            ))
            .id();

        self.mesh_entities.insert(handle, entity);
        handle
    }

    pub fn mesh_handles(&self) -> Vec<MeshHandle> {
        self.mesh_entities.keys().copied().collect()
    }

    pub fn mesh_entity(&self, handle: MeshHandle) -> Result<Entity, SceneError> {
        self.mesh_entities
            .get(&handle)
            .copied()
            .ok_or(SceneError::MeshHandleNotFound(handle))
    }

    pub fn delete_mesh(&mut self, handle: MeshHandle) -> Result<(), SceneError> {
        let entity = self
            .mesh_entities
            .remove(&handle)
            .ok_or(SceneError::MeshHandleNotFound(handle))?;
        let _ = self.world.despawn(entity);
        Ok(())
    }

    pub fn update_mesh_source(
        &mut self,
        handle: MeshHandle,
        positions: Vec<f32>,
        indices: Vec<u32>,
        normals: Option<Vec<f32>>,
    ) -> Result<(), SceneError> {
        let entity = *self
            .mesh_entities
            .get(&handle)
            .ok_or(SceneError::MeshHandleNotFound(handle))?;

        let mut entity_mut = self.world.entity_mut(entity);
        entity_mut.insert(MeshSourceComponent::from_vectors(
            positions, indices, normals,
        ));
        Ok(())
    }

    pub fn set_mesh_name(
        &mut self,
        handle: MeshHandle,
        name: impl Into<String>,
    ) -> Result<(), SceneError> {
        let entity = self.mesh_entity(handle)?;
        self.world
            .entity_mut(entity)
            .insert(SceneNameComponent::new(name));
        Ok(())
    }

    pub fn mesh_name(&self, handle: MeshHandle) -> Result<SceneNameComponent, SceneError> {
        let entity = self.mesh_entity(handle)?;
        self.world
            .get::<SceneNameComponent>(entity)
            .cloned()
            .ok_or(SceneError::MeshHandleNotFound(handle))
    }

    pub fn set_mesh_transform(
        &mut self,
        handle: MeshHandle,
        transform: SceneTransformComponent,
    ) -> Result<(), SceneError> {
        let entity = self.mesh_entity(handle)?;
        self.world.entity_mut(entity).insert(transform);
        Ok(())
    }

    pub fn mesh_transform(
        &self,
        handle: MeshHandle,
    ) -> Result<SceneTransformComponent, SceneError> {
        let entity = self.mesh_entity(handle)?;
        self.world
            .get::<SceneTransformComponent>(entity)
            .copied()
            .ok_or(SceneError::MeshHandleNotFound(handle))
    }

    pub fn set_mesh_parent(
        &mut self,
        handle: MeshHandle,
        parent: Option<MeshHandle>,
    ) -> Result<(), SceneError> {
        let entity = self.mesh_entity(handle)?;
        self.world
            .entity_mut(entity)
            .insert(SceneParentComponent { parent });
        Ok(())
    }

    pub fn mesh_parent(&self, handle: MeshHandle) -> Result<SceneParentComponent, SceneError> {
        let entity = self.mesh_entity(handle)?;
        self.world
            .get::<SceneParentComponent>(entity)
            .copied()
            .ok_or(SceneError::MeshHandleNotFound(handle))
    }

    pub fn attach_material(
        &mut self,
        handle: MeshHandle,
        material: MaterialHandle,
    ) -> Result<(), SceneError> {
        let entity = *self
            .mesh_entities
            .get(&handle)
            .ok_or(SceneError::MeshHandleNotFound(handle))?;

        let mut entity_mut = self.world.entity_mut(entity);
        entity_mut.insert(MaterialAssignmentComponent { material });

        if let Some(mut viewport) = entity_mut.get_mut::<ViewportStateComponent>() {
            viewport.material_binding = Some(material);
        }

        Ok(())
    }

    pub fn update_subdivision_settings(
        &mut self,
        handle: MeshHandle,
        settings: SubdivisionSettingsComponent,
    ) -> Result<(), SceneError> {
        let entity = *self
            .mesh_entities
            .get(&handle)
            .ok_or(SceneError::MeshHandleNotFound(handle))?;

        self.world.entity_mut(entity).insert(settings);
        Ok(())
    }

    pub fn attach_rig(
        &mut self,
        handle: MeshHandle,
        rig: crate::RigHandle,
    ) -> Result<(), SceneError> {
        let entity = *self
            .mesh_entities
            .get(&handle)
            .ok_or(SceneError::MeshHandleNotFound(handle))?;

        self.world
            .entity_mut(entity)
            .insert(RigReferenceComponent { rig });
        Ok(())
    }

    pub fn insert_take(
        &mut self,
        name: impl Into<String>,
        path: impl Into<String>,
        model_id: impl Into<String>,
        frame_count: usize,
    ) -> TakeHandle {
        let handle = TakeHandle(self.allocate_handle());
        let entity = self
            .world
            .spawn((
                TakeHandleComponent(handle),
                TakeSourceComponent {
                    name: name.into(),
                    path: path.into(),
                    model_id: model_id.into(),
                    frame_count,
                },
            ))
            .id();

        self.take_entities.insert(handle, entity);
        handle
    }

    pub fn insert_animation(
        &mut self,
        name: impl Into<String>,
        source_take: Option<TakeHandle>,
        external_path: Option<String>,
    ) -> AnimationHandle {
        let handle = AnimationHandle(self.allocate_handle());
        let entity = self
            .world
            .spawn((
                AnimationHandleComponent(handle),
                AnimationSourceComponent {
                    name: name.into(),
                    source_take,
                    external_path,
                },
            ))
            .id();

        self.animation_entities.insert(handle, entity);
        handle
    }

    pub fn mesh_source(&self, handle: MeshHandle) -> Result<MeshSourceComponent, SceneError> {
        let entity = *self
            .mesh_entities
            .get(&handle)
            .ok_or(SceneError::MeshHandleNotFound(handle))?;

        self.world
            .get::<MeshSourceComponent>(entity)
            .cloned()
            .ok_or(SceneError::MeshHandleNotFound(handle))
    }

    pub fn mesh_edit_stack(
        &self,
        handle: MeshHandle,
    ) -> Result<MeshEditStackComponent, SceneError> {
        let entity = *self
            .mesh_entities
            .get(&handle)
            .ok_or(SceneError::MeshHandleNotFound(handle))?;

        self.world
            .get::<MeshEditStackComponent>(entity)
            .cloned()
            .ok_or(SceneError::MeshHandleNotFound(handle))
    }

    pub fn subdivision_settings(
        &self,
        handle: MeshHandle,
    ) -> Result<SubdivisionSettingsComponent, SceneError> {
        let entity = *self
            .mesh_entities
            .get(&handle)
            .ok_or(SceneError::MeshHandleNotFound(handle))?;

        self.world
            .get::<SubdivisionSettingsComponent>(entity)
            .cloned()
            .ok_or(SceneError::MeshHandleNotFound(handle))
    }

    pub fn viewport_state(&self, handle: MeshHandle) -> Result<ViewportStateComponent, SceneError> {
        let entity = *self
            .mesh_entities
            .get(&handle)
            .ok_or(SceneError::MeshHandleNotFound(handle))?;

        self.world
            .get::<ViewportStateComponent>(entity)
            .cloned()
            .ok_or(SceneError::MeshHandleNotFound(handle))
    }

    pub fn update_mesh_positions_partial(
        &mut self,
        handle: MeshHandle,
        modified_indices: &[usize],
        new_positions: &[f32],
    ) -> Result<(), SceneError> {
        let entity = *self
            .mesh_entities
            .get(&handle)
            .ok_or(SceneError::MeshHandleNotFound(handle))?;

        let Some(mut source) = self.world.get_mut::<MeshSourceComponent>(entity) else {
            return Err(SceneError::MeshHandleNotFound(handle));
        };

        let mut positions = source.positions.as_ref().to_vec();
        for (i, &idx) in modified_indices.iter().enumerate() {
            let dst = idx * 3;
            let src = i * 3;
            if dst + 2 < positions.len() && src + 2 < new_positions.len() {
                positions[dst] = new_positions[src];
                positions[dst + 1] = new_positions[src + 1];
                positions[dst + 2] = new_positions[src + 2];
            }
        }

        source.positions = Arc::<[f32]>::from(positions);
        Ok(())
    }

    pub fn update_mesh_normals_partial(
        &mut self,
        handle: MeshHandle,
        modified_indices: &[usize],
        new_normals: &[f32],
    ) -> Result<(), SceneError> {
        let entity = *self
            .mesh_entities
            .get(&handle)
            .ok_or(SceneError::MeshHandleNotFound(handle))?;

        let Some(mut source) = self.world.get_mut::<MeshSourceComponent>(entity) else {
            return Err(SceneError::MeshHandleNotFound(handle));
        };

        let mut normals = source
            .normals
            .as_ref()
            .map(|existing| existing.as_ref().to_vec())
            .unwrap_or_else(|| vec![0.0; source.positions.len()]);

        for (i, &idx) in modified_indices.iter().enumerate() {
            let dst = idx * 3;
            let src = i * 3;
            if dst + 2 < normals.len() && src + 2 < new_normals.len() {
                normals[dst] = new_normals[src];
                normals[dst + 1] = new_normals[src + 1];
                normals[dst + 2] = new_normals[src + 2];
            }
        }

        source.normals = Some(Arc::<[f32]>::from(normals));
        Ok(())
    }

    pub fn mesh_counts(&self, handle: MeshHandle) -> Result<(usize, usize), SceneError> {
        let source = self.mesh_source(handle)?;
        Ok((source.positions.len() / 3, source.indices.len() / 3))
    }

    pub fn take_source(&self, handle: TakeHandle) -> Result<TakeSourceComponent, SceneError> {
        let entity = *self
            .take_entities
            .get(&handle)
            .ok_or(SceneError::TakeHandleNotFound(handle))?;

        self.world
            .get::<TakeSourceComponent>(entity)
            .cloned()
            .ok_or(SceneError::TakeHandleNotFound(handle))
    }

    pub fn animation_source(
        &self,
        handle: AnimationHandle,
    ) -> Result<AnimationSourceComponent, SceneError> {
        let entity = *self
            .animation_entities
            .get(&handle)
            .ok_or(SceneError::AnimationHandleNotFound(handle))?;

        self.world
            .get::<AnimationSourceComponent>(entity)
            .cloned()
            .ok_or(SceneError::AnimationHandleNotFound(handle))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn creates_mesh_and_round_trips_component_storage() {
        let mut scene = SceneWorld::new();
        let mesh = scene.create_mesh(vec![0.0, 1.0, 2.0], vec![0, 1, 2], None);

        let source = scene.mesh_source(mesh).expect("mesh source");
        assert_eq!(&*source.positions, &[0.0, 1.0, 2.0]);
        assert_eq!(&*source.indices, &[0, 1, 2]);
    }

    #[test]
    fn updates_mesh_source_and_material_assignment() {
        let mut scene = SceneWorld::new();
        let mesh = scene.create_mesh(vec![0.0, 1.0, 2.0], vec![0, 1, 2], None);

        scene
            .update_mesh_source(mesh, vec![3.0, 4.0, 5.0], vec![2, 1, 0], None)
            .expect("mesh update");
        scene
            .attach_material(mesh, crate::MaterialHandle(77))
            .expect("material attach");

        let source = scene.mesh_source(mesh).expect("mesh source");
        assert_eq!(&*source.positions, &[3.0, 4.0, 5.0]);
    }

    #[test]
    fn stores_mesh_scene_metadata() {
        let mut scene = SceneWorld::new();
        let mesh = scene.create_mesh(vec![0.0, 1.0, 2.0], vec![0, 1, 2], None);

        scene
            .set_mesh_name(mesh, "Zen Cube")
            .expect("mesh name should update");
        scene
            .set_mesh_transform(
                mesh,
                SceneTransformComponent {
                    translation: [1.0, 2.0, 3.0],
                    rotation: [0.0, 0.0, 0.0, 1.0],
                    scale: [2.0, 2.0, 2.0],
                },
            )
            .expect("mesh transform should update");
        scene
            .set_mesh_parent(mesh, Some(MeshHandle(999)))
            .expect("mesh parent should update");

        assert_eq!(scene.mesh_name(mesh).expect("mesh name").name, "Zen Cube");
        assert_eq!(
            scene
                .mesh_transform(mesh)
                .expect("mesh transform")
                .translation,
            [1.0, 2.0, 3.0]
        );
        assert_eq!(
            scene.mesh_parent(mesh).expect("mesh parent").parent,
            Some(MeshHandle(999))
        );
    }

    #[test]
    fn inserts_take_and_animation_assets() {
        let mut scene = SceneWorld::new();
        let take = scene.insert_take("Walk", "C:/takes/walk.zenmocap", "yolov11s_pose", 120);
        let animation = scene.insert_animation("WalkClip", Some(take), None);

        let take_source = scene.take_source(take).expect("take");
        let animation_source = scene.animation_source(animation).expect("animation");

        assert_eq!(take_source.model_id, "yolov11s_pose");
        assert_eq!(animation_source.source_take, Some(take));
    }

    #[test]
    fn updates_mesh_positions_and_normals_partially() {
        let mut scene = SceneWorld::new();
        let mesh = scene.create_mesh(
            vec![0.0, 0.0, 0.0, 1.0, 1.0, 1.0],
            vec![0, 1, 0],
            Some(vec![0.0, 0.0, 1.0, 0.0, 0.0, 1.0]),
        );

        scene
            .update_mesh_positions_partial(mesh, &[1], &[2.0, 3.0, 4.0])
            .expect("position update");
        scene
            .update_mesh_normals_partial(mesh, &[0], &[1.0, 0.0, 0.0])
            .expect("normal update");

        let source = scene.mesh_source(mesh).expect("mesh source");
        assert_eq!(&*source.positions, &[0.0, 0.0, 0.0, 2.0, 3.0, 4.0]);
        assert_eq!(
            source.normals.as_deref().expect("normals"),
            &[1.0, 0.0, 0.0, 0.0, 0.0, 1.0]
        );
    }
}
