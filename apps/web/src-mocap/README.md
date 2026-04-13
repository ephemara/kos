# Frontend - Universal Desktop Application Templates

## Overview

This is the frontend for the **Universal Desktop Application Templates** - a production-ready starter codebase designed for building high-performance desktop applications with AI coding assistants.

The frontend is organized with a clean 2D/3D separation, making it easy to build canvas apps, 3D modeling tools, or full-stack applications.

## Directory Structure

```
src-frontend/
├── shared/          # Universal components (2D + 3D)
├── two-d/           # 2D-specific code
├── three-d/         # 3D-specific code
├── shaders/         # Shader library (70+ shaders)
├── features/        # Starter templates + special features
├── engine/          # Runtime abstraction (Tauri/WASM)
├── input/           # Input handling
├── notifications/   # Toast system
├── error/           # Error boundaries
├── lib/             # Shared utilities
├── types/           # Type definitions
└── components/      # Root components
```

## Quick Start

### Development

```bash
# Install dependencies
npm install --legacy-peer-deps

# Start dev server (with WASM rebuild)
npm run dev:web

# Start dev server (frontend only)
npm run dev

# Start Tauri desktop app
npm run tauri:dev
```

### Building

```bash
# Build WASM module
npm run wasm:build

# Build for production
npm run build:web

# Build Tauri desktop app
npm run tauri:build
```

## Core Directories

### 📦 shared/ - Universal Components

Components that work for both 2D and 3D applications:

- **shell/**: AppShell, AppMenuBar, AppTopBar, docking system
- **primitives/**: Button, Slider, Dialog, Popover, widgets
- **theme/**: Theme system with CSS variables
- **state/**: Global stores (Zustand/Jotai), event bus
- **protocol/**: Generated TypeScript types from Rust
- **config/**: Manifests (modules, routes, capabilities, assets)
- **services/**: Universal services (file save, projects, etc.)
- **systems/**: Universal systems (layers, brush, IPC, content browser)

[Read more →](./shared/README.md)

### 🎨 two-d/ - 2D Applications

Everything related to 2D canvas, painting, and image editing:

- **services/**: 2D-specific services
- **systems/**: 2D systems (brush-2d, layers-2d)
- **examples/**: 2D example apps (Graphos - digital painting)

**Import Rule**: Cannot import Three.js or 3D systems

[Read more →](./two-d/README.md)

### 🎮 three-d/ - 3D Applications

Everything related to 3D rendering, modeling, and DCC tools:

- **services/**: 3D services (sculpt, mesh, UV, PBR, raycast)
- **systems/**: 3D systems (three, materials, masking, terrain, baking)
- **examples/**: 3D examples (paint, sculpting, inspect, atlas, etc.)

**Import Rule**: Can import shared/ and three-d/, but not two-d/

[Read more →](./three-d/README.md)

### ✨ shaders/ - Shader Library

World-class collection of 70+ production-ready shaders:

- **noise.ts**: 12 noise shaders (Perlin, Simplex, Worley, etc.)
- **filters.ts**: 10 filter shaders (blur, sharpen, edge detection)
- **physics.ts**: 8 physics shaders (Navier-Stokes, fluid dynamics)
- **math.ts**: 10 math utilities
- **color.ts**: 8 color utilities
- **simulations.ts**: 4 simulation shaders
- **generators.ts**: 3 generator shaders
- **terrain.ts**: 2 terrain shaders (hydraulic erosion, thermal)
- **lighting.ts**: 1 lighting shader
- **uncategorized.ts**: 12 misc shaders

[Read more →](./shaders/README.md)

### 🚀 features/ - Starter Templates

Main stage for starter templates and special features:

- **template/**: 2D starter template (STAYS HERE!)
- **template3D/**: 3D starter template (STAYS HERE!)
- **external-app/**: External app tether (THE SECRET SAUCE!)
- **console/**: Console panel
- **notifications/**: GPU doctor listener

**The templates stay in features/ because they're the main stage!**

[Read more →](./features/README.md)

### ⚙️ engine/ - Runtime Abstraction

Platform-agnostic engine interface:

- **tauri/**: Desktop implementation (full GPU access)
- **wasm/**: Web implementation (WebGPU)
- **external/**: External engine tethering

[Read more →](./engine/README.md)

## Architecture Patterns

### Import Paths

Always use the `@/` alias for imports:

```typescript
// ✅ Correct
import { AppShell } from '@/shared/shell';
import { sculptService } from '@/three-d/services/sculptClient';

// ❌ Wrong
import { AppShell } from '../../../shared/shell';
```

### Service Layer Pattern

All Tauri backend calls go through typed service wrappers:

```typescript
// services/sculptClient.ts
export class SculptService extends BaseService {
  async stroke(handle: number, points: Float32Array): Promise<void> {
    return await this.invoke('app_sculpt_stroke', { handle, points });
  }
}

export const sculptService = new SculptService();
```

### Module Registration

Modules are registered via manifest, not hardcoded imports:

```typescript
// shared/config/modules.manifest.ts
export const MODULES: ModuleDefinition[] = [
  {
    id: 'template3d',
    name: 'Template 3D',
    category: '3d',
    entryComponent: lazy(() => import('@/three-d/template')),
    requiredCapabilities: ['tauri', 'three']
  }
];
```

## Import Boundaries (Enforced)

### 2D Boundary
Files in `two-d/` **CANNOT** import:
- `three`
- `@react-three/fiber`
- `@react-three/drei`
- Any Three.js-related packages

### Core Boundary
Files in `shared/` **CANNOT** import:
- `two-d/examples/`
- `three-d/examples/`
- Feature-specific code

### System Boundary
Files in `systems/` **CANNOT** import:
- `examples/` directories
- Feature-specific domain logic

**Enforcement**: Build-time script checks all imports and fails on violations

Run manually: `npm run check:boundaries`

## Tech Stack

### Frontend
- **React 18** + **TypeScript** (ES2022)
- **Three.js** via @react-three/fiber (3D rendering)
- **Vite** (dev server + build tool)
- **Tailwind CSS** + **Radix UI** + **Mantine** (UI framework)
- **Framer Motion** (animations)
- **Zustand** + **Jotai** (state management)

### Backend (Rust)
- **Rust** (stable, compiled to WASM via wasm-pack)
- **wgpu** → WebGPU (GPU compute)
- **nalgebra** (linear algebra)
- **parry3d** (collision/raycasting)
- **Tauri 2.x** (desktop runtime)

## Key Features

### 🎯 GPU-Accelerated Backend
Production-grade Rust + WGPU compute primitives:
- Spatial grids, SVT (sparse virtual texturing), atlas packing
- GPU raycasting, sculpting, subdivision, remeshing
- PBR generation, procedural textures

### 🎨 Premium UI Shell
Professional desktop application shell:
- Docking panels with drag-and-drop
- Theme system with CSS variables
- Command palette (Ctrl+K)
- Smooth animations and micro-interactions

### 🔧 Universal Systems
Extracted from production features:
- Layer management (2D and 3D)
- Smart masking (curvature, height, slope)
- GPU terrain simulation
- LCSM UV solving and packing
- Advanced Three.js utilities
- Real-time baking systems

### 🚀 External App Tether (SECRET SAUCE!)
Bootstrap ANY external application (Bevy, Unity, Godot, etc.) to React:
- Window positioning sync
- Visibility management
- Click-through mode
- Debug panel support

[Read more →](./features/external-app/README.md)

## Development Workflow

### Adding a New 2D Feature

```
src-frontend/two-d/examples/photo-editor/
├── PhotoEditor.tsx        # Main component
├── services/              # 2D-specific services
├── hooks/                 # Custom hooks
└── ui/                    # UI components
```

### Adding a New 3D Feature

```
src-frontend/three-d/examples/voxel-editor/
├── VoxelEditor.tsx        # Main component
├── services/              # 3D-specific services
├── scene/                 # Three.js scene setup
└── ui/                    # UI components
```

### Adding a Universal System

```
src-frontend/shared/systems/animation/
├── AnimationSystem.ts     # Core system
├── AnimationTypes.ts      # Type definitions
├── useAnimation.ts        # React hook
└── README.md              # Documentation
```

## Testing

```bash
# Run all tests
npm test

# Run property-based tests
npm run test:properties

# Run unit tests
npm run test:unit

# Check import boundaries
npm run check:boundaries
```

## Performance Optimization

### Development
- Vite HMR for instant updates
- WASM cached between rebuilds
- Lazy module loading
- GPU compute on separate thread

### Production
- Tree shaking removes unused code
- Minification + compression
- Code splitting by route
- Shader compilation caching

## Contributing

1. Follow the existing patterns
2. Use manifests for configuration
3. Respect import boundaries
4. Type everything
5. Document interfaces
6. Test properties
7. Compose, don't duplicate

## Documentation

Each major directory has its own README:

- [shared/README.md](./shared/README.md) - Universal components
- [two-d/README.md](./two-d/README.md) - 2D structure
- [three-d/README.md](./three-d/README.md) - 3D structure
- [shaders/README.md](./shaders/README.md) - Shader library
- [features/README.md](./features/README.md) - Templates and features
- [engine/README.md](./engine/README.md) - Runtime abstraction

## Philosophy

**Make the codebase so clear that AI agents can understand and extend it confidently.**

Every decision about structure, naming, and organization is made with AI comprehension in mind. The goal is to create the perfect context window for AI-assisted development.

---

**Ready to build something incredible?** Start with a template and let AI help you extend it! 🚀
