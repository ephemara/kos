# K_OS PYTHON ARSENAL

> **FORMAT**: AI-optimized. Grouped by purpose. Quick reference for AI agents.
> **AGENTS**: Check here before adding new packages. Use what's available!
> **LOCATION**: `sources/python/` - Python sidecar for AI/ML operations

---

## QUICK REFERENCE

```
TOTAL_PACKAGES: ~50
LAST_UPDATED: 2025-12-13
PYTHON_VERSION: 3.10+
IPC_METHOD: JSON-RPC over stdio
GPU_FRAMEWORKS: PyTorch, Taichi, CuPy, JAX
```

---

## CORE SCIENTIFIC

| Package | Import | Purpose |
|---------|--------|---------|
| `numpy` | `import numpy as np` | Array operations, math foundation |
| `scipy` | `from scipy import ndimage, optimize` | Scientific computing, optimization |
| `numba` | `from numba import jit, njit, prange` | JIT compilation (Rust-like speed!) |

### Numba Quick Reference
```python
from numba import njit, prange

@njit(parallel=True)
def fast_operation(arr):
    result = np.zeros_like(arr)
    for i in prange(len(arr)):  # Parallel loop
        result[i] = arr[i] * 2
    return result
```

---

## 3D GEOMETRY & MESH

| Package | Import | Purpose | K_OS Use |
|---------|--------|---------|----------|
| `trimesh` | `import trimesh` | Mesh loading, boolean ops | Import/export |
| `open3d` | `import open3d as o3d` | Point clouds, reconstruction | Scanning |
| `pymeshlab` | `import pymeshlab` | MeshLab bindings (remesh, clean) | Mesh cleanup |
| `pyvista` | `import pyvista as pv` | 3D analysis, plotting | Debug viz |
| `libigl` | `import igl` | Geometry processing (Blender's lib) | Advanced ops |
| `vedo` | `from vedo import *` | 3D visualization | Preview |
| `meshio` | `import meshio` | Multi-format mesh I/O | Import/export |

### Trimesh Quick Reference
```python
import trimesh

# Load mesh
mesh = trimesh.load('model.glb')

# Boolean operations
result = trimesh.boolean.difference([mesh_a, mesh_b])

# Export
mesh.export('output.glb')

# Properties
vertices = mesh.vertices  # (N, 3) array
faces = mesh.faces        # (M, 3) array
normals = mesh.vertex_normals
```

### Open3D Quick Reference
```python
import open3d as o3d

# Load point cloud
pcd = o3d.io.read_point_cloud("scan.ply")

# Poisson surface reconstruction
mesh, densities = o3d.geometry.TriangleMesh.create_from_point_cloud_poisson(pcd, depth=9)

# Mesh simplification
mesh_simplified = mesh.simplify_quadric_decimation(target_number_of_triangles=10000)
```

---

## POINT CLOUDS & SCANNING

| Package | Import | Purpose |
|---------|--------|---------|
| `laspy` | `import laspy` | LAS/LAZ point cloud files |
| `plyfile` | `from plyfile import PlyData` | PLY format |
| `pyntcloud` | `from pyntcloud import PyntCloud` | Point cloud analysis |

---

## IMAGE & TEXTURE

| Package | Import | Purpose | K_OS Use |
|---------|--------|---------|----------|
| `Pillow` | `from PIL import Image` | Image I/O, basic ops | Texture load/save |
| `opencv-python` | `import cv2` | Computer vision | Edge detection, filters |
| `scikit-image` | `from skimage import filters` | Advanced image processing | PBR generation |
| `imageio` | `import imageio` | Image I/O, GIF/video | Export |
| `colour-science` | `import colour` | Color science (ACES, spectral) | Color grading |

### OpenCV Quick Reference
```python
import cv2
import numpy as np

# Load image
img = cv2.imread('texture.png', cv2.IMREAD_UNCHANGED)

# Convert color
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

# Edge detection (for normal maps)
edges = cv2.Canny(gray, 100, 200)

# Blur  
blurred = cv2.GaussianBlur(img, (5, 5), 0)

# Save
cv2.imwrite('output.png', img)
```

### Normal Map Generation
```python
from PIL import Image
import numpy as np

def height_to_normal(height_map, strength=1.0):
    """Convert heightmap to normal map"""
    h = np.array(height_map, dtype=np.float32) / 255.0
    
    # Sobel gradients
    dx = np.gradient(h, axis=1) * strength
    dy = np.gradient(h, axis=0) * strength
    
    # Normal vector
    normal = np.dstack((-dx, -dy, np.ones_like(h)))
    norm = np.linalg.norm(normal, axis=2, keepdims=True)
    normal = normal / norm
    
    # Convert to 0-255 range
    normal = ((normal + 1) * 0.5 * 255).astype(np.uint8)
    return Image.fromarray(normal)
```

---

## MACHINE LEARNING & AI

| Package | Import | Purpose | K_OS Use |
|---------|--------|---------|----------|
| `torch` | `import torch` | Deep learning | All ML |
| `torchvision` | `import torchvision` | Vision models | Image models |
| `transformers` | `from transformers import pipeline` | HuggingFace models | Text/image AI |
| `diffusers` | `from diffusers import StableDiffusionPipeline` | Stable Diffusion | AI textures |
| `segment-anything` | `from segment_anything import sam_model_registry` | Auto segmentation | Masking |
| `onnxruntime` | `import onnxruntime as ort` | Fast ONNX inference | Production |
| `ultralytics` | `from ultralytics import YOLO` | YOLOv8 detection | Object detect |

### PyTorch Quick Reference
```python
import torch
import torch.nn as nn

# Check GPU
device = 'cuda' if torch.cuda.is_available() else 'cpu'

# Tensor operations
x = torch.randn(32, 3, 256, 256, device=device)

# Model inference
model.eval()
with torch.no_grad():
    output = model(x)
```

### Stable Diffusion Quick Reference
```python
from diffusers import StableDiffusionImg2ImgPipeline
import torch

pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
    "runwayml/stable-diffusion-v1-5",
    torch_dtype=torch.float16
).to("cuda")

# Generate
result = pipe(
    prompt="seamless brick texture, 4k, pbr",
    image=input_image,
    strength=0.75
).images[0]
```

---

## GENERATIVE AI & TEXTURES

| Package | Import | Purpose |
|---------|--------|---------|
| `controlnet-aux` | `from controlnet_aux import *` | ControlNet preprocessors |
| `accelerate` | `from accelerate import Accelerator` | Distributed training |
| `safetensors` | `from safetensors import safe_open` | Safe model loading |
| `xformers` | Auto-enabled | Memory-efficient attention |

---

## PHYSICS & SIMULATION

| Package | Import | Purpose | K_OS Use |
|---------|--------|---------|----------|
| `taichi` | `import taichi as ti` | GPU physics (fast!) | Fluid sim |
| `pymunk` | `import pymunk` | 2D physics | Scatter physics |
| `pybullet` | `import pybullet as p` | 3D physics, robotics | Drop sim |

### Taichi Quick Reference
```python
import taichi as ti

ti.init(arch=ti.gpu)  # Use GPU

@ti.kernel
def compute():
    for i, j in field:
        field[i, j] = ti.sin(i * 0.1) + ti.cos(j * 0.1)

field = ti.field(dtype=ti.f32, shape=(512, 512))
compute()
```

---

## PROCEDURAL & NOISE

| Package | Import | Purpose |
|---------|--------|---------|
| `noise` | `from noise import pnoise2, snoise2` | Perlin, simplex noise |
| `opensimplex` | `from opensimplex import OpenSimplex` | OpenSimplex noise |
| `poisson-disc` | `from poisson_disc import Bridson_sampling` | Poisson distribution |

### Noise Quick Reference
```python
from noise import pnoise2, snoise2
import numpy as np

def generate_noise_texture(width, height, scale=0.1, octaves=4):
    arr = np.zeros((height, width))
    for y in range(height):
        for x in range(width):
            arr[y, x] = pnoise2(x * scale, y * scale, octaves=octaves)
    return ((arr + 1) * 127.5).astype(np.uint8)
```

---

## ANIMATION & RIGGING

| Package | Import | Purpose |
|---------|--------|---------|
| `gltflib` | `from gltflib import GLTF` | glTF manipulation |
| `fbx` | `import fbx` | FBX SDK (if available) |

---

## DATA & SERIALIZATION

| Package | Import | Purpose | When to Use |
|---------|--------|---------|-------------|
| `msgpack` | `import msgpack` | Fast binary | Rust IPC |
| `orjson` | `import orjson` | Fastest JSON | API responses |
| `pyarrow` | `import pyarrow as pa` | Apache Arrow | Large datasets |
| `h5py` | `import h5py` | HDF5 files | Training data |
| `zarr` | `import zarr` | Chunked arrays | Out-of-core data |

### orjson Quick Reference
```python
import orjson

# 10x faster than json.dumps
data = orjson.dumps({"vertices": vertices.tolist()})

# Parse
obj = orjson.loads(json_bytes)
```

---

## MATH & OPTIMIZATION

| Package | Import | Purpose |
|---------|--------|---------|
| `sympy` | `import sympy as sp` | Symbolic math |
| `cvxpy` | `import cvxpy as cp` | Convex optimization |
| `nlopt` | `import nlopt` | Nonlinear optimization |

---

## GPU & PARALLEL

| Package | Import | Purpose | Notes |
|---------|--------|---------|-------|
| `cupy` | `import cupy as cp` | NumPy on CUDA | GPU arrays |
| `jax` | `import jax.numpy as jnp` | Google JAX | Auto-diff, XLA |

### CuPy Quick Reference
```python
import cupy as cp
import numpy as np

# Move to GPU (drop-in numpy replacement)
gpu_arr = cp.asarray(numpy_arr)

# Operations run on GPU
result = cp.dot(gpu_arr, gpu_arr.T)

# Move back to CPU
cpu_result = cp.asnumpy(result)
```

---

## UTILITIES

| Package | Import | Purpose |
|---------|--------|---------|
| `tqdm` | `from tqdm import tqdm` | Progress bars |
| `rich` | `from rich import print` | Pretty terminal |
| `watchdog` | `from watchdog.observers import Observer` | File watching |
| `pydantic` | `from pydantic import BaseModel` | Data validation |
| `httpx` | `import httpx` | HTTP client |

---

## IPC & COMMUNICATION

| Package | Import | Purpose |
|---------|--------|---------|
| `pyzmq` | `import zmq` | ZeroMQ (fast IPC) |
| `websockets` | `import websockets` | WebSocket |

### K_OS IPC Pattern
```python
import sys
import json

def handle_request(request):
    method = request.get('method')
    params = request.get('params', {})
    
    if method == 'generate_normal_map':
        result = generate_normal_map(**params)
        return {'result': result}
    
    return {'error': f'Unknown method: {method}'}

# JSON-RPC over stdio
for line in sys.stdin:
    request = json.loads(line)
    response = handle_request(request)
    print(json.dumps(response), flush=True)
```

---

## COMMON PATTERNS

### Pattern: Image to Base64
```python
import base64
from io import BytesIO
from PIL import Image

def image_to_base64(img: Image.Image) -> str:
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    return base64.b64encode(buffer.getvalue()).decode('utf-8')

def base64_to_image(b64: str) -> Image.Image:
    data = base64.b64decode(b64)
    return Image.open(BytesIO(data))
```

### Pattern: NumPy to/from List (for JSON)
```python
# To JSON-safe format
json_data = {
    'vertices': vertices.tolist(),
    'shape': list(vertices.shape)
}

# From JSON
vertices = np.array(json_data['vertices'], dtype=np.float32)
```

### Pattern: Parallel Processing
```python
from concurrent.futures import ProcessPoolExecutor
from tqdm import tqdm

def process_item(item):
    return heavy_computation(item)

with ProcessPoolExecutor(max_workers=8) as executor:
    results = list(tqdm(executor.map(process_item, items), total=len(items)))
```

---

## NOTES FOR AI AGENTS

1. **Use numba @njit** for loops over large arrays (100x speedup)
2. **Use orjson** instead of json (10x faster)
3. **Use trimesh** for mesh operations, Open3D for point clouds
4. **Use cv2** for image processing, Pillow for simple I/O
5. **Use torch** on GPU when available (`device='cuda'`)
6. **Return base64 images** to Tauri (not file paths)
7. **Use tqdm** for any loop that takes >1 second
8. **Print to stderr** for logs (stdout is for JSON-RPC responses)
