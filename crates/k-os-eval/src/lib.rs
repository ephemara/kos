use serde::{Deserialize, Serialize};
use std::any::{Any, TypeId};
use std::collections::{HashMap, HashSet, VecDeque};
use thiserror::Error;

pub mod linalg;
pub mod mesh_pipeline;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, PartialOrd, Ord)]
pub struct NodeId(pub u64);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DirtyReason {
    SourceChanged,
    ParameterChanged,
    TopologyChanged,
    ViewStateChanged,
}

#[derive(Debug, Error)]
pub enum EvalError {
    #[error("node already registered: {0:?}")]
    NodeAlreadyRegistered(NodeId),
    #[error("node not found: {0:?}")]
    NodeNotFound(NodeId),
    #[error("adding dependency would create a cycle: {from:?} -> {to:?}")]
    CycleDetected { from: NodeId, to: NodeId },
    #[error("cached value has unexpected type for node {0:?}")]
    CacheTypeMismatch(NodeId),
}

pub trait EvalNode {
    type Output: Send + Sync + 'static;

    fn id(&self) -> NodeId;
    fn dependencies(&self) -> &[NodeId];
    fn evaluate(&self, ctx: &mut EvalContext) -> Result<Self::Output, EvalError>;
}

#[derive(Default)]
pub struct EvalContext {
    cache: HashMap<NodeId, Box<dyn Any + Send + Sync>>,
    versions: HashMap<NodeId, u64>,
    resources: HashMap<TypeId, Box<dyn Any + Send + Sync>>,
}

impl EvalContext {
    pub fn get<T: Send + Sync + 'static>(&self, node_id: NodeId) -> Option<&T> {
        self.cache.get(&node_id)?.downcast_ref::<T>()
    }

    pub fn put<T: Send + Sync + 'static>(&mut self, node_id: NodeId, value: T) -> &T {
        let entry = self.cache.insert(node_id, Box::new(value));
        let _ = entry;

        let version = self.versions.entry(node_id).or_default();
        *version += 1;

        self.cache
            .get(&node_id)
            .expect("cache entry must exist after insert")
            .downcast_ref::<T>()
            .expect("cache entry type must match inserted value")
    }

    pub fn invalidate(&mut self, node_id: NodeId) {
        self.cache.remove(&node_id);
    }

    pub fn version(&self, node_id: NodeId) -> Option<u64> {
        self.versions.get(&node_id).copied()
    }

    pub fn insert_resource<T: Send + Sync + 'static>(&mut self, value: T) {
        self.resources.insert(TypeId::of::<T>(), Box::new(value));
    }

    pub fn get_resource<T: Send + Sync + 'static>(&self) -> Option<&T> {
        self.resources.get(&TypeId::of::<T>())?.downcast_ref::<T>()
    }
}

#[derive(Debug, Clone)]
struct NodeState {
    dependencies: HashSet<NodeId>,
    dependents: HashSet<NodeId>,
    dirty: bool,
    last_reason: Option<DirtyReason>,
}

impl Default for NodeState {
    fn default() -> Self {
        Self {
            dependencies: HashSet::new(),
            dependents: HashSet::new(),
            dirty: true,
            last_reason: None,
        }
    }
}

pub struct EvalGraph {
    nodes: HashMap<NodeId, NodeState>,
}

impl Default for EvalGraph {
    fn default() -> Self {
        Self::new()
    }
}

impl EvalGraph {
    pub fn new() -> Self {
        Self {
            nodes: HashMap::new(),
        }
    }

    pub fn register_node(&mut self, node_id: NodeId) -> Result<(), EvalError> {
        if self.nodes.contains_key(&node_id) {
            return Err(EvalError::NodeAlreadyRegistered(node_id));
        }

        self.nodes.insert(node_id, NodeState::default());
        Ok(())
    }

    pub fn register_node_with_dependencies(
        &mut self,
        node_id: NodeId,
        dependencies: &[NodeId],
    ) -> Result<(), EvalError> {
        self.register_node(node_id)?;
        for dependency in dependencies {
            self.add_dependency(node_id, *dependency)?;
        }
        Ok(())
    }

    pub fn add_dependency(&mut self, node_id: NodeId, dependency: NodeId) -> Result<(), EvalError> {
        if !self.nodes.contains_key(&node_id) {
            return Err(EvalError::NodeNotFound(node_id));
        }
        if !self.nodes.contains_key(&dependency) {
            return Err(EvalError::NodeNotFound(dependency));
        }
        if self.has_path(node_id, dependency) || node_id == dependency {
            return Err(EvalError::CycleDetected {
                from: node_id,
                to: dependency,
            });
        }

        self.nodes
            .get_mut(&node_id)
            .expect("validated node")
            .dependencies
            .insert(dependency);
        self.nodes
            .get_mut(&dependency)
            .expect("validated dependency")
            .dependents
            .insert(node_id);

        Ok(())
    }

    pub fn mark_dirty(&mut self, node_id: NodeId, reason: DirtyReason) -> Result<(), EvalError> {
        if !self.nodes.contains_key(&node_id) {
            return Err(EvalError::NodeNotFound(node_id));
        }

        let mut queue = VecDeque::from([node_id]);
        let mut visited = HashSet::new();

        while let Some(current) = queue.pop_front() {
            if !visited.insert(current) {
                continue;
            }

            let dependents = {
                let state = self.nodes.get_mut(&current).expect("validated node");
                state.dirty = true;
                state.last_reason = Some(reason);
                state.dependents.iter().copied().collect::<Vec<_>>()
            };

            for dependent in dependents {
                queue.push_back(dependent);
            }
        }

        Ok(())
    }

