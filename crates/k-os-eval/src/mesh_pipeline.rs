use crate::{EvalContext, EvalError, EvalGraph, EvalNode, NodeId};
use glam::Vec3;
use k_os_mesh_processing::{subdivision, Mesh};
use k_os_scene::{MeshHandle, SceneWorld, ShadingMode, SubdivisionAlgorithm};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, RwLock};

#[derive(Debug, Clone, PartialEq)]
pub struct MeshPayload {
    pub mesh_handle: MeshHandle,
    pub vertices: Vec<Vec3>,
    pub indices: Vec<u32>,
    pub normals: Option<Vec<Vec3>>,
    pub edit_count: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ViewportBufferPayload {
    pub mesh_handle: MeshHandle,
    pub positions: Vec<f32>,
    pub normals: Vec<f32>,
    pub indices: Vec<u32>,
    pub shading_mode: ShadingMode,
    pub vertex_count: usize,
    pub index_count: usize,
}

#[derive(Debug, Clone, Copy)]
pub struct MeshPipelineIds {
    pub source: NodeId,
    pub edit: NodeId,
    pub subdivision: NodeId,
    pub normals: NodeId,
    pub viewport: NodeId,
}

impl MeshPipelineIds {
    pub fn from_seed(seed: u64) -> Self {
        Self {
            source: NodeId(seed),
            edit: NodeId(seed + 1),
            subdivision: NodeId(seed + 2),
            normals: NodeId(seed + 3),
            viewport: NodeId(seed + 4),
        }
    }
}

pub fn register_mesh_pipeline(
    graph: &mut EvalGraph,
    ids: MeshPipelineIds,
) -> Result<(), EvalError> {
    graph.register_node(ids.source)?;
    graph.register_node_with_dependencies(ids.edit, &[ids.source])?;
    graph.register_node_with_dependencies(ids.subdivision, &[ids.edit])?;
    graph.register_node_with_dependencies(ids.normals, &[ids.subdivision])?;
    graph.register_node_with_dependencies(ids.viewport, &[ids.normals])?;
    Ok(())
}

fn get_scene(ctx: &EvalContext) -> Result<Arc<RwLock<SceneWorld>>, EvalError> {
    ctx.get_resource::<Arc<RwLock<SceneWorld>>>()
        .cloned()
        .ok_or(EvalError::CacheTypeMismatch(NodeId(0)))
}

pub struct MeshSourceNode {
    pub id: NodeId,
    pub mesh_handle: MeshHandle,
    dependencies: Vec<NodeId>,
}

impl MeshSourceNode {
    pub fn new(id: NodeId, mesh_handle: MeshHandle) -> Self {
        Self {
            id,
            mesh_handle,
            dependencies: Vec::new(),
        }
    }
}

impl EvalNode for MeshSourceNode {
    type Output = MeshPayload;

    fn id(&self) -> NodeId {
        self.id
    }

    fn dependencies(&self) -> &[NodeId] {
        &self.dependencies
    }

    fn evaluate(&self, ctx: &mut EvalContext) -> Result<Self::Output, EvalError> {
        let scene = get_scene(ctx)?;
        let source = scene
            .read()
            .unwrap()
            .mesh_source(self.mesh_handle)
            .map_err(|_| EvalError::NodeNotFound(self.id))?;

        let vertices = source
            .positions
            .chunks_exact(3)
            .map(|chunk| Vec3::new(chunk[0], chunk[1], chunk[2]))
            .collect();
        let normals = source.normals.as_ref().map(|values| {
            values
                .chunks_exact(3)
                .map(|chunk| Vec3::new(chunk[0], chunk[1], chunk[2]))
                .collect()
        });

        Ok(MeshPayload {
            mesh_handle: self.mesh_handle,
            vertices,
            indices: source.indices.as_ref().to_vec(),
            normals,
            edit_count: 0,
        })
    }
}

pub struct MeshEditNode {
    pub id: NodeId,
    pub mesh_handle: MeshHandle,
    dependencies: Vec<NodeId>,
}

impl MeshEditNode {
    pub fn new(id: NodeId, mesh_handle: MeshHandle, source: NodeId) -> Self {
        Self {
            id,
            mesh_handle,
            dependencies: vec![source],
        }
    }
}

impl EvalNode for MeshEditNode {
    type Output = MeshPayload;

    fn id(&self) -> NodeId {
        self.id
    }

