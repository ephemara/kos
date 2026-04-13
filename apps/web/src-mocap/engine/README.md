# Engine - Runtime Abstraction Layer

This directory provides a platform-agnostic interface for GPU operations and backend communication. It abstracts away the differences between Tauri desktop, WASM web, and external engine integrations.

## Directory Structure

```
engine/
├── tauri/             # Tauri desktop implementation
├── wasm/              # WASM web implementation
├── external/          # External engine tether
├── EngineProvider.ts  # Abstract interface
├── TauriEngineProvider.ts    # Tauri implementation
├── WasmEngineProvider.ts     # WASM implementation
└── providerFactory.ts        # Runtime provider selection
```

## Overview

The engine layer provides a unified API for:
- GPU compute operations
- File system access
- IPC communication
- Platform-specific features

This allows applications to work seamlessly across:
- **Tauri Desktop**: Full GPU access, native file system
- **WASM Web**: WebGPU, browser file APIs
- **External Engines**: Bevy, Unity, Godot integration

## Architecture

```
┌─────────────────────────────────────┐
│  Application Code                   │
│  (React Components, Services)       │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│  EngineProvider Interface           │
│  (Abstract API)                     │
└─────────────────┬───────────────────┘
                  │
        ┌─────────┼─────────┐
        │         │         │
┌───────▼──┐ ┌───▼────┐ ┌──▼────────┐
│  Tauri   │ │  WASM  │ │ External  │
│ Provider │ │Provider│ │  Engine   │
└──────────┘ └────────┘ └───────────┘
```

## EngineProvider Interface

The abstract interface that all providers implement:

```typescript
export interface EngineProvider {
  // Initialization
  init(): Promise<void>;
  dispose(): Promise<void>;
  
  // GPU Operations
  sculptStroke(handle: number, params: BrushParams): Promise<void>;
  remesh(handle: number, resolution: number): Promise<void>;
  subdivide(handle: number, iterations: number): Promise<void>;
  
  // File System
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  
  // Platform Info
  getPlatform(): 'tauri' | 'wasm' | 'external';
  getCapabilities(): Capability[];
}
```

## Tauri Provider

Desktop implementation with full GPU access.

**Features**:
- Full WGPU compute access
- Native file system
- Python sidecar integration
- External process spawning
- System tray integration

**Usage**:
```typescript
import { TauriEngineProvider } from '@/engine/TauriEngineProvider';

const engine = new TauriEngineProvider();
await engine.init();

// Full GPU operations available
await engine.sculptStroke(handle, params);
```

**Capabilities**:
- `tauri` - Tauri desktop runtime
- `wgpu` - Full GPU compute
- `filesystem` - Native file access
- `python` - Python sidecar
- `external` - External process spawning

## WASM Provider

Web implementation with WebGPU.

**Features**:
- WebGPU compute (where available)
- Browser file APIs
- IndexedDB storage
- Web Workers for threading

**Usage**:
```typescript
import { WasmEngineProvider } from '@/engine/WasmEngineProvider';

const engine = new WasmEngineProvider();
await engine.init();

// Limited GPU operations (WebGPU)
await engine.sculptStroke(handle, params);
```

**Capabilities**:
- `wasm` - WASM runtime
- `webgpu` - WebGPU compute (if available)
- `indexeddb` - Browser storage

**Limitations**:
- No physics simulation (Rapier3D)
- No fluid simulation (Salva3D)
- Limited file system access
- No external process spawning

## External Engine Provider

Integration with external engines (Bevy, Unity, Godot).

**Features**:
- IPC communication with engine
- Shared memory for performance
- Event-driven architecture
- Bidirectional data flow

**Usage**:
```typescript
import { ExternalEngineProvider } from '@/engine/external/ExternalEngineProvider';

const engine = new ExternalEngineProvider({
  enginePath: './my-engine.exe',
  ipcPort: 9001
});

await engine.init();

// Operations forwarded to external engine
await engine.sculptStroke(handle, params);
```

