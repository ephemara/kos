# K_OS SCULPTING MASTER LIST
## Features & Implementation Paths from Reference Projects

**Reference Projects Analyzed:**
1. **uSculpt** - GPU-first OpenGL/GLSL sculpting (C++)
2. **Dilay** - Production-grade CPU sculpting with dynamic mesh (C++)
3. **Freestyle** - Academic sculpting with topological ops (C++)
4. **sculpt-3D** - React/Three.js sculpting (TypeScript)

---

# 🔴 PRIORITY 1: CRITICAL PERFORMANCE FIXES

## 1.1 Gaussian Falloff Function
| Attribute | Details |
|-----------|---------|
| **Source** | uSculpt `ShaderBrush.comp:68-80` |
| **Problem** | K_OS uses quadratic `(1-t)²` which feels "steppy" |
| **Solution** | Replace with Gaussian `exp(-t²/σ²)` |
| **Files to Modify** | `sculpt_stamp.wgsl`, `sculpt_smooth.wgsl`, `sculpt_pinch.wgsl`, `sculpt.rs` |
| **Effort** | 30 minutes |
| **Impact** | HIGH - Immediately smoother brush feel |

```wgsl
// NEW: Gaussian falloff for all WGSL shaders
fn falloff_gaussian(dist: f32, radius: f32) -> f32 {
    let t = dist * 4.0 / radius;
    return exp(-t * t / 4.5);  // σ² = 2.25 * 2
}
```

```rust
// NEW: Gaussian falloff for Rust CPU kernels
fn falloff_gaussian(dist: f32, radius: f32) -> f32 {
    let t = dist * 4.0 / radius;
    (-t * t / 4.5).exp()
}
```

---

## 1.2 LinearStep Two-Zone Falloff
| Attribute | Details |
|-----------|---------|
| **Source** | Dilay `brush.cpp:47` (`Util::linearStep`) |
| **Problem** | Single-zone falloff has no "plateau" for consistent effect |
| **Solution** | Inner zone (full intensity) + outer zone (smooth fade) |
| **Files to Modify** | Add as brush parameter option |
| **Effort** | 1 hour |
| **Impact** | MEDIUM - More predictable brush behavior |

```rust
// Inner plateau + smooth outer fade
fn falloff_linear_step(dist: f32, inner_radius: f32, outer_radius: f32) -> f32 {
    if dist < inner_radius { return 1.0; }
    if dist > outer_radius { return 0.0; }
    let t = (dist - inner_radius) / (outer_radius - inner_radius);
    1.0 - t * t * (3.0 - 2.0 * t)  // Hermite smoothstep
}
```

---

## 1.3 GPU-Resident Mesh (Zero IPC Round-Trip)
| Attribute | Details |
|-----------|---------|
| **Source** | uSculpt `uSculpt.cpp` main loop |
| **Problem** | K_OS does TS → Rust → GPU → Rust → TS per stroke (latency) |
| **Solution** | Keep mesh on GPU, only sync for undo snapshots |
| **Files to Modify** | `crates/k-os-bevy/src/tools/sculpt.rs`, Bevy render graph |
| **Effort** | 2-3 days |
| **Impact** | VERY HIGH - Eliminates per-frame latency |

**Architecture:**
```
Current:  [Frontend] → IPC → [Rust] → GPU → [Rust] → IPC → [Frontend]
Target:   [Bevy]  ────────────→ GPU ──────────────→ [Render]
                                ↑
                          (stays resident)
```

---

# 🟠 PRIORITY 2: DYNAMIC MESH OPERATIONS

## 2.1 Adaptive Subdivision (Live Detail)
| Attribute | Details |
|-----------|---------|
| **Source** | Dilay `action.cpp:176-327`, sculpt-3D `symmetricSubdivision.ts` |
| **Problem** | K_OS mesh density is fixed - can't add detail where needed |
| **Solution** | Split edges > threshold during sculpting |
| **Files to Modify** | New `DynamicMesh` module in `k-os-engine` |
| **Effort** | 2-3 days |
| **Impact** | VERY HIGH - Enables infinite detail sculpting |

