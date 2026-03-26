# Export System Migration Guide

This guide shows how to migrate DCC apps from hardcoded export logic to the centralized ConfigRegistry-based export system.

## Overview

The new export system provides:
- **Data-driven formats**: All export formats defined in `export_formats.json`
- **Unified UI**: Reusable `ExportDialog` component
- **Type safety**: TypeScript interfaces for all export operations
- **Progress tracking**: Built-in progress callbacks
- **Error handling**: Consistent error messages across all apps

## Architecture

```
ConfigRegistry (Rust)
  ↓
export_formats.json
  ↓
exportService (TypeScript)
  ↓
ExportDialog (React Component)
  ↓
useExport Hook (React Hook)
  ↓
DCC Apps (KTecton, KSculpt, etc.)
```

## Migration Steps

### Step 1: Remove Hardcoded Export Logic

**Before (KTecton example):**
```typescript
const handleExportGLB = async () => {
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
  const exporter = new GLTFExporter();
  
  // Hardcoded export logic...
  exporter.parse(scene, (gltf) => {
    // Manual file saving...
  });
};

const handleExportHeightmap = async (format: 'png8' | 'png16' | 'exr') => {
  // Hardcoded heightmap export...
};
```

**After:**
```typescript
import { useExport } from '@/hooks/useExport';
import { ExportDialog } from '@/ui/ExportDialog';

const {
  isExporting,
  progress,
  status,
  showDialog,
  exportMesh,
  exportTexture,
  openExportDialog,
  closeExportDialog
} = useExport({
  onExportComplete: (result) => {
    console.log('Export saved to:', result.path);
  }
});
```

### Step 2: Replace Export UI

**Before:**
```typescript
<button onClick={handleExportGLB}>Export GLB</button>
<button onClick={() => handleExportHeightmap('png8')}>Export PNG 8-bit</button>
<button onClick={() => handleExportHeightmap('png16')}>Export PNG 16-bit</button>
<button onClick={() => handleExportHeightmap('exr')}>Export EXR</button>
```

**After:**
```typescript
<button onClick={openExportDialog}>Export</button>

<ExportDialog
  isOpen={showDialog}
  onClose={closeExportDialog}
  exportType="mesh" // or "texture" or "all"
  onExport={async (formatId, options) => {
    await exportMesh(sceneRef.current, { formatId, options });
  }}
/>
```

### Step 3: Update Menu Items

**Before:**
```typescript
const menuItems = [
  { label: 'Export Terrain (GLB)', onSelect: handleExportGLB },
  { label: 'Export Heightmap (PNG 8-bit)', onSelect: () => handleExportHeightmap('png8') },
  { label: 'Export Heightmap (PNG 16-bit)', onSelect: () => handleExportHeightmap('png16') },
  { label: 'Export Heightmap (EXR)', onSelect: () => handleExportHeightmap('exr') },
];
```

**After:**
```typescript
const menuItems = [
  { label: 'Export...', onSelect: openExportDialog, shortcut: 'Ctrl+E' },
];
```

## Complete Example: KTecton Migration

### Before (Hardcoded)

```typescript
// KTecton.tsx - OLD APPROACH
const handleExportGLB = async () => {
  const r = engineRef.current;
  if (!r.mesh) return;
  
  try {
    const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
    const exporter = new GLTFExporter();
    
    const exportScene = new THREE.Scene();
    const exportMesh = r.mesh.clone();
    exportScene.add(exportMesh);
    
    exporter.parse(exportScene, async (gltf) => {
      const blob = new Blob([gltf as ArrayBuffer], { type: 'application/octet-stream' });
      downloadBlob(blob, 'terrain.glb');
    }, (error) => {
      console.error('Export failed:', error);
    }, { binary: true });
  } catch (error) {
    console.error('Export failed:', error);
  }
};

const handleExportHeightmap = async (format: 'png8' | 'png16' | 'exr', exportResolution?: number) => {
  const r = engineRef.current;
  if (!r.targetA) return;
  
  const targetRes = exportResolution || resolution;
  
  // Create canvas and render heightmap
  const canvas = document.createElement('canvas');
  canvas.width = targetRes;
  canvas.height = targetRes;
  
  // ... complex rendering logic ...
  
  // Manual file saving
  canvas.toBlob((blob) => {
    if (blob) {
      downloadBlob(blob, `heightmap.${format === 'exr' ? 'exr' : 'png'}`);
    }
  });
};
```

### After (Centralized)

