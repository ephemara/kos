# TEMPLATE FOLDER - PERFECT SCAFFOLDED APP STRUCTURE

This folder contains the **PERFECT** scaffolded structure for creating new apps.

## 🔥 COPY-PASTE FOR ANY PROJECT

This template is designed to be **completely generic** - NO "K" prefix or K_OS-specific naming.

Use this for:
- IDEs
- Photoshop clones
- Video editors
- Game engines (Unity/Unreal/Houdini clones)
- Node graph editors
- CAD software
- Anything with a 3D viewport

## 📁 Structure

```
template/
├── Template.tsx           # Main app component (uses AppShell)
├── ui/
│   ├── TopBar.tsx        # Tool selection, sliders, toggles, actions
│   ├── LeftPanel.tsx     # Tool picker & settings
│   └── RightPanel.tsx    # Layers & assets
├── hooks/
│   └── useTemplateEngine.ts  # THREE.js/Bevy initialization
└── engine/               # (Add your engine code here)
```

## 🎨 Uses ONLY Modular Components

- `@/ui/shell/*` - AppShell, AppTopBar, DockPanel
- `@/ui/layers/*` - UniversalLayerPanel
- `@/ui/primitives/*` - Button, Slider, etc.

**NO custom UI** - everything is reusable across apps.

## 🚀 How to Use

1. **Copy this folder**: `cp -r features/template features/my-new-app`
2. **Rename files**: `Template.tsx` → `MyNewApp.tsx`
3. **Update imports**: Change component names
4. **Replace viewport**: Add your THREE.js/Bevy canvas
5. **Add to config**: Register in `appConfig.ts`

## ⚡ Pattern Examples

### TopBar Pattern
- Tool toggle groups
- Undo/Redo buttons
- Sliders for brush/tool settings
- Action buttons (Save, Upload, etc.)

### LeftPanel Pattern
- App header with branding
- Tool grid/list selector
- Tool-specific controls
- Utility buttons

### RightPanel Pattern
- UniversalLayerPanel for hierarchy
- Asset tabs (Primitives, Library, etc.)
- Asset grid with hover states

### Engine Hook Pattern
- useRef for canvas container
- useEffect for init/cleanup
- Export engine state/methods

---

**KEY RULE**: When you copy this, **REMOVE ALL "K" PREFIXES** from component names. This template is designed to be 100% generic.