**Capabilities**:
- `external` - External engine integration
- `ipc` - Inter-process communication
- Engine-specific capabilities

## Provider Factory

Automatically selects the correct provider at runtime:

```typescript
import { createEngineProvider } from '@/engine/providerFactory';

// Automatically detects platform
const engine = await createEngineProvider();

// Use unified API
await engine.sculptStroke(handle, params);
```

**Detection Logic**:
1. Check if `window.__TAURI__` exists → Tauri Provider
2. Check if external engine connected → External Provider
3. Fallback to WASM Provider

## Service Integration

Services use the engine provider for backend operations:

```typescript
// services/sculptClient.ts
import { getEngineProvider } from '@/engine/providerFactory';

export class SculptService extends BaseService {
  private engine: EngineProvider;
  
  constructor() {
    super();
    this.engine = getEngineProvider();
  }
  
  async stroke(handle: number, params: BrushParams): Promise<void> {
    // Automatically uses correct provider
    await this.engine.sculptStroke(handle, params);
  }
}
```

## Platform Detection

Detect the current platform at runtime:

```typescript
import { getPlatform, getCapabilities } from '@/engine/providerFactory';

const platform = getPlatform(); // 'tauri' | 'wasm' | 'external'
const capabilities = getCapabilities(); // ['tauri', 'wgpu', 'filesystem', ...]

// Conditional features
if (capabilities.includes('python')) {
  // Python sidecar available
}

if (capabilities.includes('wgpu')) {
  // Full GPU compute available
}
```

## Capability System

Capabilities define what features are available:

```typescript
type Capability = 
  | 'tauri'        // Tauri desktop runtime
  | 'wasm'         // WASM web runtime
  | 'wgpu'         // Full GPU compute
  | 'webgpu'       // WebGPU (browser)
  | 'filesystem'   // Native file system
  | 'indexeddb'    // Browser storage
  | 'python'       // Python sidecar
  | 'external'     // External engine
  | 'ipc'          // Inter-process communication
  | 'three'        // Three.js available
  | 'canvas';      // Canvas API available
```

**Usage**:
```typescript
import { hasCapability } from '@/engine/providerFactory';

if (hasCapability('python')) {
  // Use Python features
  await pythonService.runScript('my_script.py');
}

if (hasCapability('wgpu')) {
  // Use full GPU features
  await sculptService.dynamicTopology(handle);
}
```

## Error Handling

Providers handle errors gracefully:

```typescript
try {
  await engine.sculptStroke(handle, params);
} catch (error) {
  if (error instanceof EngineError) {
    console.error('Engine error:', error.message);
    console.error('Platform:', error.platform);
    console.error('Operation:', error.operation);
  }
}
```

## Performance Considerations

### Tauri Provider
- **Fastest**: Direct GPU access, no serialization overhead
- **Best for**: Heavy compute operations, large datasets
- **Latency**: ~1-2ms per operation

### WASM Provider
- **Fast**: WebGPU compute, minimal overhead
- **Best for**: Web deployment, moderate compute
- **Latency**: ~5-10ms per operation

### External Provider
- **Variable**: Depends on IPC mechanism
- **Best for**: Leveraging existing engines
- **Latency**: ~10-50ms per operation (IPC overhead)

## Testing

### Unit Tests

```typescript
describe('EngineProvider', () => {
  it('should initialize correctly', async () => {
    const engine = await createEngineProvider();
    expect(engine).toBeDefined();
    expect(engine.getPlatform()).toBeDefined();
  });
  
  it('should handle GPU operations', async () => {
    const engine = await createEngineProvider();
    const handle = await engine.createMesh(vertices);
    expect(handle).toBeGreaterThan(0);
  });
});
```

### Integration Tests

```typescript
describe('Service Integration', () => {
  it('should work with sculpt service', async () => {
    const engine = await createEngineProvider();
    const service = new SculptService(engine);
    
    const handle = await service.init(mesh);
    await service.stroke(handle, params);
    
    expect(handle).toBeGreaterThan(0);
  });
});
```

