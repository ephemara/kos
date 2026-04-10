pub struct GeneratedSpirvLookupEntry {
    pub id: &'static str,
    pub asset: &'static crate::GeneratedSpirvAsset,
}

pub const MATERIAL_PBR_STANDARD_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/materials/material_pbr_standard.spv"));
pub static MATERIAL_PBR_STANDARD: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "material_pbr_standard",
    label: "Material PBR Standard",
    domain: crate::KainDomain::Materials,
    source_path: "crates/k-os-kain/domains/materials/material_pbr_standard.kn",
    compiled_path: "crates/k-os-kain/generated/spv/materials/material_pbr_standard.spv",
    bytes: MATERIAL_PBR_STANDARD_BYTES,
};
pub fn material_pbr_standard() -> &'static crate::GeneratedSpirvAsset { &MATERIAL_PBR_STANDARD }

pub const PAINT_SURFACE_FILTER_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/paint/paint_surface_filter.spv"));
pub static PAINT_SURFACE_FILTER: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "paint_surface_filter",
    label: "Paint Surface Filter",
    domain: crate::KainDomain::Paint,
    source_path: "crates/k-os-kain/domains/paint/paint_surface_filter.kn",
    compiled_path: "crates/k-os-kain/generated/spv/paint/paint_surface_filter.spv",
    bytes: PAINT_SURFACE_FILTER_BYTES,
};
pub fn paint_surface_filter() -> &'static crate::GeneratedSpirvAsset { &PAINT_SURFACE_FILTER }

pub const RENDERER_SURFACE_PASS_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/renderer/renderer_surface_pass.spv"));
pub static RENDERER_SURFACE_PASS: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "renderer_surface_pass",
    label: "Renderer Surface Pass",
    domain: crate::KainDomain::Renderer,
    source_path: "crates/k-os-kain/domains/renderer/renderer_surface_pass.kn",
    compiled_path: "crates/k-os-kain/generated/spv/renderer/renderer_surface_pass.spv",
    bytes: RENDERER_SURFACE_PASS_BYTES,
};
pub fn renderer_surface_pass() -> &'static crate::GeneratedSpirvAsset { &RENDERER_SURFACE_PASS }

pub const RENDERER_ZEN_ATMOSPHERE_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/renderer/renderer_zen_atmosphere.spv"));
pub static RENDERER_ZEN_ATMOSPHERE: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "renderer_zen_atmosphere",
    label: "Renderer Zen Atmosphere",
    domain: crate::KainDomain::Renderer,
    source_path: "crates/k-os-kain/domains/renderer/renderer_zen_atmosphere.kn",
    compiled_path: "crates/k-os-kain/generated/spv/renderer/renderer_zen_atmosphere.spv",
    bytes: RENDERER_ZEN_ATMOSPHERE_BYTES,
};
pub fn renderer_zen_atmosphere() -> &'static crate::GeneratedSpirvAsset { &RENDERER_ZEN_ATMOSPHERE }

pub const SCULPT_PHYSICS_ATTRACTOR_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/sculpting/sculpt_physics_attractor.spv"));
pub static SCULPT_PHYSICS_ATTRACTOR: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "sculpt_physics_attractor",
    label: "Sculpt Physics Attractor",
    domain: crate::KainDomain::Sculpting,
    source_path: "crates/k-os-kain/domains/sculpting/sculpt_physics_attractor.kn",
    compiled_path: "crates/k-os-kain/generated/spv/sculpting/sculpt_physics_attractor.spv",
    bytes: SCULPT_PHYSICS_ATTRACTOR_BYTES,
};
pub fn sculpt_physics_attractor() -> &'static crate::GeneratedSpirvAsset { &SCULPT_PHYSICS_ATTRACTOR }

pub const SCULPT_PHYSICS_ELASTIC_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/sculpting/sculpt_physics_elastic.spv"));
pub static SCULPT_PHYSICS_ELASTIC: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "sculpt_physics_elastic",
    label: "Sculpt Physics Elastic",
    domain: crate::KainDomain::Sculpting,
    source_path: "crates/k-os-kain/domains/sculpting/sculpt_physics_elastic.kn",
    compiled_path: "crates/k-os-kain/generated/spv/sculpting/sculpt_physics_elastic.spv",
    bytes: SCULPT_PHYSICS_ELASTIC_BYTES,
};
pub fn sculpt_physics_elastic() -> &'static crate::GeneratedSpirvAsset { &SCULPT_PHYSICS_ELASTIC }

pub const SCULPT_PHYSICS_GRAVITY_DROP_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/sculpting/sculpt_physics_gravity_drop.spv"));
pub static SCULPT_PHYSICS_GRAVITY_DROP: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "sculpt_physics_gravity_drop",
    label: "Sculpt Physics Gravity Drop",
    domain: crate::KainDomain::Sculpting,
    source_path: "crates/k-os-kain/domains/sculpting/sculpt_physics_gravity_drop.kn",
    compiled_path: "crates/k-os-kain/generated/spv/sculpting/sculpt_physics_gravity_drop.spv",
    bytes: SCULPT_PHYSICS_GRAVITY_DROP_BYTES,
};
pub fn sculpt_physics_gravity_drop() -> &'static crate::GeneratedSpirvAsset { &SCULPT_PHYSICS_GRAVITY_DROP }

