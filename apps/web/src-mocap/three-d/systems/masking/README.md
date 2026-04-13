# Masking System

Universal masking system for procedural mask generation in 3D applications. Supports curvature, height, slope-based masking with GPU acceleration.

## Overview

The masking system provides powerful procedural masking capabilities for 3D meshes, enabling smart selection and painting based on surface properties. This is essential for:

- **3D Texture Painting**: Mask painting to edges, cavities, or height ranges
- **Procedural Texturing**: Generate masks for material blending
- **Sculpting**: Limit brush strokes to specific surface features
- **Terrain Editing**: Mask by elevation or slope

## Architecture

```
MaskTypes.ts          # Type definitions and interfaces
SmartMask.ts          # Main masking system with GPU acceleration
CurvatureMask.ts      # Curvature-based masking (edges/cavities)
HeightMask.ts         # Height-based masking (elevation)
SlopeMask.ts          # Slope-based masking (surface orientation)
useMasking.ts         # React hook for masking system integration
index.ts              # Public API exports
```

## Features

### Curvature Masking
- **Edge Detection**: Mask convex areas (ridges, edges)
- **Cavity Detection**: Mask concave areas (crevices, cavities)
- **Threshold Control**: Adjustable sensitivity
- **Feathering**: Smooth transitions

### Height Masking
- **Range Masking**: Mask specific height ranges
- **Gradient Masking**: Smooth top-to-bottom gradients
- **Band Masking**: Mask specific elevation bands
- **Falloff Control**: Adjustable boundary transitions

### Slope Masking
- **Direction-Based**: Mask by surface orientation (up/down/horizontal)
- **Angle Control**: Specify angle thresholds
- **Tolerance**: Smooth angle transitions
- **Statistics**: Analyze mesh slope distribution

### Mask Combination
- **Blend Modes**: Add, multiply, subtract, screen, overlay, min, max
- **Multi-Mask**: Combine multiple masks with different operations
- **Strength Control**: Overall mask intensity

## Usage

### Basic Curvature Masking

```typescript
import { CurvatureMask } from '@/three-d/systems/masking';

const curvatureMask = new CurvatureMask(renderer);

// Generate edge mask
const edgeMask = curvatureMask.generateEdgeMask(mesh, {
  threshold: 0.5,
  strength: 1.0,
  feather: 0.1,
});

// Generate cavity mask
const cavityMask = curvatureMask.generateCavityMask(mesh, {
  threshold: 0.5,
  strength: 1.0,
  feather: 0.1,
});
```

### Basic Height Masking

```typescript
import { HeightMask } from '@/three-d/systems/masking';

const heightMask = new HeightMask(renderer);

// Generate height range mask
const mask = heightMask.generateHeightMask(mesh, {
  minHeight: 0,
  maxHeight: 10,
  falloff: 1.0,
  strength: 1.0,
});

// Generate gradient mask (bottom to top)
const gradientMask = heightMask.generateGradientMask(mesh);

// Generate band mask (specific elevation)
const bandMask = heightMask.generateBandMask(mesh, 5.0, 2.0);
```

### Basic Slope Masking

```typescript
import { SlopeMask } from '@/three-d/systems/masking';

const slopeMask = new SlopeMask(renderer);

// Generate upward-facing mask
const upMask = slopeMask.generateUpMask(mesh, {
  angle: 45,
  tolerance: 15,
  strength: 1.0,
});

// Generate downward-facing mask
const downMask = slopeMask.generateDownMask(mesh, {
  angle: 45,
  tolerance: 15,
  strength: 1.0,
});

// Generate horizontal mask
const horizontalMask = slopeMask.generateHorizontalMask(mesh, {
  angle: 90,
  tolerance: 15,
  strength: 1.0,
});

// Get slope statistics
const stats = slopeMask.getSlopeStatistics(mesh);
console.log(`Up-facing: ${stats.upFacingPercent.toFixed(1)}%`);
console.log(`Down-facing: ${stats.downFacingPercent.toFixed(1)}%`);
console.log(`Horizontal: ${stats.horizontalPercent.toFixed(1)}%`);
```

### Using the React Hook