```typescript
// KTecton.tsx - NEW APPROACH
import { useExport } from '@/hooks/useExport';
import { ExportDialog } from '@/ui/ExportDialog';

export default function KTecton({ sharedState, onCommit }: any) {
  const {
    isExporting,
    progress,
    status,
    showDialog,
    exportMesh,
    exportTexture,
    openExportDialog,
    closeExportDialog
  } = useExport({
    onExportComplete: (result) => {
      setStatus(`Export saved: ${result.path}`);
    },
    onExportError: (error) => {
      setStatus(`Export failed: ${error}`);
    }
  });

  const handleExport = async (formatId: string, options: Record<string, any>) => {
    const r = engineRef.current;
    
    // Determine if this is a mesh or texture export
    if (formatId === 'gltf' || formatId === 'glb' || formatId === 'obj') {
      // Mesh export
      if (!r.mesh) {
        throw new Error('No terrain mesh to export');
      }
      
      const exportScene = new THREE.Scene();
      const exportMesh = r.mesh.clone();
      exportScene.add(exportMesh);
      
      await exportMesh(exportScene, { formatId, options });
    } else {
      // Texture/heightmap export
      if (!r.targetA) {
        throw new Error('No heightmap data to export');
      }
      
      // Create canvas from render target
      const canvas = document.createElement('canvas');
      const targetRes = options.resolution ? parseInt(options.resolution) : resolution;
      canvas.width = targetRes;
      canvas.height = targetRes;
      
      // Render heightmap to canvas
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // ... render logic ...
      }
      
      await exportTexture(canvas, { formatId, options });
    }
  };

  return (
    <AppShell>
      <TopBar
        onExport={openExportDialog}
        // ... other props
      />
      
      <ExportDialog
        isOpen={showDialog}
        onClose={closeExportDialog}
        exportType="all"
        onExport={handleExport}
        title="Export Terrain"
      />
      
      {/* Rest of app */}
    </AppShell>
  );
}
```

## App-Specific Export Logic

Each app can customize the export process while still using the centralized system:

### KSculpt (Mesh Export)

```typescript
const handleExport = async (formatId: string, options: Record<string, any>) => {
  const exportScene = new THREE.Scene();
  
  // Export visible layers only
  visibleLayers.forEach(layer => {
    const mesh = sceneRef.current.meshes.get(layer.id);
    if (mesh) {
      const exportMesh = mesh.clone();
      exportMesh.name = layer.name;
      exportScene.add(exportMesh);
    }
  });
  
  await exportMesh(exportScene, { formatId, options });
};
```

### KPainter (Texture Export)

```typescript
const handleExport = async (formatId: string, options: Record<string, any>) => {
  // Export current PBR channel
  const canvas = paintEngineRef.current.getChannelCanvas(activeChannel);
  await exportTexture(canvas, { formatId, options });
};
```

### KQuantum (Particle Export)

```typescript
const handleExport = async (formatId: string, options: Record<string, any>) => {
  if (formatId === 'gltf' || formatId === 'glb') {
    // Export particles as instanced meshes
    const exportScene = new THREE.Scene();
    const particleGroup = createParticleInstancedMesh();
    exportScene.add(particleGroup);
    
    await exportMesh(exportScene, { formatId, options });
  } else {
    // Export particle data as JSON
    const particleData = quantumEngineRef.current.exportParticles();
    // ... save JSON
  }
};
```

## Benefits

### Before Migration
- ❌ Hardcoded export formats in each app
- ❌ Duplicated export logic across 10+ apps
- ❌ Inconsistent UI and error handling
- ❌ No centralized format configuration
- ❌ Difficult to add new export formats

### After Migration
- ✅ All formats defined in `export_formats.json`
- ✅ Single export implementation shared across all apps
- ✅ Consistent UI with `ExportDialog` component
- ✅ Centralized configuration via ConfigRegistry
- ✅ Easy to add new formats (just update JSON)

## Adding New Export Formats

To add a new export format, simply update `export_formats.json`:

```json
{
  "id": "stl",
  "name": "STL (3D Printing)",
  "extensions": ["stl"],
  "supportsMeshes": true,
  "supportsTextures": false,
  "supportsMaterials": false,
  "options": [
    {
      "id": "binary",
      "label": "Binary Format",
      "type": "bool",
      "default": true
    }
  ]
}
```

Then implement the exporter in `exportService.ts`:

```typescript
case 'stl':
  return await this.exportSTL(sceneOrMesh, filePath, options);
```

## Testing

After migration, test:
1. ✅ Export dialog opens and shows available formats
2. ✅ Format options are populated from config
3. ✅ Export progress is displayed
4. ✅ Files are saved to correct location
5. ✅ Error messages are clear and helpful
6. ✅ All apps use consistent export UI

## Rollout Plan

1. **Phase 1**: Implement core export system (✅ Complete)
2. **Phase 2**: Migrate KTecton as reference (In Progress)
3. **Phase 3**: Migrate remaining apps:
   - KQuantum
   - KCloner
   - KSculpt (update to use centralized system)
   - KPainter
   - KAtlas
   - KGraphos
   - KGreeble
   - KAutopbr
   - KInspect
4. **Phase 4**: Remove old export code
5. **Phase 5**: Add new formats (FBX, USD, etc.)

## Support

For questions or issues, check:
- `src-frontend/services/exportService.ts` - Core export logic
- `src-frontend/ui/ExportDialog/ExportDialog.tsx` - UI component
- `src-frontend/hooks/useExport.ts` - React hook
- `crates/k-os-config/src/config/schemas/export_formats.json` - Format definitions