pub const SCULPT_PHYSICS_INFLATE_PULSE_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/sculpting/sculpt_physics_inflate_pulse.spv"));
pub static SCULPT_PHYSICS_INFLATE_PULSE: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "sculpt_physics_inflate_pulse",
    label: "Sculpt Physics Inflate Pulse",
    domain: crate::KainDomain::Sculpting,
    source_path: "crates/k-os-kain/domains/sculpting/sculpt_physics_inflate_pulse.kn",
    compiled_path: "crates/k-os-kain/generated/spv/sculpting/sculpt_physics_inflate_pulse.spv",
    bytes: SCULPT_PHYSICS_INFLATE_PULSE_BYTES,
};
pub fn sculpt_physics_inflate_pulse() -> &'static crate::GeneratedSpirvAsset { &SCULPT_PHYSICS_INFLATE_PULSE }

pub const SCULPT_PHYSICS_MAGNET_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/sculpting/sculpt_physics_magnet.spv"));
pub static SCULPT_PHYSICS_MAGNET: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "sculpt_physics_magnet",
    label: "Sculpt Physics Magnet",
    domain: crate::KainDomain::Sculpting,
    source_path: "crates/k-os-kain/domains/sculpting/sculpt_physics_magnet.kn",
    compiled_path: "crates/k-os-kain/generated/spv/sculpting/sculpt_physics_magnet.spv",
    bytes: SCULPT_PHYSICS_MAGNET_BYTES,
};
pub fn sculpt_physics_magnet() -> &'static crate::GeneratedSpirvAsset { &SCULPT_PHYSICS_MAGNET }

pub const SCULPT_PHYSICS_TURBULENCE_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/sculpting/sculpt_physics_turbulence.spv"));
pub static SCULPT_PHYSICS_TURBULENCE: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "sculpt_physics_turbulence",
    label: "Sculpt Physics Turbulence",
    domain: crate::KainDomain::Sculpting,
    source_path: "crates/k-os-kain/domains/sculpting/sculpt_physics_turbulence.kn",
    compiled_path: "crates/k-os-kain/generated/spv/sculpting/sculpt_physics_turbulence.spv",
    bytes: SCULPT_PHYSICS_TURBULENCE_BYTES,
};
pub fn sculpt_physics_turbulence() -> &'static crate::GeneratedSpirvAsset { &SCULPT_PHYSICS_TURBULENCE }

pub const SCULPT_PHYSICS_VORTEX_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/sculpting/sculpt_physics_vortex.spv"));
pub static SCULPT_PHYSICS_VORTEX: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "sculpt_physics_vortex",
    label: "Sculpt Physics Vortex",
    domain: crate::KainDomain::Sculpting,
    source_path: "crates/k-os-kain/domains/sculpting/sculpt_physics_vortex.kn",
    compiled_path: "crates/k-os-kain/generated/spv/sculpting/sculpt_physics_vortex.spv",
    bytes: SCULPT_PHYSICS_VORTEX_BYTES,
};
pub fn sculpt_physics_vortex() -> &'static crate::GeneratedSpirvAsset { &SCULPT_PHYSICS_VORTEX }

pub const SCULPT_PHYSICS_WIND_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/sculpting/sculpt_physics_wind.spv"));
pub static SCULPT_PHYSICS_WIND: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "sculpt_physics_wind",
    label: "Sculpt Physics Wind",
    domain: crate::KainDomain::Sculpting,
    source_path: "crates/k-os-kain/domains/sculpting/sculpt_physics_wind.kn",
    compiled_path: "crates/k-os-kain/generated/spv/sculpting/sculpt_physics_wind.spv",
    bytes: SCULPT_PHYSICS_WIND_BYTES,
};
pub fn sculpt_physics_wind() -> &'static crate::GeneratedSpirvAsset { &SCULPT_PHYSICS_WIND }

pub const SCULPT_STAMP_BLOB_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/sculpting/sculpt_stamp_blob.spv"));
pub static SCULPT_STAMP_BLOB: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "sculpt_stamp_blob",
    label: "Sculpt Stamp Blob",
    domain: crate::KainDomain::Sculpting,
    source_path: "crates/k-os-kain/domains/sculpting/sculpt_stamp_blob.kn",
    compiled_path: "crates/k-os-kain/generated/spv/sculpting/sculpt_stamp_blob.spv",
    bytes: SCULPT_STAMP_BLOB_BYTES,
};
pub fn sculpt_stamp_blob() -> &'static crate::GeneratedSpirvAsset { &SCULPT_STAMP_BLOB }

pub const SCULPT_STAMP_CLAY_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/sculpting/sculpt_stamp_clay.spv"));
pub static SCULPT_STAMP_CLAY: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "sculpt_stamp_clay",
    label: "Sculpt Stamp Clay",
    domain: crate::KainDomain::Sculpting,
    source_path: "crates/k-os-kain/domains/sculpting/sculpt_stamp_clay.kn",
    compiled_path: "crates/k-os-kain/generated/spv/sculpting/sculpt_stamp_clay.spv",
    bytes: SCULPT_STAMP_CLAY_BYTES,
};
pub fn sculpt_stamp_clay() -> &'static crate::GeneratedSpirvAsset { &SCULPT_STAMP_CLAY }

pub const SCULPT_STAMP_CREASE_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/sculpting/sculpt_stamp_crease.spv"));
pub static SCULPT_STAMP_CREASE: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "sculpt_stamp_crease",
    label: "Sculpt Stamp Crease",
    domain: crate::KainDomain::Sculpting,
    source_path: "crates/k-os-kain/domains/sculpting/sculpt_stamp_crease.kn",
    compiled_path: "crates/k-os-kain/generated/spv/sculpting/sculpt_stamp_crease.spv",
    bytes: SCULPT_STAMP_CREASE_BYTES,
};
pub fn sculpt_stamp_crease() -> &'static crate::GeneratedSpirvAsset { &SCULPT_STAMP_CREASE }