    fn dependencies(&self) -> &[NodeId] {
        &self.dependencies
    }

    fn evaluate(&self, ctx: &mut EvalContext) -> Result<Self::Output, EvalError> {
        let mut payload = ctx
            .get::<MeshPayload>(self.dependencies[0])
            .cloned()
            .ok_or(EvalError::CacheTypeMismatch(self.dependencies[0]))?;

        let scene = get_scene(ctx)?;
        let edits = scene
            .read()
            .unwrap()
            .mesh_edit_stack(self.mesh_handle)
            .map_err(|_| EvalError::NodeNotFound(self.id))?;
        payload.edit_count = edits.edits.len();

        Ok(payload)
    }
}

pub struct SubdivisionNode {
    pub id: NodeId,
    pub mesh_handle: MeshHandle,
    dependencies: Vec<NodeId>,
}

impl SubdivisionNode {
    pub fn new(id: NodeId, mesh_handle: MeshHandle, edit: NodeId) -> Self {
        Self {
            id,
            mesh_handle,
            dependencies: vec![edit],
        }
    }
}

impl EvalNode for SubdivisionNode {
    type Output = MeshPayload;

    fn id(&self) -> NodeId {
        self.id
    }

    fn dependencies(&self) -> &[NodeId] {
        &self.dependencies
    }

    fn evaluate(&self, ctx: &mut EvalContext) -> Result<Self::Output, EvalError> {
        let payload = ctx
            .get::<MeshPayload>(self.dependencies[0])
            .cloned()
            .ok_or(EvalError::CacheTypeMismatch(self.dependencies[0]))?;

        let scene = get_scene(ctx)?;
        let settings = scene
            .read()
            .unwrap()
            .subdivision_settings(self.mesh_handle)
            .map_err(|_| EvalError::NodeNotFound(self.id))?;

        let input_mesh = Mesh {
            vertices: payload.vertices.clone(),
            indices: payload.indices.clone(),
            normals: payload.normals.clone(),
            uvs: None,
            colors: None,
        };

        let output_mesh = match settings.algorithm {
            SubdivisionAlgorithm::Loop => {
                subdivision::loop_subdivision(&input_mesh, settings.level as usize)
            }
            SubdivisionAlgorithm::CatmullClark => {
                subdivision::catmull_clark(&input_mesh, settings.level as usize)
            }
        }
        .map_err(|_| EvalError::NodeNotFound(self.id))?;

        Ok(MeshPayload {
            mesh_handle: payload.mesh_handle,
            vertices: output_mesh.vertices,
            indices: output_mesh.indices,
            normals: output_mesh.normals,
            edit_count: payload.edit_count,
        })
    }
}

pub struct NormalsNode {
    pub id: NodeId,
    dependencies: Vec<NodeId>,
}

impl NormalsNode {
    pub fn new(id: NodeId, subdivision: NodeId) -> Self {
        Self {
            id,
            dependencies: vec![subdivision],
        }
    }
}

impl EvalNode for NormalsNode {
    type Output = MeshPayload;

    fn id(&self) -> NodeId {
        self.id
    }

    fn dependencies(&self) -> &[NodeId] {
        &self.dependencies
    }

    fn evaluate(&self, ctx: &mut EvalContext) -> Result<Self::Output, EvalError> {
        let payload = ctx
            .get::<MeshPayload>(self.dependencies[0])
            .cloned()
            .ok_or(EvalError::CacheTypeMismatch(self.dependencies[0]))?;

        let mut mesh = Mesh {
            vertices: payload.vertices.clone(),
            indices: payload.indices.clone(),
            normals: payload.normals.clone(),
            uvs: None,
            colors: None,
        };
        mesh.compute_normals();

        Ok(MeshPayload {
            mesh_handle: payload.mesh_handle,
            vertices: mesh.vertices,
            indices: mesh.indices,
            normals: mesh.normals,
            edit_count: payload.edit_count,
        })
    }
}

pub struct ViewportBuffersNode {
    pub id: NodeId,
    pub mesh_handle: MeshHandle,
    dependencies: Vec<NodeId>,
}

impl ViewportBuffersNode {
    pub fn new(id: NodeId, mesh_handle: MeshHandle, normals: NodeId) -> Self {
        Self {
            id,
            mesh_handle,
            dependencies: vec![normals],
        }
    }
}

impl EvalNode for ViewportBuffersNode {
    type Output = ViewportBufferPayload;

