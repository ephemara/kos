# Master Integration Plan - ZenPainter + ZenSample
**Created**: 2026-02-24
**Purpose**: Complete integration roadmap
**Status**: Ready for implementation

## Phase 1: Project Setup (1 hour)

### 1.1 Create Feature Structure
\\\
features/substance-clone/
├── SubstanceClone.tsx
├── SubstanceContext.tsx
├── painter/ (from backup/paint/)
├── sampler/ (from backup/autopbr/)
├── shared/
└── data/
\\\

### 1.2 Register Module
\\\	ypescript
// shared/config/modules.manifest.ts
{
  id: 'substance-clone',
  name: 'SUBSTANCE CLONE',
  category: '3d',
  entryComponent: lazy(() => import('@/features/substance-clone/SubstanceClone')),
  requiredCapabilities: ['tauri', 'three', 'wgpu']
}
\\\

## Phase 2: ZenPainter Integration (4-5 hours)

### 2.1 Core Engine
- Copy PaintSystem.ts (944 lines) → painter/engine/
- Copy PaintShaders.ts (576 lines) → painter/engine/
- Copy MaskSystem.ts (143 lines) → painter/engine/
- Copy meshUtils.ts (320 lines) → painter/engine/

### 2.2 UI Components
- Copy KPainter.tsx → PainterMode.tsx
- Copy all UI components from backup/paint/ui/
- Integrate UniversalLayerPanel from @/three-d/systems/layers-3d/

### 2.3 Backend Integration
- SVT PBR Client: @/three-d/systems/svt/svtPbrClient
- Rust Raycast: @/three-d/services/raycastClient
- Brush Client: @/three-d/services/brushClient

## Phase 3: ZenSample Integration (4-5 hours)

### 3.1 Core Engine
- Copy KAutopbrEngine.tsx → sampler/engine/
- Copy KAutopbrHDR.tsx → sampler/engine/
- Copy KAutopbrHDREncoder.ts → sampler/engine/

### 3.2 UI Components
- Copy KAutopbr.tsx → SamplerMode.tsx
- Copy all UI components from backup/autopbr/ui/
- Integrate material presets from KAutopbrpresets.tsx

### 3.3 Backend Integration
- GPU PBR Pipeline: @/three-d/services/pbrClient
- Procedural Generators: @/two-d/services/proceduralClient
- Python Bridge: @/shared/services/pythonBridge

## Phase 4: Shared Systems (2-3 hours)

### 4.1 Material Preview
- Real-time PBR sphere/plane preview
- HDR environment lighting
- Material parameter controls

### 4.2 Texture Export
- Export all PBR channels
- Multiple format support (PNG, TGA, EXR)
- Resolution options

### 4.3 Mode Switching
- Seamless transition between painter and sampler
- Preserve material state across modes
- Shared texture library

## Phase 5: Testing & Polish (1-2 hours)

### 5.1 Feature Testing
- [ ] Paint with all brush types
- [ ] Test all PBR channels
- [ ] Test layer system
- [ ] Test smart masks
- [ ] Test fluid effects
- [ ] Generate PBR materials
- [ ] Apply presets
- [ ] Export textures

### 5.2 Performance Validation
- [ ] 60fps painting at 2048x2048
- [ ] <100ms PBR generation (4K)
- [ ] Smooth stroke interpolation
- [ ] No GC pauses

## Critical Integration Points

### Backend Services Required

1. **SVT PBR Client** (Primary Painting)
   - Location: src-frontend/three-d/systems/svt/
   - Status: ✅ Already implemented
   - Usage: Multi-channel texture painting

2. **GPU PBR Pipeline** (Material Generation)
   - Location: crates/k-os-gpu-pipeline/src/pipelines/pbr.rs
   - Status: ✅ Already implemented
   - Usage: Generate all 8 PBR maps from photos

3. **Rust Raycast** (UV Resolution)
   - Location: src-frontend/three-d/services/raycastClient.ts
   - Status: ✅ Already implemented
   - Usage: Mouse → UV coordinate resolution

4. **Brush System** (Alpha Maps)
   - Location: crates/k-os-brushes/src/ and crates/k-os-gpu-pipeline/src/brush/
   - Status: ✅ Already implemented
   - Usage: Universal brush/alpha infrastructure

### Frontend Systems Required

1. **Paint Engine** (Core Painting)
   - Location: backup/paint/engine/PaintSystem.ts
   - Status: ✅ Production-ready
   - Lines: 944 lines

2. **Mask System** (Smart Masking)
   - Location: backup/paint/engine/MaskSystem.ts
   - Status: ✅ Production-ready
   - Lines: 143 lines

3. **Layer System** (Non-destructive Editing)
   - Location: src-frontend/three-d/systems/layers-3d/
   - Status: ✅ Already implemented
   - Usage: Universal layer panel

