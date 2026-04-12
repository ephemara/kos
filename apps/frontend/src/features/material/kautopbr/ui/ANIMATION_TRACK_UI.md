# Animation Track UI Implementation

## Overview

Task 10.3 implementation for KAutoPBR animation track UI. Provides a complete interface for managing animation tracks with support for keyframe, procedural, and physics-based animations.

## Components

### AnimationTrackList.tsx

Main component for displaying and managing animation tracks.

**Features:**
- Display all animation tracks with parameter names and types
- Add new tracks with parameter and animation type selection
- Remove tracks with confirmation
- Enable/disable individual tracks
- Select tracks for editing
- Expand/collapse procedural track editors
- Visual indicators for animation type (color-coded)

**Props:**
```typescript
interface AnimationTrackListProps {
  tracks?: AnimationTrack[];
  selectedTrackIndex?: number | null;
  onTrackAdd?: (parameter: AnimationParameter, animationType: 'Keyframe' | 'Procedural' | 'Physics') => void;
  onTrackRemove?: (index: number) => void;
  onTrackSelect?: (index: number | null) => void;
  onTrackToggle?: (index: number, enabled: boolean) => void;
  onExpressionChange?: (index: number, expression: string) => void;
  className?: string;
}
```

**Animation Type Colors:**
- Keyframe: Green (`text-green-400`)
- Procedural: Purple (`text-purple-400`)
- Physics: Orange (`text-orange-400`)

### ExpressionEditor.tsx

Code editor for procedural animation expressions with syntax highlighting.

**Features:**
- Real-time syntax highlighting using regex-based parser
- Highlights functions, numbers, operators, variables, parentheses
- Monospace font for code clarity
- Auto-scrolling synchronized between textarea and highlight layer
- Transparent textarea overlay technique for performance

**Syntax Highlighting:**
- Functions (sin, cos, perlin, etc.): Purple
- Numbers: Blue
- Operators (+, -, *, /, ^): Orange
- Variable 't': Green
- Parentheses/commas: Gray

**Props:**
```typescript
interface ExpressionEditorProps {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
}
```

### expressionPresets.ts

Data-driven expression preset library with 27 presets across 5 categories.

**Categories:**
- **Wave**: Sine, cosine, fast/slow oscillations
- **Pulse**: Pulsing, breathing, heartbeat patterns
- **Noise**: Perlin, simplex, worley, FBM, turbulent
- **UV**: Scrolling in all directions, flowing water
- **Complex**: Fire, wind, electric, shimmer, glitch, fade, bounce

**Preset Structure:**
```typescript
interface ExpressionPreset {
  name: string;
  description: string;
  expression: string;
  category: 'Wave' | 'Noise' | 'UV' | 'Pulse' | 'Complex';
}
```

**Helper Functions:**
- `getPresetsByCategory(category)`: Filter presets by category
- `getPresetCategories()`: Get all available categories
- `findPresetByName(name)`: Find specific preset

## Supported Animation Parameters

All 12 animatable parameters from the Rust backend:
- `AlbedoColor`, `AlbedoRed`, `AlbedoGreen`, `AlbedoBlue`
- `Roughness`, `Metallic`
- `EmissiveIntensity`, `EmissiveColor`
- `HeightOffset`, `NormalStrength`
- `UVOffsetX`, `UVOffsetY`

## Expression Language

**Variables:**
- `t` - Time in seconds

**Math Functions:**
- `sin(x)`, `cos(x)`, `tan(x)` - Trigonometric functions
- `abs(x)`, `sqrt(x)`, `pow(x, y)` - Basic math
- `min(x, y)`, `max(x, y)` - Comparison
- `clamp(value, min, max)` - Constrain value
- `lerp(a, b, t)` - Linear interpolation

**Noise Functions:**
- `perlin(x, frequency, amplitude)` - Perlin noise
- `simplex(x, frequency, amplitude)` - Simplex noise
- `worley(x, frequency, amplitude)` - Worley/cellular noise
- `fbm(x, frequency, amplitude, octaves, lacunarity, persistence)` - Fractal Brownian Motion