    fn id(&self) -> NodeId {
        self.id
    }

    fn dependencies(&self) -> &[NodeId] {
        &self.dependencies
    }

    fn evaluate(&self, ctx: &mut EvalContext) -> Result<Self::Output, EvalError> {
        let payload = ctx
            .get::<MeshPayload>(self.dependencies[0])
            .cloned()
            .ok_or(EvalError::CacheTypeMismatch(self.dependencies[0]))?;
        let scene = get_scene(ctx)?;
        let viewport = scene
            .read()
            .unwrap()
            .viewport_state(self.mesh_handle)
            .map_err(|_| EvalError::NodeNotFound(self.id))?;

        let positions = payload
            .vertices
            .iter()
            .flat_map(|v| [v.x, v.y, v.z])
            .collect::<Vec<_>>();
        let normals = payload
            .normals
            .unwrap_or_default()
            .iter()
            .flat_map(|n| [n.x, n.y, n.z])
            .collect::<Vec<_>>();

        Ok(ViewportBufferPayload {
            mesh_handle: payload.mesh_handle,
            vertex_count: positions.len() / 3,
            index_count: payload.indices.len(),
            positions,
            normals,
            indices: payload.indices,
            shading_mode: viewport.shading_mode,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{DirtyReason, EvalContext, EvalGraph};
    use k_os_scene::{SceneWorld, SubdivisionAlgorithm, SubdivisionSettingsComponent};
    use std::sync::{Arc, RwLock};

    fn make_scene_with_triangle() -> (Arc<RwLock<SceneWorld>>, MeshHandle) {
        let mut scene = SceneWorld::new();
        let mesh = scene.create_mesh(
            vec![0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0],
            vec![0, 1, 2],
            None,
        );
        scene
            .update_subdivision_settings(
                mesh,
                SubdivisionSettingsComponent {
                    level: 1,
                    algorithm: SubdivisionAlgorithm::Loop,
                },
            )
            .expect("subdivision settings update");
        (Arc::new(RwLock::new(scene)), mesh)
    }

    #[test]
    fn evaluates_mesh_pipeline_and_subdivision_increases_triangles() {
        let (scene, mesh_handle) = make_scene_with_triangle();
        let ids = MeshPipelineIds::from_seed(100);
        let mut graph = EvalGraph::new();
        register_mesh_pipeline(&mut graph, ids).unwrap();
        let mut ctx = EvalContext::default();
        ctx.insert_resource(scene);

        let source = MeshSourceNode::new(ids.source, mesh_handle);
        let edit = MeshEditNode::new(ids.edit, mesh_handle, ids.source);
        let subdiv = SubdivisionNode::new(ids.subdivision, mesh_handle, ids.edit);
        let normals = NormalsNode::new(ids.normals, ids.subdivision);
        let viewport = ViewportBuffersNode::new(ids.viewport, mesh_handle, ids.normals);

        graph.evaluate_registered_node(&source, &mut ctx).unwrap();
        graph.evaluate_registered_node(&edit, &mut ctx).unwrap();
        let (subdivided_index_count, subdivided_vertex_count) = {
            let subdivided = graph.evaluate_registered_node(&subdiv, &mut ctx).unwrap();
            (subdivided.indices.len(), subdivided.vertices.len())
        };
        let _ = graph.evaluate_registered_node(&normals, &mut ctx).unwrap();
        let viewport_payload = graph.evaluate_registered_node(&viewport, &mut ctx).unwrap();

        assert!(subdivided_index_count > 3);
        assert_eq!(viewport_payload.index_count, subdivided_index_count);
        assert_eq!(viewport_payload.vertex_count, subdivided_vertex_count);
    }

    #[test]
    fn dirtying_source_propagates_to_mesh_pipeline_nodes() {
        let (_scene, mesh_handle) = make_scene_with_triangle();
        let ids = MeshPipelineIds::from_seed(200);
        let mut graph = EvalGraph::new();
        register_mesh_pipeline(&mut graph, ids).unwrap();

        graph
            .mark_dirty(ids.source, DirtyReason::SourceChanged)
            .unwrap();
        assert!(graph.is_dirty(ids.edit).unwrap());
        assert!(graph.is_dirty(ids.subdivision).unwrap());
        assert!(graph.is_dirty(ids.normals).unwrap());
        assert!(graph.is_dirty(ids.viewport).unwrap());
        let _ = mesh_handle;
    }
}
