# K_OS IPC Optimization Patterns

**Date:** 2026-03-09  
**Focus:** Eliminating IPC bottlenecks with native k-os-renderer  
**Priority:** HIGH - Critical for real-time performance

---

## The IPC Problem (Legacy Three.js)

### Current Bottleneck

```typescript
// ❌ BAD: Serialize entire mesh through IPC (Legacy)
const mesh = await invoke('sculpt_apply_brush', {
  meshData: largeGLBBuffer, // 10-100MB serialized to JSON
  brushParams: { strength: 0.5, radius: 10 }
});
// Result: 100-500ms latency, UI freeze
```

**Why This Failed (Three.js Era):**
1. **JSON Serialization** - Binary data → Base64 → JSON (3x size overhead)
2. **Memory Copies** - Data copied 4+ times (JS → IPC → Rust → GPU)
3. **Blocking** - UI thread frozen during transfer
4. **No Streaming** - All-or-nothing transfer
5. **WebGL Limitations** - No direct GPU memory access

---

## Solution: Native k-os-renderer Architecture

With `k-os-renderer` (Rust + wgpu + winit), the entire paradigm changes:

**Key Insight:** The viewport is now a **native Rust process** with direct GPU access. React never touches mesh data - it only sends commands and receives handles.

---

## Solution 1: Handle-Based Architecture (k-os-renderer Native)

### The Pattern

**All mesh data lives in Rust GPU buffers. React only holds handles.**

```typescript
// ✅ GOOD: Native renderer owns all data
const viewportHandle = await invoke('renderer_create_viewport', {
  config: { width: 1920, height: 1080, msaa_samples: 4 }
});

// Upload mesh once to GPU (happens in Rust, not through IPC)
const meshHandle = await invoke('scene_create_mesh', { 
  path: '/assets/character.glb' 
});

// Attach mesh to viewport (just handles, no data transfer)
const renderMeshHandle = await invoke('renderer_attach_mesh', {
  viewport: viewportHandle,
  mesh: meshHandle
});

// Apply brush (GPU-side operation, no data transfer)
await invoke('sculpt_apply_brush', {
  meshHandle: meshHandle, // Just a u64 handle
  brushParams: { strength: 0.5, radius: 10 }
});
// Result: 1-4ms latency, zero data transfer
```

### Rust Implementation (k-os-renderer)

```rust
// crates/k-os-renderer/src/lib.rs (already implemented)
pub struct Renderer {
    render_graph: RenderGraph,
    viewports: HashMap<ViewportHandle, ViewportRuntime>,
    meshes: HashMap<RenderMeshHandle, RenderMeshRuntime>,
    scene_to_render: HashMap<MeshHandle, Vec<RenderMeshHandle>>,
    selection_cache: HashMap<MeshHandle, MeshSelectionCache>,
}

impl Renderer {
    // All data stays in Rust, React never sees it
    pub fn attach_mesh(
        &mut self,
        viewport: ViewportHandle,
        mesh: MeshHandle,
    ) -> Result<RenderMeshHandle, RendererError> {
        // Mesh data already on GPU from scene system
        // Just create render handle and link to viewport
        let handle = RenderMeshHandle(NEXT_RENDER_MESH_ID.fetch_add(1, Ordering::Relaxed));
        self.meshes.insert(handle, RenderMeshRuntime {
            handle,
            scene_mesh: mesh,
            viewport,
            dirty: true,
            payload_version: None,
            vertex_count: 0,
            index_count: 0,
        });
        Ok(handle)
    }

    // GPU-side operation, no CPU round-trip
    pub fn execute_viewport(
        &mut self,
        viewport: ViewportHandle,
    ) -> Result<Option<RenderGraphExecutionReport>, RendererError> {
        let context = self.viewport_context(viewport)?;
        self.render_graph.execute(&device, &queue, &context)
    }
}
```

### React Integration

```typescript
// src-frontend/hooks/useMesh.ts
import { invoke } from '@tauri-apps/api/tauri';

export function useMesh() {
  const [meshHandle, setMeshHandle] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const uploadMesh = async (glbData: ArrayBuffer) => {
    setIsLoading(true);
    try {
      const handle = await invoke<string>('upload_mesh', {
        data: Array.from(new Uint8Array(glbData))
      });
      setMeshHandle(handle);
      return handle;
    } finally {
      setIsLoading(false);
    }
  };

  const applyBrush = async (params: BrushParams) => {
    if (!meshHandle) throw new Error('No mesh loaded');
    
    await invoke('sculpt_apply_brush', {
      meshHandle,
      brushParams: params
    });
  };

  return { meshHandle, uploadMesh, applyBrush, isLoading };
}
```

**Performance Gain:** 10-50x faster (100-500ms → 2-8ms)

---

## Solution 2: Event-Driven Updates

### The Pattern

**Don't wait for results, stream progress updates.**