**Operators:**
- `+`, `-`, `*`, `/`, `^` (exponentiation)
- Standard operator precedence with parentheses

## Usage Example

```typescript
import { AnimationTrackList } from './ui/AnimationTrackList';
import type { AnimationTrack } from './types';

function MyComponent() {
  const [tracks, setTracks] = useState<AnimationTrack[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<number | null>(null);

  const handleAddTrack = (param, type) => {
    const newTrack = {
      parameter: param,
      animationType: type === 'Procedural' 
        ? { Procedural: { expression: 't * 0.5' } }
        : { Keyframe: { keyframes: [], interpolation: 'Linear' } }
    };
    setTracks([...tracks, newTrack]);
  };

  return (
    <AnimationTrackList
      tracks={tracks}
      selectedTrackIndex={selectedTrack}
      onTrackAdd={handleAddTrack}
      onTrackRemove={(i) => setTracks(tracks.filter((_, idx) => idx !== i))}
      onTrackSelect={setSelectedTrack}
      onExpressionChange={(i, expr) => {
        const newTracks = [...tracks];
        if ('Procedural' in newTracks[i].animationType) {
          newTracks[i].animationType.Procedural.expression = expr;
          setTracks(newTracks);
        }
      }}
    />
  );
}
```

## Integration Points

### With AnimationTimeline
The AnimationTrackList should be used alongside AnimationTimeline:
- AnimationTimeline handles keyframe editing and playback
- AnimationTrackList manages track selection and procedural expressions
- Both components share the same `AnimationTrack[]` data structure

### With Material System
Tracks are part of the `AnimationData` structure:
```typescript
interface AnimationData {
  duration: number;
  loopMode: LoopMode;
  tracks: AnimationTrack[];
}
```

## Design Decisions

### Data-Driven Presets
Expression presets are stored in a separate data file (`expressionPresets.ts`) rather than hardcoded in the component. This allows:
- Easy addition of new presets without touching component code
- Potential for user-defined presets in the future
- Clear separation of data and UI logic

### Syntax Highlighting Approach
Used a simple regex-based highlighter instead of a full code editor library (CodeMirror/Monaco) because:
- Lightweight and fast for simple expressions
- No external dependencies
- Sufficient for the limited expression language
- Can be upgraded later if needed

### Transparent Overlay Technique
The ExpressionEditor uses a transparent textarea with a highlighted div underneath:
- Maintains native textarea behavior (cursor, selection, etc.)
- Allows custom syntax highlighting
- Better performance than contentEditable approaches
- Standard technique used by many code editors

## Requirements Satisfied

- ✅ **5.1**: Display animation tracks for each parameter
- ✅ **5.12**: Support adding/removing tracks
- ✅ **6.1**: Add procedural expression editor with syntax highlighting
- ✅ **6.12**: Add expression preset dropdown with 27 presets

## Future Enhancements

1. **Advanced Syntax Highlighting**: Integrate CodeMirror or Monaco for:
   - Error highlighting
   - Autocomplete
   - Multi-line expressions
   - Bracket matching

2. **Expression Validation**: Real-time validation using the Rust ExpressionEvaluator:
   - Show syntax errors inline
   - Highlight invalid function names
   - Suggest corrections

3. **Visual Expression Builder**: Drag-and-drop node-based expression builder for non-programmers

4. **Custom Presets**: Allow users to save their own expression presets

5. **Track Groups**: Organize related tracks into collapsible groups

6. **Track Duplication**: Quick duplicate button for copying track configurations

7. **Expression Library**: Community-shared expression library with ratings and tags

## Testing

A demo component (`AnimationTrackListDemo.tsx`) is provided for testing:
- Add/remove tracks
- Edit expressions
- Apply presets
- View debug info

Run the demo to verify all functionality works correctly.
