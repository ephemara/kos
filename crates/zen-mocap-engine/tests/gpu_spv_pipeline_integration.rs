#![cfg(feature = "gpu-chain")]

use std::panic::{catch_unwind, AssertUnwindSafe};
use zen_mocap_engine::gpu_chain::GpuChain;
use zen_mocap_engine::gpu_pipeline::{
    AUDIO_MOTION_SPV, BLEND_SPV, CLOTH_SIM_SPV, CONTACT_WELD_SPV, CROWD_SPV, DENOISE_SPV,
    HAND_FK_SPV, IK_REACH_SPV, LIVELINK_SPV, MIRROR_SPV, MOGRAPH_SPV, PHYSICS_SPV, POSE_MATCH_SPV,
    POSE_NORMALIZE_SPV, PREPROCESS_SPV, RETARGET_SPV, SKELETON_SPV, SPRING_FOLLOW_SPV,
    STABILIZE_ROOT_SPV, SUPERMOTION_LIVELINK_SPV, VELOCITY_SMOOTH_SPV,
};
use zen_mocap_engine::types::Joint;

fn all_spv_blobs() -> Vec<(&'static str, &'static [u8])> {
    vec![
        ("mocap_denoise", DENOISE_SPV),
        ("mocap_skeleton", SKELETON_SPV),
        ("mocap_physics", PHYSICS_SPV),
        ("mocap_livelink", LIVELINK_SPV),
        ("mograph_supermotion", MOGRAPH_SPV),
        ("mocap_supermotion_livelink", SUPERMOTION_LIVELINK_SPV),
        ("mocap_blend", BLEND_SPV),
        ("mocap_audio_motion", AUDIO_MOTION_SPV),
        ("mocap_ik_reach", IK_REACH_SPV),
        ("mocap_retarget", RETARGET_SPV),
        ("mocap_spring_follow", SPRING_FOLLOW_SPV),
        ("mocap_pose_normalize", POSE_NORMALIZE_SPV),
        ("mocap_stabilize_root", STABILIZE_ROOT_SPV),
        ("mocap_velocity_smooth", VELOCITY_SMOOTH_SPV),
        ("mocap_contact_weld", CONTACT_WELD_SPV),
        ("mocap_pose_match", POSE_MATCH_SPV),
        ("mocap_mirror", MIRROR_SPV),
        ("mocap_crowd", CROWD_SPV),
        ("mocap_cloth_sim", CLOTH_SIM_SPV),
        ("mocap_hand_fk", HAND_FK_SPV),
        ("preprocess", PREPROCESS_SPV),
    ]
}

fn runtime_chain_spv_blobs() -> Vec<(&'static str, &'static [u8], &'static str, u32)> {
    vec![
        ("mocap_denoise", DENOISE_SPV, "mocap_denoise", 3),
        ("mocap_skeleton", SKELETON_SPV, "mocap_skeleton", 4),
        ("mocap_physics", PHYSICS_SPV, "mocap_physics", 3),
        (
            "mocap_supermotion_livelink",
            SUPERMOTION_LIVELINK_SPV,
            "mocap_supermotion_livelink",
            9,
        ),
        ("mocap_livelink", LIVELINK_SPV, "mocap_livelink", 3),
    ]
}

fn spv_words(bytes: &[u8]) -> Vec<u32> {
    bytes
        .chunks_exact(4)
        .map(|b| u32::from_le_bytes([b[0], b[1], b[2], b[3]]))
        .collect()
}

async fn request_test_device() -> Option<(wgpu::Device, wgpu::Queue, String)> {
    let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor {
        backends: wgpu::Backends::all(),
        ..Default::default()
    });
    let adapter = instance
        .request_adapter(&wgpu::RequestAdapterOptions {
            power_preference: wgpu::PowerPreference::HighPerformance,
            force_fallback_adapter: false,
            compatible_surface: None,
        })
        .await?;
    let info = adapter.get_info();
    let backend = format!("{:?}", info.backend);
    let adapter_limits = adapter.limits();
    let (device, queue) = adapter
        .request_device(
            &wgpu::DeviceDescriptor {
                required_features: wgpu::Features::empty(),
                required_limits: adapter_limits,
                memory_hints: wgpu::MemoryHints::Performance,
                label: Some("gpu_spv_pipeline_integration_device"),
            },
            None,
        )
        .await
        .ok()?;
    Some((device, queue, backend))
}

