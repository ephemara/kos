# Webcam Feature Module

Real-time webcam feed with skeleton tracking overlay for ZenMocap.

## Overview

The webcam feature provides a floating, draggable panel that displays the live webcam feed with optional skeleton tracking visualization. It integrates with the ZenMocap AI inference pipeline to render COCO 17-keypoint skeletons in real-time at 60fps.

## Architecture

```
webcam/
├── components/
│   ├── WebcamPanel.tsx          # Main floating panel with drag/resize
│   ├── WebcamVideo.tsx          # Video element + tracking overlay
│   ├── WebcamControls.tsx       # Device/quality/mirror controls
│   ├── WebcamStatus.tsx         # Status indicator (live/connecting/error)
│   └── TrackingOverlay.tsx      # Canvas-based skeleton renderer
├── hooks/
│   ├── useWebcamStream.ts       # MediaStream management
│   ├── useCameraDevices.ts      # Device enumeration
│   └── useTrackingRenderer.ts   # 60fps skeleton rendering loop
├── utils/
│   └── skeletonRenderer.ts      # Pure drawing functions
├── types.ts                     # TypeScript interfaces
├── WebcamService.ts             # Tauri IPC service
└── index.ts                     # Public exports
```

## Features

### Floating Panel
- **Draggable**: Click and drag header to reposition
- **Resizable**: Drag bottom-right corner to resize (320x240 to 1280x960)
- **Pinnable**: Lock position to prevent accidental movement
- **Minimizable**: Collapse to header only
- **Persistent**: Position and size saved to localStorage

### Video Controls
- **Device Selection**: Switch between multiple cameras
- **Quality Presets**: 480p, 720p, 1080p
- **Mirror Toggle**: Flip video horizontally (default: on)
- **Overlay Toggle**: Show/hide tracking visualization

