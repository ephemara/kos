# K_OS NPM ARSENAL

> **FORMAT**: AI-optimized. Grouped by purpose. Quick reference for AI agents.
> **AGENTS**: Check here before reinventing wheels. Use these libs!

---

## QUICK REFERENCE

```text
TOTAL_DEPS: 235
LAST_UPDATED: 2026-03-04
THREE_ECOSYSTEM: 22 packages
RADIX_SUITE: 22 packages (COMPLETE)
DOCKING: 4 packages (rc-dock, flexlayout, dockview, react-resizable-panels)
UI_LIBRARIES: 3 suites (Mantine, Chakra, React Aria)
UTILITIES: 40+ packages (CVA, tailwind-merge, auto-animate)
```

---

## THREE.JS CORE

| Package | Import | Purpose | K_OS Apps |
|---------|--------|---------|-----------|
| `@react-three/fiber` | `import { Canvas } from '@react-three/fiber'` | React renderer for Three.js | ALL 3D apps |
| `@react-three/drei` | `import { OrbitControls, TransformControls, ... } from '@react-three/drei'` | 150+ Three.js helpers | ALL 3D apps |
| `@react-three/postprocessing` | `import { EffectComposer, Bloom, ... } from '@react-three/postprocessing'` | ✅ **Post-processing effects** | KSculpt, KPainter |
| `tunnel-rat` | `import { tunnel } from 'tunnel-rat'` | ✅ **Portal between React trees** | Cross-tree rendering |
| `three` | `import * as THREE from 'three'` | Core 3D library | ALL |
| `three-stdlib` | `import { ... } from 'three-stdlib'` | Community extensions | Shaders, loaders |
| `postprocessing` | Core for r3f/postprocessing | Required dependency | - |

---

## THREE.JS MATERIALS & SHADERS

| Package | Import | Purpose | K_OS Apps |
|---------|--------|---------|-----------|
| `three-custom-shader-material` | `import CustomShaderMaterial from 'three-custom-shader-material'` | Extend standard materials | KPainter, KGraphos |
| `lamina` | `import { LayerMaterial, ... } from 'lamina'` | Layer-based materials | Advanced materials |
| `n8ao` | `import { N8AOPass } from 'n8ao'` | Best SSAO for Three.js | Viewport AO |
| `meshline` | `import { MeshLineGeometry, MeshLineMaterial } from 'meshline'` | Fat/thick lines | Brush strokes, curves |
| `maath` | `import * as maath from 'maath'` | Math helpers for Three.js (easing, curves) | Shaders, animations |
| `leva` | `import { useControls } from 'leva'` | GUI controls for debugging | Dev/debug panels |

---

## THREE.JS RENDERING

| Package | Import | Purpose | K_OS Apps |
|---------|--------|---------|-----------|
| `three-mesh-bvh` | `import { MeshBVH } from 'three-mesh-bvh'` | Fast raycasting | KSculpt, picking |
| `three-bvh-csg` | `import { ADDITION, Brush } from 'three-bvh-csg'` | Boolean operations | KGreeble |
| `three-gpu-pathtracer` | `import { PathTracingRenderer } from 'three-gpu-pathtracer'` | Ray tracing | Preview renders |
| `three-perf` | `import { Perf } from 'three-perf'` | Performance stats | Debug |
| `stats-gl` | `import Stats from 'stats-gl'` | WebGL performance | Debug |
| `stats.js` | `import Stats from 'stats.js'` | FPS/memory stats | Debug |
| `@types/stats.js` | Types for stats.js | TypeScript types | Dev |
| `detect-gpu` | `import { getGPUTier } from 'detect-gpu'` | GPU detection | Adaptive quality |

---

## THREE.JS TEXT & UI

| Package | Import | Purpose | K_OS Apps |
|---------|--------|---------|-----------|
| `troika-three-text` | `import { Text } from 'troika-three-text'` | SDF text rendering | 3D labels |
| `three-spritetext` | `import SpriteText from 'three-spritetext'` | Sprite-based text | Floating labels |
| `@react-three/a11y` | `import { A11y } from '@react-three/a11y'` | Accessibility | Screen readers |

