# TEMPLATE GUIDE
### For Humans and AI Agents — Complete Recipe Book

> **TL;DR for AI agents:** This is a React + Three.js + Rust/Tauri hybrid.  
> Features (apps/pages) live in `features/`. Modules are registered in `shared/config/modules.manifest.ts`.  
> Shaders live in `shaders/`. Shell components (AppShell, ShaderBackground, etc.) live in `shared/shell/`.  
> **Two critical files** must always stay in sync: `modules.manifest.ts` + `lib/hooks/useAppSettings.ts`.

---

## ARCHITECTURE OVERVIEW

```
src-frontend/
│
├── features/              ← YOUR APPS/PAGES LIVE HERE (one folder per feature)
│   ├── template/          ← 2D template (copy this for new 2D apps)
│   └── template3D/        ← 3D template (copy this for new 3D/Three.js apps)
│
├── shared/
│   ├── shell/             ← AppShell, AppTopBar, DockPanel, ShaderBackground, etc.
│   ├── primitives/        ← Button, Slider, Dialog, ButterSlider, etc.
│   ├── config/            ← modules.manifest.ts, routes.manifest.ts, assets.config.ts
│   └── theme/             ← topBarThemes.ts, appThemeConfig.ts
│
├── shaders/               ← GLSL shader library (import as strings, use anywhere)
│   ├── index.ts           ← barrel export — import everything from '@/shaders'
│   ├── noise.ts           ← GEN_FBM_FRAG, snoise, curl noise
│   ├── generators.ts      ← GEN_VORONOI_FRAG, GEN_NOISE_FRAG, nebula
│   ├── simulations.ts     ← Navier-Stokes, Lorenz attractor, Aizawa
│   ├── physics.ts         ← VELOCITY_FRAGMENT, black holes, galaxies, tornadoes
│   ├── terrain.ts         ← hydraulic erosion, thermal diffusion, seismic
│   ├── lighting.ts        ← PBR, neon cyberpunk, slope heatmap
│   └── filters.ts         ← brush alpha, masking, color manipulation
│
├── App.tsx                ← Root app — reads ALL_MODULES, renders active module
├── lib/hooks/
│   ├── useAppSettings.ts  ← activeModuleId default lives here ← CRITICAL
│   └── useKernelApp.ts    ← kernel state (assets, materials, alphas)
│
└── config/
    └── appConfig.ts       ← Re-exports MODULES as ALL_MODULES (legacy compat)
```

---

## CRITICAL RULES (Read before touching anything)

```
RULE 1: Every new feature must be registered in shared/config/modules.manifest.ts
RULE 2: The default module in lib/hooks/useAppSettings.ts must match a real module ID
RULE 3: ALL lazy() components MUST have a <Suspense> ancestor — App.tsx already has one
RULE 4: Shaders go in shaders/ — never inline GLSL strings in components
RULE 5: Reusable UI goes in shared/ — never in features/
RULE 6: Never hardcode colors, routes, or module IDs — use manifests and config
```

---

## RECIPE 1: Add a New Module (App / Page)

**5 steps, ~5 minutes.**

### Step 1 — Create the feature folder
```
features/
└── my-feature/
    ├── MyFeature.tsx          ← main component (required)
    ├── hooks/
    │   └── useMyEngine.ts     ← engine/state hook (optional)
    └── ui/
        ├── TopBar.tsx         ← app top bar (optional)
        ├── LeftPanel.tsx      ← left dock panel content (optional)
        └── RightPanel.tsx     ← right dock panel content (optional)
```

### Step 2 — Write the main component (copy from template)
```tsx
// features/my-feature/MyFeature.tsx
import React, { useState } from 'react';
import { AppShell } from '@/shared/shell/AppShell';
import { Box } from 'lucide-react';

export default function MyFeature() {
    return (
        <AppShell layoutKey="my-feature">
            <div className="w-full h-full flex items-center justify-center">
                {/* your main canvas / content here */}
            </div>
        </AppShell>
    );
}
```

### Step 3 — Register in modules.manifest.ts
```ts
// shared/config/modules.manifest.ts
import { lazy } from 'react';

export const MODULES: ModuleDefinition[] = [
  // ... existing modules ...
  {
    id: 'my-feature',            // ← unique ID, used everywhere
    name: 'MY FEATURE',          // ← display name
    category: '2d',              // ← '2d' | '3d' | 'shared'
    dimension: '2d',             // ← '2d' | '3d' | 'both'
    entryComponent: lazy(() => import('@/features/my-feature/MyFeature')),
    requiredCapabilities: [],    // ← [] | ['three'] | ['tauri'] | ['wgpu']
    description: 'What this does',
  },
];
```