### Skeleton Tracking
- **Real-time Rendering**: 60fps canvas overlay
- **Confidence-based Coloring**:
  - Cyan (#00ffcc): High confidence (>0.7)
  - Yellow (#ffcc00): Medium confidence (0.4-0.7)
  - Red (#ff4444): Low confidence (<0.4)
- **Adaptive Opacity**: Fades based on confidence
- **COCO 17 Keypoints**: Full body skeleton (nose, eyes, ears, shoulders, elbows, wrists, hips, knees, ankles)
- **Zero-copy Data**: Reads from ref, no React re-renders

## Usage

### Basic Integration

```tsx
import { WebcamPanel } from '@/features/webcam';
import { useWebcamStream } from '@/features/webcam/hooks/useWebcamStream';
import { JointFrame } from '@/features/ZenMocap/types';

function MyComponent() {
  const latestFrame = useRef<JointFrame | null>(null);
  const {
    stream,
    isConnecting,
    error,
    availableDevices,
    currentDeviceId,
    currentQuality,
    startStream,
    stopStream,
    changeDevice,
    changeQuality,
  } = useWebcamStream();

  return (
    <WebcamPanel
      stream={stream}
      isConnecting={isConnecting}
      error={error}
      onClose={stopStream}
      onDeviceChange={changeDevice}
      onQualityChange={changeQuality}
      availableDevices={availableDevices}
      currentDeviceId={currentDeviceId}
      currentQuality={currentQuality}
      latestFrameRef={latestFrame}
      showTracking={true}
    />
  );
}
```

### Standalone Tracking Overlay

```tsx
import { TrackingOverlay } from '@/features/webcam';
import { JointFrame } from '@/features/ZenMocap/types';

function MyVideoPlayer() {
  const latestFrame = useRef<JointFrame | null>(null);

  return (
    <div style={{ position: 'relative' }}>
      <video ref={videoRef} />
      <TrackingOverlay
        latestFrameRef={latestFrame}
        enabled={true}
        showLegend={true}
        showFPS={true}
      />
    </div>
  );
}
```

### Custom Skeleton Rendering

```tsx
import {
  drawSkeleton,
  drawJoint,
  drawBone,
  DEFAULT_RENDER_CONFIG,
} from '@/features/webcam/utils/skeletonRenderer';
import { SKELETON_BONES } from '@/features/ZenMocap/types';

function customRender(
  ctx: CanvasRenderingContext2D,
  frame: JointFrame,
  width: number,
  height: number
) {
  // Use built-in renderer
  drawSkeleton(ctx, frame.joints, SKELETON_BONES, width, height);

  // Or draw custom elements
  const nose = frame.joints['nose'];
  if (nose && nose.confidence > 0.5) {
    const [x, y] = normalizedToCanvas(
      nose.position[0],
      nose.position[1],
      width,
      height
    );
    drawJoint(ctx, x, y, nose.confidence, 8); // Larger nose marker
  }
}
```

## API Reference

### Components

#### `<WebcamPanel>`
Main floating panel component.

**Props:**
- `stream: MediaStream | null` - Active webcam stream
- `isConnecting: boolean` - Connection state
- `error: string | null` - Error message
- `onClose: () => void` - Close handler
- `onDeviceChange: (deviceId: string) => void` - Device change handler
- `onQualityChange: (quality: string) => void` - Quality change handler
- `availableDevices: MediaDeviceInfo[]` - Available cameras
- `currentDeviceId: string` - Active device ID
- `currentQuality: string` - Active quality preset
- `latestFrameRef?: React.RefObject<JointFrame | null>` - Frame data ref
- `showTracking?: boolean` - Enable skeleton overlay

#### `<TrackingOverlay>`
Canvas-based skeleton renderer.

**Props:**
- `latestFrameRef: React.RefObject<JointFrame | null>` - Frame data ref (required)
- `enabled?: boolean` - Enable rendering (default: true)
- `showLegend?: boolean` - Show confidence legend (default: true)
- `showFPS?: boolean` - Show FPS counter (default: true)
- `className?: string` - Additional CSS classes
- `style?: React.CSSProperties` - Inline styles

### Hooks

#### `useTrackingRenderer(latestFrameRef, options)`
60fps skeleton rendering loop.

**Parameters:**
- `latestFrameRef: React.RefObject<JointFrame | null>` - Frame data ref
- `options?: UseTrackingRendererOptions` - Rendering options

**Returns:**
- `canvasRef: React.RefObject<HTMLCanvasElement>` - Canvas element ref
- `fps: number` - Current rendering FPS

**Options:**
```typescript
interface UseTrackingRendererOptions {
  enabled?: boolean;
  showLegend?: boolean;
  showFPS?: boolean;
  config?: Partial<SkeletonRenderConfig>;
}
```

#### `useWebcamStream()`
MediaStream management hook.

**Returns:**
```typescript
{
  stream: MediaStream | null;
  isConnecting: boolean;
  error: string | null;
  availableDevices: MediaDeviceInfo[];
  currentDeviceId: string;
  currentQuality: string;
  startStream: (deviceId?: string, quality?: string) => Promise<void>;
  stopStream: () => void;
  changeDevice: (deviceId: string) => Promise<void>;
  changeQuality: (quality: string) => Promise<void>;
}
```

### Utilities

#### `drawSkeleton(ctx, joints, bones, width, height, config?)`
Draw complete skeleton with bones and joints.

#### `drawJoint(ctx, x, y, confidence, radius?)`
Draw single joint as colored circle.

#### `drawBone(ctx, x1, y1, x2, y2, confidence, width?)`
Draw bone as colored line between joints.

#### `getConfidenceColor(confidence: number): string`
Get color based on confidence level.

#### `normalizedToCanvas(normalizedX, normalizedY, width, height): [number, number]`
Map normalized [0,1] coordinates to canvas pixels.

## Performance

### Rendering Loop
- **Target FPS**: 60fps
- **Actual FPS**: 55-60fps (depends on GPU)
- **Frame Time**: ~16ms per frame
- **Zero-copy**: Reads from ref, no React re-renders

### Resource Usage
- **CPU**: ~2-3% (rendering loop)
- **GPU**: ~5% (canvas compositing)
- **Memory**: ~10MB (canvas buffers)

### Optimization Strategies
1. **requestAnimationFrame**: Syncs with display refresh rate
2. **Zero-copy refs**: Avoids React re-render overhead
3. **Canvas reuse**: Single canvas, no allocation per frame
4. **Confidence filtering**: Skips low-confidence joints (<0.3)
5. **Device pixel ratio**: Matches canvas resolution to display

## Keyboard Shortcuts

- **Esc**: Close panel
- **M**: Toggle mirror mode

## Styling

The webcam panel uses ZenMocap's design system:
- **Background**: `#060606/95` with backdrop blur
- **Border**: `white/10`
- **Accent**: `#00ffcc` (cyan)
- **Font**: Monospace for technical feel

## Integration with ZenMocap Pipeline

```
Camera Capture (nokhwa)
    ↓
AI Inference (onnxruntime-rs)
    ↓
IK Solving (FABRIK)
    ↓
Tauri Event: "mocap-frame"
    ↓
latestFrame.current = event.payload  ← Zero-copy update
    ↓
useTrackingRenderer reads ref
    ↓
Canvas rendering (60fps)
```

## Future Enhancements

- [ ] Multi-person tracking (multiple skeletons)
- [ ] Confidence threshold slider
- [ ] Custom color schemes
- [ ] Recording indicator
- [ ] Snapshot capture
- [ ] Grid overlay options
- [ ] Performance metrics panel
- [ ] Export skeleton data

## Troubleshooting

### No camera detected
- Check browser permissions
- Ensure camera is not in use by another app
- Try refreshing the page

### Low FPS
- Reduce video quality (480p)
- Disable tracking overlay
- Close other GPU-intensive apps

### Skeleton not rendering
- Ensure `latestFrameRef` is passed to `WebcamVideo`
- Check that `showTracking={true}` is set
- Verify AI inference is running (check console)

### Mirrored skeleton
- Toggle mirror mode in controls
- Or set `isMirrored={false}` on `WebcamVideo`

## License

Part of ZenMocap - Real-time AI Motion Capture Engine
