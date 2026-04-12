# Implementation Checklist - Substance Clone

**Purpose**: Step-by-step checklist for implementing ZenPainter + ZenSample
**Use**: Check off items as you complete them

---

## Phase 1: Project Setup ☐

### Directory Structure ☐
- [ ] Create `src-frontend/features/substance-clone/`
- [ ] Create `substance-clone/SubstanceClone.tsx`
- [ ] Create `substance-clone/SubstanceContext.tsx`
- [ ] Create `substance-clone/painter/` directory
- [ ] Create `substance-clone/sampler/` directory
- [ ] Create `substance-clone/shared/` directory
- [ ] Create `substance-clone/data/` directory

### Module Registration ☐
- [ ] Add entry to `shared/config/modules.manifest.ts`
- [ ] Set id: 'substance-clone'
- [ ] Set requiredCapabilities: ['tauri', 'three', 'wgpu']
- [ ] Add icon and description

---

## Phase 2: ZenPainter Integration ☐

### Core Engine Files ☐
- [ ] Copy `backup/paint/engine/PaintSystem.ts` → `painter/engine/`
- [ ] Copy `backup/paint/engine/PaintShaders.ts` → `painter/engine/`
- [ ] Copy `backup/paint/engine/MaskSystem.ts` → `painter/engine/`
- [ ] Copy `backup/paint/engine/meshUtils.ts` → `painter/engine/`
- [ ] Copy `backup/paint/engine/index.ts` → `painter/engine/`
- [ ] Update all imports to use `@/` alias
- [ ] Verify shader imports work

### Main Component ☐
- [ ] Copy `backup/paint/KPainter.tsx` → `painter/PainterMode.tsx`
- [ ] Rename all `KPainter` → `PainterMode`
- [ ] Update imports to `@/features/substance-clone/painter/`
- [ ] Verify SVT PBR integration
- [ ] Verify Rust raycast integration

### UI Components ☐
- [ ] Copy `backup/paint/ui/KPainterUI.tsx` → `painter/ui/PainterUI.tsx`
- [ ] Copy `backup/paint/ui/TopBar.tsx` → `painter/ui/`
- [ ] Copy `backup/paint/ui/LeftPanel.tsx` → `painter/ui/`
- [ ] Copy `backup/paint/ui/RightPanel.tsx` → `painter/ui/`
- [ ] Copy `backup/paint/ui/AlphaPanel.tsx` → `painter/ui/`
- [ ] Copy `backup/paint/ui/TexturesPanel.tsx` → `painter/ui/`
- [ ] Copy `backup/paint/ui/QuickMenu.tsx` → `painter/ui/`
- [ ] Update all imports
- [ ] Verify `AppShell` integration
- [ ] Verify `UniversalLayerPanel` integration

### Hooks & Utils ☐
- [ ] Copy `backup/paint/hooks/usePaintInput.tsx` → `painter/hooks/`
- [ ] Copy `backup/paint/InkSystem.ts` → `painter/`
- [ ] Copy `backup/paint/constants.ts` → `painter/`
- [ ] Copy `backup/paint/PainterContext.tsx` → `painter/PainterContext.tsx`
- [ ] Update all imports

### Testing ZenPainter ☐
- [ ] Load primitive mesh (sphere, cube)
- [ ] Paint with standard brush
- [ ] Paint with ink brush
- [ ] Test all 5 PBR channels
- [ ] Test layer add/delete/toggle
- [ ] Test undo/redo
- [ ] Test symmetry (X, Y, Z, radial)
- [ ] Test projection mode
- [ ] Test smart masks (edge, cavity, slope)
- [ ] Test manual masking (Ctrl/Shift)
- [ ] Test fluid effects
- [ ] Test 3D/2D view switching
- [ ] Test export

---

## Phase 3: ZenSample Integration ☐

### Core Engine Files ☐
- [ ] Copy `backup/autopbr/KAutopbrEngine.tsx` → `sampler/engine/`
- [ ] Copy `backup/autopbr/KAutopbrHDR.tsx` → `sampler/engine/`
- [ ] Copy `backup/autopbr/KAutopbrHDREncoder.ts` → `sampler/engine/`
- [ ] Copy `backup/autopbr/KAutopbrlighting.tsx` → `sampler/engine/`
- [ ] Copy `backup/autopbr/KAutopbrpresets.tsx` → `sampler/data/presets.ts`
- [ ] Copy `backup/autopbr/KAutopbrdecals.tsx` → `sampler/engine/`
- [ ] Update all imports