**Algorithm (from Dilay):**
```rust
fn split_edges(mesh: &mut DynamicMesh, max_length: f32, affected_faces: &DynamicFaces) {
    // 1. Find edges longer than max_length in brush area
    // 2. Calculate midpoint position using normal-aware interpolation
    // 3. Add new vertex at midpoint
    // 4. Triangulate affected faces (1→2 or 1→4 based on split pattern)
    // 5. Repeat until no edges exceed threshold
}
```

**Key Data Structures:**
```rust
struct DynamicMesh {
    vertices: Vec<glam::Vec3>,
    normals: Vec<glam::Vec3>,
    indices: Vec<u32>,
    vertex_data: Vec<VertexData>,  // isFree, adjacentFaces
    face_data: Vec<FaceData>,      // isFree
    free_vertices: Vec<u32>,       // Recycled indices
    free_faces: Vec<u32>,
}

struct VertexData {
    is_free: bool,
    adjacent_faces: SmallVec<[u32; 6]>,  // Usually 5-7 faces per vertex
}
```

---

## 2.2 Edge Collapse (Reduce Brush)
| Attribute | Details |
|-----------|---------|
| **Source** | Dilay `action.cpp:514-685`, Freestyle `quasiuniformmesh.cpp:4-24` |
| **Problem** | Can't reduce mesh density in sculpted areas |
| **Solution** | Collapse edges shorter than threshold |
| **Files to Modify** | Same `DynamicMesh` module |
| **Effort** | 1 day (after subdivision implemented) |
| **Impact** | MEDIUM - Enables reduce/simplify brush |

```rust
fn collapse_edge(mesh: &mut DynamicMesh, i1: u32, i2: u32) -> bool {
    // 1. Check valence constraints (v1 >= 3, v2 >= 3)
    // 2. Find left/right faces sharing edge
    // 3. Delete edge faces, merge vertices
    // 4. Create new vertex at midpoint
    // 5. Reconnect adjacent faces
}
```

---

## 2.3 Edge Relaxation (Topology Quality)
| Attribute | Details |
|-----------|---------|
| **Source** | Dilay `action.cpp:329-376`, Freestyle `topologicalhandler.cpp:42-83` |
| **Problem** | Poor valence distribution causes visual artifacts |
| **Solution** | Flip edges to maintain valence ~6 |
| **Files to Modify** | `DynamicMesh` module |
| **Effort** | 3 hours |
| **Impact** | MEDIUM - Cleaner mesh topology |

```rust
fn relax_edges(mesh: &mut DynamicMesh, faces: &DynamicFaces) {
    // For each edge where valence deviation would improve by flipping:
    // 1. Get edge endpoints e1, e2 and opposite vertices left, right
    // 2. Score = |v(e1)-6| + |v(e2)-6| + |v(left)-6| + |v(right)-6|
    // 3. If flipping reduces score AND valences stay > 3: flip
}
```

---

## 2.4 Vertex Welding (Genus Changes)
| Attribute | Details |
|-----------|---------|
| **Source** | Freestyle `topologicalhandler.cpp:10-173` |
| **Problem** | Can't create handles/holes by joining distant vertices |
| **Solution** | Detect close non-adjacent vertices, weld rings |
| **Files to Modify** | `DynamicMesh` module |
| **Effort** | 1-2 days |
| **Impact** | LOW (advanced feature) - Enables topology changes |

---

# 🟡 PRIORITY 3: BRUSH IMPROVEMENTS

## 3.1 Tangential Smoothing
| Attribute | Details |
|-----------|---------|
| **Source** | Dilay `action.cpp:378-438` |
| **Problem** | Current smooth shrinks/inflates mesh |
| **Solution** | Project smoothed position onto tangent plane |
| **Files to Modify** | `sculpt_smooth.wgsl`, `sculpt.rs` |
| **Effort** | 30 minutes |
| **Impact** | HIGH - Preserves volume during smoothing |

```wgsl
// Tangential smooth (preserves volume)
fn smooth_tangential(pos: vec3<f32>, avg_pos: vec3<f32>, normal: vec3<f32>, weight: f32) -> vec3<f32> {
    let delta = avg_pos - pos;
    let tangent_delta = delta - normal * dot(delta, normal);
    return pos + tangent_delta * weight;
}
```

---

## 3.2 Polynomial Brush Curves
| Attribute | Details |
|-----------|---------|
| **Source** | Freestyle `operator.cpp:31` |
| **Problem** | Limited falloff curve options |
| **Solution** | Parameterized polynomial: `(n-1)x^n - nx^(n-1) + 1` |
| **Files to Modify** | Add `smoothParam` to `BrushParams` |
| **Effort** | 30 minutes |
| **Impact** | LOW - More artistic control |

```rust
// n = smoothness parameter (2 = linear, 3 = quadratic, etc.)
fn polynomial_falloff(t: f32, n: u32) -> f32 {
    let nf = n as f32;
    (nf - 1.0) * t.powi(n as i32) - nf * t.powi(n as i32 - 1) + 1.0
}
```

---

## 3.3 Twist Brush
| Attribute | Details |
|-----------|---------|
| **Source** | Freestyle `operator.cpp:58-86` |
| **Problem** | K_OS missing twist/rotate brush |
| **Solution** | Rotate vertices around brush axis |
| **Files to Modify** | New `sculpt_twist.wgsl` |
| **Effort** | 2 hours |
| **Impact** | LOW - Nice-to-have brush type |

```wgsl
fn twist_vertex(pos: vec3<f32>, center: vec3<f32>, axis: vec3<f32>, angle: f32, falloff: f32) -> vec3<f32> {
    let rel = pos - center;
    let parallel = axis * dot(rel, axis);
    let perp = rel - parallel;
    let rotated = perp * cos(angle * falloff) + cross(axis, perp) * sin(angle * falloff);
    return center + parallel + rotated;
}
```

---

## 3.4 Dynamic Step Width
| Attribute | Details |
|-----------|---------|
| **Source** | Dilay `brush.cpp:230` |
| **Problem** | Fixed stroke spacing regardless of brush size |
| **Solution** | `stepWidth = factor * log(radius + 1)` |
| **Files to Modify** | `brush_dynamics.rs` |
| **Effort** | 15 minutes |
| **Impact** | LOW - Smoother large brush strokes |

---

# 🟢 PRIORITY 4: INFRASTRUCTURE

## 4.1 Loose Octree for Spatial Queries
| Attribute | Details |
|-----------|---------|
| **Source** | Dilay `dynamic/octree.cpp` |
| **Problem** | Tight BVH needs rebuild after vertex moves |
| **Solution** | Loose octree (2x bounding box) handles movement |
| **Files to Modify** | Optional replacement for `SpatialGrid` |
| **Effort** | 2 days |
| **Impact** | MEDIUM - Better query performance during sculpting |

**Key insight:** `looseAABox(c, 2.0f * w, 2.0f * w, 2.0f * w)` - doubled bounds

---

## 4.2 Symmetry-Aware Subdivision
| Attribute | Details |
|-----------|---------|
| **Source** | sculpt-3D `symmetricSubdivision.ts` |
| **Problem** | Subdivision can break mesh symmetry |
| **Solution** | Subdivide all symmetry points simultaneously |
| **Files to Modify** | `DynamicMesh` + symmetry integration |
| **Effort** | 1 day |
| **Impact** | MEDIUM - Maintains symmetry during detail addition |

---

## 4.3 Face Adjacency Structures
| Attribute | Details |
|-----------|---------|
| **Source** | sculpt-3D `BrushPreview.tsx:40-90` |
| **Problem** | No prebuilt face adjacency for smooth normal averaging |
| **Solution** | Build `vertexToFaces` and `faceNeighbors` maps |
| **Files to Modify** | `MeshTopology` in `sculpt.rs` |
| **Effort** | 1 hour |
| **Impact** | LOW - Better brush preview normals |

---

## 4.4 Distance Field for Complex Brushes
| Attribute | Details |
|-----------|---------|
| **Source** | Freestyle `engine/distancefield.cpp` |
| **Problem** | No SDF-based brush effects |
| **Solution** | 3D distance field for volume-aware operations |
| **Files to Modify** | New optional module |
| **Effort** | 1 week |
| **Impact** | LOW (advanced) - Enables volume brushes |