## Adding a New Provider

To add a new provider (e.g., for a new platform):

1. **Create provider class**:
```typescript
// engine/myplatform/MyPlatformProvider.ts
export class MyPlatformProvider implements EngineProvider {
  async init(): Promise<void> {
    // Initialize platform
  }
  
  async sculptStroke(handle: number, params: BrushParams): Promise<void> {
    // Implement operation
  }
  
  getPlatform(): 'myplatform' {
    return 'myplatform';
  }
  
  getCapabilities(): Capability[] {
    return ['myplatform', 'custom-feature'];
  }
}
```

2. **Update factory**:
```typescript
// engine/providerFactory.ts
export async function createEngineProvider(): Promise<EngineProvider> {
  if (isMyPlatform()) {
    return new MyPlatformProvider();
  }
  // ... existing logic
}
```

3. **Add capabilities**:
```typescript
// Update Capability type
type Capability = 
  | 'myplatform'
  | 'custom-feature'
  | ... // existing capabilities
```

## Best Practices

### Use the Factory

Always use the factory to create providers:

```typescript
// ✅ Good: Use factory
const engine = await createEngineProvider();

// ❌ Bad: Direct instantiation
const engine = new TauriEngineProvider();
```

### Check Capabilities

Always check capabilities before using features:

```typescript
// ✅ Good: Check capability
if (hasCapability('python')) {
  await pythonService.runScript('script.py');
}

// ❌ Bad: Assume capability
await pythonService.runScript('script.py'); // May fail on web
```

### Handle Errors

Always handle provider errors:

```typescript
// ✅ Good: Error handling
try {
  await engine.sculptStroke(handle, params);
} catch (error) {
  console.error('Operation failed:', error);
  // Fallback or user notification
}

// ❌ Bad: No error handling
await engine.sculptStroke(handle, params);
```

### Dispose Resources

Always dispose of providers when done:

```typescript
// ✅ Good: Cleanup
const engine = await createEngineProvider();
try {
  // Use engine
} finally {
  await engine.dispose();
}

// ❌ Bad: No cleanup
const engine = await createEngineProvider();
// Use engine
// Memory leak!
```

## Common Patterns

### Conditional Features

```typescript
const engine = await createEngineProvider();
const capabilities = engine.getCapabilities();

if (capabilities.includes('wgpu')) {
  // Enable advanced GPU features
  enableDynamicTopology();
  enablePhysicsSimulation();
} else {
  // Fallback to basic features
  enableBasicSculpting();
}
```

### Platform-Specific UI

```typescript
const platform = getPlatform();

return (
  <AppShell>
    {platform === 'tauri' && <DesktopFeatures />}
    {platform === 'wasm' && <WebFeatures />}
    {platform === 'external' && <ExternalEngineFeatures />}
  </AppShell>
);
```

### Progressive Enhancement

```typescript
const engine = await createEngineProvider();

// Basic features (all platforms)
await engine.sculptStroke(handle, basicParams);

// Enhanced features (if available)
if (hasCapability('wgpu')) {
  await engine.dynamicTopology(handle, detailSize);
}

if (hasCapability('python')) {
  await engine.runPythonScript('enhance.py');
}
```

## Resources

- [Tauri Documentation](https://tauri.app/v1/guides/)
- [WebGPU Specification](https://www.w3.org/TR/webgpu/)
- [WASM Documentation](https://webassembly.org/)
- [Service Layer](../shared/services/README.md)

## Contributing

When modifying the engine layer:

1. Maintain interface compatibility
2. Update all providers consistently
3. Add capability checks for new features
4. Document platform limitations
5. Write tests for all platforms
6. Update this README

## Migration Notes

If you're migrating from the old structure:
- Old `src/platform/` → `engine/`
- Old `src/tauri-client/` → `engine/tauri/`
- Old `src/wasm-client/` → `engine/wasm/`