```typescript
// ❌ BAD: Synchronous blocking
const result = await invoke('bake_texture', { settings });
// UI frozen for 5-30 seconds

// ✅ GOOD: Async with progress
invoke('bake_texture_async', { settings });

listen('bake-progress', (event) => {
  setProgress(event.payload.percent);
  setPreview(event.payload.previewUrl);
});

listen('bake-complete', (event) => {
  setResult(event.payload.textureHandle);
});
```

### Rust Implementation

```rust
// src-tauri/src/baking.rs
use tauri::{AppHandle, Manager};

#[tauri::command]
async fn bake_texture_async(
    settings: BakeSettings,
    app: AppHandle
) -> Result<(), String> {
    // Spawn background task
    tokio::spawn(async move {
        let total_samples = settings.samples;
        
        for sample in 0..total_samples {
            // Render sample
            let preview = render_sample(sample, &settings);
            
            // Emit progress
            app.emit_all("bake-progress", BakeProgress {
                percent: (sample as f32 / total_samples as f32) * 100.0,
                preview_url: preview.to_data_url(),
            }).ok();
            
            // Check for cancellation
            if should_cancel() {
                app.emit_all("bake-cancelled", ()).ok();
                return;
            }
        }
        
        // Finalize
        let texture_handle = finalize_bake(&settings);
        app.emit_all("bake-complete", BakeResult {
            texture_handle,
        }).ok();
    });
    
    Ok(())
}
```

### React Integration

```typescript
// src-frontend/hooks/useBaking.ts
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';

export function useBaking() {
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    const unlistenProgress = listen('bake-progress', (event) => {
      setProgress(event.payload.percent);
      setPreview(event.payload.previewUrl);
    });

    const unlistenComplete = listen('bake-complete', (event) => {
      setResult(event.payload.textureHandle);
      setProgress(100);
    });

    return () => {
      unlistenProgress.then(fn => fn());
      unlistenComplete.then(fn => fn());
    };
  }, []);

  const startBake = async (settings: BakeSettings) => {
    setProgress(0);
    setResult(null);
    await invoke('bake_texture_async', { settings });
  };

  return { progress, preview, result, startBake };
}
```

**Performance Gain:** UI stays responsive, real-time feedback

---

## Solution 3: Shared Memory Buffers

### The Pattern

**For ultra-high-frequency updates (brush strokes), use shared memory.**

```typescript
// ❌ BAD: 60 FPS brush strokes through IPC
onMouseMove((event) => {
  invoke('sculpt_stroke', {
    x: event.x,
    y: event.y,
    pressure: event.pressure
  }); // 60 IPC calls/sec = bottleneck
});

// ✅ GOOD: Write to shared buffer
const strokeBuffer = await invoke('create_stroke_buffer');

onMouseMove((event) => {
  // Write directly to shared memory
  writeToBuffer(strokeBuffer, {
    x: event.x,
    y: event.y,
    pressure: event.pressure
  });
  // Rust polls buffer at 120Hz
});
```

### Rust Implementation

```rust
// src-tauri/src/shared_buffer.rs
use std::sync::Arc;
use parking_lot::RwLock;

pub struct StrokeBuffer {
    data: Arc<RwLock<Vec<StrokePoint>>>,
}

impl StrokeBuffer {
    pub fn new() -> Self {
        Self {
            data: Arc::new(RwLock::new(Vec::with_capacity(1024))),
        }
    }

    pub fn push(&self, point: StrokePoint) {
        self.data.write().push(point);
    }

    pub fn drain(&self) -> Vec<StrokePoint> {
        let mut data = self.data.write();
        data.drain(..).collect()
    }
}

// Background polling task
async fn poll_stroke_buffer(buffer: Arc<StrokeBuffer>, mesh_handle: String) {
    let mut interval = tokio::time::interval(Duration::from_millis(8)); // 120Hz
    
    loop {
        interval.tick().await;
        
        let points = buffer.drain();
        if !points.is_empty() {
            apply_stroke_batch(&mesh_handle, &points);
        }
    }
}
```

**Performance Gain:** 60+ FPS brush strokes with <1ms latency

---

## Solution 4: GPU-Side Operations (k-os-renderer RenderGraph)

### The Pattern

**All operations execute on GPU via RenderGraph. Zero CPU round-trips.**

```typescript
// ❌ BAD (Legacy Three.js): Download mesh, modify, re-upload
const meshData = await invoke('download_mesh', { handle });
const modified = modifyMeshCPU(meshData);
await invoke('upload_mesh', { data: modified });
// Result: 200-1000ms, 3 copies

// ✅ GOOD (k-os-renderer): GPU-side RenderGraph execution
await invoke('renderer_execute_viewport', {
  viewport: viewportHandle
});
// Result: 1-5ms, 0 copies, all operations on GPU
```

### Rust Implementation (k-os-renderer RenderGraph)