pub const SCULPT_STAMP_FLATTEN_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/sculpting/sculpt_stamp_flatten.spv"));
pub static SCULPT_STAMP_FLATTEN: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "sculpt_stamp_flatten",
    label: "Sculpt Stamp Flatten",
    domain: crate::KainDomain::Sculpting,
    source_path: "crates/k-os-kain/domains/sculpting/sculpt_stamp_flatten.kn",
    compiled_path: "crates/k-os-kain/generated/spv/sculpting/sculpt_stamp_flatten.spv",
    bytes: SCULPT_STAMP_FLATTEN_BYTES,
};
pub fn sculpt_stamp_flatten() -> &'static crate::GeneratedSpirvAsset { &SCULPT_STAMP_FLATTEN }

pub const SCULPT_STAMP_HPOLISH_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/sculpting/sculpt_stamp_hpolish.spv"));
pub static SCULPT_STAMP_HPOLISH: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "sculpt_stamp_hpolish",
    label: "Sculpt Stamp Hpolish",
    domain: crate::KainDomain::Sculpting,
    source_path: "crates/k-os-kain/domains/sculpting/sculpt_stamp_hpolish.kn",
    compiled_path: "crates/k-os-kain/generated/spv/sculpting/sculpt_stamp_hpolish.spv",
    bytes: SCULPT_STAMP_HPOLISH_BYTES,
};
pub fn sculpt_stamp_hpolish() -> &'static crate::GeneratedSpirvAsset { &SCULPT_STAMP_HPOLISH }

pub const SCULPT_STAMP_INFLATE_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/sculpting/sculpt_stamp_inflate.spv"));
pub static SCULPT_STAMP_INFLATE: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "sculpt_stamp_inflate",
    label: "Sculpt Stamp Inflate",
    domain: crate::KainDomain::Sculpting,
    source_path: "crates/k-os-kain/domains/sculpting/sculpt_stamp_inflate.kn",
    compiled_path: "crates/k-os-kain/generated/spv/sculpting/sculpt_stamp_inflate.spv",
    bytes: SCULPT_STAMP_INFLATE_BYTES,
};
pub fn sculpt_stamp_inflate() -> &'static crate::GeneratedSpirvAsset { &SCULPT_STAMP_INFLATE }

pub const SCULPT_STAMP_LAYER_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/sculpting/sculpt_stamp_layer.spv"));
pub static SCULPT_STAMP_LAYER: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "sculpt_stamp_layer",
    label: "Sculpt Stamp Layer",
    domain: crate::KainDomain::Sculpting,
    source_path: "crates/k-os-kain/domains/sculpting/sculpt_stamp_layer.kn",
    compiled_path: "crates/k-os-kain/generated/spv/sculpting/sculpt_stamp_layer.spv",
    bytes: SCULPT_STAMP_LAYER_BYTES,
};
pub fn sculpt_stamp_layer() -> &'static crate::GeneratedSpirvAsset { &SCULPT_STAMP_LAYER }

pub const SCULPT_STAMP_MAIN_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/sculpting/sculpt_stamp_main.spv"));
pub static SCULPT_STAMP_MAIN: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "sculpt_stamp_main",
    label: "Sculpt Stamp Main",
    domain: crate::KainDomain::Sculpting,
    source_path: "crates/k-os-kain/domains/sculpting/sculpt_stamp_main.kn",
    compiled_path: "crates/k-os-kain/generated/spv/sculpting/sculpt_stamp_main.spv",
    bytes: SCULPT_STAMP_MAIN_BYTES,
};
pub fn sculpt_stamp_main() -> &'static crate::GeneratedSpirvAsset { &SCULPT_STAMP_MAIN }

pub const SCULPT_STAMP_SCRAPE_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/sculpting/sculpt_stamp_scrape.spv"));
pub static SCULPT_STAMP_SCRAPE: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "sculpt_stamp_scrape",
    label: "Sculpt Stamp Scrape",
    domain: crate::KainDomain::Sculpting,
    source_path: "crates/k-os-kain/domains/sculpting/sculpt_stamp_scrape.kn",
    compiled_path: "crates/k-os-kain/generated/spv/sculpting/sculpt_stamp_scrape.spv",
    bytes: SCULPT_STAMP_SCRAPE_BYTES,
};
pub fn sculpt_stamp_scrape() -> &'static crate::GeneratedSpirvAsset { &SCULPT_STAMP_SCRAPE }

pub const SCULPT_ENGINE_LAYER_ACCUMULATE_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/sculpting_engine/sculpt_engine_layer_accumulate.spv"));
pub static SCULPT_ENGINE_LAYER_ACCUMULATE: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "sculpt_engine_layer_accumulate",
    label: "Sculpt Engine Layer Accumulate",
    domain: crate::KainDomain::SculptingEngine,
    source_path: "crates/k-os-kain/domains/sculpting_engine/sculpt_engine_layer_accumulate.kn",
    compiled_path: "crates/k-os-kain/generated/spv/sculpting_engine/sculpt_engine_layer_accumulate.spv",
    bytes: SCULPT_ENGINE_LAYER_ACCUMULATE_BYTES,
};
pub fn sculpt_engine_layer_accumulate() -> &'static crate::GeneratedSpirvAsset { &SCULPT_ENGINE_LAYER_ACCUMULATE }