---

# 📊 IMPLEMENTATION ROADMAP

## Phase 1: Quick Wins (1 day)
- [ ] 1.1 Gaussian falloff in WGSL shaders
- [ ] 1.2 LinearStep falloff option
- [ ] 3.1 Tangential smoothing
- [ ] 3.4 Dynamic step width

## Phase 2: Core Dynamic Mesh (1 week)
- [ ] 2.1 DynamicMesh data structure
- [ ] 2.1 Edge splitting / adaptive subdivision
- [ ] 2.3 Edge relaxation
- [ ] 4.2 Symmetry-aware subdivision

## Phase 3: GPU-Resident Architecture (1 week)
- [ ] 1.3 Bevy GPU-resident mesh
- [ ] 1.3 Compute shader dispatch per frame
- [ ] 1.3 Lazy CPU sync for undo

## Phase 4: Polish (ongoing)
- [ ] 2.2 Edge collapse / reduce brush
- [ ] 3.2 Polynomial falloff curves
- [ ] 3.3 Twist brush
- [ ] 4.1 Loose octree
- [ ] 2.4 Vertex welding (genus changes)
- [ ] 4.4 Distance field brushes

---

# 📁 REFERENCE FILE LOCATIONS

| Feature | Reference File |
|---------|----------------|
| Gaussian falloff | `IMPORTS/uSculpt-main/ShaderBrush.comp:68-80` |
| GPU pipeline | `IMPORTS/uSculpt-main/uSculpt.cpp:main loop` |
| Adaptive subdivision | `IMPORTS/dilay-master/lib/src/tool/sculpt/util/action.cpp:176-327` |
| Edge collapse | `IMPORTS/dilay-master/lib/src/tool/sculpt/util/action.cpp:514-685` |
| Edge relaxation | `IMPORTS/dilay-master/lib/src/tool/sculpt/util/action.cpp:329-376` |
| Tangential smooth | `IMPORTS/dilay-master/lib/src/tool/sculpt/util/action.cpp:378-438` |
| DynamicMesh | `IMPORTS/dilay-master/lib/src/dynamic/mesh.cpp` |
| DynamicOctree | `IMPORTS/dilay-master/lib/src/dynamic/octree.cpp` |
| QuasiUniformMesh | `IMPORTS/freestyle-master/sculptor/quasiuniformmesh.cpp` |
| Vertex welding | `IMPORTS/freestyle-master/sculptor/topologicalhandler.cpp` |
| Twist brush | `IMPORTS/freestyle-master/sculptor/operator.cpp:58-86` |
| Symmetric subdiv | `IMPORTS/sculpt-3D-main/src/utils/symmetricSubdivision.ts` |
| Symmetry points | `IMPORTS/sculpt-3D-main/src/services/sculpting/sculptingEngine.ts:28-62` |

---

# 🤖 AI PORTING NOTES

**For AI agents porting these features:**

1. **Dilay is C++ with OpenMesh** - Translate iterator patterns to Rust iterators
2. **uSculpt is GLSL** - Almost 1:1 translation to WGSL (minor syntax changes)
3. **sculpt-3D is TypeScript/Three.js** - Logic translates to Rust, Three.js → Bevy
4. **Freestyle uses OpenMesh** - Similar to Dilay, half-edge mesh structure

**Common translations:**
```
OpenMesh::VertexHandle    → u32 (vertex index)
mesh.point(vh)            → positions[vh as usize]
mesh.normal(vh)           → normals[vh as usize]
vv_iter(v)                → topology.vertex_neighbors(v)
ve_iter(v)                → topology.vertex_edges(v)
vf_iter(v)                → topology.vertex_faces(v)
mesh.add_vertex(p)        → dynamic_mesh.add_vertex(p)
mesh.delete_face(f)       → dynamic_mesh.delete_face(f)
mesh.collapse(heh)        → dynamic_mesh.collapse_edge(e)
mesh.flip(eh)             → dynamic_mesh.flip_edge(e)
```

---

*Generated by K_OS sculpting analysis - December 2024*