---

## THREE.JS CAMERA & CONTROLS

| Package | Import | Purpose | K_OS Apps |
|---------|--------|---------|-----------|
| `camera-controls` | `import CameraControls from 'camera-controls'` | Advanced camera | Dolly, truck, fit |

---

## THREE.JS LOADING & FORMATS

| Package | Import | Purpose | K_OS Apps |
|---------|--------|---------|-----------|
| `@gltf-transform/core` | `import { Document } from '@gltf-transform/core'` | GLTF manipulation | Export/import |
| `draco3d` | Mesh compression | Smaller files | - |
| `xatlas-three` | UV unwrapping | KAtlas | |
| `xatlasjs` | Base xatlas | KAtlas | |

---

## DOCKING & LAYOUT MANAGEMENT

> **USE THESE FOR WINDOW/PANEL SYSTEMS. STOP WRITING CUSTOM DOCKING CODE.**

| Package | Import | Purpose | Best For |
|---------|--------|---------|----------|
| `rc-dock` | `import { DockLayout } from 'rc-dock'` | Modern docking system | Desktop-style docking |
| `flexlayout-react` | `import { Layout, Model } from 'flexlayout-react'` | Tabs, grids, splitters, popouts | Complex layouts |
| `dockview-react` | `import { DockviewReact } from 'dockview-react'` | Zero-dependency layout manager | Lightweight docking |
| `react-resizable-panels` | `import { PanelGroup, Panel } from 'react-resizable-panels'` | Resizable panel groups | ✅ **Already using** |

### Quick Reference

```tsx
// rc-dock - Full docking system
import { DockLayout } from 'rc-dock';
const layout = {
  dockbox: {
    mode: 'horizontal',
    children: [{ tabs: [...] }]
  }
};

// flexlayout - Tabs + popouts
import { Layout, Model } from 'flexlayout-react';
const model = Model.fromJson(json);

// react-resizable-panels - Simple splits
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
<PanelGroup direction="horizontal">
  <Panel defaultSize={30}>Sidebar</Panel>
  <PanelResizeHandle />
  <Panel>Content</Panel>
</PanelGroup>
```

---

## UI COMPONENT LIBRARIES

> **NEW ADDITIONS for complex components. Use alongside Radix for primitives.**

| Package | Import | Purpose | When to Use |
|---------|--------|---------|-------------|
| `@mantine/core` | `import { Button, TextInput } from '@mantine/core'` | 100+ components | Rich forms, data tables |
| `@mantine/hooks` | `import { useHotkeys } from '@mantine/hooks'` | Utility hooks | Custom functionality |
| `@chakra-ui/react` | `import { Button, Box } from '@chakra-ui/react'` | Themeable components | Design system |
| `react-aria` | `import { useButton } from 'react-aria'` | Headless primitives | Unstyled, full control |

### Mantine Quick Reference

```tsx
import { MantineProvider, Button, TextInput, Table } from '@mantine/core';

// Wrap app
<MantineProvider>
  <App />
</MantineProvider>

// Use components
<TextInput label="Name" required />
<Button variant="gradient">Submit</Button>
```

### Chakra Quick Reference

```tsx
import { ChakraProvider, Button, useColorMode } from '@chakra-ui/react';

<ChakraProvider>
  <Button colorScheme="blue">Click me</Button>
</ChakraProvider>
```

---

## RADIX UI (COMPLETE SUITE)

> **USE THIS FOR ALL UI COMPONENTS. DO NOT BUILD FROM SCRATCH.**

