# K_OS Python Sidecar

Python integration for K_OS - run AI/ML scripts alongside Rust.

## Quick Start

```bash
# Install dependencies (one time)
cd src-python
pip install -r requirements.txt

# Test Python is working
python main.py
# Then type: {"jsonrpc": "2.0", "method": "ping", "params": {}, "id": 1}
```

## Usage from React/TypeScript

```typescript
import { python } from './src-frontend/services/pythonBridge';

// Start Python sidecar
await python.start();

// Call any registered function
const noise = await python.generateNoise(512, 512);
const mesh = await python.decimateMesh(vertices, faces, 1000);

// Execute raw Python code
const result = await python.exec('import numpy as np; result = np.arange(10).sum()');

// Run your own scripts from kos/scripts/
await python.runScript('my_script', 'my_function', { param: 'value' });
```

## Adding Custom Scripts

Drop any `.py` file in `src-python/kos/scripts/` and it auto-loads!

```python
# src-python/kos/scripts/my_tool.py
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from main import register

@register("my_tool.hello")
def hello(name: str = "World"):
    return f"Hello, {name}!"
```

Then call from JS: `await python.call('my_tool.hello', { name: 'K_OS' })`

## Available Functions

### Mesh Processing
- `mesh.load` - Load mesh from file
- `mesh.decimate` - Reduce poly count
- `mesh.remesh` - Uniform remeshing
- `mesh.boolean` - Union/intersection/difference
- `mesh.curvature` - Per-vertex curvature
- `mesh.repair` - Fix holes, normals, degenerates

### Textures
- `texture.load/save` - Image I/O
- `texture.generate_normal_map` - From heightmap
- `texture.generate_ao` - Ambient occlusion
- `texture.seamless_tile` - Make tileable
- `texture.color_transfer` - Match color palette
- `texture.upscale` - Lanczos upscaling

### AI/ML
- `ml.get_device` - Check CUDA/MPS/CPU
- `ml.segment_image` - SAM segmentation
- `ml.generate_image` - Stable Diffusion
- `ml.inpaint` - SD inpainting
- `ml.depth_estimation` - MiDaS depth
- `ml.style_transfer` - Neural style
- `ml.upscale_esrgan` - AI upscaling

### Procedural
- `procedural.perlin_2d` - Perlin noise
- `procedural.voronoi` - Voronoi cells
- `procedural.fbm` - Fractal brownian motion
- `procedural.terrain` - Terrain with erosion
- `procedural.scatter_points` - Poisson disc
- `procedural.hexagonal_grid` - Hex grid

## Building for Distribution

```bash
cd src-python
pip install pyinstaller
python build.py
```

Output: `dist/kos_python.exe` - copy to `src-tauri/bin/`
