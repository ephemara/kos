# Shared - Universal Components

## Overview

The `shared/` directory contains components, systems, and utilities that work for **both 2D and 3D applications**. This is the foundation that all applications build upon.

## Directory Structure

```
shared/
├── shell/           # Application shell and docking
├── primitives/      # UI primitives and widgets
├── theme/           # Theme system
├── state/           # Global state management
├── protocol/        # Generated TypeScript types from Rust
├── config/          # Configuration manifests
├── services/        # Universal services
└── systems/         # Universal systems
```

## Subdirectories

### 🏠 shell/ - Application Shell

The core application shell with docking, menu bar, and top bar:

**Components:**
- `AppShell.tsx` - Main application shell with docking layout
- `AppMenuBar.tsx` - Menu bar with file/edit/view menus
- `AppTopBar.tsx` - Customizable top bar with controls
- `DockPanel.tsx` - Docking panel system
- `GlobalCommandPalette.tsx` - Ctrl+K command palette
- `QuickMenu.tsx` - Quick access menu
- `Sequencer.tsx` - Timeline/sequencer component
- `FloatingQuickMenu.tsx` - Floating quick menu
- `controls/transform/TransformPanel.tsx` - Transform controls

**Usage:**
```typescript
import { AppShell, AppMenuBar } from '@/shared/shell';

function MyApp() {
  return (
    <AppShell>
      <AppMenuBar />
      <Viewport />
      <SidePanel />
    </AppShell>
  );
}
```

### 🎨 primitives/ - UI Primitives

Reusable UI components built on Radix UI and Tailwind:

**Components:**
- `Button.tsx` - Button component
- `Slider.tsx` - Slider component
- `ButterSlider.tsx` - Smooth slider with butter-like feel
- `Dialog.tsx` - Modal dialog
- `AlertDialog.tsx` - Alert dialog
- `ColorPopover.tsx` - Color picker popover
- `Toolbar.tsx` - Toolbar component
- `cn.ts` - Class name utility

**Widgets:**
- `PerfHud.tsx` - Performance HUD
- `AlphaMenu.tsx` - Alpha brush menu

**Usage:**
```typescript
import { Button, Slider, Dialog } from '@/shared/primitives';

function MyPanel() {
  return (
    <div>
      <Button onClick={handleClick}>Click Me</Button>
      <Slider value={value} onChange={setValue} />
    </div>
  );
}
```

### 🎭 theme/ - Theme System

Theme management with CSS variables:

**Files:**
- `theme.ts` - Theme definitions
- `ThemeProvider.tsx` - Theme context provider
- `ThemeSelector.tsx` - Theme selector component
- `appThemeConfig.ts` - App theme configuration
- `topBarThemes.ts` - Top bar theme presets
- `topBarLayoutConfig.ts` - Top bar layout configuration

**Usage:**
```typescript
import { ThemeProvider, useTheme } from '@/shared/theme';

function App() {
  return (
    <ThemeProvider>
      <MyApp />
    </ThemeProvider>
  );
}

function MyComponent() {
  const { theme, setTheme } = useTheme();
  return <div>Current theme: {theme}</div>;
}
```

**CSS Variables:**
```css
--kos-surface-primary
--kos-surface-secondary
--kos-text-primary
--kos-text-secondary
--kos-border-primary
--kos-accent-primary
```

### 🔄 state/ - Global State Management

Global state stores using Zustand and Jotai:

**Files:**
- `consoleStore.ts` - Console log store
- `perfHudStore.ts` - Performance HUD store
- `eventBus.ts` - Global event bus
- `mode.ts` - Runtime mode detection (Tauri/WASM)

**Usage:**
```typescript
import { useConsoleStore } from '@/shared/state';

function Console() {
  const logs = useConsoleStore(state => state.logs);
  return <div>{logs.map(log => <div>{log}</div>)}</div>;
}
```

### 📦 protocol/ - Generated Types

TypeScript types generated from Rust protocol definitions:

**Files:**
- `ActiveTool.ts`
- `BrushAsset.ts`
- `BrushLibrary.ts`
- `LayerInfo.ts`
- `LayerHierarchy.ts`
- `MeshStats.ts`
- `SculptState.ts`
- `ViewportState.ts`
- `KosMessage.ts`
- `KosResponse.ts`
- And more...

**Usage:**
```typescript
import type { BrushAsset, LayerInfo } from '@/shared/protocol';

const brush: BrushAsset = {
  id: 'brush-1',
  name: 'Standard',
  // ...
};
```

### ⚙️ config/ - Configuration Manifests

Centralized configuration for modules, routes, capabilities, and assets:

**Files:**
- `modules.manifest.ts` - Module registration
- `capabilities.manifest.ts` - Capability definitions
- `routes.manifest.ts` - Route registration
- `assets.config.ts` - Asset path configuration

**Module Registration:**
```typescript
// modules.manifest.ts
export const MODULES: ModuleDefinition[] = [
  {
    id: 'sculpting',
    name: 'Sculpting',
    category: '3d',
    entryComponent: lazy(() => import('@/three-d/examples/sculpting')),
    requiredCapabilities: ['tauri', 'three', 'wgpu'],
    icon: Hammer,
    description: 'ZBrush-style digital sculpting'
  }
];
```

**Asset Configuration:**
```typescript
// assets.config.ts
export const ASSET_PATHS = {
  matcaps: '/matcaps',
  hdr: '/hdr',
  primitives: '/primitives'
};

// Usage
const matcapPath = `${ASSET_PATHS.matcaps}/MatCap_Grey.png`;
```

### 🔌 services/ - Universal Services

Services that work for both 2D and 3D:

**Files:**
- `BaseService.ts` - Base service class
- `fileSave.ts` - File save service
- `projectServices.ts` - Project management
- `kernelServices.ts` - Kernel services
- `kosPaths.ts` - Path utilities
- `pythonBridge.ts` - Python bridge
- `sketchfabService.ts` - Sketchfab integration
- `tauriClient.ts` - Tauri client utilities
- `thumbnailGenerator.ts` - Thumbnail generation

**Service Pattern:**
```typescript
import { BaseService } from '@/shared/services/BaseService';

export class MyService extends BaseService {
  async myMethod(param: string): Promise<Result> {
    return await this.invoke('my_command', { param });
  }
}

export const myService = new MyService();
```

### 🧩 systems/ - Universal Systems

Systems that work for both 2D and 3D:

#### layers/ - Layer Management System

Universal layer management for 2D and 3D:

**Files:**
- `LayerTypes.ts` - Layer type definitions
- `LayerManager.ts` - Layer management logic
- `useLayerManager.ts` - React hook
- `UniversalLayerPanel.tsx` - Universal layer panel UI

**Usage:**
```typescript
import { useLayerManager, UniversalLayerPanel } from '@/shared/systems/layers';

function MyApp() {
  const layerManager = useLayerManager();
  
  return (
    <UniversalLayerPanel
      manager={layerManager}
      onLayerSelect={(layer) => console.log(layer)}
    />
  );
}
```

#### brush/ - Brush System

Universal brush system with alpha support:

**Files:**
- `BrushTypes.ts` - Brush type definitions
- `AlphaBrush.ts` - Alpha brush implementation
- `ProceduralBrush.ts` - Procedural brush generation
- `AlphaPicker.tsx` - Alpha picker UI
- `KBrushEngine.ts` - Brush engine

**Usage:**
```typescript
import { AlphaPicker } from '@/shared/systems/brush';

function BrushPanel() {
  return (
    <AlphaPicker
      onAlphaChange={(alpha) => console.log(alpha)}
      onSaveAlpha={(alpha) => saveToLibrary(alpha)}
    />
  );
}
```

#### ipc/ - IPC System

Binary IPC for high-performance data transfer:

**Files:**
- `binaryIpc.ts` - Binary IPC utilities