pub const SCULPT_ENGINE_SURFACE_DRAG_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/sculpting_engine/sculpt_engine_surface_drag.spv"));
pub static SCULPT_ENGINE_SURFACE_DRAG: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "sculpt_engine_surface_drag",
    label: "Sculpt Engine Surface Drag",
    domain: crate::KainDomain::SculptingEngine,
    source_path: "crates/k-os-kain/domains/sculpting_engine/sculpt_engine_surface_drag.kn",
    compiled_path: "crates/k-os-kain/generated/spv/sculpting_engine/sculpt_engine_surface_drag.spv",
    bytes: SCULPT_ENGINE_SURFACE_DRAG_BYTES,
};
pub fn sculpt_engine_surface_drag() -> &'static crate::GeneratedSpirvAsset { &SCULPT_ENGINE_SURFACE_DRAG }

pub const MOCAP_AUDIO_MOTION_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/supermotion/mocap_audio_motion.spv"));
pub static MOCAP_AUDIO_MOTION: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "mocap_audio_motion",
    label: "Mocap Audio Motion",
    domain: crate::KainDomain::Supermotion,
    source_path: "crates/k-os-kain/domains/supermotion/mocap_audio_motion.kn",
    compiled_path: "crates/k-os-kain/generated/spv/supermotion/mocap_audio_motion.spv",
    bytes: MOCAP_AUDIO_MOTION_BYTES,
};
pub fn mocap_audio_motion() -> &'static crate::GeneratedSpirvAsset { &MOCAP_AUDIO_MOTION }

pub const MOCAP_BLEND_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/supermotion/mocap_blend.spv"));
pub static MOCAP_BLEND: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "mocap_blend",
    label: "Mocap Blend",
    domain: crate::KainDomain::Supermotion,
    source_path: "crates/k-os-kain/domains/supermotion/mocap_blend.kn",
    compiled_path: "crates/k-os-kain/generated/spv/supermotion/mocap_blend.spv",
    bytes: MOCAP_BLEND_BYTES,
};
pub fn mocap_blend() -> &'static crate::GeneratedSpirvAsset { &MOCAP_BLEND }

pub const MOCAP_CLOTH_SIM_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/supermotion/mocap_cloth_sim.spv"));
pub static MOCAP_CLOTH_SIM: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "mocap_cloth_sim",
    label: "Mocap Cloth Sim",
    domain: crate::KainDomain::Supermotion,
    source_path: "crates/k-os-kain/domains/supermotion/mocap_cloth_sim.kn",
    compiled_path: "crates/k-os-kain/generated/spv/supermotion/mocap_cloth_sim.spv",
    bytes: MOCAP_CLOTH_SIM_BYTES,
};
pub fn mocap_cloth_sim() -> &'static crate::GeneratedSpirvAsset { &MOCAP_CLOTH_SIM }

pub const MOCAP_CONTACT_WELD_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/supermotion/mocap_contact_weld.spv"));
pub static MOCAP_CONTACT_WELD: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "mocap_contact_weld",
    label: "Mocap Contact Weld",
    domain: crate::KainDomain::Supermotion,
    source_path: "crates/k-os-kain/domains/supermotion/mocap_contact_weld.kn",
    compiled_path: "crates/k-os-kain/generated/spv/supermotion/mocap_contact_weld.spv",
    bytes: MOCAP_CONTACT_WELD_BYTES,
};
pub fn mocap_contact_weld() -> &'static crate::GeneratedSpirvAsset { &MOCAP_CONTACT_WELD }

pub const MOCAP_CROWD_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/supermotion/mocap_crowd.spv"));
pub static MOCAP_CROWD: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "mocap_crowd",
    label: "Mocap Crowd",
    domain: crate::KainDomain::Supermotion,
    source_path: "crates/k-os-kain/domains/supermotion/mocap_crowd.kn",
    compiled_path: "crates/k-os-kain/generated/spv/supermotion/mocap_crowd.spv",
    bytes: MOCAP_CROWD_BYTES,
};
pub fn mocap_crowd() -> &'static crate::GeneratedSpirvAsset { &MOCAP_CROWD }

pub const MOCAP_DENOISE_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/supermotion/mocap_denoise.spv"));
pub static MOCAP_DENOISE: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "mocap_denoise",
    label: "Mocap Denoise",
    domain: crate::KainDomain::Supermotion,
    source_path: "crates/k-os-kain/domains/supermotion/mocap_denoise.kn",
    compiled_path: "crates/k-os-kain/generated/spv/supermotion/mocap_denoise.spv",
    bytes: MOCAP_DENOISE_BYTES,
};
pub fn mocap_denoise() -> &'static crate::GeneratedSpirvAsset { &MOCAP_DENOISE }

pub const MOCAP_FACIAL_BLEND_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/supermotion/mocap_facial_blend.spv"));
pub static MOCAP_FACIAL_BLEND: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "mocap_facial_blend",
    label: "Mocap Facial Blend",
    domain: crate::KainDomain::Supermotion,
    source_path: "crates/k-os-kain/domains/supermotion/mocap_facial_blend.kn",
    compiled_path: "crates/k-os-kain/generated/spv/supermotion/mocap_facial_blend.spv",
    bytes: MOCAP_FACIAL_BLEND_BYTES,
};
pub fn mocap_facial_blend() -> &'static crate::GeneratedSpirvAsset { &MOCAP_FACIAL_BLEND }

pub const MOCAP_HAND_FK_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/supermotion/mocap_hand_fk.spv"));
pub static MOCAP_HAND_FK: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "mocap_hand_fk",
    label: "Mocap Hand Fk",
    domain: crate::KainDomain::Supermotion,
    source_path: "crates/k-os-kain/domains/supermotion/mocap_hand_fk.kn",
    compiled_path: "crates/k-os-kain/generated/spv/supermotion/mocap_hand_fk.spv",
    bytes: MOCAP_HAND_FK_BYTES,
};
pub fn mocap_hand_fk() -> &'static crate::GeneratedSpirvAsset { &MOCAP_HAND_FK }