```typescript
import { useMasking } from '@/three-d/systems/masking';

function MyMaskingComponent() {
  const {
    generateEdgeMask,
    generateHeightMask,
    generateSlopeMask,
    currentMask,
    isGenerating,
    lastGenerationTime,
  } = useMasking(renderer);

  const handleGenerateEdgeMask = async () => {
    const mask = await generateEdgeMask(mesh, {
      threshold: 0.7,
      strength: 1.0,
      feather: 0.1,
    });
    // Use mask in your material...
  };

  const handleGenerateCombinedMask = async () => {
    const mask = await generateMask(mesh, {
      masks: [
        {
          type: 'curvature',
          mode: 'edge',
          threshold: 0.5,
          strength: 1.0,
          invert: false,
          feather: 0.1,
        },
        {
          type: 'slope',
          direction: 'up',
          angle: 45,
          tolerance: 15,
          strength: 1.0,
          invert: false,
          feather: 0.1,
        },
      ],
      blendMode: 'multiply',
      strength: 1.0,
    });
  };

  return (
    <div>
      <button onClick={handleGenerateEdgeMask} disabled={isGenerating}>
        Generate Edge Mask
      </button>
      {lastGenerationTime && (
        <p>Generated in {lastGenerationTime.toFixed(2)}ms</p>
      )}
    </div>
  );
}
```

### Smart Mask System (Combined)

```typescript
import { SmartMaskSystem } from '@/three-d/systems/masking';

const smartMask = new SmartMaskSystem(renderer);

// Bake required maps
const maps = await smartMask.bakeMaps(mesh, 1024);

// Generate curvature mask
const edgeMask = smartMask.generateMask({
  mesh,
  renderer,
  bakedMaps: maps,
  config: {
    type: 'curvature',
    mode: 'edge',
    threshold: 0.5,
    strength: 1.0,
    invert: false,
    feather: 0.1,
  },
});

// Generate height mask
const heightMask = smartMask.generateMask({
  mesh,
  renderer,
  bakedMaps: maps,
  config: {
    type: 'height',
    minHeight: 0,
    maxHeight: 10,
    falloff: 1.0,
    strength: 1.0,
    invert: false,
    feather: 0.1,
  },
});
```

### Combined Masks

```typescript
import { SmartMaskSystem } from '@/three-d/systems/masking';

const smartMask = new SmartMaskSystem(renderer);
const maps = await smartMask.bakeMaps(mesh, 1024);

// Combine edge mask + height mask
const combinedMask = smartMask.generateMask({
  mesh,
  renderer,
  bakedMaps: maps,
  config: {
    masks: [
      {
        type: 'curvature',
        mode: 'edge',
        threshold: 0.5,
        strength: 1.0,
        invert: false,
        feather: 0.1,
      },
      {
        type: 'height',
        minHeight: 5,
        maxHeight: 15,
        falloff: 2.0,
        strength: 1.0,
        invert: false,
        feather: 0.1,
      },
    ],
    blendMode: 'multiply', // Only paint on edges at specific height
    strength: 1.0,
  },
});
```

### Using Masks in Shaders

```typescript
// In your painting/sculpting shader
const material = new THREE.ShaderMaterial({
  uniforms: {
    uMaskTexture: { value: edgeMask },
    uUseMask: { value: true },
    // ... other uniforms
  },
  fragmentShader: `
    uniform sampler2D uMaskTexture;
    uniform bool uUseMask;
    varying vec2 vUv;

    void main() {
      float mask = 1.0;
      
      if (uUseMask) {
        mask = texture2D(uMaskTexture, vUv).r;
      }
      
      // Apply mask to your effect
      vec3 color = yourEffect();
      gl_FragColor = vec4(color, mask);
    }
  `,
});
```

## Integration with Paint System

The masking system integrates seamlessly with the 3D paint system:

```typescript
import { SmartMaskSystem } from '@/three-d/systems/masking';
import { paintService } from '@/three-d/services/paintClient';

// Setup masking
const smartMask = new SmartMaskSystem(renderer);
const maps = await smartMask.bakeMaps(mesh, 1024);

// Generate mask
const mask = smartMask.generateMask({
  mesh,
  renderer,
  bakedMaps: maps,
  config: {
    type: 'curvature',
    mode: 'edge',
    threshold: 0.7,
    strength: 1.0,
    invert: false,
    feather: 0.1,
  },
});

// Use mask in painting
// The paint shader will automatically respect the mask texture
```

## Performance Considerations

### GPU Acceleration
- All mask generation is GPU-accelerated using WebGL render targets
- Baked maps are cached for reuse
- Mask textures can be reused across multiple paint strokes

### Resolution
- Default resolution: 1024x1024
- Higher resolution = more detail but slower generation
- Lower resolution = faster but less precise
- Choose based on mesh detail and performance requirements

### Caching
- Baked maps are cached per mesh
- Reuse baked maps when generating multiple masks
- Dispose of unused masks to free GPU memory

## CPU Fallback

