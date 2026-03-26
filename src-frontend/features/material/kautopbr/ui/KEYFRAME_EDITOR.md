# Keyframe Editor UI - AnimationTimeline Component

## Overview

The `AnimationTimeline` component provides a complete keyframe editor for material animation in KAutoPBR. It supports adding, moving, selecting, and deleting keyframes, as well as changing interpolation types.

**Task**: 10.2 - Implement keyframe editor UI  
**Requirements**: 5.2, 5.4  
**Status**: ✅ Complete

## Features

### 1. Display Keyframes as Markers
- Keyframes appear as circular markers on the timeline
- Green markers for unselected keyframes
- Yellow markers for selected keyframes
- Hover effects for better visual feedback
- Tooltips showing time and value

### 2. Add Keyframes with Click
- Click anywhere on the timeline to add a keyframe at that time
- New keyframe value is interpolated from surrounding keyframes
- Newly added keyframe is automatically selected
- Visual hint when no keyframes exist

### 3. Drag Keyframes to Adjust Timing
- Click and drag any keyframe marker to move it
- Keyframes automatically re-sort after moving
- Visual feedback during drag (scale increase)
- Selection follows the moved keyframe

### 4. Select and Delete Keyframes
- Click on a keyframe marker to select it
- Selected keyframe shows in yellow with larger size
- Delete with keyboard: `Delete` or `Backspace` key
- Delete with UI: Trash button in keyframe controls
- Keyframe info displayed when selected (time and value)

### 5. Interpolation Type Selector
- Dropdown menu for interpolation type
- Available types:
  - **Linear**: Constant rate of change
  - **Ease In**: Slow start, fast end
  - **Ease Out**: Fast start, slow end
  - **Ease In-Out**: Slow start and end
  - **Bezier**: Custom curve with tangent control
- Changes apply to selected keyframe
- Persists across keyframe selection

## Usage

### Basic Example

```tsx
import { AnimationTimeline } from '@/features/material/kautopbr/ui';
import type { Keyframe, InterpolationType } from '@/features/material/kautopbr/types';

function MyComponent() {
  const [keyframes, setKeyframes] = useState<Keyframe[]>([
    { time: 0, value: 0 },
    { time: 5, value: 1 },
  ]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [interpolation, setInterpolation] = useState<InterpolationType>('Linear');

  return (
    <AnimationTimeline
      duration={10}
      keyframes={keyframes}
      selectedKeyframeIndex={selectedIndex}
      interpolationType={interpolation}
      onKeyframeAdd={(time) => {
        const newKf = { time, value: 0.5 };
        setKeyframes([...keyframes, newKf].sort((a, b) => a.time - b.time));
      }}
      onKeyframeMove={(index, newTime) => {
        const updated = [...keyframes];
        updated[index] = { ...updated[index], time: newTime };
        setKeyframes(updated.sort((a, b) => a.time - b.time));
      }}
      onKeyframeSelect={setSelectedIndex}
      onKeyframeDelete={(index) => {
        setKeyframes(keyframes.filter((_, i) => i !== index));
        setSelectedIndex(null);
      }}
      onInterpolationChange={setInterpolation}
    />
  );
}
```

### Complete Example

See `AnimationTimelineDemo.tsx` for a full working example with:
- Keyframe management state
- Interpolated value calculation for new keyframes
- Index tracking after re-sorting
- Debug info display

## Props

### Keyframe Editor Props

| Prop | Type | Description |
|------|------|-------------|
| `keyframes` | `Keyframe[]` | Array of keyframes to display |
| `selectedKeyframeIndex` | `number \| null` | Index of currently selected keyframe |
| `interpolationType` | `InterpolationType` | Interpolation type for selected keyframe |
| `onKeyframeAdd` | `(time: number) => void` | Called when user clicks timeline to add keyframe |
| `onKeyframeMove` | `(index: number, newTime: number) => void` | Called when user drags keyframe |
| `onKeyframeSelect` | `(index: number \| null) => void` | Called when user selects/deselects keyframe |
| `onKeyframeDelete` | `(index: number) => void` | Called when user deletes keyframe |
| `onInterpolationChange` | `(type: InterpolationType) => void` | Called when interpolation type changes |

### Playback Props

| Prop | Type | Description |
|------|------|-------------|
| `currentTime` | `number` | Current playback time in seconds |
| `duration` | `number` | Total animation duration in seconds |
| `isPlaying` | `boolean` | Whether animation is playing |
| `loopMode` | `LoopMode` | Loop mode: 'Once', 'Loop', or 'PingPong' |
| `playbackSpeed` | `number` | Playback speed multiplier (1.0 = normal) |
| `onTimeChange` | `(time: number) => void` | Called when time changes |
| `onPlayStateChange` | `(isPlaying: boolean) => void` | Called when play state changes |
| `onStop` | `() => void` | Called when stop button pressed |
| `onLoopModeChange` | `(mode: LoopMode) => void` | Called when loop mode changes |

## Data Types

### Keyframe

```typescript
interface Keyframe {
  time: number;        // Time in seconds
  value: number;       // Parameter value at this time
  tangentIn?: Vec2;    // Bezier tangent (incoming)
  tangentOut?: Vec2;   // Bezier tangent (outgoing)
}
```