### Step 4 — Set as default (optional)
```ts
// lib/hooks/useAppSettings.ts  ← line ~11
const [activeModuleId, setActiveModuleId] = useState<string>('my-feature');
```

### Step 5 — Done
The module will appear in the top bar automatically. No router config needed.

---

## RECIPE 2: Use a Shader as Background

### Quick version (ShaderBackground component)
```tsx
import { ShaderBackground } from '@/shared/shell/ShaderBackground';

// Inside any component's JSX:
<ShaderBackground
    colorA="#010012"   // dark anchor color
    colorB="#003388"   // highlight color
    scale={3.2}        // FBM spatial frequency
    speed={0.055}      // animation speed
>
    {/* any React UI here floats on top of the GPU shader */}
    <div className="glass-panel">Hello world</div>
</ShaderBackground>
```

### Custom shader version (raw Three.js)
```tsx
import { Canvas, useFrame } from '@react-three/fiber';
import { GEN_FBM_FRAG } from '@/shaders/noise';         // ← the shader, one import
import { SIM_NEBULA_FRAG } from '@/shaders/generators'; // ← or nebula
import { VELOCITY_FRAGMENT } from '@/shaders/physics';  // ← or particle physics
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

const VERT = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

function MyShaderPlane() {
    const uniforms = useMemo(() => ({
        uTime:   { value: 0 },
        uScale:  { value: 3.0 },
        uSeed:   { value: 9.31 },
        uColorA: { value: new THREE.Color('#010012') },
        uColorB: { value: new THREE.Color('#004488') },
    }), []);

    useFrame(({ clock }) => { uniforms.uTime.value = clock.elapsedTime * 0.06; });

    return (
        <mesh>
            <planeGeometry args={[2, 2]} />
            <shaderMaterial
                vertexShader={VERT}
                fragmentShader={GEN_FBM_FRAG}  // ← swap any shader here
                uniforms={uniforms}
            />
        </mesh>
    );
}

// Usage:
<Canvas orthographic camera={{ zoom: 1, position: [0, 0, 1] }}>
    <MyShaderPlane />
</Canvas>
```

### Available shaders (import from '@/shaders')
| Export | File | What it looks like |
|---|---|---|
| `GEN_FBM_FRAG` | noise.ts | Fractional Brownian Motion — flowing organic wisps |
| `GEN_NOISE_FRAG` | generators.ts | Raw simplex noise |
| `GEN_VORONOI_FRAG` | generators.ts | Crystal cell / Voronoi diagram |
| `SIM_NEBULA_FRAG` | generators.ts | Fluid nebula (needs ping-pong texture) |
| `VELOCITY_FRAGMENT` | physics.ts | GPU particle physics (black hole, galaxy, tornado modes) |
| `VORTEX_FRAG` | uncategorized.ts | Swirling vortex |
| `RIVULET_FRAG` | uncategorized.ts | Flowing fluid rivulets |
| `MAGMA_FRAG` | uncategorized.ts | Lava / magma flow |

---

## RECIPE 3: Add AppShell Panels

```tsx
import { AppShell } from '@/shared/shell/AppShell';
import { Layers, Box } from 'lucide-react';

<AppShell
    layoutKey="my-app"           // ← unique key for localStorage persistence

    topBar={<MyTopBar />}        // ← optional top bar component

    left={{
        title: 'Tools',
        tabs: [
            {
                id: 'tools',
                label: 'Tools',
                icon: Box,
                content: <MyToolPanel />,
            },
            {
                id: 'layers',
                label: 'Layers',
                icon: Layers,
                content: <MyLayerPanel />,
            },
        ],
        defaultTabId: 'tools',
        defaultSize: 20,    // % of total width
        minSize: 12,
        collapsedSize: 4,
    }}

    right={{
        title: 'Properties',
        tabs: [{ id: 'props', label: 'Props', icon: Box, content: <MyPropsPanel /> }],
        defaultTabId: 'props',
        defaultSize: 22,
        minSize: 15,
        collapsedSize: 4,
    }}

    // bottom panel also available:
    // bottom={{ ... }}
>
    {/* Main canvas / viewport — fills remaining space */}
    <div className="w-full h-full">
        {/* your content */}
    </div>
</AppShell>
```

