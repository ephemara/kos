# ☢️ K_OS RAW (Zero Build)

This is the new "Raw Dog" frontend for K_OS. 
It requires NO build step, NO npm install, and NO bundlers.

# K_OS: Raw Dog Edition (Vanilla JS + Rust)

This is the pure Vanilla JS frontend for K_OS, designed for maximum performance and direct GPU integration.

## Features Implemented
- **Core Architecture**: Golden Layout + Module Injection
- **Bridge**: Direct `invoke` and `send` to Rust backend
- **Sculpt Feature**:
  - Three.js Viewport (WebGL 2.0)
  - Raycasting & Brush Cursors
  - Backend Integration (`init_sculpt_mesh`, `apply_brush`)
  - Brush Tools: Draw, Clay, Smooth, Flatten, Grab, pinch, Inflate
  - Dynamic Mesh Updates (Vertex positions & Normals)
  - UI Panel (Radius, Intensity, Symmetry, Subdivide)

## Getting Started
1. Run `npm run tauri dev`
2. The UI will default to "Sculpt" mode.
3. A sphere will appear.
4. Left-click to sculpt.
5. Alt+Left-Click to orbit.

## Architecture
- `src-raw/main.js`: Entry point, manages layout and feature switching.
- `src-raw/features/sculpt.js`: Self-contained sculpting module.
- `src-raw/core/bridge.js`: Communication with Tauri backend.
Tauri is configured to serve this directory directly.
