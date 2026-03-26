# Zen Mocap Engine ⚡

**GPU-Accelerated Real-Time AI Body Tracking, IK Solving, and Motion Synthesis Pipeline.**

Zen Mocap is a high-performance Rust engine designed for zero-latency markerless motion capture. It combines deep learning pose inference with a high-bandwidth GPU compute chain authored entirely in the **KAIN** programming language.

---

## 🏗 Architecture: The 5-Pass GPU Compute Chain

Unlike traditional mocap systems that handle filtering and IK on the CPU, Zen Mocap offloads the entire motion refinement pipeline to the GPU via `wgpu` and SPIR-V compute shaders.

Every frame follows this sequence:

1.  **AI Inference**: Raw camera frames hit the **ONNX Runtime** (CUDA/TensorRT) to produce 17 COCO keypoints.
2.  **GPU Upload**: 3D joint data is uploaded to GPU storage buffers.
3.  **Pass 1: Denoise (`mocap_denoise.spv`)**: High-performance One-Euro adaptive filter removes jitter while preserving rapid motion.
4.  **Pass 2: Skeleton (`mocap_skeleton.spv`)**: GPU-parallel FABRIK bone-length enforcement for structural integrity.
5.  **Pass 3: Physics (`mocap_physics.spv`)**: Real-time floor contact, foot-locking, and capsule-based self-collision.
6.  **Pass 4: SuperMotion (`mograph_supermotion.spv`)**: A heterogeneous procedural overlay engine with 50+ motion primitives (Orbit, Heartbeat, Turbulence, etc.).
7.  **Pass 5: LiveLink (`mocap_livelink.spv`)**: Parallel rotation matrix decomposition into quaternions for DCC output.

---

## 💎 The KAIN Connection

Zen Mocap serves as a primary production environment for the **KAIN** language. Every SPIR-V shader in the pipeline is authored in `.kn` source files:

*   **`mograph_supermotion.kn`**: 36.6 KB of dense procedural motion logic.
*   **`perlin_noise.kn`**: 70.7 KB KAIN implementation of multi-octave Perlin/Simplex noise.
*   **`linmath.kn`**: A full GPU-parallel linear algebra library.

Developing in KAIN allows for 1:20 code compression over GLSL/HLSL and native support for actor-based concurrency and effect tracking.

---

## 🌟 Key Features

*   **Multi-Person Scaling**: Designed for crowds. GPU dispatch scales as `count * 17`, handling mass-mocap without CPU branching.
*   **SuperMotion™ Engine**: 50+ procedural primitives that add life, secondary motion, and stylized overrides to raw capture data.
*   **DCC Broadcaster**: Built-in support for:
    *   **UE5 LiveLink** (UDP)
    *   **OSC** (Blender, Maya, C4D, Resolve)
    *   **JSON/MessagePack** (Custom integrations)
*   **Video Analysis**: Frame-by-frame batch processing of video files into `.zenmocap` take files.
*   **Zero-Copy Pipeline**: Uses lock-free ring buffers between camera, inference, and GPU threads for sub-millisecond latency.

---

## 🛠 Technology Stack

*   **Language**: Rust (Engine), KAIN (Shaders/Scripting).
*   **Compute**: wgpu (Vulkan/DX12/Metal) with SPIR-V passthrough.
*   **AI**: ONNX Runtime (CUDA, TensorRT, CoreML).
*   **Vision**: Nokhwa (Media Foundation / V4L2).
*   **Math**: Glam, Bytemuck, KAIN-LinMath.

---

## 🚀 High-Level API

The engine is exposed via a clean Rust API, easily integrated into Tauri or standalone applications.

```rust
use zen_mocap_engine::{MocapSession, SessionConfig};

// Initialize the 5-pass GPU session
let mut session = MocapSession::new(SessionConfig::default());

// Start live capture + broadcast
session.start().await?;

// Subscribe to live joint frames
let mut rx = session.subscribe();
while let Ok(frame) = rx.recv().await {
    println!("Joints tracked: {}", frame.joints.len());
}
```

---

*Part of the K-OS DCC Operating System.*