---

## RECIPE 4: Add a Top Bar (AppTopBar)

```tsx
import { AppTopBar } from '@/shared/shell/AppTopBar';

// In a TopBar.tsx panel file:
export default function MyTopBar() {
    return (
        <AppTopBar appId="my-feature" themeId="obsidian">
            {/* Left slot */}
            <div>Logo / Title</div>

            {/* Center slot — tools, dropdowns, etc */}
            <div className="flex items-center gap-2">
                <Button>File</Button>
                <Button>Edit</Button>
            </div>

            {/* Right slot */}
            <div>Settings</div>
        </AppTopBar>
    );
}
```

### Available top bar themes (from shared/theme/topBarThemes.ts)
| ID | Description |
|---|---|
| `obsidian` | Dark matte black (default) |
| `glass` | Frosted glass / blur |
| `neon` | Bright green neon accents |
| `minimal` | Ultra-minimal, thin border |
| `cyber` | Electric cyan cyberpunk |
| `aurora` | Purple/teal gradient |

---

## RECIPE 5: Use Primitives

```tsx
import { Button } from '@/shared/primitives/Button';
import { Slider } from '@/shared/primitives/Slider';
import { ButterSlider } from '@/shared/primitives/ButterSlider';
import { Dialog, DialogContent, DialogTrigger } from '@/shared/primitives/Dialog';
import { DropdownMenu } from '@/shared/primitives/DropdownMenu';
import { ScrollArea } from '@/shared/primitives/ScrollArea';
import { ColorPopover } from '@/shared/primitives/ColorPopover';

// ButterSlider — premium snapping slider with label + formatted value
<ButterSlider
    label="Brush Size"
    value={brushSize}
    min={0} max={200}
    snapPoints={[1, 10, 50, 100, 200]}
    format={(v) => `${v}px`}
    tone="cyan"
    onChange={setBrushSize}
/>
```

---

## RECIPE 6: Engine Hook (useTemplateEngine pattern)

```ts
// features/my-feature/hooks/useMyEngine.ts
import { useRef, useEffect } from 'react';

export function useMyEngine() {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Initialize THREE.js, WebGL, WASM, etc.
        // containerRef.current is the mount point

        return () => {
            // Cleanup on unmount
        };
    }, []);

    return {
        containerRef,
        // expose engine state / methods here
    };
}
```

---

## GOTCHAS (Things that will break you)

### GOTCHA 1: Suspense — the most common crash
```
Error: A component suspended while responding to synchronous input.
```
**Cause:** A `lazy()` component rendered without a `<Suspense>` ancestor.  
**Status:** App.tsx already wraps ALL_MODULES in `<React.Suspense>` — you are safe as long as you register modules in the manifest (not render them directly).  
**If it happens anyway:** Wrap the specific lazy import in its own `<Suspense>`.

### GOTCHA 2: Default module must exist
```ts
// lib/hooks/useAppSettings.ts
const [activeModuleId, setActiveModuleId] = useState<string>('YOUR_MODULE_ID');
```
If this ID doesn't exist in `MODULES[]`, the app renders nothing — no error, just blank. Always update this when the default module changes.

### GOTCHA 3: AppShell needs a layoutKey
Every `<AppShell layoutKey="...">` must have a unique key. Without it, panels can collide in localStorage and restore incorrect sizes.

### GOTCHA 4: Shader uniforms must match the GLSL declarations
Each shader exports specific uniform names. Wrong names = silent visual glitch or black screen.  
Check the export at the top of each shader file for the uniform list.

### GOTCHA 5: Three.js Canvas doesn't need a WebViewport
`<WebViewport />` in App.tsx is a separate standalone engine instance. Don't nest a `<Canvas>` inside it — use your feature's own contained `<Canvas>` inside AppShell's children slot.

### GOTCHA 6: The WORKFLOW object in appConfig.ts
`appConfig.ts` exports `WORKFLOW` as a plain object (not array). `App.tsx` references it as `WORKFLOW[groupIndex]` assuming it was an array — this will be `undefined`. If you add workflow navigation logic, use `MODULES` directly instead of `WORKFLOW`.

---

## MODULE CAPABILITY SYSTEM

When registering a module, set `requiredCapabilities` to signal what the module needs:

