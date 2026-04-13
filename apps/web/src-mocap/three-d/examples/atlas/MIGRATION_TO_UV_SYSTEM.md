# Atlas Feature Migration to UV System

## Overview

The Atlas feature has been refactored to use the extracted UV system located in `three-d/systems/uv/`.

## Migration Guide

### Before (Old Imports)

```typescript
import { createKippUVGrid, applyUVProjection, applyLSCM, ProjectionConfig, applyGpuProjection, canUseGpuProjection, applyGpuPack } from './KAtlasUVEngine';
import { applyBoxProjection } from './KAtlasBox';
import { applyHybridAutoUnwrap } from './KAtlasHybrid';
import { KAtlasUVBrush } from './KAtlasUVBrush';
import { KBinPacker } from './KBinPacker';
```

### After (New Imports)

```typescript
import {
    // Types
    ProjectionConfig,
    LSCMConfig,
    BoxProjectionConfig,
    HybridConfig,
    UVBrushParams,
    
    // Core functions
    applyUVProjection,
    applyBoxProjection,
    applyHybridAutoUnwrap,
    applyGpuProjection,
    canUseGpuProjection,
    applyLSCM,
    
    // Packing
    AtlasPacker,
    packUVsGPU,
    packUVsGrid,
    
    // Editing
    UVBrush,
    UVSelection,
    calculateUVBounds,
    calculateMultiMeshUVBounds,
    createUVGridTexture,
    
    // React hook (recommended)
    useUV
} from '@/three-d/systems/uv';
```

## Recommended Approach: Use the Hook

The easiest way to integrate UV functionality is to use the `useUV` hook:

```typescript
import { useUV } from '@/three-d/systems/uv';

function AtlasComponent() {
    const uv = useUV({
        useGpu: true,
        defaultProjection: 'BOX'
    });

    // All UV operations are available through the hook
    const handleUnwrap = async () => {
        await uv.performUnwrap(meshes, selectedIds, originalGeos, camera);
    };

    const handlePack = async () => {
        await uv.performPack(meshes, selectedIds);
    };

    return (
        <div>
            <button onClick={handleUnwrap}>Unwrap</button>
            <button onClick={handlePack}>Pack</button>
            {uv.isProcessing && <div>Processing...</div>}
            {uv.uvStats && <div>Processed {uv.uvStats.verts} vertices</div>}
        </div>
    );
}
```

## File Mapping

### Old Files → New System

| Old File | New Location | Notes |
|----------|--------------|-------|
| `KAtlasUVEngine.tsx` | `systems/uv/UVProjection.ts` | Core projection algorithms |
| `KAtlasLSCM.ts` | `systems/uv/LSCMSolver.ts` | LSCM unwrapping |
| `KAtlasBox.ts` | `systems/uv/UVProjection.ts` | Box projection (integrated) |
| `KAtlasHybrid.ts` | `systems/uv/UVProjection.ts` | Hybrid unwrap (integrated) |
| `KAtlasUVBrush.ts` | `systems/uv/UVEditor.ts` | UV brush tools |
| `KBinPacker.ts` | `systems/uv/AtlasPacker.ts` | Bin packing algorithm |
| N/A | `systems/uv/UVTypes.ts` | All type definitions |
| N/A | `systems/uv/useUV.ts` | React hook |

## Key Changes

### 1. Unified Type System

All types are now in `UVTypes.ts`:
- `ProjectionMode` - All projection modes
- `ProjectionConfig` - Projection configuration
- `LSCMConfig` - LSCM solver configuration
- `BoxProjectionConfig` - Box projection configuration
- `HybridConfig` - Hybrid unwrap configuration
- `UVBrushParams` - Brush parameters

### 2. Simplified API

The UV system provides a cleaner API:

```typescript
// Old way
const result = await applyKAtlasLSCM(mesh, config);

// New way
const result = await applyLSCM(mesh, config);
```

### 3. React Hook Integration

The `useUV` hook provides:
- State management for all UV parameters
- Automatic GPU detection
- Processing state tracking
- UV statistics
- Preset configurations

### 4. Better Organization

- **Types**: All in one place (`UVTypes.ts`)
- **Projection**: All projection algorithms (`UVProjection.ts`)
- **LSCM**: Dedicated solver (`LSCMSolver.ts`)
- **Packing**: Atlas packing (`AtlasPacker.ts`)
- **Editing**: UV editing tools (`UVEditor.ts`)
- **Hook**: React integration (`useUV.ts`)

## Migration Steps

1. **Update imports** to use the new UV system
2. **Replace function calls** with new API
3. **Use the hook** for React components (recommended)
4. **Update type references** to use unified types
5. **Test thoroughly** to ensure functionality is preserved

## Benefits

- **Reusability**: UV system can be used in any 3D feature
- **Maintainability**: Single source of truth for UV operations
- **Type Safety**: Comprehensive TypeScript types
- **React Integration**: Easy to use hook
- **Documentation**: Clear API documentation
- **Testing**: Easier to test isolated system

## Example: Full Migration

### Before

```typescript
import { applyLSCM } from './KAtlasLSCM';
import { applyBoxProjection } from './KAtlasBox';

const handleUnwrap = async () => {
    if (mode === 'LSCM') {
        await applyLSCM(mesh, { maxIterations: 600 });
    } else {
        applyBoxProjection(mesh, { padding: 0.005, worldAlign: true });
    }
};
```

### After (Using Hook)

```typescript
import { useUV } from '@/three-d/systems/uv';

const uv = useUV();

const handleUnwrap = async () => {
    uv.setProjection(mode === 'LSCM' ? 'LSCM' : 'BOX');
    await uv.performUnwrap(meshes, selectedIds, originalGeos);
};
```

## Backward Compatibility

The old files (`KAtlasUVEngine.tsx`, `KAtlasLSCM.ts`, etc.) can remain in the Atlas feature directory for backward compatibility during the transition period. However, new code should use the extracted UV system.

## Next Steps

1. Update `KAtlas.tsx` to import from `@/three-d/systems/uv`
2. Refactor to use `useUV` hook where possible
3. Update UI components to use hook state
4. Remove old files once migration is complete
5. Update tests to use new system

## Support

For questions or issues during migration, refer to:
- `systems/uv/README.md` - Complete UV system documentation
- `systems/uv/UVTypes.ts` - Type definitions
- `systems/uv/useUV.ts` - Hook documentation