#[test]
fn spv_embeds_are_present_and_aligned() {
    for (name, blob) in all_spv_blobs() {
        assert!(
            !blob.is_empty(),
            "SPV blob '{}' is empty; build_spirv.bat may not have run",
            name
        );
        assert_eq!(
            blob.len() % 4,
            0,
            "SPV blob '{}' is not 4-byte aligned",
            name
        );
        assert!(
            blob.len() >= 20,
            "SPV blob '{}' too small to contain valid header",
            name
        );
        let magic = u32::from_le_bytes([blob[0], blob[1], blob[2], blob[3]]);
        assert_eq!(
            magic, 0x0723_0203,
            "SPV blob '{}' has invalid SPIR-V magic",
            name
        );
    }
}

#[tokio::test]
async fn runtime_chain_spv_compiles_on_wgpu() {
    let Some((device, _queue, backend)) = request_test_device().await else {
        eprintln!("Skipping runtime_chain_spv_compiles_on_wgpu: no wgpu adapter available");
        return;
    };
    eprintln!("GPU backend for shader validation: {}", backend);

    let max_storage_buffers = device.limits().max_storage_buffers_per_shader_stage;
    for (name, blob, entry_point, required_storage_buffers) in runtime_chain_spv_blobs() {
        if required_storage_buffers > max_storage_buffers {
            eprintln!(
                "Skipping '{}' on backend {}: requires {} storage buffers, device supports {}",
                name, backend, required_storage_buffers, max_storage_buffers
            );
            continue;
        }
        let words = spv_words(blob);

        device.push_error_scope(wgpu::ErrorFilter::Validation);
        let module = match catch_unwind(AssertUnwindSafe(|| {
            device.create_shader_module(wgpu::ShaderModuleDescriptor {
                label: Some(name),
                source: wgpu::ShaderSource::SpirV(std::borrow::Cow::Owned(words)),
            })
        })) {
            Ok(m) => m,
            Err(_) => panic!("Shader module creation panicked for '{}'", name),
        };
        if let Some(err) = device.pop_error_scope().await {
            panic!("Shader module validation failed for '{}': {err}", name);
        }

        device.push_error_scope(wgpu::ErrorFilter::Validation);
        let _pipeline = match catch_unwind(AssertUnwindSafe(|| {
            device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
                label: Some(name),
                layout: None, // derive pipeline layout from shader bindings
                module: &module,
                entry_point: Some(entry_point),
                compilation_options: Default::default(),
                cache: None,
            })
        })) {
            Ok(p) => p,
            Err(_) => panic!("Compute pipeline creation panicked for '{}'", name),
        };
        if let Some(err) = device.pop_error_scope().await {
            panic!("Compute pipeline validation failed for '{}': {err}", name);
        }
    }
}

#[tokio::test]
async fn gpu_chain_process_frame_smoke() {
    let chain = match GpuChain::new(17, None).await {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Skipping gpu_chain_process_frame_smoke: GPU chain unavailable: {e}");
            return;
        }
    };

    // COCO-ish parent map (17 joints)
    let parents: [i32; 17] = [-1, 0, 0, 1, 2, 0, 0, 5, 6, 7, 8, 5, 6, 11, 12, 13, 14];
    let rest_lengths: [f32; 17] = [
        0.05, 0.04, 0.04, 0.05, 0.05, 0.25, 0.25, 0.26, 0.26, 0.23, 0.23, 0.30, 0.30, 0.40, 0.40,
        0.38, 0.38,
    ];
    chain.upload_topology(&parents, &rest_lengths);

    // Frame A
    let joints_a: Vec<Joint> = (0..17)
        .map(|i| Joint {
            position: [0.4 + (i as f32) * 0.005, 0.6 - (i as f32) * 0.01, 0.0],
            confidence: 0.85,
        })
        .collect();
    let out_a = chain
        .process_frame(&joints_a, 0.033, 0.0)
        .await
        .expect("GPU chain failed on first frame");

    // Frame B (localized motion so constraints can't collapse it to identity)
    let mut joints_b = joints_a.clone();
    joints_b[9].position[0] += 0.06;
    joints_b[10].position[1] -= 0.05;
    joints_b[15].position[2] += 0.04;
    let out_b = chain
        .process_frame(&joints_b, 0.033, 0.033)
        .await
        .expect("GPU chain failed on second frame");

    assert_eq!(out_a.len(), 17, "first frame output joint count mismatch");
    assert_eq!(out_b.len(), 17, "second frame output joint count mismatch");

    // Ensure frame-to-frame input motion propagates through the chain.
    let mut motion_delta = 0.0_f32;
    for i in 0..out_b.len() {
        motion_delta += (out_b[i].position[0] - out_a[i].position[0]).abs();
        motion_delta += (out_b[i].position[1] - out_a[i].position[1]).abs();
        motion_delta += (out_b[i].position[2] - out_a[i].position[2]).abs();
    }
    assert!(
        motion_delta > 1e-4,
        "GPU chain output appears static across frames; total delta={motion_delta}"
    );

    for (idx, j) in out_b.iter().enumerate() {
        assert!(
            j.position[0].is_finite() && j.position[1].is_finite() && j.position[2].is_finite(),
            "joint {} has non-finite position: {:?}",
            idx,
            j.position
        );
        assert!(
            (0.0..=1.0).contains(&j.confidence),
            "joint {} confidence out of range: {}",
            idx,
            j.confidence
        );
    }
}

#[tokio::test]
async fn gpu_chain_physics_floor_lock_converges_on_ankles() {
    let chain = match GpuChain::new(17, None).await {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Skipping gpu_chain_physics_floor_lock_converges_on_ankles: GPU chain unavailable: {e}");
            return;
        }
    };

    let parents: [i32; 17] = [-1, 0, 0, 1, 2, 0, 0, 5, 6, 7, 8, 5, 6, 11, 12, 13, 14];
    let rest_lengths: [f32; 17] = [
        0.05, 0.04, 0.04, 0.05, 0.05, 0.25, 0.25, 0.26, 0.26, 0.23, 0.23, 0.30, 0.30, 0.40, 0.40,
        0.38, 0.38,
    ];
    chain.upload_topology(&parents, &rest_lengths);

    let mut joints: Vec<Joint> = (0..17)
        .map(|i| Joint {
            position: [0.2 + (i as f32) * 0.01, 0.4 - (i as f32) * 0.005, 0.0],
            confidence: 0.9,
        })
        .collect();

    // Force ankles below floor so lock path must clamp over sequential frames.
    joints[15].position[1] = -0.25;
    joints[16].position[1] = -0.22;

    // First pass seeds prev/history buffers.
    let _ = chain
        .process_frame(&joints, 0.033, 0.0)
        .await
        .expect("GPU chain failed on floor-lock warmup frame");

    // Second pass should see near-zero ankle velocity and lock to floor.
    let out = chain
        .process_frame(&joints, 0.033, 0.033)
        .await
        .expect("GPU chain failed on floor-lock verification frame");

    for ankle_idx in [15_usize, 16_usize] {
        let y_in = joints[ankle_idx].position[1];
        let y_out = out[ankle_idx].position[1];
        assert!(
            y_out.is_finite(),
            "ankle joint {} produced non-finite y",
            ankle_idx
        );
        assert!(
            y_out > y_in + 0.01,
            "ankle joint {} did not lift toward floor lock target (in={}, out={})",
            ankle_idx,
            y_in,
            y_out
        );
    }
}

#[tokio::test]
async fn gpu_chain_default_mode_is_stable_on_static_frame() {
    let chain = match GpuChain::new(17, None).await {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Skipping gpu_chain_default_mode_is_stable_on_static_frame: GPU chain unavailable: {e}");
            return;
        }
    };

    // No constraints: every joint is root so skeleton pass should be pass-through.
    let parents: [i32; 17] = [-1; 17];
    let rest_lengths: [f32; 17] = [0.0; 17];
    chain.upload_topology(&parents, &rest_lengths);

    // Well above floor to avoid physics clamping.
    let joints: Vec<Joint> = (0..17)
        .map(|i| Joint {
            position: [
                0.25 + (i as f32) * 0.02,
                0.55 + (i as f32) * 0.01,
                0.1 + (i as f32) * 0.005,
            ],
            confidence: 0.95,
        })
        .collect();

    // First frame seeds history buffers. Second frame should remain stable.
    let _ = chain
        .process_frame(&joints, 0.033, 0.0)
        .await
        .expect("GPU chain failed on first static frame");
    let out = chain
        .process_frame(&joints, 0.033, 0.033)
        .await
        .expect("GPU chain failed on second static frame");

    assert_eq!(out.len(), joints.len(), "output joint count mismatch");

    let mut max_abs_delta = 0.0_f32;
    for i in 0..joints.len() {
        let dx = (out[i].position[0] - joints[i].position[0]).abs();
        let dy = (out[i].position[1] - joints[i].position[1]).abs();
        let dz = (out[i].position[2] - joints[i].position[2]).abs();
        max_abs_delta = max_abs_delta.max(dx.max(dy).max(dz));
    }

    assert!(
        max_abs_delta < 0.25,
        "static-frame stability violated (max abs delta={max_abs_delta})"
    );
}