**Usage:**
```typescript
import { binaryInvoke, bytesToFloat32 } from '@/shared/systems/ipc/binaryIpc';

const result = await binaryInvoke('my_command', { data });
const floats = bytesToFloat32(result);
```

#### content-browser/ - Content Browser

Universal content browser for assets:

**Files:**
- `KContentBrowser.tsx` - Content browser component
- `useContentBrowser.ts` - Content browser hook

## Import Rules

### ✅ Can Import
- Other `shared/` modules
- External libraries (React, Three.js, etc.)
- Type definitions from `types/`

### ❌ Cannot Import
- `two-d/examples/` - Feature-specific 2D code
- `three-d/examples/` - Feature-specific 3D code
- Feature-specific domain logic

## Best Practices

### 1. Keep It Universal

Components in `shared/` should work for both 2D and 3D:

```typescript
// ✅ Good - Universal
export function UniversalLayerPanel({ manager }: Props) {
  // Works for both 2D and 3D layers
}

// ❌ Bad - 3D-specific
export function LayerPanel({ mesh }: Props) {
  // Assumes Three.js mesh
}
```

### 2. Use Composition

Build complex UIs from primitives:

```typescript
import { Button, Slider, Dialog } from '@/shared/primitives';

export function MyPanel() {
  return (
    <Dialog>
      <Button>Click</Button>
      <Slider value={value} onChange={setValue} />
    </Dialog>
  );
}
```

### 3. Configuration Over Code

Use manifests for configuration:

```typescript
// ✅ Good - Manifest-driven
export const MODULES = [
  { id: 'my-module', entryComponent: lazy(() => import('./MyModule')) }
];

// ❌ Bad - Hardcoded
if (activeModule === 'my-module') {
  return <MyModule />;
}
```

### 4. Type Everything

Explicit types for all functions and components:

```typescript
interface MyComponentProps {
  value: number;
  onChange: (value: number) => void;
}

export const MyComponent: React.FC<MyComponentProps> = ({ value, onChange }) => {
  // Implementation
};
```

## Adding New Components

### Adding a New Primitive

```typescript
// shared/primitives/MyPrimitive.tsx
import { cn } from './cn';

interface MyPrimitiveProps {
  className?: string;
  // ... other props
}

export function MyPrimitive({ className, ...props }: MyPrimitiveProps) {
  return (
    <div className={cn('base-styles', className)} {...props}>
      {/* Implementation */}
    </div>
  );
}
```

### Adding a New System

```
shared/systems/my-system/
├── MySystemTypes.ts      # Type definitions
├── MySystem.ts           # Core logic
├── useMySystem.ts        # React hook
├── MySystemUI.tsx        # UI component
├── index.ts              # Exports
└── README.md             # Documentation
```

### Adding a New Service

```typescript
// shared/services/myService.ts
import { BaseService } from './BaseService';

export class MyService extends BaseService {
  async myMethod(param: string): Promise<Result> {
    return await this.invoke('my_command', { param });
  }
}

export const myService = new MyService();
```

## Testing

Test universal components with both 2D and 3D use cases:

```typescript
describe('UniversalLayerPanel', () => {
  it('should work with 2D layers', () => {
    const manager = create2DLayerManager();
    render(<UniversalLayerPanel manager={manager} />);
    // Test 2D behavior
  });

  it('should work with 3D layers', () => {
    const manager = create3DLayerManager();
    render(<UniversalLayerPanel manager={manager} />);
    // Test 3D behavior
  });
});
```

## Philosophy

The `shared/` directory embodies the principle: **Do it once, use 50 times.**

Every component here should be:
- **Universal**: Works for both 2D and 3D
- **Reusable**: Can be composed into larger components
- **Well-typed**: Explicit TypeScript types
- **Documented**: Clear interfaces and examples
- **Tested**: Property-based tests for universal behaviors

---

**This is the foundation that makes everything else possible!** 🏗️
