use bevy::prelude::*;
use bevy::render::render_resource::*;
use bevy::pbr::MaterialPipeline;
use bevy::render::render_resource::ShaderRef;

// Brush cursor material with dynamic properties
#[derive(Clone, Copy, Debug, ShaderType)]
pub struct BrushCursorData {
    pub color: Vec4,
    pub radius: f32,
    pub falloff: f32,
    pub alpha: f32,
    // For grab brush delta visualization
    pub show_delta: f32,
    pub delta_start: Vec3,
    pub delta_end: Vec3,
    pub _padding: f32,
}

impl Default for BrushCursorData {
    fn default() -> Self {
        Self {
            color: Vec4::new(0.0, 1.0, 1.0, 1.0), // Cyan color
            radius: 0.1,
            falloff: 0.3,
            alpha: 0.8,
            show_delta: 0.0,
            delta_start: Vec3::ZERO,
            delta_end: Vec3::ZERO,
            _padding: 0.0,
        }
    }
}

// Custom material for brush cursor
#[derive(Asset, AsBindGroup, Reflect, Debug, Clone)]
pub struct BrushCursorMaterial {
    #[uniform(0)]
    data: BrushCursorData,
}

impl Default for BrushCursorMaterial {
    fn default() -> Self {
        Self {
            data: BrushCursorData::default(),
        }
    }
}

impl BrushCursorMaterial {
    pub fn new(color: Color, radius: f32, falloff: f32) -> Self {
        Self {
            data: BrushCursorData {
                color: color.to_linear().to_vec4(),
                radius,
                falloff,
                alpha: 0.8,
                show_delta: 0.0,
                delta_start: Vec3::ZERO,
                delta_end: Vec3::ZERO,
                _padding: 0.0,
            },
        }
    }
    
    pub fn set_radius(&mut self, radius: f32) {
        self.data.radius = radius;
    }
    
    pub fn set_falloff(&mut self, falloff: f32) {
        self.data.falloff = falloff;
    }
    
    pub fn show_delta(&mut self, start: Vec3, end: Vec3) {
        self.data.show_delta = 1.0;
        self.data.delta_start = start;
        self.data.delta_end = end;
    }
    
    pub fn hide_delta(&mut self) {
        self.data.show_delta = 0.0;
    }
}

impl Material for BrushCursorMaterial {
    fn vertex_shader() -> ShaderRef {
        "shaders/brush_cursor.wgsl".into()
    }
    
    fn fragment_shader() -> ShaderRef {
        "shaders/brush_cursor.wgsl".into()
    }
    
    fn alpha_mode(&self) -> AlphaMode {
        AlphaMode::Blend
    }
    
    fn specialize(_pipeline: &mut MaterialPipeline<Self>, descriptor: &mut RenderPipelineDescriptor, layout: &MeshVertexBufferLayoutRef, _key: MaterialPipelineKey<Self>) {
        let vertex_layout = layout.0.get_layout(&[
            Mesh::ATTRIBUTE_POSITION.at_shader_location(0),
            Mesh::ATTRIBUTE_NORMAL.at_shader_location(1),
            Mesh::ATTRIBUTE_UV_0.at_shader_location(2),
        ]).unwrap();
        
        descriptor.vertex.buffers = vec![vertex_layout];
    }
}