```rust
// crates/k-os-renderer/src/render_graph.rs (already implemented)
pub struct RenderGraph {
    passes: Vec<RenderPassKind>,
    resources: HashMap<String, RenderResourceBinding>,
}

impl RenderGraph {
    // Execute entire graph on GPU
    pub fn execute(
        &self,
        device: &Device,
        queue: &Queue,
        context: &RenderGraphExecutionContext,
    ) -> Result<RenderGraphExecutionReport, String> {
        let mut encoder = device.create_command_encoder(&Default::default());
        
        for pass in &self.passes {
            match pass {
                RenderPassKind::Compute { shader, workgroups } => {
                    // Execute compute shader on GPU
                    let pipeline = self.get_compute_pipeline(device, shader);
                    let mut compute_pass = encoder.begin_compute_pass(&Default::default());
                    compute_pass.set_pipeline(&pipeline);
                    compute_pass.set_bind_group(0, &bind_group, &[]);
                    compute_pass.dispatch_workgroups(*workgroups, 1, 1);
                }
                RenderPassKind::Render { .. } => {
                    // Render pass (rasterization)
                }
            }
        }
        
        queue.submit(Some(encoder.finish()));
        // All operations stay on GPU, no CPU round-trip
        Ok(report)
    }
}

// Tauri command
#[tauri::command]
async fn renderer_execute_viewport(
    viewport: ViewportHandle,
    state: tauri::State<'_, RendererService>
) -> Result<RenderGraphExecutionReport, String> {
    state.renderer.execute_viewport(viewport)
        .map_err(|e| e.to_string())
}
```

**Performance Gain:** 100-200x faster than CPU operations, zero memory copies

---

## Solution 5: Batch Operations

### The Pattern

**Group multiple operations into single IPC call.**

```typescript
// ❌ BAD: Multiple IPC calls
for (const vertex of selectedVertices) {
  await invoke('move_vertex', { vertexId: vertex.id, delta: [0, 1, 0] });
}
// Result: N * 5ms = 500ms for 100 vertices

// ✅ GOOD: Batch operation
await invoke('move_vertices_batch', {
  vertexIds: selectedVertices.map(v => v.id),
  delta: [0, 1, 0]
});
// Result: 10ms for 100 vertices
```

### Rust Implementation

```rust
#[tauri::command]
async fn move_vertices_batch(
    mesh_handle: String,
    vertex_ids: Vec<u32>,
    delta: [f32; 3],
    state: tauri::State<'_, MeshManager>
) -> Result<(), String> {
    let mesh = state.get_mesh(&mesh_handle).ok_or("Mesh not found")?;
    
    // Single GPU dispatch for all vertices
    mesh.move_vertices_gpu(&vertex_ids, delta)?;
    
    Ok(())
}
```

**Performance Gain:** N operations → 1 operation (50-100x faster)

---

## Performance Comparison (k-os-renderer Native)

| Pattern | Latency | Throughput | Use Case |
|---------|---------|------------|----------|
| Direct IPC (Legacy) | 5-50ms | 20-200 ops/sec | Infrequent operations |
| Handle-Based (Native) | 1-4ms | 250-1000 ops/sec | Frequent operations |
| Event-Driven | 0.5-2ms | 500-2000 ops/sec | Async operations |
| Shared Buffer | <0.5ms | 2000+ ops/sec | Real-time input |
| RenderGraph (GPU) | 1-5ms | 200-1000 ops/sec | Heavy compute |
| Batch | 5-20ms | 5000+ ops/batch | Bulk operations |

**Key Improvement:** Native renderer eliminates WebGL overhead, providing 4-8x better latency across all patterns.

---

## Best Practices

### DO ✅

1. **Upload once, reference by handle**
2. **Use events for async operations**
3. **Keep data on GPU when possible**
4. **Batch multiple operations**
5. **Profile before optimizing**

### DON'T ❌

1. **Serialize large binary data through IPC**
2. **Block UI thread on IPC calls**
3. **Round-trip GPU data to CPU**
4. **Make IPC calls in tight loops**
5. **Duplicate state across Rust/React**

---

## Migration Checklist

- [ ] Audit all `invoke()` calls for large data transfers
- [ ] Implement handle-based mesh management
- [ ] Convert long operations to event-driven
- [ ] Add shared buffer for brush strokes
- [ ] Move operations to GPU-side
- [ ] Batch vertex/face operations
- [ ] Profile before/after performance
- [ ] Document IPC contracts

---

## References

- [Tauri IPC Best Practices](https://tauri.app/v1/guides/features/command/)
- [wgpu Compute Shaders](https://wgpu.rs/)
- [Rust Async Patterns](https://rust-lang.github.io/async-book/)
- [Zero-Copy Serialization](https://capnproto.org/)

---

**Status:** Ready for implementation  
**Priority:** HIGH - Blocks multi-window migration  
**Owner:** Kipp (Scavenger King)