    pub fn is_dirty(&self, node_id: NodeId) -> Result<bool, EvalError> {
        self.nodes
            .get(&node_id)
            .map(|node| node.dirty)
            .ok_or(EvalError::NodeNotFound(node_id))
    }

    pub fn topological_order(&self) -> Result<Vec<NodeId>, EvalError> {
        let mut in_degree: HashMap<NodeId, usize> = self
            .nodes
            .iter()
            .map(|(id, state)| (*id, state.dependencies.len()))
            .collect();
        let mut queue: VecDeque<NodeId> = in_degree
            .iter()
            .filter_map(|(id, degree)| if *degree == 0 { Some(*id) } else { None })
            .collect();
        let mut order = Vec::with_capacity(self.nodes.len());

        while let Some(node_id) = queue.pop_front() {
            order.push(node_id);

            if let Some(state) = self.nodes.get(&node_id) {
                for dependent in &state.dependents {
                    if let Some(entry) = in_degree.get_mut(dependent) {
                        *entry -= 1;
                        if *entry == 0 {
                            queue.push_back(*dependent);
                        }
                    }
                }
            }
        }

        if order.len() != self.nodes.len() {
            return Err(EvalError::CycleDetected {
                from: NodeId(0),
                to: NodeId(0),
            });
        }

        Ok(order)
    }

    pub fn evaluate_node<'a, T, F>(
        &mut self,
        node_id: NodeId,
        ctx: &'a mut EvalContext,
        eval_fn: F,
    ) -> Result<&'a T, EvalError>
    where
        T: Send + Sync + 'static,
        F: FnOnce(&mut EvalContext) -> Result<T, EvalError>,
    {
        let dirty = self.is_dirty(node_id)?;
        if !dirty {
            return ctx
                .get::<T>(node_id)
                .ok_or(EvalError::CacheTypeMismatch(node_id));
        }

        let value = eval_fn(ctx)?;
        let cached = ctx.put(node_id, value);
        if let Some(state) = self.nodes.get_mut(&node_id) {
            state.dirty = false;
        }

        Ok(cached)
    }

    pub fn evaluate_registered_node<'a, N: EvalNode>(
        &mut self,
        node: &N,
        ctx: &'a mut EvalContext,
    ) -> Result<&'a N::Output, EvalError> {
        self.evaluate_node(node.id(), ctx, |ctx| node.evaluate(ctx))
    }

    fn has_path(&self, start: NodeId, target: NodeId) -> bool {
        let mut stack = vec![start];
        let mut visited = HashSet::new();

        while let Some(current) = stack.pop() {
            if current == target {
                return true;
            }

            if !visited.insert(current) {
                continue;
            }

            if let Some(state) = self.nodes.get(&current) {
                stack.extend(state.dependents.iter().copied());
            }
        }

        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registers_nodes_and_rejects_cycles() {
        let mut graph = EvalGraph::new();
        graph.register_node(NodeId(1)).unwrap();
        graph.register_node(NodeId(2)).unwrap();
        graph.add_dependency(NodeId(2), NodeId(1)).unwrap();

        let cycle = graph.add_dependency(NodeId(1), NodeId(2));
        assert!(matches!(cycle, Err(EvalError::CycleDetected { .. })));
    }

    #[test]
    fn produces_topological_order() {
        let mut graph = EvalGraph::new();
        graph.register_node(NodeId(1)).unwrap();
        graph.register_node(NodeId(2)).unwrap();
        graph.register_node(NodeId(3)).unwrap();
        graph.add_dependency(NodeId(2), NodeId(1)).unwrap();
        graph.add_dependency(NodeId(3), NodeId(2)).unwrap();

        let order = graph.topological_order().unwrap();
        assert_eq!(order, vec![NodeId(1), NodeId(2), NodeId(3)]);
    }

    #[test]
    fn propagates_dirty_to_dependents() {
        let mut graph = EvalGraph::new();
        graph.register_node(NodeId(1)).unwrap();
        graph.register_node(NodeId(2)).unwrap();
        graph.register_node(NodeId(3)).unwrap();
        graph.add_dependency(NodeId(2), NodeId(1)).unwrap();
        graph.add_dependency(NodeId(3), NodeId(2)).unwrap();

        graph
            .evaluate_node(NodeId(1), &mut EvalContext::default(), |_| {
                Ok::<_, EvalError>(1i32)
            })
            .unwrap();
        graph
            .mark_dirty(NodeId(1), DirtyReason::SourceChanged)
            .unwrap();

        assert!(graph.is_dirty(NodeId(1)).unwrap());
        assert!(graph.is_dirty(NodeId(2)).unwrap());
        assert!(graph.is_dirty(NodeId(3)).unwrap());
    }

    #[test]
    fn caches_evaluation_results_until_dirty() {
        let mut graph = EvalGraph::new();
        graph.register_node(NodeId(42)).unwrap();
        let mut ctx = EvalContext::default();
        let mut call_count = 0usize;

        let first = graph
            .evaluate_node(NodeId(42), &mut ctx, |_| {
                call_count += 1;
                Ok::<_, EvalError>(99usize)
            })
            .unwrap();
        assert_eq!(*first, 99);
        assert_eq!(call_count, 1);

        let second = graph
            .evaluate_node(NodeId(42), &mut ctx, |_| {
                call_count += 1;
                Ok::<_, EvalError>(100usize)
            })
            .unwrap();
        assert_eq!(*second, 99);
        assert_eq!(call_count, 1);

        graph
            .mark_dirty(NodeId(42), DirtyReason::ParameterChanged)
            .unwrap();
        let third = graph
            .evaluate_node(NodeId(42), &mut ctx, |_| {
                call_count += 1;
                Ok::<_, EvalError>(101usize)
            })
            .unwrap();
        assert_eq!(*third, 101);
        assert_eq!(call_count, 2);
    }
}
