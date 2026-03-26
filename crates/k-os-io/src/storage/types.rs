//! Asset types and handles for OptiMatrix storage system

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Unique identifier for stored assets
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct AssetHandle(pub u64);

impl AssetHandle {
    /// Generate a new unique handle
    pub fn new() -> Self {
        use std::sync::atomic::{AtomicU64, Ordering};
        static COUNTER: AtomicU64 = AtomicU64::new(1);
        Self(COUNTER.fetch_add(1, Ordering::SeqCst))
    }
}

impl Default for AssetHandle {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for AssetHandle {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Asset type enumeration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Asset {
    Mesh(MeshAsset),
    Animation(AnimationAsset),
    Texture(TextureAsset),
    Material(MaterialAsset),
    SceneGraph(SceneGraphAsset),
    BinaryBlob(Vec<u8>),
}

/// Asset type identifier
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum AssetType {
    Mesh,
    Animation,
    Texture,
    Material,
    SceneGraph,
    BinaryBlob,
}

impl Asset {
    pub fn asset_type(&self) -> AssetType {
        match self {
            Asset::Mesh(_) => AssetType::Mesh,
            Asset::Animation(_) => AssetType::Animation,
            Asset::Texture(_) => AssetType::Texture,
            Asset::Material(_) => AssetType::Material,
            Asset::SceneGraph(_) => AssetType::SceneGraph,
            Asset::BinaryBlob(_) => AssetType::BinaryBlob,
        }
    }
}

/// Mesh asset data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshAsset {
    pub positions: Vec<f32>,        // [x,y,z, x,y,z, ...]
    pub indices: Vec<u32>,          // Triangle indices
    pub normals: Option<Vec<f32>>,  // Per-vertex normals
    pub uvs: Option<Vec<f32>>,      // UV coordinates
    pub tangents: Option<Vec<f32>>, // Tangent space
    pub colors: Option<Vec<f32>>,   // Vertex colors
}

/// Animation asset data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnimationAsset {
    pub duration: f32,
    pub keyframes: Vec<Keyframe>,
    pub curves: Vec<AnimationCurve>,
    pub skeleton: Option<SkeletonData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Keyframe {
    pub time: f32,
    pub transform: Transform,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnimationCurve {
    pub target: String,
    pub property: String,
    pub keyframes: Vec<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkeletonData {
    pub bones: Vec<Bone>,
    pub bind_poses: Vec<Transform>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bone {
    pub name: String,
    pub parent: Option<usize>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Transform {
    pub translation: [f32; 3],
    pub rotation: [f32; 4], // Quaternion
    pub scale: [f32; 3],
}

/// Texture asset data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextureAsset {
    pub width: u32,
    pub height: u32,
    pub depth: u32,            // 1 for 2D, 6 for cubemap, N for 3D
    pub format: TextureFormat, // RGBA8, RGBA16F, BC7, etc.
    pub mip_levels: u32,
    pub data: Vec<u8>, // Raw pixel data
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TextureFormat {
    RGBA8,
    RGBA16F,
    RGBA32F,
    BC7,
    BC5,
    ETC2,
}

/// Material definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaterialAsset {
    pub shader: String,
    pub parameters: HashMap<String, MaterialParam>,
    pub textures: HashMap<String, AssetHandle>, // References to texture assets
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MaterialParam {
    Float(f32),
    Vec2([f32; 2]),
    Vec3([f32; 3]),
    Vec4([f32; 4]),
    Int(i32),
    Bool(bool),
}

/// Scene graph hierarchy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SceneGraphAsset {
    pub nodes: Vec<SceneNode>,
    pub root_indices: Vec<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SceneNode {
    pub name: String,
    pub transform: Transform,
    pub mesh: Option<AssetHandle>,
    pub material: Option<AssetHandle>,
    pub children: Vec<usize>,
}

/// Asset metadata for queries
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetMetadata {
    pub handle: AssetHandle,
    pub asset_type: AssetType,
    pub project_id: String,
    pub tags: Vec<String>,
    pub size_bytes: u64,
    pub created_at: i64,
    pub modified_at: i64,
    pub version: u32,
    pub dependencies: Vec<AssetHandle>,
    pub content_hash: [u8; 32], // BLAKE3 for entanglement
}