| Package | Import | Purpose |
|---------|--------|---------|
| `@radix-ui/react-accordion` | `import * as Accordion` | Collapsible panels |
| `@radix-ui/react-alert-dialog` | `import * as AlertDialog` | Critical confirmations (Delete) |
| `@radix-ui/react-aspect-ratio` | `import * as AspectRatio` | Thumbnails, previews |
| `@radix-ui/react-avatar` | `import * as Avatar` | User profiles, icons |
| `@radix-ui/react-checkbox` | `import * as Checkbox` | Settings toggles |
| `@radix-ui/react-collapsible` | `import * as Collapsible` | Sidebars, sections |
| `@radix-ui/react-context-menu` | `import * as ContextMenu` | Right-click menus |
| `@radix-ui/react-dialog` | `import * as Dialog` | Modals, settings |
| `@radix-ui/react-dropdown-menu` | `import * as DropdownMenu` | Top bar menus |
| `@radix-ui/react-hover-card` | `import * as HoverCard` | Rich tooltips/previews |
| `@radix-ui/react-label` | `import * as Label` | Accessible labels |
| `@radix-ui/react-menubar` | `import * as Menubar` | Desktop-style app menus |
| `@radix-ui/react-navigation-menu` | `import * as NavigationMenu` | Mega-menus |
| `@radix-ui/react-popover` | `import * as Popover` | Color pickers, small inputs |
| `@radix-ui/react-progress` | `import * as Progress` | Loading, baking status |
| `@radix-ui/react-radio-group` | `import * as RadioGroup` | Exclusive mode selection |
| `@radix-ui/react-scroll-area` | `import * as ScrollArea` | Custom scrollbars |
| `@radix-ui/react-select` | `import * as Select` | Dropdowns |
| `@radix-ui/react-separator` | `import * as Separator` | Visual dividers |
| `@radix-ui/react-slider` | `import * as Slider` | Brush size, opacity, params |
| `@radix-ui/react-slot` | `import { Slot } from` | Comp composition (Button as Child) |
| `@radix-ui/react-switch` | `import * as Switch` | On/Off toggles |
| `@radix-ui/react-tabs` | `import * as Tabs` | Panel switching |
| `@radix-ui/react-toggle` | `import * as Toggle` | Single toggle buttons |
| `@radix-ui/react-toggle-group` | `import * as ToggleGroup` | Tool groups (Grab/Brush/Mask) |
| `@radix-ui/react-toolbar` | `import * as Toolbar` | Toolbars |
| `@radix-ui/react-tooltip` | `import * as Tooltip` | Button hints |
| `@radix-ui/react-visually-hidden` | `import * as VisuallyHidden` | A11y text |

---

## SHADCN / STYLE UTILITIES

> **PATTERN**: Use `cva` for variants, `cn()` helper with `clsx` + `tailwind-merge`.

| Package | Import | Purpose |
|---------|--------|---------|
| `class-variance-authority` | `import { cva } from 'class-variance-authority'` | Component variants |
| `clsx` | `import { clsx } from 'clsx'` | Conditional classes |
| `tailwind-merge` | `import { twMerge } from 'tailwind-merge'` | Merge tailwind classes safely |
| `@formkit/auto-animate` | `import { useAutoAnimate } from '@formkit/auto-animate/react'` | One-line list animations |
| `react-wrap-balancer` | `import Balancer from 'react-wrap-balancer'` | Beautiful text wrapping |

---

## UI / ANIMATION / INTERACTION

| Package | Import | Purpose | K_OS Apps |
|---------|--------|---------|-----------|
| `framer-motion` | `import { motion } from 'framer-motion'` | Complex animations | ALL UI |
| `gsap` | `import gsap from 'gsap'` | Timeline animation | Camera, mesh anims |
| `sonner` | `import { toast } from 'sonner'` | Toast notifications | User feedback |
| `react-colorful` | `import { HexColorPicker } from 'react-colorful'` | Color picker | KPainter, materials |
| `react-resizable-panels` | `import { PanelGroup } from 'react-resizable-panels'` | Layout shell | Unified Shell |
| `react-dropzone` | `import { useDropzone } from 'react-dropzone'` | File drag & drop | Import |
| `cmdk` | `import { Command } from 'cmdk'` | Command palette | Ctrl+K menu |
| `lucide-react` | `import { Icon } from 'lucide-react'` | Icons | ALL UI |
| `embla-carousel-react` | `useEmblaCarousel` | Carousels | Textures/Presets |
| `react-spinners` | `import { BeatLoader } from 'react-spinners'` | Loading states | Async waits |
| `@floating-ui/react` | `useFloating` | Component positioning | Custom popups |
| `react-zoom-pan-pinch` | `import { TransformWrapper } from 'react-zoom-pan-pinch'` | Pan/zoom viewer | Image preview |
| `react-image-crop` | `import ReactCrop from 'react-image-crop'` | Image cropping | Texture editing |
| `react-error-boundary` | `import { ErrorBoundary } from 'react-error-boundary'` | Error handling | Error UI |
| `react-aria-components` | `import { ... } from 'react-aria-components'` | Accessible components | A11y |
| `react-dom` | `import ReactDOM from 'react-dom'` | React rendering | Core |