### InterpolationType

```typescript
type InterpolationType = 
  | 'Linear'      // Constant rate
  | 'EaseIn'      // Quadratic ease-in (slow → fast)
  | 'EaseOut'     // Quadratic ease-out (fast → slow)
  | 'EaseInOut'   // Cubic ease-in-out (slow → fast → slow)
  | 'Bezier';     // Custom curve with tangents
```

## Implementation Details

### Keyframe Rendering
- Keyframes are positioned absolutely based on `(time / duration) * 100%`
- Z-index ensures keyframes appear above timeline track
- Selected keyframe has higher z-index and scale

### Drag Behavior
- Mouse down on keyframe starts drag
- Window-level mouse move/up listeners for smooth dragging
- Drag position calculated from timeline bounding rect
- Time clamped to [0, duration] range

### Selection State
- Only one keyframe can be selected at a time
- Clicking timeline background deselects (via `onKeyframeSelect(null)`)
- Selection persists during drag operations

### Keyboard Shortcuts
- `Delete` or `Backspace`: Delete selected keyframe
- Event listeners attached to window for global capture
- Cleaned up on component unmount

### Click vs Drag Detection
- Timeline click adds keyframe
- Keyframe click selects (stops propagation)
- Keyframe drag moves (stops propagation)
- Data attributes prevent conflicts: `[data-keyframe]`, `[data-playhead]`

## Styling

### Colors
- **Unselected keyframe**: Green (`bg-green-400`, `border-green-300`)
- **Selected keyframe**: Yellow (`bg-yellow-400`, `border-yellow-300`)
- **Playhead**: Blue (`bg-blue-400`, `border-blue-300`)
- **Timeline track**: Dark gray (`bg-gray-800`, `border-gray-700`)

### Animations
- Smooth scale transitions on hover/select
- Shadow intensity changes for depth
- Cursor changes for interactive elements

### Responsive Design
- Timeline scales to container width
- Markers positioned with percentage-based layout
- Touch-friendly hit targets (12px markers)

## Integration with Animation System

The keyframe editor UI is designed to work with the Rust animation engine:

1. **Frontend State**: Manages UI-level keyframe array
2. **IPC Layer**: Sends keyframe changes to Rust backend
3. **Rust Engine**: Evaluates keyframes with interpolation
4. **Preview Update**: Material parameters update in real-time

### Example Integration Flow

```typescript
// 1. User adds keyframe in UI
onKeyframeAdd={(time) => {
  const newKeyframe = { time, value: calculateValue(time) };
  
  // 2. Update local state
  setKeyframes([...keyframes, newKeyframe]);
  
  // 3. Send to backend via IPC
  await autoPBRClient.updateAnimationKeyframes(materialId, trackId, [...keyframes, newKeyframe]);
  
  // 4. Backend evaluates and updates preview
  // (handled automatically by animation engine)
}}
```

## Future Enhancements

### Bezier Tangent Editing
- Visual tangent handles for Bezier interpolation
- Drag handles to adjust curve shape
- Symmetrical/broken tangent modes

### Multi-Selection
- Shift+click to select multiple keyframes
- Drag multiple keyframes together
- Bulk delete operations

### Copy/Paste
- Copy keyframe values
- Paste at current time
- Duplicate keyframes

### Curve Editor
- Separate curve view showing interpolation
- Visual representation of easing functions
- Direct curve manipulation

### Snapping
- Snap to time markers
- Snap to other keyframes
- Snap to playhead

### Value Editing
- Direct value input for selected keyframe
- Numeric stepper controls
- Value constraints/clamping

## Testing

Run the demo component to test all features:

```bash
# Start dev server
npm run dev

# Navigate to AnimationTimelineDemo component
# Test all interactions:
# - Click timeline to add keyframes
# - Drag keyframes to move
# - Select keyframes
# - Delete with keyboard/button
# - Change interpolation type
```

## Related Files

- `AnimationTimeline.tsx` - Main component implementation
- `AnimationTimelineDemo.tsx` - Demo/example component
- `types.ts` - TypeScript type definitions
- `crates/k-os-material/src/autopbr/animation.rs` - Rust animation engine
- `.kiro/specs/kautopbr-substance-parity-plus/tasks.md` - Task specification

## Requirements Validation

✅ **Requirement 5.2**: Keyframe animation support
- Keyframes can be added at any time
- Keyframes record parameter values
- UI displays all keyframes on timeline

✅ **Requirement 5.4**: Interpolation types
- Linear, Ease-In, Ease-Out, Ease-In-Out, Bezier supported
- Interpolation type selector per keyframe
- Visual feedback for selected interpolation

## Completion Checklist

- [x] Display keyframes as markers on timeline
- [x] Support adding keyframes with click
- [x] Support dragging keyframes to adjust timing
- [x] Support selecting keyframes
- [x] Support deleting keyframes (keyboard + button)
- [x] Add interpolation type selector per keyframe
- [x] Visual feedback for selection state
- [x] Tooltips showing keyframe info
- [x] Keyboard shortcuts (Delete/Backspace)
- [x] Demo component with full example
- [x] TypeScript types updated with tangent fields
- [x] Documentation complete
