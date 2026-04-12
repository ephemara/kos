#![allow(dead_code)]
#![allow(unused_variables)]

pub mod kain_gpu_generated {
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub enum ShaderStage {
        Vertex,
        Fragment,
        Compute,
        Surface,
    }

    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub enum BindingKind {
        StorageBuffer,
        Sampler2D,
        Uniform,
        LocalSize,
        SpecializationConstant,
    }

    #[derive(Debug, Clone, Copy)]
    pub struct BindingDesc {
        pub name: &'static str,
        pub binding: u32,
        pub descriptor_set: u32,
        pub ty: &'static str,
        pub kind: BindingKind,
    }

    #[derive(Debug, Clone, Copy)]
    pub struct BindingLayoutEntry {
        pub binding: u32,
        pub descriptor_set: u32,
        pub kind: BindingKind,
        pub ty: &'static str,
    }

    #[derive(Debug, Clone, Copy)]
    pub struct DispatchSize {
        pub x: u32,
        pub y: u32,
        pub z: u32,
    }

    #[derive(Debug, Clone)]
    pub struct BuiltinInputParam {
        pub name: &'static str,
        pub ty: &'static str,
    }

    #[derive(Debug, Clone)]
    pub struct UniformParam {
        pub ty: &'static str,
    }

    #[derive(Debug, Clone)]
    pub struct StorageBufferParam {
        pub ty: &'static str,
        pub read_only: bool,
    }

    #[derive(Debug, Clone)]
    pub struct Sampler2DParam {
        pub ty: &'static str,
    }

    #[derive(Debug, Clone)]
    pub struct LocalSizeParam {
        pub axis: &'static str,
        pub default_value: u32,
    }

    #[derive(Debug, Clone)]
    pub struct SpecializationConstantParam {
        pub ty: &'static str,
    }