pub const MOCAP_IK_REACH_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/supermotion/mocap_ik_reach.spv"));
pub static MOCAP_IK_REACH: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "mocap_ik_reach",
    label: "Mocap Ik Reach",
    domain: crate::KainDomain::Supermotion,
    source_path: "crates/k-os-kain/domains/supermotion/mocap_ik_reach.kn",
    compiled_path: "crates/k-os-kain/generated/spv/supermotion/mocap_ik_reach.spv",
    bytes: MOCAP_IK_REACH_BYTES,
};
pub fn mocap_ik_reach() -> &'static crate::GeneratedSpirvAsset { &MOCAP_IK_REACH }

pub const MOCAP_LIVELINK_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/supermotion/mocap_livelink.spv"));
pub static MOCAP_LIVELINK: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "mocap_livelink",
    label: "Mocap Livelink",
    domain: crate::KainDomain::Supermotion,
    source_path: "crates/k-os-kain/domains/supermotion/mocap_livelink.kn",
    compiled_path: "crates/k-os-kain/generated/spv/supermotion/mocap_livelink.spv",
    bytes: MOCAP_LIVELINK_BYTES,
};
pub fn mocap_livelink() -> &'static crate::GeneratedSpirvAsset { &MOCAP_LIVELINK }

pub const MOCAP_MIRROR_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/supermotion/mocap_mirror.spv"));
pub static MOCAP_MIRROR: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "mocap_mirror",
    label: "Mocap Mirror",
    domain: crate::KainDomain::Supermotion,
    source_path: "crates/k-os-kain/domains/supermotion/mocap_mirror.kn",
    compiled_path: "crates/k-os-kain/generated/spv/supermotion/mocap_mirror.spv",
    bytes: MOCAP_MIRROR_BYTES,
};
pub fn mocap_mirror() -> &'static crate::GeneratedSpirvAsset { &MOCAP_MIRROR }

pub const MOCAP_PHYSICS_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/supermotion/mocap_physics.spv"));
pub static MOCAP_PHYSICS: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "mocap_physics",
    label: "Mocap Physics",
    domain: crate::KainDomain::Supermotion,
    source_path: "crates/k-os-kain/domains/supermotion/mocap_physics.kn",
    compiled_path: "crates/k-os-kain/generated/spv/supermotion/mocap_physics.spv",
    bytes: MOCAP_PHYSICS_BYTES,
};
pub fn mocap_physics() -> &'static crate::GeneratedSpirvAsset { &MOCAP_PHYSICS }

pub const MOCAP_POSE_MATCH_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/supermotion/mocap_pose_match.spv"));
pub static MOCAP_POSE_MATCH: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "mocap_pose_match",
    label: "Mocap Pose Match",
    domain: crate::KainDomain::Supermotion,
    source_path: "crates/k-os-kain/domains/supermotion/mocap_pose_match.kn",
    compiled_path: "crates/k-os-kain/generated/spv/supermotion/mocap_pose_match.spv",
    bytes: MOCAP_POSE_MATCH_BYTES,
};
pub fn mocap_pose_match() -> &'static crate::GeneratedSpirvAsset { &MOCAP_POSE_MATCH }

pub const MOCAP_POSE_NORMALIZE_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/supermotion/mocap_pose_normalize.spv"));
pub static MOCAP_POSE_NORMALIZE: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "mocap_pose_normalize",
    label: "Mocap Pose Normalize",
    domain: crate::KainDomain::Supermotion,
    source_path: "crates/k-os-kain/domains/supermotion/mocap_pose_normalize.kn",
    compiled_path: "crates/k-os-kain/generated/spv/supermotion/mocap_pose_normalize.spv",
    bytes: MOCAP_POSE_NORMALIZE_BYTES,
};
pub fn mocap_pose_normalize() -> &'static crate::GeneratedSpirvAsset { &MOCAP_POSE_NORMALIZE }

pub const MOCAP_RETARGET_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/supermotion/mocap_retarget.spv"));
pub static MOCAP_RETARGET: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "mocap_retarget",
    label: "Mocap Retarget",
    domain: crate::KainDomain::Supermotion,
    source_path: "crates/k-os-kain/domains/supermotion/mocap_retarget.kn",
    compiled_path: "crates/k-os-kain/generated/spv/supermotion/mocap_retarget.spv",
    bytes: MOCAP_RETARGET_BYTES,
};
pub fn mocap_retarget() -> &'static crate::GeneratedSpirvAsset { &MOCAP_RETARGET }

pub const MOCAP_SKELETON_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/supermotion/mocap_skeleton.spv"));
pub static MOCAP_SKELETON: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "mocap_skeleton",
    label: "Mocap Skeleton",
    domain: crate::KainDomain::Supermotion,
    source_path: "crates/k-os-kain/domains/supermotion/mocap_skeleton.kn",
    compiled_path: "crates/k-os-kain/generated/spv/supermotion/mocap_skeleton.spv",
    bytes: MOCAP_SKELETON_BYTES,
};
pub fn mocap_skeleton() -> &'static crate::GeneratedSpirvAsset { &MOCAP_SKELETON }