For vertex-based masking (when texture-based masking isn't suitable):

```typescript
// Calculate vertex curvature (CPU)
const curvature = curvatureMask.calculateVertexCurvature(geometry);

// Calculate vertex heights (CPU)
const heights = heightMask.calculateVertexHeights(mesh);

// Apply mask to vertex colors
heightMask.applyHeightMaskToVertexColors(mesh, {
  type: 'height',
  minHeight: 0,
  maxHeight: 10,
  falloff: 1.0,
  strength: 1.0,
  invert: false,
  feather: 0.1,
});
```

## Examples

See these features for masking system usage:
- `three-d/examples/paint/` - 3D texture painting with smart masks
- `three-d/examples/sculpting/` - Sculpting with curvature masks
- `three-d/examples/tecton/` - Terrain editing with height masks

## API Reference

### SmartMaskSystem

Main class for procedural mask generation.

**Methods:**
- `bakeMaps(mesh, resolution)` - Bake required maps for mask generation
- `generateMask(params)` - Generate a mask from configuration
- `combineMasks(masks, operation, strength)` - Combine multiple masks
- `dispose()` - Clean up GPU resources

### CurvatureMask

Curvature-based mask generation.

**Methods:**
- `generateCurvatureMap(mesh, resolution)` - Generate curvature map
- `generateEdgeMask(mesh, config, resolution)` - Generate edge mask
- `generateCavityMask(mesh, config, resolution)` - Generate cavity mask
- `calculateVertexCurvature(geometry)` - CPU fallback for vertex curvature

### HeightMask

Height-based mask generation.

**Methods:**
- `generatePositionMap(mesh, resolution)` - Generate position map
- `generateHeightMask(mesh, config, resolution)` - Generate height range mask
- `generateGradientMask(mesh, config, resolution)` - Generate gradient mask
- `generateBandMask(mesh, centerHeight, bandWidth, config, resolution)` - Generate band mask
- `calculateVertexHeights(mesh)` - CPU fallback for vertex heights
- `applyHeightMaskToVertexColors(mesh, config)` - Apply mask to vertex colors

### SlopeMask

Slope-based mask generation.

**Methods:**
- `generateNormalMap(mesh, resolution)` - Generate normal map
- `generateUpMask(mesh, config, resolution)` - Generate upward-facing mask
- `generateDownMask(mesh, config, resolution)` - Generate downward-facing mask
- `generateHorizontalMask(mesh, config, resolution)` - Generate horizontal mask
- `generateSlopeMask(mesh, config, resolution)` - Generate custom slope mask
- `calculateVertexSlopes(mesh, direction)` - CPU fallback for vertex slopes
- `applySlopeMaskToVertexColors(mesh, config)` - Apply mask to vertex colors
- `getSlopeStatistics(mesh)` - Get slope distribution statistics

### useMasking Hook

React hook for masking system integration.

**Returns:**
- `generateMask(mesh, config, resolution)` - Generate mask from configuration
- `generateEdgeMask(mesh, config, resolution)` - Generate edge mask
- `generateCavityMask(mesh, config, resolution)` - Generate cavity mask
- `generateHeightMask(mesh, config, resolution)` - Generate height mask
- `generateSlopeMask(mesh, config, resolution)` - Generate slope mask
- `bakeMaps(mesh, resolution)` - Bake maps for mask generation
- `clearMapsCache(mesh?)` - Clear cached maps
- `currentMask` - Currently generated mask texture
- `isGenerating` - Whether a mask is being generated
- `lastGenerationTime` - Last generation time in milliseconds
- `cachedMaps` - Cached baked maps

## Type Definitions

See `MaskTypes.ts` for complete type definitions:
- `MaskConfig` - Base mask configuration
- `CurvatureMaskConfig` - Curvature mask configuration
- `HeightMaskConfig` - Height mask configuration
- `SlopeMaskConfig` - Slope mask configuration
- `CustomMaskConfig` - Custom mask configuration
- `CombinedMaskConfig` - Combined mask configuration
- `BakedMaskMaps` - Pre-computed maps
- `MaskGenerationParams` - Mask generation parameters
- `MaskGenerationResult` - Mask generation result

## Future Enhancements

- **AO Masking**: Ambient occlusion-based masking
- **Texture Masking**: Use existing textures as masks
- **Animated Masks**: Time-varying procedural masks
- **Mask Presets**: Library of common mask configurations
- **Mask Editor UI**: Visual mask editing interface
- **Mask Painting**: Interactive mask painting tools
- **Mask Blending UI**: Visual blend mode editor