```ts
requiredCapabilities: []              // Browser-only, no native deps
requiredCapabilities: ['three']       // Needs Three.js (always available in browser)
requiredCapabilities: ['tauri']       // Needs Tauri desktop runtime
requiredCapabilities: ['wgpu']        // Needs WGPU/Rust GPU compute
requiredCapabilities: ['python']      // Needs Python sidecar
requiredCapabilities: ['tauri', 'wgpu'] // Multiple
```

The capability check system (`shared/config/capabilities.manifest.ts`) can gate modules from loading if requirements aren't met. For website deployment, keep modules at `[]` or `['three']`.

---

## THEMING SYSTEM

Themes are applied per-app or globally via `shared/theme/appThemeConfig.ts`.

```ts
// Apply a theme to a specific app:
import { setAppTheme } from '@/shared/theme/appThemeConfig';
setAppTheme('my-feature', 'cyber');

// Available themes: 'classic' | 'glass' | 'neon' | 'minimal'
```

CSS variables exposed by ThemeProvider:
```css
var(--kos-surface-primary)    /* main background */
var(--kos-surface-secondary)  /* panel background */
var(--kos-text-primary)       /* primary text */
var(--kos-accent-primary)     /* active accent color */
var(--kos-accent-secondary)   /* secondary accent */
var(--kos-border)             /* panel borders */
```

---

## IMPORT ALIASES

```ts
'@/features/*'        →  src-frontend/features/*
'@/shared/*'          →  src-frontend/shared/*
'@/shaders'           →  src-frontend/shaders/index.ts  (all shaders)
'@/shaders/*'         →  src-frontend/shaders/*
'@/config/*'          →  src-frontend/config/*
'@/lib/*'             →  src-frontend/lib/*
'@/three-d/*'         →  src-frontend/three-d/*
'@/types/*'           →  src-frontend/types/*
```

---

## IMPORT BOUNDARY RULES

```
two-d/      ← CANNOT import Three.js, @react-three/fiber, or @react-three/drei
three-d/    ← CAN import Three.js stack
features/   ← CAN import anything (features are dimension-aware by convention)
shared/     ← CANNOT import from features/ (no circular deps)
shaders/    ← Pure GLSL strings only — no React, no Three.js imports
```

---

## COMPLETE EXAMPLE: New Feature in 5 Minutes

```
Goal: Add a "KQuantum"-style particle demo page called "Plasma"
```

**1. Create `features/plasma/Plasma.tsx`:**
```tsx
import React from 'react';
import { AppShell } from '@/shared/shell/AppShell';
import { ShaderBackground } from '@/shared/shell/ShaderBackground';

export default function Plasma() {
    return (
        <AppShell layoutKey="plasma">
            <div className="relative w-full h-full">
                <ShaderBackground colorA="#080002" colorB="#880022" scale={4} speed={0.04} />
            </div>
        </AppShell>
    );
}
```

**2. Add to `shared/config/modules.manifest.ts`:**
```ts
{
    id: 'plasma',
    name: 'PLASMA',
    category: '2d',
    dimension: '2d',
    entryComponent: lazy(() => import('@/features/plasma/Plasma')),
    requiredCapabilities: ['three'],
    description: 'GPU plasma simulation',
},
```

**3. Optionally set as default in `lib/hooks/useAppSettings.ts`:**
```ts
useState<string>('plasma')
```

**Done. 3 steps, ~10 lines of code.** The GPU shader is running, the AppShell chrome is in place, the module is switchable from the top bar.

---

## FILE CHECKLIST FOR NEW FEATURES

```
REQUIRED:
  ☐ features/my-feature/MyFeature.tsx           main component
  ☐ shared/config/modules.manifest.ts           module registration

OPTIONAL (but recommended):
  ☐ features/my-feature/hooks/useMyEngine.ts    engine hook
  ☐ features/my-feature/ui/TopBar.tsx           top bar
  ☐ features/my-feature/ui/LeftPanel.tsx        left panel content
  ☐ features/my-feature/ui/RightPanel.tsx       right panel content

NEVER:
  ✗ Hardcode colors outside theme config
  ✗ Inline GLSL strings — use @/shaders
  ✗ Put reusable components inside features/
  ✗ Import from features/ inside shared/
  ✗ Render lazy() without a Suspense ancestor
```

---

*This template was built to make AI-assisted development embarrassingly fast.  
A complete GPU-accelerated, panel-based, shader-powered app in ~10 lines and 5 minutes.*