4. **Shader Library** (70+ Shaders)
   - Location: src-frontend/shaders/
   - Status: ✅ Complete inventory
   - Usage: Brush, fluid, effects, filters

## Data Flow

### ZenPainter Painting Pipeline
\\\
User Input → usePaintInput → Rust Raycast → UV Coordinate
    ↓
Brush System → Alpha Map → Dynamics
    ↓
Mask System → Smart Masks → Global Mask
    ↓
Paint Engine → PaintSystem.ts → Shader Rendering
    ↓
SVT PBR Client → GPU Compute → Multi-channel Paint
    ↓
Layer Compositing → Final Output → Material Update
\\\

### ZenSample Generation Pipeline
\\\
Photo Upload → processImage() → Color Grading
    ↓
Decal Projection → Scatter Decals
    ↓
GPU PBR Pipeline → Generate 8 Maps (50x faster!)
    ↓
Material Preview → Three.js PBR → Real-time Update
    ↓
Export → Download All Maps → Save to Library
\\\

## Performance Targets

| Operation | Target | Notes |
|-----------|--------|-------|
| Paint stroke | <2ms | 16K texture, SVT |
| PBR generation | <100ms | 4K texture, all 8 maps |
| Raycast | <0.5ms | 1M triangle mesh |
| Layer composite | <5ms | All 5 channels |
| Fluid step | <10ms | 512x512 resolution |
| Export texture | <500ms | 4K PNG encode |

## Success Criteria

✅ Painter mode fully functional (paint, layers, masks, export)
✅ Sampler mode fully functional (material gen, presets, HDR)
✅ Seamless mode switching
✅ Real-time PBR preview
✅ Export all PBR channels
✅ Professional UI/UX
✅ Fast performance (60fps painting, <1s material gen)

## Next Steps

1. **Read this document completely**
2. **Review all 4 analysis documents**:
   - BACKEND_GPU_SYSTEMS.md
   - FRONTEND_PAINTING_SYSTEMS.md
   - ZENPAINTER_ANALYSIS.md
   - ZENSAMPLE_ANALYSIS.md
3. **Follow the phase-by-phase implementation**
4. **Test incrementally after each phase**
5. **Document any issues or deviations**

## Key Advantages

1. **Everything is already built** - This is a composition task
2. **GPU-first architecture** - 10-50x faster than CPU
3. **Binary IPC** - 10-50x faster than JSON for large data
4. **Modular design** - Easy to extend and maintain
5. **Production-tested** - All systems battle-tested in 14-app DCC suite

**This is the power of the template system + modular components.**

---

## Quick Reference

### File Locations

**ZenPainter Source**:
- backup/paint/KPainter.tsx (1675 lines)
- backup/paint/engine/PaintSystem.ts (944 lines)
- backup/paint/engine/PaintShaders.ts (576 lines)
- backup/paint/engine/MaskSystem.ts (143 lines)
- backup/paint/engine/meshUtils.ts (320 lines)

**ZenSample Source**:
- backup/autopbr/KAutopbr.tsx (main component)
- backup/autopbr/KAutopbrEngine.tsx (PBR generation)
- backup/autopbr/KAutopbrHDR.tsx (HDR system)
- backup/autopbr/KAutopbrpresets.tsx (30+ presets)

**Backend GPU**:
- crates/k-os-gpu-pipeline/src/svt/ (Virtual texturing)
- crates/k-os-gpu-pipeline/src/pipelines/pbr.rs (PBR generation)
- crates/k-os-gpu-pipeline/src/raycast/ (GPU raycasting)
- crates/k-os-brushes/src/ and crates/k-os-gpu-pipeline/src/brush/ (Brush system)

**Frontend Systems**:
- src-frontend/three-d/systems/svt/ (SVT client)
- src-frontend/three-d/systems/layers-3d/ (Layer panel)
- src-frontend/three-d/services/ (Service layer)
- src-frontend/shaders/ (Shader library)

### Import Patterns

\\\	ypescript
// SVT System
import { svtPbrClient } from '@/three-d/systems/svt';

// Services
import { rustSculpt } from '@/three-d/services/sculptClient';
import { pbrService } from '@/three-d/services/pbrClient';
import { raycastService } from '@/three-d/services/raycastClient';

// Systems
import { UniversalLayerPanel } from '@/three-d/systems/layers-3d';
import { UVProjection } from '@/three-d/systems/uv';

// Shaders
import { BRUSH_FRAG, SIMPLEX_NOISE } from '@/shaders';

// Shared
import { AppShell, AppTopBar } from '@/shared/shell';
import { Button, Slider } from '@/shared/primitives';
\\\

---

**END OF MASTER INTEGRATION PLAN**
