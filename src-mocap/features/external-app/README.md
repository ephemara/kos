# External App Tether - The Secret Sauce 🚀

## Overview

The **App Tether** is the secret weapon that allows you to bootstrap **ANY external application** (Bevy, Unity, Godot, Unreal, custom engines, etc.) to this React frontend in a whim.

This is what makes this template system truly special - you can combine the power of React for UI with the raw performance of native engines for rendering/compute.

## What It Does

The App Tether synchronizes an external application's window with a React viewport:

- **Window Positioning**: External app follows React viewport pixel-perfectly
- **Visibility Management**: Show/hide external app on demand
- **Click-Through Mode**: React UI overlay with external app receiving input
- **Debug Support**: Toggle debug panels in external app
- **Connection Monitoring**: Real-time connection status

## Supported External Apps

While originally designed for Bevy, the App Tether works with ANY application that can:

1. Be launched as a separate process
2. Receive window positioning commands via IPC (Tauri commands)
3. Support visibility toggling

### Examples:
- **Bevy** (Rust game engine) ✅ Fully integrated
- **Unity** (C# game engine) - Possible with Unity IPC bridge
- **Godot** (GDScript/C++ engine) - Possible with Godot IPC bridge
- **Unreal Engine** - Possible with UE IPC bridge
- **Custom Engines** - Any engine with IPC support

## Quick Start

### Basic Usage

```tsx
import { AppTether } from '@/features/external-app';

function MyApp() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [advancedMode, setAdvancedMode] = useState(false);

  return (
    <div ref={viewportRef} className="viewport">
      {/* The magic happens here! */}
      <AppTether 
        viewportRef={viewportRef} 
        enabled={advancedMode} 
      />
      
      {/* Your React UI */}
      <YourReactUI />
    </div>
  );
}
```

### Advanced Usage with Hook

```tsx
import { useAppTether, AppConnectionBadge } from '@/features/external-app';

function AdvancedApp() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  const {
    isConnected,
    isUiOnly,
    setIsUiOnly,
    isDebugOpen,
    setIsDebugOpen,
  } = useAppTether({
    viewportRef,
    enabled,
    uiOnly: false,
    debugPanel: false,
    onConnectionChange: (connected) => {
      console.log('External app connection:', connected);
    },
  });

  return (
    <div>
      <AppConnectionBadge connected={isConnected} appName="BEVY" />
      
      <div ref={viewportRef} className="viewport">
        {/* Your UI */}
      </div>
      
      <button onClick={() => setIsUiOnly(!isUiOnly)}>
        Toggle Click-Through
      </button>
    </div>
  );
}
```

## Props

### AppTetherProps

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `viewportRef` | `React.RefObject<HTMLDivElement>` | Required | Ref to viewport element |
| `enabled` | `boolean` | `false` | Whether tether is active |
| `uiOnly` | `boolean` | `false` | Enable click-through mode |
| `debugPanel` | `boolean` | `false` | Show debug panel in external app |
| `onConnectionChange` | `(connected: boolean) => void` | - | Connection status callback |

## How It Works

### 1. Window Sync Loop

The tether runs a continuous sync loop at ~60fps:

```typescript
// Simplified version
const sync = () => {
  const rect = viewportRef.current.getBoundingClientRect();
  const windowPos = await getCurrentWindow().outerPosition();
  
  await invoke('sync_bevy_window', {
    x: windowPos.x + rect.left,
    y: windowPos.y + rect.top,
    width: rect.width,
    height: rect.height,
  });
};
```

### 2. Event Listeners

Listens for window move/resize events and syncs immediately:

```typescript
window.onMoved(() => syncViewport());
window.onResized(() => syncViewport());
```

### 3. Visibility Management

Shows/hides external app based on `enabled` prop:

```typescript
useEffect(() => {
  if (enabled) {
    invoke('set_bevy_visible', { visible: true });
  } else {
    invoke('set_bevy_visible', { visible: false });
  }
}, [enabled]);
```

## Keyboard Shortcuts

When tether is enabled:

- **F1**: Toggle debug panel in external app
- **F2**: Toggle UI-only mode (click-through)

## Required Tauri Commands

Your Tauri backend must implement these commands:

```rust
#[tauri::command]
async fn set_bevy_visible(visible: bool) -> Result<(), String> {
    // Show/hide external app window
}

#[tauri::command]
async fn sync_bevy_window(x: i32, y: i32, width: u32, height: u32) -> Result<(), String> {
    // Position external app window
}

#[tauri::command]
async fn leash_egui_only(enabled: bool) -> Result<(), String> {
    // Toggle UI-only mode
}

#[tauri::command]
async fn leash_debug_ui(enabled: bool) -> Result<(), String> {
    // Toggle debug panel
}
```

## Integration Examples

### Bevy Integration (Included)

See `crates/k-os-bevy/` for full Bevy integration example.

### Unity Integration (Conceptual)

```csharp
// Unity C# script
public class TauriBridge : MonoBehaviour {
    void Start() {
        // Listen for IPC commands from Tauri
        IPCManager.OnPositionUpdate += UpdateWindowPosition;
    }
    
    void UpdateWindowPosition(int x, int y, int width, int height) {
        // Move Unity window
        Screen.SetResolution(width, height, false);
        // Position window (platform-specific)
    }
}
```

### Godot Integration (Conceptual)

```gdscript
# Godot GDScript
extends Node

func _ready():
    # Connect to Tauri IPC
    var ipc = TauriIPC.new()
    ipc.connect("position_update", self, "_on_position_update")

func _on_position_update(x, y, width, height):
    # Move Godot window
    OS.window_position = Vector2(x, y)
    OS.window_size = Vector2(width, height)
```

## Performance Considerations

### Optimizations

1. **Debouncing**: Window events are debounced to 16ms (~60fps)
2. **Change Detection**: Only syncs when position/size actually changes
3. **RequestAnimationFrame**: Uses RAF for smooth continuous sync
4. **IPC Batching**: Reduces IPC noise by checking for changes

### Performance Tips

- Only enable tether when needed (e.g., "Advanced Mode")
- Use `uiOnly` mode sparingly (adds input latency)
- Disable debug panel in production

## Troubleshooting

### External app not showing

1. Check that Tauri commands are implemented
2. Verify external app process is running
3. Check console for IPC errors

### Window positioning is off

1. Ensure viewport ref is attached to correct element
2. Check that element has proper dimensions
3. Verify window position calculations

### Click-through not working

1. Ensure `uiOnly` prop is set to `true`
2. Check that `setIgnoreCursorEvents` is supported
3. Verify external app is receiving input events

## Why This Is Special

This pattern allows you to:

1. **Use React for UI**: Leverage the entire React ecosystem for UI
2. **Use Native Engines for Rendering**: Get raw GPU performance
3. **Mix and Match**: Combine strengths of both worlds
4. **Rapid Prototyping**: Bootstrap any engine in minutes
5. **Production Ready**: Battle-tested in real applications

## Future Possibilities

- **Multi-App Tethering**: Tether multiple external apps simultaneously
- **Bidirectional Communication**: External app controls React UI
- **Shared Memory**: Zero-copy data sharing between apps
- **Hot Reload**: Reload external app without restarting React

## Credits

Originally designed for Bevy integration in K_OS, generalized for universal use.

---

**This is the secret sauce that makes this template system truly special!** 🚀