pub const MOCAP_SPRING_FOLLOW_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/supermotion/mocap_spring_follow.spv"));
pub static MOCAP_SPRING_FOLLOW: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "mocap_spring_follow",
    label: "Mocap Spring Follow",
    domain: crate::KainDomain::Supermotion,
    source_path: "crates/k-os-kain/domains/supermotion/mocap_spring_follow.kn",
    compiled_path: "crates/k-os-kain/generated/spv/supermotion/mocap_spring_follow.spv",
    bytes: MOCAP_SPRING_FOLLOW_BYTES,
};
pub fn mocap_spring_follow() -> &'static crate::GeneratedSpirvAsset { &MOCAP_SPRING_FOLLOW }

pub const MOCAP_STABILIZE_ROOT_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/supermotion/mocap_stabilize_root.spv"));
pub static MOCAP_STABILIZE_ROOT: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "mocap_stabilize_root",
    label: "Mocap Stabilize Root",
    domain: crate::KainDomain::Supermotion,
    source_path: "crates/k-os-kain/domains/supermotion/mocap_stabilize_root.kn",
    compiled_path: "crates/k-os-kain/generated/spv/supermotion/mocap_stabilize_root.spv",
    bytes: MOCAP_STABILIZE_ROOT_BYTES,
};
pub fn mocap_stabilize_root() -> &'static crate::GeneratedSpirvAsset { &MOCAP_STABILIZE_ROOT }

pub const MOCAP_SUPERMOTION_LIVELINK_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/supermotion/mocap_supermotion_livelink.spv"));
pub static MOCAP_SUPERMOTION_LIVELINK: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "mocap_supermotion_livelink",
    label: "Mocap Supermotion Livelink",
    domain: crate::KainDomain::Supermotion,
    source_path: "crates/k-os-kain/domains/supermotion/mocap_supermotion_livelink.kn",
    compiled_path: "crates/k-os-kain/generated/spv/supermotion/mocap_supermotion_livelink.spv",
    bytes: MOCAP_SUPERMOTION_LIVELINK_BYTES,
};
pub fn mocap_supermotion_livelink() -> &'static crate::GeneratedSpirvAsset { &MOCAP_SUPERMOTION_LIVELINK }

pub const MOCAP_VELOCITY_SMOOTH_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/supermotion/mocap_velocity_smooth.spv"));
pub static MOCAP_VELOCITY_SMOOTH: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "mocap_velocity_smooth",
    label: "Mocap Velocity Smooth",
    domain: crate::KainDomain::Supermotion,
    source_path: "crates/k-os-kain/domains/supermotion/mocap_velocity_smooth.kn",
    compiled_path: "crates/k-os-kain/generated/spv/supermotion/mocap_velocity_smooth.spv",
    bytes: MOCAP_VELOCITY_SMOOTH_BYTES,
};
pub fn mocap_velocity_smooth() -> &'static crate::GeneratedSpirvAsset { &MOCAP_VELOCITY_SMOOTH }

pub const MOGRAPH_SUPERMOTION_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/supermotion/mograph_supermotion.spv"));
pub static MOGRAPH_SUPERMOTION: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "mograph_supermotion",
    label: "Mograph Supermotion",
    domain: crate::KainDomain::Supermotion,
    source_path: "crates/k-os-kain/domains/supermotion/mograph_supermotion.kn",
    compiled_path: "crates/k-os-kain/generated/spv/supermotion/mograph_supermotion.spv",
    bytes: MOGRAPH_SUPERMOTION_BYTES,
};
pub fn mograph_supermotion() -> &'static crate::GeneratedSpirvAsset { &MOGRAPH_SUPERMOTION }

pub const PREPROCESS_BYTES: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/generated/spv/supermotion/preprocess.spv"));
pub static PREPROCESS: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {
    id: "preprocess",
    label: "Preprocess",
    domain: crate::KainDomain::Supermotion,
    source_path: "crates/k-os-kain/domains/supermotion/preprocess.kn",
    compiled_path: "crates/k-os-kain/generated/spv/supermotion/preprocess.spv",
    bytes: PREPROCESS_BYTES,
};
pub fn preprocess() -> &'static crate::GeneratedSpirvAsset { &PREPROCESS }

pub static ASSETS: &[&crate::GeneratedSpirvAsset] = &[
    &MATERIAL_PBR_STANDARD,
    &PAINT_SURFACE_FILTER,
    &RENDERER_SURFACE_PASS,
    &RENDERER_ZEN_ATMOSPHERE,
    &SCULPT_PHYSICS_ATTRACTOR,
    &SCULPT_PHYSICS_ELASTIC,
    &SCULPT_PHYSICS_GRAVITY_DROP,
    &SCULPT_PHYSICS_INFLATE_PULSE,
    &SCULPT_PHYSICS_MAGNET,
    &SCULPT_PHYSICS_TURBULENCE,
    &SCULPT_PHYSICS_VORTEX,
    &SCULPT_PHYSICS_WIND,
    &SCULPT_STAMP_BLOB,
    &SCULPT_STAMP_CLAY,
    &SCULPT_STAMP_CREASE,
    &SCULPT_STAMP_FLATTEN,
    &SCULPT_STAMP_HPOLISH,
    &SCULPT_STAMP_INFLATE,
    &SCULPT_STAMP_LAYER,
    &SCULPT_STAMP_MAIN,
    &SCULPT_STAMP_SCRAPE,
    &SCULPT_ENGINE_LAYER_ACCUMULATE,
    &SCULPT_ENGINE_SURFACE_DRAG,
    &MOCAP_AUDIO_MOTION,
    &MOCAP_BLEND,
    &MOCAP_CLOTH_SIM,
    &MOCAP_CONTACT_WELD,
    &MOCAP_CROWD,
    &MOCAP_DENOISE,
    &MOCAP_FACIAL_BLEND,
    &MOCAP_HAND_FK,
    &MOCAP_IK_REACH,
    &MOCAP_LIVELINK,
    &MOCAP_MIRROR,
    &MOCAP_PHYSICS,
    &MOCAP_POSE_MATCH,
    &MOCAP_POSE_NORMALIZE,
    &MOCAP_RETARGET,
    &MOCAP_SKELETON,
    &MOCAP_SPRING_FOLLOW,
    &MOCAP_STABILIZE_ROOT,
    &MOCAP_SUPERMOTION_LIVELINK,
    &MOCAP_VELOCITY_SMOOTH,
    &MOGRAPH_SUPERMOTION,
    &PREPROCESS,
];