---

## INPUT / GESTURES / HOTKEYS

| Package | Import | Purpose | K_OS Apps |
|---------|--------|---------|-----------|
| `@use-gesture/react` | `import { useDrag, useGesture } from '@use-gesture/react'` | ✅ **Touch/mouse gestures** | Tablet UI, KPainter |
| `use-gesture` | `import { useGesture } from 'use-gesture'` | Advanced gesture detection | Drag, pinch, scroll |
| `react-hotkeys-hook` | `import { useHotkeys } from 'react-hotkeys-hook'` | React hotkeys | Component hotkeys |
| `perfect-freehand` | `import { getStroke } from 'perfect-freehand'` | Smooth brush strokes | KPainter |
| `hotkeys-js` | - | Core lib for hook | - |

---

## NODE EDITOR (K-GRAPHOS)

| Package | Import | Purpose | K_OS Apps |
|---------|--------|---------|-----------|
| `@xyflow/react` | `import { ReactFlow } from '@xyflow/react'` | Node-based editor | KGraphos shader nodes |
| `elkjs` | `import ELK from 'elkjs'` | Auto-layout nodes | KGraphos |

---

## STATE / DATA / UTILS

| Package | Import | Purpose | K_OS Apps |
|---------|--------|---------|--------------|
| `zustand` | `import { create } from 'zustand'` | ✅ **Lightweight state store** | ALL |
| `@tanstack/react-query` | `import { useQuery } from '@tanstack/react-query'` | Server state management | API calls, cache |
| `jotai` | `import { useAtom } from 'jotai'` | Atomic state | Components |
| `immer` | `import { produce } from 'immer'` | Immutable updates | Undo/redo |
| `use-immer` | `import { useImmer } from 'use-immer'` | React + immer | State with history |
| `nuqs` | `import { useQueryState } from 'nuqs'` | URL state sync | Shareable links |
| `localforage` | `import localforage from 'localforage'` | Async storage | Large data |
| `idb-keyval` | `import { set } from 'idb-keyval'` | Simple IDB | Prefs |
| `comlink` | `import * as Comlink from 'comlink'` | Web Worker RPC | Heavy compute |
| `p-queue` | `import PQueue from 'p-queue'` | Queue promises | Rate limiting |
| `mitt` | `import mitt from 'mitt'` | Event emitter | Pub/sub |
| `uuid` | `import { v4 as uuidv4 } from 'uuid'` | Unique IDs | Entity IDs |
| `jszip` | `import JSZip from 'jszip'` | ZIP files | Export bundles |
| `lodash-es` | `import { debounce } from 'lodash-es'` | Utils | Perf |
| `date-fns` | `import { format } from 'date-fns'` | Date formatting | History/Exports |
| `react-use` | `import { useDebounce, ... } from 'react-use'` | React utility hooks | ALL |
| `usehooks-ts` | `import { useLocalStorage } from 'usehooks-ts'` | TypeScript React hooks | ALL |
| `@uidotdev/usehooks` | `import { useMeasure } from '@uidotdev/usehooks'` | Modern React hooks | ALL |

### TanStack Query Quick Reference

```tsx
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';

// Setup
const queryClient = new QueryClient();
<QueryClientProvider client={queryClient}>
  <App />
</QueryClientProvider>

// Use
const { data, isLoading } = useQuery({
  queryKey: ['materials'],
  queryFn: () => invoke('get_materials')
});
```

---

## FORMS & VALIDATION

