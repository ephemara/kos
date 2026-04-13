# Features - Starter Templates

This directory contains the core starter templates that developers copy to build new applications. These are the "main stage" - the entry points for creating new desktop applications.

## Directory Structure

```
features/
├── template/          # 2D starter template
├── template3D/        # 3D starter template  
└── external-app/      # External engine tether (Bevy, Unity, Godot, etc.)
```

## Philosophy

**Features are NOT examples.** They are production-ready starter templates designed to be copied and extended. Think of them as:

- **Templates**: Starting points for new applications
- **Minimal**: Only essential functionality
- **Extensible**: Easy to build upon
- **Universal**: Work for any use case in their category

## Core Templates

### `template/` - 2D Starter Template

The foundation for building 2D canvas applications.

**Use Cases**:
- Digital painting tools
- Image editors
- 2D animation software
- Procedural texture generators
- Node-based compositing tools

**What's Included**:
- Canvas setup with high-DPI support
- Basic tool system
- Layer management integration
- Undo/redo system
- File import/export
- UI shell with docking panels

**Getting Started**:
```bash
# Copy the template
cp -r src-frontend/features/template src-frontend/two-d/examples/my-app

# Customize for your needs
# Register in modules.manifest.ts
```

### `template3D/` - 3D Starter Template

The foundation for building 3D applications with Three.js.

**Use Cases**:
- Digital sculpting tools
- 3D modeling software
- CAD applications
- Game level editors
- Procedural generation tools
- Visualization software

**What's Included**:
- Three.js scene setup
- Camera controls (orbit, pan, zoom)
- Basic lighting
- Object selection system
- Transform gizmos
- Layer management integration
- GPU service integration
- UI shell with docking panels

**Getting Started**:
```bash
# Copy the template
cp -r src-frontend/features/template3D src-frontend/three-d/examples/my-app

# Customize for your needs
# Register in modules.manifest.ts
```

**Key Features**:
- React Three Fiber integration
- GPU-accelerated operations via services
- Material system
- Post-processing support
- Performance optimizations

## Special Features

### `external-app/` - External Engine Tether

**The Secret Sauce**: Bootstrap ANY external application (Bevy, Unity, Godot, Unreal, custom engines) and overlay React UI on top.

**How It Works**:
1. External engine renders to a window
2. React UI overlays on top (transparent background)
3. IPC communication between React and engine
4. Unified input handling

**Use Cases**:
- Bevy game engine integration
- Unity editor extensions
- Godot tool development
- Custom engine UIs
- Any external .exe that needs a modern UI

**Key Components**:
- `AppTether.tsx` - Main tether component
- IPC bridge for communication
- Input passthrough system
- Window management

**Example**:
```typescript
import { AppTether } from '@/features/external-app';

<AppTether
  enginePath="./my-engine.exe"
  uiOnly={false}
  onEngineReady={() => console.log('Engine connected!')}
>
  <YourReactUI />
</AppTether>
```

See [external-app/README.md](./external-app/README.md) for detailed documentation.

## Utilities (Moved to Shared)

Developer tools and notifications have been moved to more appropriate locations:
- **Console Panel**: Now in `shared/dev-tools/` - Developer console for log streaming
- **Notifications**: Now in `notifications/` - Toast system and GPU error handling

These are utility components, not feature templates, so they don't belong in the main stage.

## Template vs Example

**Templates (in `features/`)**:
- ✅ Minimal, essential functionality only
- ✅ Designed to be copied and extended
- ✅ Generic, works for any use case
- ✅ Well-documented with clear extension points
- ✅ Production-ready starting point

**Examples (in `two-d/examples/` or `three-d/examples/`)**:
- ✅ Full-featured applications
- ✅ Demonstrate specific use cases
- ✅ Show how to use systems and services
- ✅ Reference implementations
- ✅ Not meant to be copied directly

## Creating a New Application

### From 2D Template

1. **Copy the template**:
```bash
cp -r src-frontend/features/template src-frontend/two-d/examples/my-paint-app
```

2. **Customize the template**:
```typescript
// my-paint-app/MyPaintApp.tsx
export const MyPaintApp: React.FC = () => {
  // Add your custom logic
  return (
    <AppShell>
      <ToolPanel>
        {/* Your tools */}
      </ToolPanel>
      <Canvas>
        {/* Your canvas */}
      </Canvas>
    </AppShell>
  );
};
```

3. **Register in manifest**:
```typescript
// shared/config/modules.manifest.ts
{
  id: 'my-paint-app',
  name: 'My Paint App',
  category: '2d',
  entryComponent: lazy(() => import('@/two-d/examples/my-paint-app')),
  requiredCapabilities: ['canvas']
}
```

### From 3D Template

1. **Copy the template**:
```bash
cp -r src-frontend/features/template3D src-frontend/three-d/examples/my-sculpt-app
```

2. **Customize the template**:
```typescript
// my-sculpt-app/MySculptApp.tsx
export const MySculptApp: React.FC = () => {
  // Add your custom logic
  return (
    <AppShell>
      <ToolPanel>
        {/* Your tools */}
      </ToolPanel>
      <Canvas>
        <Scene />
      </Canvas>
    </AppShell>
  );
};
```

3. **Register in manifest**:
```typescript
// shared/config/modules.manifest.ts
{
  id: 'my-sculpt-app',
  name: 'My Sculpt App',
  category: '3d',
  entryComponent: lazy(() => import('@/three-d/examples/my-sculpt-app')),
  requiredCapabilities: ['tauri', 'three', 'wgpu']
}
```

## Template Extension Points

### 2D Template Extension Points

