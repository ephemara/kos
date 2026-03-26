use crate::{AnimationHandle, MaterialHandle, MeshHandle, RigHandle, TakeHandle};
use bevy_ecs::component::Component;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum SubdivisionAlgorithm {
    Loop,
    CatmullClark,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ShadingMode {
    Solid,
    Wireframe,
    Matcap,
    Xray,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum MeshEditOpKind {
    SculptStroke,
    VertexTranslate,
    TopologyChange,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MeshEditOp {
    pub kind: MeshEditOpKind,
    pub description: String,
    pub modified_vertex_count: usize,
}

#[derive(Component, Debug, Clone)]
pub struct MeshSourceComponent {
    pub positions: Arc<[f32]>,
    pub indices: Arc<[u32]>,
    pub normals: Option<Arc<[f32]>>,
}

impl MeshSourceComponent {
    pub fn from_vectors(positions: Vec<f32>, indices: Vec<u32>, normals: Option<Vec<f32>>) -> Self {
        Self {
            positions: Arc::<[f32]>::from(positions),
            indices: Arc::<[u32]>::from(indices),
            normals: normals.map(Arc::<[f32]>::from),
        }
    }
}

#[derive(Component, Debug, Clone, Default)]
pub struct MeshEditStackComponent {
    pub base_mesh: Option<MeshHandle>,
    pub edits: Vec<MeshEditOp>,
}

#[derive(Component, Debug, Clone)]
pub struct SubdivisionSettingsComponent {
    pub level: u32,
    pub algorithm: SubdivisionAlgorithm,
}

impl Default for SubdivisionSettingsComponent {
    fn default() -> Self {
        Self {
            level: 0,
            algorithm: SubdivisionAlgorithm::Loop,
        }
    }
}

#[derive(Component, Debug, Clone)]
pub struct ViewportStateComponent {
    pub shading_mode: ShadingMode,
    pub material_binding: Option<MaterialHandle>,
}

impl Default for ViewportStateComponent {
    fn default() -> Self {
        Self {
            shading_mode: ShadingMode::Solid,
            material_binding: None,
        }
    }
}

#[derive(Component, Debug, Clone)]
pub struct MaterialAssignmentComponent {
    pub material: MaterialHandle,
}

#[derive(Component, Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SceneNameComponent {
    pub name: String,
}

impl SceneNameComponent {
    pub fn new(name: impl Into<String>) -> Self {
        Self { name: name.into() }
    }
}

#[derive(Component, Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub struct SceneTransformComponent {
    pub translation: [f32; 3],
    pub rotation: [f32; 4],
    pub scale: [f32; 3],
}

impl Default for SceneTransformComponent {
    fn default() -> Self {
        Self {
            translation: [0.0, 0.0, 0.0],
            rotation: [0.0, 0.0, 0.0, 1.0],
            scale: [1.0, 1.0, 1.0],
        }
    }
}

#[derive(Component, Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub struct SceneParentComponent {
    pub parent: Option<MeshHandle>,
}

impl Default for SceneParentComponent {
    fn default() -> Self {
        Self { parent: None }
    }
}

#[derive(Component, Debug, Clone)]
pub struct RigReferenceComponent {
    pub rig: RigHandle,
}

#[derive(Component, Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TakeSourceComponent {
    pub name: String,
    pub path: String,
    pub model_id: String,
    pub frame_count: usize,
}

#[derive(Component, Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AnimationSourceComponent {
    pub name: String,
    pub source_take: Option<TakeHandle>,
    pub external_path: Option<String>,
}

#[derive(Component, Debug, Clone, Copy)]
pub struct MeshHandleComponent(pub MeshHandle);

#[derive(Component, Debug, Clone, Copy)]
pub struct TakeHandleComponent(pub TakeHandle);

#[derive(Component, Debug, Clone, Copy)]
pub struct AnimationHandleComponent(pub AnimationHandle);
