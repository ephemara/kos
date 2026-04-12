# KCompose Export System

## Overview

KCompose supports exporting composites in multiple formats with HDR workflow support:

- **PNG**: 8-bit and 16-bit (standard and high-quality)
- **EXR**: 16-bit and 32-bit floating-point (HDR)
- **TIFF**: 8-bit, 16-bit, and 32-bit (professional)

## Current Implementation

### Working Features
- ✅ HDR workflow toggle (enables floating-point rendering pipeline)
- ✅ Export settings dialog with format, bit depth, and compression options
- ✅ PNG export (8-bit) via Canvas API
- ✅ Tone mapping controls for HDR preview
- ✅ Resolution control for export
- ✅ Proper color space handling (Linear SRGB for HDR)

### Partial Implementation
- ⚠️ EXR export (currently exports tone-mapped PNG as fallback)
- ⚠️ TIFF export (currently exports PNG as fallback)
- ⚠️ 16-bit PNG export (requires additional library)

## Library Recommendations

To complete the export functionality, add these NPM packages:

### For EXR Support (HDR)
```bash
npm install openexr
# OR
npm install @types/openexr
```

**Alternative**: Use `tinyexr` or `exr` package
- `openexr`: Full-featured OpenEXR encoder/decoder
- `tinyexr`: Lightweight EXR library
- Supports ZIP, PIZ, RLE compression
- Handles 16-bit half-float and 32-bit float

### For TIFF Support
```bash
npm install utif
```

**Features**:
- Encode/decode TIFF images
- Support for 8-bit, 16-bit, 32-bit
- LZW, ZIP, RLE compression
- Multi-page TIFF support

### For 16-bit PNG Support
```bash
npm install upng-js
```

**Features**:
- Encode PNG with 16-bit depth
- Better compression than browser Canvas API
- Supports alpha channel

## HDR Workflow

### Enabling HDR
```typescript
engine.setHDREnabled(true);
```

This configures the renderer for HDR:
- Uses `THREE.ACESFilmicToneMapping` for tone mapping
- Sets `THREE.LinearSRGBColorSpace` for color space
- Enables floating-point render targets

### Exposure Control
```typescript
engine.setExposure(1.5); // Increase exposure
```

### Exporting HDR
```typescript
const settings: ExportSettings = {
  format: 'exr',
  bitDepth: 32,
  compression: 'piz',
  width: 3840,
  height: 2160,
  filename: 'my_composite'
};

await engine.exportCompositeAdvanced(settings);
```

## Implementation Guide

### Adding EXR Export

1. Install library:
```bash
npm install openexr
```

2. Update `exportUtility.ts`:
```typescript
import { encodeEXR } from 'openexr';

private async exportEXR(
  renderTarget: THREE.WebGLRenderTarget,
  filename: string,
  settings: ExportSettings
): Promise<void> {
  const width = renderTarget.width;
  const height = renderTarget.height;
  const pixels = new Float32Array(width * height * 4);
  
  this.renderer.readRenderTargetPixels(
    renderTarget, 0, 0, width, height, pixels
  );

  // Encode to EXR
  const exrData = encodeEXR({
    width,
    height,
    channels: ['R', 'G', 'B', 'A'],
    data: pixels,
    compression: settings.compression,
    pixelType: settings.bitDepth === 32 ? 'float' : 'half',
  });

  // Download
  const blob = new Blob([exrData], { type: 'image/x-exr' });
  const url = URL.createObjectURL(blob);
  this.downloadUrl(url, `${filename}.exr`);
  URL.revokeObjectURL(url);
}
```

### Adding TIFF Export

1. Install library:
```bash
npm install utif
```

2. Update `exportUtility.ts`:
```typescript
import UTIF from 'utif';

private async exportTIFF(
  renderTarget: THREE.WebGLRenderTarget,
  filename: string,
  settings: ExportSettings
): Promise<void> {
  const width = renderTarget.width;
  const height = renderTarget.height;
  
  let pixels: Uint8Array | Uint16Array | Float32Array;
  
  if (settings.bitDepth === 8) {
    pixels = new Uint8Array(width * height * 4);
  } else if (settings.bitDepth === 16) {
    pixels = new Uint16Array(width * height * 4);
  } else {
    pixels = new Float32Array(width * height * 4);
  }
  
  this.renderer.readRenderTargetPixels(
    renderTarget, 0, 0, width, height, pixels
  );

  // Encode to TIFF
  const tiffData = UTIF.encodeImage(pixels, width, height, {
    compression: settings.compression === 'zip' ? 8 : 1,
    bitsPerSample: settings.bitDepth,
  });

  // Download
  const blob = new Blob([tiffData], { type: 'image/tiff' });
  const url = URL.createObjectURL(blob);
  this.downloadUrl(url, `${filename}.tiff`);
  URL.revokeObjectURL(url);
}
```

## Testing

Test the export functionality:

```typescript
// Test PNG export
await engine.exportCompositeAdvanced({
  format: 'png',
  bitDepth: 8,
  compression: 'none',
  width: 1920,
  height: 1080,
  filename: 'test_png'
});

// Test HDR workflow
engine.setHDREnabled(true);
engine.setExposure(1.2);

await engine.exportCompositeAdvanced({
  format: 'exr',
  bitDepth: 32,
  compression: 'piz',
  width: 3840,
  height: 2160,
  filename: 'test_hdr'
});
```

## Performance Considerations

- **Large Exports**: 4K+ exports may take several seconds
- **HDR Processing**: Float32 textures use 4x memory vs 8-bit
- **Compression**: PIZ compression is slower but provides better quality
- **Memory**: Monitor memory usage for large exports (use `performance.memory`)

## Future Enhancements

- [ ] Add progress bar for large exports
- [ ] Implement batch export for multiple layers
- [ ] Add export presets (Web, Print, HDR, etc.)
- [ ] Support for additional formats (WebP, AVIF)
- [ ] GPU-accelerated compression
- [ ] Export queue for multiple files
- [ ] Metadata embedding (author, software, etc.)
- [ ] Color profile support (sRGB, Adobe RGB, ProPhoto RGB)

## References

- [OpenEXR Specification](https://www.openexr.com/)
- [TIFF Specification](https://www.adobe.io/open/standards/TIFF.html)
- [PNG Specification](http://www.libpng.org/pub/png/spec/)
- [Three.js WebGLRenderer](https://threejs.org/docs/#api/en/renderers/WebGLRenderer)
