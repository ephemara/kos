# Animation Playback Integration

## Overview

This document describes the integration between the AnimationTimeline component and the PreviewViewport component, enabling real-time animated material preview with 60fps playback and scrubbing support.

**Requirements Validated:** 5.5, 5.7

## Architecture

### Data Flow

```
User Interaction (Timeline)
    ↓
AnimatedPreview Component (React)
    ↓
autoPBRClient.evaluateAnimation() (TypeScript)
    ↓
Tauri IPC (evaluate_animation command)
    ↓
MaterialSystem.evaluate_animation() (Rust)
    ↓
AnimationEngine.evaluate_keyframe() (Rust)
    ↓
Parameter Values (HashMap<AnimationParameter, f32>)
    ↓
Convert to PBRMaterialProps (TypeScript)
    ↓
PreviewViewport Update (Three.js)
```

### Components

#### 1. **AnimatedPreview Component** (`AnimatedPreview.tsx`)

The main integration component that:
- Manages animation playback state (time, playing, keyframes)
- Calls `autoPBRClient.evaluateAnimation()` on time changes
- Converts parameter values to Three.js material properties
- Merges animated props with base material props
- Passes merged props to PreviewViewport

**Key Features:**
- **60fps Updates**: Uses `requestAnimationFrame` in AnimationTimeline for smooth playback
- **Real-time Scrubbing**: Evaluates animation on every time change (Requirement 5.7)
- **Latency Monitoring**: Logs warnings if evaluation exceeds 33ms (30fps threshold)
- **Debouncing**: Prevents redundant evaluations for the same time value

#### 2. **Tauri Command** (`evaluate_animation`)

Rust backend command that:
- Accepts material ID and time as parameters
- Retrieves material and animation data
- Calls `AnimationEngine.evaluate_keyframe()`
- Converts `AnimationParameter` enum keys to string keys for JSON
- Returns `HashMap<String, f32>` with parameter values

**Location:** `src-tauri/src/commands/autopbr.rs`

#### 3. **MaterialSystem Method** (`evaluate_animation`)

Rust method that:
- Validates material exists and has animation data
- Delegates to `AnimationEngine.evaluate_keyframe()`
- Returns `HashMap<AnimationParameter, f32>`

**Location:** `crates/k-os-material/src/lib.rs`

#### 4. **AutoPBRClient Method** (`evaluateAnimation`)

TypeScript service client method that:
- Wraps Tauri IPC call with type safety
- Provides error handling with user-friendly messages
- Returns `Record<string, number>` with parameter values

**Location:** `src-frontend/services/autoPBRClient.ts`

## Parameter Mapping

The integration maps animation parameters to Three.js material properties:

| Animation Parameter | Three.js Property | Type | Notes |
|---------------------|-------------------|------|-------|
| `albedoRed`, `albedoGreen`, `albedoBlue` | `albedoColor` | RGB string | Combined into `rgb(r, g, b)` |
| `roughness` | `roughnessValue` | number | Direct mapping |
| `metallic` | `metallicValue` | number | Direct mapping |
| `emissiveIntensity` | `emissiveIntensity` | number | Direct mapping |
| `emissiveColor` | `emissiveColor` | RGB string | Grayscale to RGB |
| `normalStrength` | `normalStrength` | number | Direct mapping |
| `uvOffsetX`, `uvOffsetY` | (future) | number | Not yet implemented |

## Performance

### Requirement 5.5: 60fps Playback

The AnimationTimeline component uses `requestAnimationFrame` for playback, ensuring:
- **Target Frame Rate**: 60fps minimum
- **Actual Performance**: Depends on backend evaluation latency
- **Monitoring**: Logs warnings if evaluation exceeds 33ms

### Requirement 5.7: Real-time Scrubbing

The integration evaluates animation on every time change:
- **Scrubbing Latency**: < 33ms target (30fps minimum)
- **Debouncing**: Prevents redundant evaluations for same time
- **Concurrent Protection**: Prevents overlapping evaluations

## Usage Example

```typescript
import { AnimatedPreview } from './AnimatedPreview';
import type { AnimationData, PBRMaterialProps } from '../types';

function MyComponent() {
  const animationData: AnimationData = {
    duration: 5.0,
    loopMode: 'Loop',
    tracks: [
      {
        parameter: 'EmissiveIntensity',
        animationType: {
          Keyframe: {
            keyframes: [
              { time: 0.0, value: 0.0 },
              { time: 2.5, value: 2.0 },
              { time: 5.0, value: 0.0 },
            ],
            interpolation: 'EaseInOut',
          },
        },
      },
    ],
  };

  const baseMaterialProps: PBRMaterialProps = {
    albedoColor: '#4080ff',
    metallicValue: 0.9,
  };

  return (
    <AnimatedPreview
      materialId="my-material-id"
      animationData={animationData}
      baseMaterialProps={baseMaterialProps}
      onAnimationChange={(animation) => console.log('Changed:', animation)}
    />
  );
}
```

## Demo

See `AnimatedPreviewDemo.tsx` for a complete working example with:
- Pulsing emissive intensity (0.0 → 2.0 → 0.0)
- Animated roughness (0.8 → 0.2 → 0.8)
- Loop mode with 5-second duration
- Real-time preview updates

## Future Enhancements

### Multi-Track Support
Currently, the AnimatedPreview component only displays keyframes from the first track in the timeline UI. Future versions should:
- Support multiple parameter tracks in the timeline
- Allow selecting which track to edit
- Display all tracks with color coding

### UV Animation
The integration currently doesn't handle UV offset/scale parameters. Future versions should:
- Apply UV transformations to texture coordinates
- Update material uniforms for UV animation
- Support UV scrolling effects

### Physics-Based Animation
The integration currently only supports keyframe and procedural animations. Future versions should:
- Evaluate physics simulations
- Update texture maps (not just scalar parameters)
- Support baking physics animations

### Performance Optimization
Potential optimizations:
- **GPU Evaluation**: Move animation evaluation to GPU compute shader
- **Caching**: Cache evaluated values for common time points
- **Interpolation**: Perform interpolation on GPU for smoother playback
- **Batching**: Batch multiple parameter evaluations into single IPC call

## Testing

### Manual Testing
1. Run `AnimatedPreviewDemo` component
2. Verify smooth 60fps playback
3. Test scrubbing responsiveness
4. Check loop modes (Once, Loop, Ping-Pong)
5. Verify parameter updates in preview

### Performance Testing
1. Monitor console for latency warnings
2. Use browser DevTools Performance tab
3. Measure frame rate during playback
4. Test with complex animations (many keyframes)

## Troubleshooting

### Slow Scrubbing
- Check console for latency warnings
- Verify backend is not blocking on other operations
- Consider reducing animation complexity

### Preview Not Updating
- Verify material ID is valid
- Check that animation data is properly formatted
- Ensure AnimationEngine is initialized
- Check browser console for errors

### Incorrect Parameter Values
- Verify parameter mapping in `evaluateAndUpdate()`
- Check that backend returns correct parameter names
- Ensure type conversions are correct (e.g., RGB to string)

## Related Files

- `AnimationTimeline.tsx` - Timeline UI with playback controls
- `PreviewViewport.tsx` - Three.js material preview
- `AnimatedPreview.tsx` - Integration component
- `AnimatedPreviewDemo.tsx` - Demo/example usage
- `src-tauri/src/commands/autopbr.rs` - Backend command
- `crates/k-os-material/src/autopbr/mod.rs` - MaterialSystem
- `crates/k-os-material/src/autopbr/animation.rs` - AnimationEngine
- `src-frontend/services/autoPBRClient.ts` - Service client