pub fn assets() -> &'static [&'static crate::GeneratedSpirvAsset] { ASSETS }

pub static ALL: &[GeneratedSpirvLookupEntry] = &[
    GeneratedSpirvLookupEntry { id: "material_pbr_standard", asset: &MATERIAL_PBR_STANDARD },
    GeneratedSpirvLookupEntry { id: "paint_surface_filter", asset: &PAINT_SURFACE_FILTER },
    GeneratedSpirvLookupEntry { id: "renderer_surface_pass", asset: &RENDERER_SURFACE_PASS },
    GeneratedSpirvLookupEntry { id: "renderer_zen_atmosphere", asset: &RENDERER_ZEN_ATMOSPHERE },
    GeneratedSpirvLookupEntry { id: "sculpt_physics_attractor", asset: &SCULPT_PHYSICS_ATTRACTOR },
    GeneratedSpirvLookupEntry { id: "sculpt_physics_elastic", asset: &SCULPT_PHYSICS_ELASTIC },
    GeneratedSpirvLookupEntry { id: "sculpt_physics_gravity_drop", asset: &SCULPT_PHYSICS_GRAVITY_DROP },
    GeneratedSpirvLookupEntry { id: "sculpt_physics_inflate_pulse", asset: &SCULPT_PHYSICS_INFLATE_PULSE },
    GeneratedSpirvLookupEntry { id: "sculpt_physics_magnet", asset: &SCULPT_PHYSICS_MAGNET },
    GeneratedSpirvLookupEntry { id: "sculpt_physics_turbulence", asset: &SCULPT_PHYSICS_TURBULENCE },
    GeneratedSpirvLookupEntry { id: "sculpt_physics_vortex", asset: &SCULPT_PHYSICS_VORTEX },
    GeneratedSpirvLookupEntry { id: "sculpt_physics_wind", asset: &SCULPT_PHYSICS_WIND },
    GeneratedSpirvLookupEntry { id: "sculpt_stamp_blob", asset: &SCULPT_STAMP_BLOB },
    GeneratedSpirvLookupEntry { id: "sculpt_stamp_clay", asset: &SCULPT_STAMP_CLAY },
    GeneratedSpirvLookupEntry { id: "sculpt_stamp_crease", asset: &SCULPT_STAMP_CREASE },
    GeneratedSpirvLookupEntry { id: "sculpt_stamp_flatten", asset: &SCULPT_STAMP_FLATTEN },
    GeneratedSpirvLookupEntry { id: "sculpt_stamp_hpolish", asset: &SCULPT_STAMP_HPOLISH },
    GeneratedSpirvLookupEntry { id: "sculpt_stamp_inflate", asset: &SCULPT_STAMP_INFLATE },
    GeneratedSpirvLookupEntry { id: "sculpt_stamp_layer", asset: &SCULPT_STAMP_LAYER },
    GeneratedSpirvLookupEntry { id: "sculpt_stamp_main", asset: &SCULPT_STAMP_MAIN },
    GeneratedSpirvLookupEntry { id: "sculpt_stamp_scrape", asset: &SCULPT_STAMP_SCRAPE },
    GeneratedSpirvLookupEntry { id: "sculpt_engine_layer_accumulate", asset: &SCULPT_ENGINE_LAYER_ACCUMULATE },
    GeneratedSpirvLookupEntry { id: "sculpt_engine_surface_drag", asset: &SCULPT_ENGINE_SURFACE_DRAG },
    GeneratedSpirvLookupEntry { id: "mocap_audio_motion", asset: &MOCAP_AUDIO_MOTION },
    GeneratedSpirvLookupEntry { id: "mocap_blend", asset: &MOCAP_BLEND },
    GeneratedSpirvLookupEntry { id: "mocap_cloth_sim", asset: &MOCAP_CLOTH_SIM },
    GeneratedSpirvLookupEntry { id: "mocap_contact_weld", asset: &MOCAP_CONTACT_WELD },
    GeneratedSpirvLookupEntry { id: "mocap_crowd", asset: &MOCAP_CROWD },
    GeneratedSpirvLookupEntry { id: "mocap_denoise", asset: &MOCAP_DENOISE },
    GeneratedSpirvLookupEntry { id: "mocap_facial_blend", asset: &MOCAP_FACIAL_BLEND },
    GeneratedSpirvLookupEntry { id: "mocap_hand_fk", asset: &MOCAP_HAND_FK },
    GeneratedSpirvLookupEntry { id: "mocap_ik_reach", asset: &MOCAP_IK_REACH },
    GeneratedSpirvLookupEntry { id: "mocap_livelink", asset: &MOCAP_LIVELINK },
    GeneratedSpirvLookupEntry { id: "mocap_mirror", asset: &MOCAP_MIRROR },
    GeneratedSpirvLookupEntry { id: "mocap_physics", asset: &MOCAP_PHYSICS },
    GeneratedSpirvLookupEntry { id: "mocap_pose_match", asset: &MOCAP_POSE_MATCH },
    GeneratedSpirvLookupEntry { id: "mocap_pose_normalize", asset: &MOCAP_POSE_NORMALIZE },
    GeneratedSpirvLookupEntry { id: "mocap_retarget", asset: &MOCAP_RETARGET },
    GeneratedSpirvLookupEntry { id: "mocap_skeleton", asset: &MOCAP_SKELETON },
    GeneratedSpirvLookupEntry { id: "mocap_spring_follow", asset: &MOCAP_SPRING_FOLLOW },
    GeneratedSpirvLookupEntry { id: "mocap_stabilize_root", asset: &MOCAP_STABILIZE_ROOT },
    GeneratedSpirvLookupEntry { id: "mocap_supermotion_livelink", asset: &MOCAP_SUPERMOTION_LIVELINK },
    GeneratedSpirvLookupEntry { id: "mocap_velocity_smooth", asset: &MOCAP_VELOCITY_SMOOTH },
    GeneratedSpirvLookupEntry { id: "mograph_supermotion", asset: &MOGRAPH_SUPERMOTION },
    GeneratedSpirvLookupEntry { id: "preprocess", asset: &PREPROCESS },
];