| Package | Import | Purpose | K_OS Apps |
|---------|--------|---------|-----------|
| `react-hook-form` | `import { useForm } from 'react-hook-form'` | Form handling | Settings |
| `zod` | `import { z } from 'zod'` | Schema validation | Type-safe forms |
| `@hookform/resolvers` | `import { zodResolver } from ...` | Zod + RHF | Validation glue |
| `react-day-picker` | `import { DayPicker } from 'react-day-picker'` | Date picker | Calendar |
| `input-otp` | `import { OTPInput } from 'input-otp'` | OTP/Pin input | Auth/Lock |

---

## TABLES & VIRTUALIZATION

| Package | Import | Purpose | K_OS Apps |
|---------|--------|---------|-----------|
| `@tanstack/react-table` | `import { useReactTable } from '@tanstack/react-table'` | Headless tables | Data views |
| `@tanstack/react-virtual` | `import { useVirtualizer } from '@tanstack/react-virtual'` | Virtualized lists | Large lists |

---

## DRAG & DROP

| Package | Import | Purpose | K_OS Apps |
|---------|--------|---------|-----------|
| `@dnd-kit/core` | `import { DndContext } from '@dnd-kit/core'` | Drag & drop | Layer reorder |
| `@dnd-kit/sortable` | `import { SortableContext } from ...` | Sortable lists | Layer panel |
| `@dnd-kit/utilities` | `import { CSS } from ...` | DnD helpers | Transform styles |
| `react-grid-layout` | `import GridLayout from 'react-grid-layout'` | Draggable tiles | Custom layouts |
| `vaul` | `import { Drawer } from 'vaul'` | Mobile drawers | Bottom sheets |

---

## AI / EXTERNAL

| Package | Import | Purpose | K_OS Apps |
|---------|--------|---------|-----------|
| `@google/genai` | `import { GoogleGenAI } from '@google/genai'` | Gemini AI | AI features |
| `@tauri-apps/api` | `import { invoke } from '@tauri-apps/api/core'` | Rust backend IPC | ALL |
| `@tauri-apps/plugin-dialog` | `import { save, open } from '@tauri-apps/plugin-dialog'` | Native OS file dialogs (Save As / Open File). Used by export pipeline — call `save()` to get a native save path, then `invoke('write_file', ...)` to write. Requires `dialog:allow-save` + `dialog:allow-open` in capabilities/default.json | KInspect, any export feature |

---

## RICH CONTENT

| Package | Import | Purpose | K_OS Apps |
|---------|--------|---------|-----------|
| `@tiptap/react` | `import { useEditor } from '@tiptap/react'` | Rich text editor | Notes, docs |
| `@tiptap/starter-kit` | `import StarterKit from '@tiptap/starter-kit'` | TipTap essentials | Notes, docs |
| `@tiptap/extension-placeholder` | `import Placeholder from '@tiptap/extension-placeholder'` | Placeholder text | Notes, docs |
| `react-markdown` | `import ReactMarkdown from 'react-markdown'` | Markdown render | Help docs |
| `prism-react-renderer` | `import { Highlight } from ...` | Code highlighting | Shader preview |

---

## NOTES FOR AI AGENTS

1. **ALWAYS check NPM_ARSENAL.md first.**
2. **DOCKING**: Use rc-dock, flexlayout, or dockview. NEVER write custom docking.
3. **UI COMPONENTS**:
   - Primitives: Radix UI + Tailwind
   - Complex components: Mantine or Chakra
   - Unstyled: react-aria
4. **STYLE UTILS**: Use `cn()` pattern (`clsx` + `tailwind-merge`) for class props.
5. **ANIMATION**: `framer-motion` for UI, `gsap` for timeline/3D.
6. **STATE**:
   - Client state: `zustand` (store), `jotai` (atomic)
   - Server state: `@tanstack/react-query`
   - URL state: `nuqs`
7. **FORMS**: `react-hook-form` + `zod` (NOT Formik).
8. **LAYOUT**: `react-resizable-panels` for app shell.
9. **ICONS**: `lucide-react` only.
10. **GESTURES**: `use-gesture` for advanced drag/pinch/scroll.
11. **NOTIFICATIONS**: `sonner` for toasts.
12. **COMMAND PALETTE**: `cmdk` for Ctrl+K menus.