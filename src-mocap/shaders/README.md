# Shader Library of Babel

World-class collection of production-ready GPU shaders.

## Philosophy

Shaders are **dimension-agnostic** - they're just GLSL/WGSL code that runs on the GPU.
This library is organized by **functionality**, not by 2D/3D dimension.

## Categories

### Color (8 shaders)

```typescript
import { GRAVITY_FRAG, FILTER_NORMAL_FRAG, FILTER_PIXEL_SORT_FRAG, ... } from '@/shaders/color';
```

### Filters (10 shaders)

```typescript
import { BRUSH_FRAG, BLACK_HOLE_FRAG, CURVATURE_COMPUTE_FRAG, ... } from '@/shaders/filters';
```

### Generators (3 shaders)

```typescript
import { FLUID_GRAD, GEN_PATTERN_FRAG, GEN_GRADIENT_FRAG } from '@/shaders/generators';
```

### Lighting (1 shaders)

```typescript
import { COPY_FRAG } from '@/shaders/lighting';
```

### Math (10 shaders)

```typescript
import { RANDOM_FUNCTION, HASH_FUNCTION, FULLSCREEN_VERTEX, ... } from '@/shaders/math';
```

### Noise (12 shaders)

```typescript
import { VELOCITY_FRAGMENT, CURL_NOISE_FUNC, SIMPLEX_NOISE, ... } from '@/shaders/noise';
```

### Physics (8 shaders)

```typescript
import { POSITION_FRAGMENT, RENDER_VERT, FLUID_ADVECT, ... } from '@/shaders/physics';
```

### Simulations (4 shaders)

```typescript
import { SIM_DRIP_FRAG, SIM_BLEED_FRAG, SIM_WIND_FRAG, ... } from '@/shaders/simulations';
```

### Terrain (2 shaders)

```typescript
import { RENDER_VERTEX, CURSOR_VERTEX } from '@/shaders/terrain';
```

### Uncategorized (12 shaders)

```typescript
import { PARTICLE_SIM_VERT, RENDER_FRAG, CIRCULAR_FALLOFF, ... } from '@/shaders/uncategorized';
```


## Usage

```typescript
import { SIMPLEX_NOISE } from '@/shaders/noise';
import { BLUR_SHADER } from '@/shaders/filters';
import { NAVIER_STOKES } from '@/shaders/physics';

// Use in your materials, compute shaders, etc.
const material = new THREE.ShaderMaterial({
  fragmentShader: SIMPLEX_NOISE + BLUR_SHADER
});
```

## Contributing

When adding new shaders:
1. Add to appropriate category file
2. Use UPPER_SNAKE_CASE for shader names
3. Document uniforms and usage
4. Avoid hardcoded values - use uniforms