pub fn all() -> &'static [GeneratedSpirvLookupEntry] { ALL }

pub fn by_id(id: &str) -> Option<&'static crate::GeneratedSpirvAsset> {
    match id {
        "material_pbr_standard" => Some(&MATERIAL_PBR_STANDARD),
        "paint_surface_filter" => Some(&PAINT_SURFACE_FILTER),
        "renderer_surface_pass" => Some(&RENDERER_SURFACE_PASS),
        "renderer_zen_atmosphere" => Some(&RENDERER_ZEN_ATMOSPHERE),
        "sculpt_physics_attractor" => Some(&SCULPT_PHYSICS_ATTRACTOR),
        "sculpt_physics_elastic" => Some(&SCULPT_PHYSICS_ELASTIC),
        "sculpt_physics_gravity_drop" => Some(&SCULPT_PHYSICS_GRAVITY_DROP),
        "sculpt_physics_inflate_pulse" => Some(&SCULPT_PHYSICS_INFLATE_PULSE),
        "sculpt_physics_magnet" => Some(&SCULPT_PHYSICS_MAGNET),
        "sculpt_physics_turbulence" => Some(&SCULPT_PHYSICS_TURBULENCE),
        "sculpt_physics_vortex" => Some(&SCULPT_PHYSICS_VORTEX),
        "sculpt_physics_wind" => Some(&SCULPT_PHYSICS_WIND),
        "sculpt_stamp_blob" => Some(&SCULPT_STAMP_BLOB),
        "sculpt_stamp_clay" => Some(&SCULPT_STAMP_CLAY),
        "sculpt_stamp_crease" => Some(&SCULPT_STAMP_CREASE),
        "sculpt_stamp_flatten" => Some(&SCULPT_STAMP_FLATTEN),
        "sculpt_stamp_hpolish" => Some(&SCULPT_STAMP_HPOLISH),
        "sculpt_stamp_inflate" => Some(&SCULPT_STAMP_INFLATE),
        "sculpt_stamp_layer" => Some(&SCULPT_STAMP_LAYER),
        "sculpt_stamp_main" => Some(&SCULPT_STAMP_MAIN),
        "sculpt_stamp_scrape" => Some(&SCULPT_STAMP_SCRAPE),
        "sculpt_engine_layer_accumulate" => Some(&SCULPT_ENGINE_LAYER_ACCUMULATE),
        "sculpt_engine_surface_drag" => Some(&SCULPT_ENGINE_SURFACE_DRAG),
        "mocap_audio_motion" => Some(&MOCAP_AUDIO_MOTION),
        "mocap_blend" => Some(&MOCAP_BLEND),
        "mocap_cloth_sim" => Some(&MOCAP_CLOTH_SIM),
        "mocap_contact_weld" => Some(&MOCAP_CONTACT_WELD),
        "mocap_crowd" => Some(&MOCAP_CROWD),
        "mocap_denoise" => Some(&MOCAP_DENOISE),
        "mocap_facial_blend" => Some(&MOCAP_FACIAL_BLEND),
        "mocap_hand_fk" => Some(&MOCAP_HAND_FK),
        "mocap_ik_reach" => Some(&MOCAP_IK_REACH),
        "mocap_livelink" => Some(&MOCAP_LIVELINK),
        "mocap_mirror" => Some(&MOCAP_MIRROR),
        "mocap_physics" => Some(&MOCAP_PHYSICS),
        "mocap_pose_match" => Some(&MOCAP_POSE_MATCH),
        "mocap_pose_normalize" => Some(&MOCAP_POSE_NORMALIZE),
        "mocap_retarget" => Some(&MOCAP_RETARGET),
        "mocap_skeleton" => Some(&MOCAP_SKELETON),
        "mocap_spring_follow" => Some(&MOCAP_SPRING_FOLLOW),
        "mocap_stabilize_root" => Some(&MOCAP_STABILIZE_ROOT),
        "mocap_supermotion_livelink" => Some(&MOCAP_SUPERMOTION_LIVELINK),
        "mocap_velocity_smooth" => Some(&MOCAP_VELOCITY_SMOOTH),
        "mograph_supermotion" => Some(&MOGRAPH_SUPERMOTION),
        "preprocess" => Some(&PREPROCESS),
        _ => None,
    }
}