### Main Component ☐
- [ ] Copy `backup/autopbr/KAutopbr.tsx` → `sampler/SamplerMode.tsx`
- [ ] Rename all `KAutopbr` → `SamplerMode`
- [ ] Update imports to `@/features/substance-clone/sampler/`
- [ ] Verify GPU PBR integration
- [ ] Verify procedural generators

### UI Components ☐
- [ ] Copy `backup/autopbr/ui/TopBar.tsx` → `sampler/ui/`
- [ ] Copy `backup/autopbr/ui/LeftPanel.tsx` → `sampler/ui/`
- [ ] Copy `backup/autopbr/ui/RightPanel.tsx` → `sampler/ui/`
- [ ] Update all imports
- [ ] Verify `AppShell` integration

### Testing ZenSample ☐
- [ ] Upload photo
- [ ] Generate PBR maps (GPU mode)
- [ ] Test material mode toggle (matte/glossy)
- [ ] Apply material presets
- [ ] Test procedural generators
- [ ] Test color grading
- [ ] Test decal projection
- [ ] Test HDR generator
- [ ] Test lighting controls
- [ ] Test material surgery (artifact mode)
- [ ] Test export all maps
- [ ] Test save to library

---

## Phase 4: Shared Systems ☐

### Mode Switcher ☐
- [ ] Create `SubstanceClone.tsx` main component
- [ ] Add mode state: `'painter' | 'sampler'`
- [ ] Add mode toggle buttons
- [ ] Implement mode switching logic
- [ ] Preserve state across mode switches

### Shared Context ☐
- [ ] Create `SubstanceContext.tsx`
- [ ] Define shared material state
- [ ] Define shared texture library
- [ ] Implement context provider
- [ ] Connect to both modes

### Material Preview ☐
- [ ] Create `shared/MaterialPreview.tsx`
- [ ] Real-time PBR sphere/plane preview
- [ ] HDR environment lighting
- [ ] Material parameter controls
- [ ] Use in both modes

### Texture Export ☐
- [ ] Create `shared/TextureExport.tsx`
- [ ] Export all PBR channels
- [ ] Multiple format support (PNG, TGA, EXR)
- [ ] Resolution options
- [ ] Batch export

### Data Configuration ☐
- [ ] Create `data/presets.ts` (material presets)
- [ ] Create `data/brushes.ts` (brush library)
- [ ] Create `data/channels.ts` (PBR channel definitions)

---

## Phase 5: Testing & Polish ☐

### Integration Testing ☐
- [ ] Test mode switching (painter → sampler)
- [ ] Test mode switching (sampler → painter)
- [ ] Verify state preservation
- [ ] Test shared texture library
- [ ] Test material preview in both modes

### Performance Testing ☐
- [ ] Measure paint stroke time (<2ms target)
- [ ] Measure PBR generation time (<100ms target)
- [ ] Measure raycast time (<0.5ms target)
- [ ] Measure layer composite time (<5ms target)
- [ ] Verify 60fps painting at 2048x2048

### UI/UX Polish ☐
- [ ] Add keyboard shortcuts
- [ ] Add tooltips
- [ ] Add loading indicators
- [ ] Add error messages
- [ ] Add success notifications

### Documentation ☐
- [ ] Create README.md in features/substance-clone/
- [ ] Document keyboard shortcuts
- [ ] Document brush types
- [ ] Document effect descriptions
- [ ] Document performance tips

---

## Final Checklist ☐

### Code Quality ☐
- [ ] All imports use `@/` alias
- [ ] No hardcoded paths
- [ ] All TypeScript errors resolved
- [ ] All console warnings resolved
- [ ] Code follows conventions.md

### Performance ☐
- [ ] 60fps painting at 2048x2048
- [ ] <100ms PBR generation (4K)
- [ ] Smooth stroke interpolation
- [ ] No GC pauses
- [ ] Effect throttling working

### Features ☐
- [ ] All ZenPainter features working
- [ ] All ZenSample features working
- [ ] Mode switching seamless
- [ ] Export working
- [ ] Save to library working

### Ready for Release ☐
- [ ] All tests passing
- [ ] Performance targets met
- [ ] Documentation complete
- [ ] No critical bugs
- [ ] User feedback positive

---

**Total Estimated Time**: 12-16 hours
**Actual Time**: _____ hours

**Notes**:
