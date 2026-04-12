# Webcam UI Components

Professional floating webcam panel system for ZenMocap with draggable, resizable, and persistent state management.

## Components

### WebcamPanel
Main container component that orchestrates the entire webcam UI.

**Features:**
- Draggable with framer-motion (can be pinned)
- Resizable with min/max constraints (320×240 to 1280×960)
- Persistent position/size via localStorage
- Minimize/maximize functionality
- Keyboard shortcuts (Esc to close, M to mirror)
- Z-index: 9999 (always on top)

**Props:**
```typescript
interface WebcamPanelProps {
  stream: MediaStream | null;
  isConnecting: boolean;
  error: string | null;
  onClose: () => void;
  onDeviceChange: (deviceId: string) => void;
  onQualityChange: (quality: string) => void;
  availableDevices: MediaDeviceInfo[];
  currentDeviceId: string;
  currentQuality: string;
}
```

**Usage:**
```tsx
import { WebcamPanel } from '@/features/webcam/components';

<WebcamPanel
  stream={mediaStream}
  isConnecting={false}
  error={null}
  onClose={() => setShowWebcam(false)}
  onDeviceChange={handleDeviceChange}
  onQualityChange={handleQualityChange}
  availableDevices={devices}
  currentDeviceId={deviceId}
  currentQuality="720p"
/>
```

### WebcamVideo
Video element wrapper with overlay rendering and performance monitoring.

**Features:**
- Auto-attaches MediaStream to video element
- Mirror mode support
- Tracking overlay (crosshairs + circle)
- FPS counter (updates parent)
- Resolution detection
- Loading states

**Props:**
```typescript
interface WebcamVideoProps {
  stream: MediaStream | null;
  isMirrored: boolean;
  showOverlay: boolean;
  isConnecting: boolean;
  error: string | null;
  onFpsUpdate: (fps: number) => void;
  onResolutionUpdate: (resolution: { width: number; height: number }) => void;
}
```

### WebcamControls
Compact control bar for camera settings.

**Features:**
- Camera device selector dropdown
- Quality preset buttons (480p, 720p, 1080p)
- Mirror toggle button
- Tracking overlay toggle button
- Responsive layout

**Props:**
```typescript
interface WebcamControlsProps {
  availableDevices: MediaDeviceInfo[];
  currentDeviceId: string;
  currentQuality: string;
  isMirrored: boolean;
  showOverlay: boolean;
  onDeviceChange: (deviceId: string) => void;
  onQualityChange: (quality: string) => void;
  onMirrorToggle: () => void;
  onOverlayToggle: () => void;
}
```

### WebcamStatus
Status indicator with animated badges and metrics.

**Features:**
- Status badge (connecting, live, error)
- Animated dot indicator
- FPS counter with color coding (green ≥30, yellow ≥20, red <20)
- Resolution display

**Props:**
```typescript
interface WebcamStatusProps {
  status: 'connecting' | 'live' | 'error';
  fps: number;
  resolution: { width: number; height: number };
}
```

## Design System

### Colors
- Background: `#060606` with 95% opacity + backdrop blur
- Border: `white/10`
- Accent: `#00ffcc` (cyan)
- Text: `text-gray-200`
- Error: `#ef4444` (red)
- Warning: `#fbbf24` (yellow)

### Typography
- Font: `font-mono` (monospace)
- Sizes: `text-xs` (controls), `text-sm` (headers)

### Animations
- Panel entrance: Spring animation (damping: 25, stiffness: 300)
- Status dot: Pulse animation (2s loop)
- Connecting: Opacity fade (1.5s loop)

## State Management

### Persistent State (localStorage)
```typescript
interface PanelState {
  x: number;           // Panel X position
  y: number;           // Panel Y position
  width: number;       // Panel width
  height: number;      // Panel height
  isPinned: boolean;   // Drag lock state
  isMinimized: boolean; // Minimize state
}
```

**Storage Key:** `zenmocap-webcam-panel-state`

### Constraints
- Min size: 320×240
- Max size: 1280×960
- Default size: 640×480
- Default position: Bottom-right corner (40px margin)

## Keyboard Shortcuts

- **Esc**: Close panel
- **M**: Toggle mirror mode

## Integration Example

```tsx
import { useState, useEffect } from 'react';
import { WebcamPanel } from '@/features/webcam/components';

export const MyComponent = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [quality, setQuality] = useState('720p');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Enumerate devices
    navigator.mediaDevices.enumerateDevices().then((deviceList) => {
      const cameras = deviceList.filter((d) => d.kind === 'videoinput');
      setDevices(cameras);
      if (cameras.length > 0) {
        setDeviceId(cameras[0].deviceId);
      }
    });
  }, []);

  const handleDeviceChange = async (newDeviceId: string) => {
    setIsConnecting(true);
    setError(null);
    
    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      const constraints = {
        video: {
          deviceId: { exact: newDeviceId },
          width: quality === '1080p' ? 1920 : quality === '720p' ? 1280 : 640,
          height: quality === '1080p' ? 1080 : quality === '720p' ? 720 : 480,
        },
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);
      setDeviceId(newDeviceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to access camera');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <WebcamPanel
      stream={stream}
      isConnecting={isConnecting}
      error={error}
      onClose={() => setStream(null)}
      onDeviceChange={handleDeviceChange}
      onQualityChange={setQuality}
      availableDevices={devices}
      currentDeviceId={deviceId}
      currentQuality={quality}
    />
  );
};
```

## Performance Considerations

### FPS Monitoring
- Uses `requestAnimationFrame` for smooth rendering
- Counts frames per second in real-time
- Updates parent component every 1000ms

### Zero-Copy Video
- Video element directly consumes MediaStream
- No intermediate canvas copies (except for overlay)
- Hardware-accelerated video decoding

### Overlay Rendering
- Separate canvas layer for tracking overlay
- Only renders when `showOverlay` is true
- Minimal CPU overhead (crosshairs + circle)

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (requires HTTPS or localhost)

## Future Enhancements

- [ ] Snapshot capture button
- [ ] Recording indicator
- [ ] Zoom controls
- [ ] Pan/tilt for PTZ cameras
- [ ] Multi-camera grid view
- [ ] Picture-in-picture mode