1. **Canvas Setup**: Customize canvas initialization
2. **Tool System**: Add your custom tools
3. **Brush Engine**: Integrate 2D brush system
4. **Layer Management**: Use universal layer system
5. **File I/O**: Add custom import/export formats
6. **Shaders**: Integrate shader library for effects

### 3D Template Extension Points

1. **Scene Setup**: Customize Three.js scene
2. **Camera Controls**: Add custom camera behaviors
3. **Tool System**: Add your custom 3D tools
4. **GPU Services**: Integrate sculpting, meshing, etc.
5. **Material System**: Add custom materials
6. **Layer Management**: Use 3D layer system
7. **Shaders**: Integrate shader library for effects

## Best Practices

### Keep Templates Minimal

Templates should be:
- **Lean**: Only essential functionality
- **Generic**: No domain-specific logic
- **Documented**: Clear extension points
- **Tested**: Core functionality verified

### Use Composition

Build features by composing existing systems:

```typescript
// ✅ Good: Compose from systems
import { useBrush } from '@/two-d/systems/brush-2d';
import { useLayerManager } from '@/two-d/systems/layers-2d';
import { Button } from '@/shared/primitives';

// ❌ Bad: Reimplement everything
const MyCustomBrush = () => {
  // Custom brush implementation
};
```

### Follow Conventions

- Use `@/` path alias for imports
- Follow naming conventions (PascalCase for components)
- Use TypeScript with explicit types
- Document public APIs
- Write tests for core functionality

### Register in Manifest

Always register new applications in the module manifest:

```typescript
// shared/config/modules.manifest.ts
export const MODULES: ModuleDefinition[] = [
  {
    id: 'my-app',
    name: 'My App',
    category: '2d' | '3d',
    entryComponent: lazy(() => import('@/path/to/my-app')),
    requiredCapabilities: ['tauri', 'three', 'wgpu'],
    icon: MyIcon,
    description: 'Brief description'
  }
];
```

## Template Maintenance

### When to Update Templates

Update templates when:
- Core architecture changes
- New essential features are added
- Better patterns are discovered
- Performance improvements are made

### When NOT to Update Templates

Don't update templates for:
- Domain-specific features
- Experimental features
- Nice-to-have additions
- Example-specific logic

## External Engine Integration

The `external-app/` tether is a game-changer for desktop development:

**Supported Engines**:
- Bevy (Rust game engine)
- Unity (C# game engine)
- Godot (GDScript/C# game engine)
- Unreal Engine (C++ game engine)
- Custom engines (any .exe)

**Benefits**:
- Modern React UI on any engine
- No engine-specific UI code
- Unified development experience
- Hot reload for UI changes
- Full TypeScript type safety

**Architecture**:
```
┌─────────────────────────────────────┐
│  React UI (Transparent Overlay)    │
│  - Panels, buttons, controls        │
│  - TypeScript + Tailwind            │
└─────────────────┬───────────────────┘
                  │ IPC
┌─────────────────▼───────────────────┐
│  External Engine (Native Window)    │
│  - Bevy, Unity, Godot, etc.         │
│  - Renders 3D scene                 │
└─────────────────────────────────────┘
```

## Resources

- [2D Systems Documentation](../two-d/README.md)
- [3D Systems Documentation](../three-d/README.md)
- [Shared Components](../shared/README.md)
- [Shader Library](../shaders/README.md)
- [Module Manifest](../shared/config/modules.manifest.ts)

## Contributing

When adding new templates:

1. Keep them minimal and generic
2. Document extension points clearly
3. Provide usage examples
4. Write tests for core functionality
5. Follow existing patterns
6. Update this README

## Migration Notes

If you're migrating from the old structure:
- Old `src/apps/base-2d/` → `features/template/`
- Old `src/apps/base-3d/` → `features/template3D/`
- Old `src/apps/bevy/` → `features/external-app/`


---

## Production Feature Modules

In addition to templates, this directory contains production feature modules that are complete, self-contained applications.

### ZenMocap
Real-time AI motion capture engine with GPU-accelerated physics correction.

**Location:** `features/ZenMocap/`

**Key Components:**
- Session management and pipeline controls
- 3D skeleton viewport with character preview
- IK constraint configuration
- LiveLink status monitoring
- Take recording and playback
- Timeline sequencer

**Integration:** Registered in `app-config/modules.manifest.ts` as `zen-mocap`

### ZenMocapLauncher
Unified launcher for ZenMocap with webcam preview and session configuration.

**Location:** `features/ZenMocapLauncher/`

**Key Components:**
- Camera device selection
- AI model selection
- DCC target configuration
- Webcam preview with live feed
- Session launch controls

### Webcam System
Standalone webcam system with skeleton tracking overlay - used by ZenMocap.

**Location:** `features/webcam/`

**Key Features:**
- Floating, draggable, resizable panel
- Real-time video feed from any camera device
- 60fps skeleton tracking overlay (COCO 17 keypoints)
- Quality presets (480p, 720p, 1080p)
- Mirror mode toggle
- Persistent position and size
- Zero-copy frame data architecture

**Usage Example:**
```tsx
import { WebcamPanel } from '@/features/webcam';
import { useWebcamStream } from '@/features/webcam/hooks/useWebcamStream';

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

**Integration in ZenMocap:**
The webcam system is integrated into ZenMocap via the View menu "Camera Preview" button. When enabled, it displays a floating panel with the live webcam feed and real-time skeleton tracking overlay synchronized with the AI inference pipeline.

### Sequencer
Timeline-based animation sequencer for multi-track recording and playback.

**Location:** `features/Sequencer/`

**Key Components:**
- Multi-track timeline
- Keyframe editing
- Loop region controls
- Playback controls
- Track management