    #[derive(Debug, Clone)]
    pub struct DispatchCall<'a, TParams> {
        pub entry_point: &'static str,
        pub stage: ShaderStage,
        pub size: DispatchSize,
        pub params: &'a TParams,
    }

    #[derive(Debug, Clone, Copy)]
    pub struct ShaderDesc {
        pub name: &'static str,
        pub stage: ShaderStage,
        pub entry_point: &'static str,
        pub output_type: &'static str,
        pub bindings: &'static [BindingDesc],
    }

    pub mod material_pbr_standard {
        use super::{
            BindingDesc, BindingKind, BindingLayoutEntry, BuiltinInputParam, DispatchCall,
            DispatchSize, LocalSizeParam, Sampler2DParam, ShaderDesc, ShaderStage,
            SpecializationConstantParam, StorageBufferParam, UniformParam,
        };

        #[derive(Debug, Clone)]
        pub struct Params {
            pub id: BuiltinInputParam,
            pub positions: StorageBufferParam,
            pub normals: StorageBufferParam,
            pub uvs: StorageBufferParam,
            pub tangents: StorageBufferParam,
            pub albedo_map: Sampler2DParam,
            pub normal_map: Sampler2DParam,
            pub metallic_map: Sampler2DParam,
            pub roughness_map: Sampler2DParam,
            pub ao_map: Sampler2DParam,
            pub emissive_map: Sampler2DParam,
            pub base_color: UniformParam,
            pub metallic_factor: UniformParam,
            pub roughness_factor: UniformParam,
            pub emissive_strength: UniformParam,
            pub normal_strength: UniformParam,
            pub ao_strength: UniformParam,
            pub camera_position: UniformParam,
            pub sun_direction: UniformParam,
            pub sun_color: UniformParam,
            pub sun_intensity: UniformParam,
            pub ambient_color: UniformParam,
            pub viewport_width: UniformParam,
            pub viewport_height: UniformParam,
            pub color_out: StorageBufferParam,
            pub cfg_enable_normal_mapping: SpecializationConstantParam,
            pub cfg_enable_ao: SpecializationConstantParam,
            pub cfg_enable_emissive: SpecializationConstantParam,
            pub cfg_high_quality: SpecializationConstantParam,
            pub local_size_x: LocalSizeParam,
            pub local_size_y: LocalSizeParam,
        }

        impl Default for Params {
            fn default() -> Self {
                Self {
                    id: BuiltinInputParam { name: "id", ty: "UVec3" },
                    positions: StorageBufferParam { ty: "StorageBuffer<Vec4>", read_only: false },
                    normals: StorageBufferParam { ty: "StorageBuffer<Vec4>", read_only: false },
                    uvs: StorageBufferParam { ty: "StorageBuffer<Vec4>", read_only: false },
                    tangents: StorageBufferParam { ty: "StorageBuffer<Vec4>", read_only: false },
                    albedo_map: Sampler2DParam { ty: "Sampler2D" },
                    normal_map: Sampler2DParam { ty: "Sampler2D" },
                    metallic_map: Sampler2DParam { ty: "Sampler2D" },
                    roughness_map: Sampler2DParam { ty: "Sampler2D" },
                    ao_map: Sampler2DParam { ty: "Sampler2D" },
                    emissive_map: Sampler2DParam { ty: "Sampler2D" },
                    base_color: UniformParam { ty: "Vec4" },
                    metallic_factor: UniformParam { ty: "Float" },
                    roughness_factor: UniformParam { ty: "Float" },
                    emissive_strength: UniformParam { ty: "Float" },
                    normal_strength: UniformParam { ty: "Float" },
                    ao_strength: UniformParam { ty: "Float" },
                    camera_position: UniformParam { ty: "Vec4" },
                    sun_direction: UniformParam { ty: "Vec4" },
                    sun_color: UniformParam { ty: "Vec4" },
                    sun_intensity: UniformParam { ty: "Float" },
                    ambient_color: UniformParam { ty: "Vec3" },
                    viewport_width: UniformParam { ty: "UInt" },
                    viewport_height: UniformParam { ty: "UInt" },
                    color_out: StorageBufferParam { ty: "StorageBuffer<Vec4>", read_only: false },
                    cfg_enable_normal_mapping: SpecializationConstantParam { ty: "UInt" },
                    cfg_enable_ao: SpecializationConstantParam { ty: "UInt" },
                    cfg_enable_emissive: SpecializationConstantParam { ty: "UInt" },
                    cfg_high_quality: SpecializationConstantParam { ty: "UInt" },
                    local_size_x: LocalSizeParam { axis: "X", default_value: 8 },
                    local_size_y: LocalSizeParam { axis: "Y", default_value: 8 },
                }
            }
        }

        pub const BINDINGS: &[BindingDesc] = &[
            BindingDesc { name: "positions", binding: 0, descriptor_set: 0, ty: "StorageBuffer<Vec4>", kind: BindingKind::StorageBuffer, },
            BindingDesc { name: "normals", binding: 1, descriptor_set: 0, ty: "StorageBuffer<Vec4>", kind: BindingKind::StorageBuffer, },
            BindingDesc { name: "uvs", binding: 2, descriptor_set: 0, ty: "StorageBuffer<Vec4>", kind: BindingKind::StorageBuffer, },
            BindingDesc { name: "tangents", binding: 3, descriptor_set: 0, ty: "StorageBuffer<Vec4>", kind: BindingKind::StorageBuffer, },
            BindingDesc { name: "albedo_map", binding: 4, descriptor_set: 0, ty: "Sampler2D", kind: BindingKind::Sampler2D, },
            BindingDesc { name: "normal_map", binding: 5, descriptor_set: 0, ty: "Sampler2D", kind: BindingKind::Sampler2D, },
            BindingDesc { name: "metallic_map", binding: 6, descriptor_set: 0, ty: "Sampler2D", kind: BindingKind::Sampler2D, },
            BindingDesc { name: "roughness_map", binding: 7, descriptor_set: 0, ty: "Sampler2D", kind: BindingKind::Sampler2D, },
            BindingDesc { name: "ao_map", binding: 8, descriptor_set: 0, ty: "Sampler2D", kind: BindingKind::Sampler2D, },
            BindingDesc { name: "emissive_map", binding: 9, descriptor_set: 0, ty: "Sampler2D", kind: BindingKind::Sampler2D, },
            BindingDesc { name: "base_color", binding: 10, descriptor_set: 0, ty: "Vec4", kind: BindingKind::Uniform, },
            BindingDesc { name: "metallic_factor", binding: 11, descriptor_set: 0, ty: "Float", kind: BindingKind::Uniform, },
            BindingDesc { name: "roughness_factor", binding: 12, descriptor_set: 0, ty: "Float", kind: BindingKind::Uniform, },
            BindingDesc { name: "emissive_strength", binding: 13, descriptor_set: 0, ty: "Float", kind: BindingKind::Uniform, },
            BindingDesc { name: "normal_strength", binding: 14, descriptor_set: 0, ty: "Float", kind: BindingKind::Uniform, },
            BindingDesc { name: "ao_strength", binding: 15, descriptor_set: 0, ty: "Float", kind: BindingKind::Uniform, },
            BindingDesc { name: "camera_position", binding: 16, descriptor_set: 0, ty: "Vec4", kind: BindingKind::Uniform, },
            BindingDesc { name: "sun_direction", binding: 17, descriptor_set: 0, ty: "Vec4", kind: BindingKind::Uniform, },
            BindingDesc { name: "sun_color", binding: 18, descriptor_set: 0, ty: "Vec4", kind: BindingKind::Uniform, },
            BindingDesc { name: "sun_intensity", binding: 19, descriptor_set: 0, ty: "Float", kind: BindingKind::Uniform, },
            BindingDesc { name: "ambient_color", binding: 20, descriptor_set: 0, ty: "Vec3", kind: BindingKind::Uniform, },
            BindingDesc { name: "viewport_width", binding: 21, descriptor_set: 0, ty: "UInt", kind: BindingKind::Uniform, },
            BindingDesc { name: "viewport_height", binding: 22, descriptor_set: 0, ty: "UInt", kind: BindingKind::Uniform, },
            BindingDesc { name: "color_out", binding: 23, descriptor_set: 0, ty: "StorageBuffer<Vec4>", kind: BindingKind::StorageBuffer, },
            BindingDesc { name: "CFG_ENABLE_NORMAL_MAPPING", binding: 100, descriptor_set: 0, ty: "UInt", kind: BindingKind::SpecializationConstant, },
            BindingDesc { name: "CFG_ENABLE_AO", binding: 101, descriptor_set: 0, ty: "UInt", kind: BindingKind::SpecializationConstant, },
            BindingDesc { name: "CFG_ENABLE_EMISSIVE", binding: 102, descriptor_set: 0, ty: "UInt", kind: BindingKind::SpecializationConstant, },
            BindingDesc { name: "CFG_HIGH_QUALITY", binding: 103, descriptor_set: 0, ty: "UInt", kind: BindingKind::SpecializationConstant, },
            BindingDesc { name: "LOCAL_SIZE_X", binding: 104, descriptor_set: 0, ty: "UInt", kind: BindingKind::LocalSize, },
            BindingDesc { name: "LOCAL_SIZE_Y", binding: 105, descriptor_set: 0, ty: "UInt", kind: BindingKind::LocalSize, },
        ];

        pub const SHADER: ShaderDesc = ShaderDesc { name: "material_pbr_standard", stage: ShaderStage::Compute, entry_point: "material_pbr_standard", output_type: "Vec4", bindings: BINDINGS, };

        pub fn descriptor() -> &'static ShaderDesc {
            &SHADER
        }

        pub fn descriptor_layout() -> Vec<BindingLayoutEntry> {
            BINDINGS
                .iter()
                .map(|binding| BindingLayoutEntry {
                    binding: binding.binding,
                    descriptor_set: binding.descriptor_set,
                    kind: binding.kind,
                    ty: binding.ty,
                })
                .collect()
        }

        pub fn dispatch<'a>(params: &'a Params, x: u32, y: u32, z: u32) -> DispatchCall<'a, Params> {
            DispatchCall {
                entry_point: "material_pbr_standard",
                stage: ShaderStage::Compute,
                size: DispatchSize { x, y, z },
                params,
            }
        }
    }

    pub fn shaders() -> &'static [ShaderDesc] {
        &[
            material_pbr_standard::SHADER,
        ]
    }
}
