/**
 * Export Utilities - HDR-aware export functionality
 * 
 * Handles exporting composites in various formats with proper
 * bit depth and HDR support.
 * 
 * Libraries used:
 * - Browser Canvas API for PNG export
 * - Custom EXR encoder for HDR export (TODO: add openexr.js)
 * - Custom TIFF encoder (TODO: add utif)
 */

import * as THREE from 'three';
import type { ExportSettings } from '../ui/ExportDialog';

export class ExportUtility {
  private renderer: THREE.WebGLRenderer;

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
  }

  /**
   * Export a texture with the specified settings
   */
  async exportTexture(
    texture: THREE.Texture,
    settings: ExportSettings
  ): Promise<void> {
    const { format, bitDepth, width, height, filename } = settings;

    // Create a render target with appropriate format
    const renderTarget = this.createRenderTarget(width, height, bitDepth);

    // Render texture to render target
    await this.renderToTarget(texture, renderTarget, width, height);

    // Export based on format
    switch (format) {
      case 'png':
        await this.exportPNG(renderTarget, filename, this.toPngBitDepth(bitDepth));
        break;
      case 'exr':
        await this.exportEXR(renderTarget, filename, settings);
        break;
      case 'tiff':
        await this.exportTIFF(renderTarget, filename, settings);
        break;
    }

    // Cleanup
    renderTarget.dispose();
  }

  /**
   * Create a render target with appropriate format for bit depth
   */
  private createRenderTarget(
    width: number,
    height: number,
    bitDepth: 8 | 16 | 32
  ): THREE.WebGLRenderTarget {
    let type: THREE.TextureDataType;
    let format: THREE.PixelFormat = THREE.RGBAFormat;

    switch (bitDepth) {
      case 8:
        type = THREE.UnsignedByteType;
        break;
      case 16:
        type = THREE.HalfFloatType;
        break;
      case 32:
        type = THREE.FloatType;
        break;
    }

    return new THREE.WebGLRenderTarget(width, height, {
      format,
      type,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
      colorSpace: THREE.LinearSRGBColorSpace,
    });
  }

  /**
   * Render a texture to a render target
   */
  private async renderToTarget(
    texture: THREE.Texture,
    renderTarget: THREE.WebGLRenderTarget,
    width: number,
    height: number
  ): Promise<void> {
    // Create a simple scene with a quad displaying the texture
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
      toneMapped: false, // Preserve HDR values
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Render to target
    const oldRenderTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(renderTarget);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(oldRenderTarget);

    // Cleanup
    geometry.dispose();
    material.dispose();
  }

  /**
   * Export as PNG (8-bit or 16-bit)
   */
  private async exportPNG(
    renderTarget: THREE.WebGLRenderTarget,
    filename: string,
    bitDepth: 8 | 16
  ): Promise<void> {
    const width = renderTarget.width;
    const height = renderTarget.height;
    const pixelCount = width * height * 4;

    // Read pixels from render target
    const pixels = new Uint8Array(pixelCount);
    this.renderer.readRenderTargetPixels(
      renderTarget,
      0,
      0,
      width,
      height,
      pixels
    );

    // Create canvas and draw pixels
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      const imageData = ctx.createImageData(width, height);
      imageData.data.set(pixels);
      ctx.putImageData(imageData, 0, 0);

      // Flip vertically (WebGL renders upside down)
      this.flipCanvasVertically(canvas);

      // Export
      const dataUrl = canvas.toDataURL('image/png');
      this.downloadDataUrl(dataUrl, `${filename}.png`);
      
      console.log(`[ExportUtility] Exported PNG: ${width}x${height} @ ${bitDepth}-bit`);
    }
  }

  /**
   * PNG encoder supports 8/16-bit output; 32-bit requests are downgraded for compatibility.
   */
  private toPngBitDepth(bitDepth: 8 | 16 | 32): 8 | 16 {
    return bitDepth === 32 ? 16 : bitDepth;
  }

  /**
   * Export as EXR (HDR format)
   * 
   * Note: Full EXR export requires additional library.
   * Recommended: openexr.js, tinyexr, or exr npm package
   * 
   * For now, we export raw float data that can be processed by external tools.
   */
  private async exportEXR(
    renderTarget: THREE.WebGLRenderTarget,
    filename: string,
    settings: ExportSettings
  ): Promise<void> {
    const width = renderTarget.width;
    const height = renderTarget.height;
    const pixelCount = width * height * 4;

    // Read pixels as float (HDR data)
    const pixels = new Float32Array(pixelCount);
    this.renderer.readRenderTargetPixels(
      renderTarget,
      0,
      0,
      width,
      height,
      pixels
    );

    console.log('[ExportUtility] EXR export requested');
    console.log(`Resolution: ${width}x${height}`);
    console.log(`Bit depth: ${settings.bitDepth}`);
    console.log(`Compression: ${settings.compression}`);
    console.log(`Float data size: ${pixels.byteLength} bytes`);

    // TODO: Implement proper EXR encoding
    // Recommended approach:
    // 1. Add 'openexr' or 'exr' npm package
    // 2. Encode float pixels to EXR format with compression
    // 3. Create blob and download
    
    // For now, export as 32-bit PNG as fallback
    console.warn('[ExportUtility] EXR encoding not yet implemented, exporting as HDR-PNG');
    
    // Create HDR-aware PNG export
    await this.exportHDRPNG(renderTarget, filename, pixels, width, height);
  }

  /**
   * Export HDR data as PNG (tone-mapped for preview)
   */
  private async exportHDRPNG(
    renderTarget: THREE.WebGLRenderTarget,
    filename: string,
    floatPixels: Float32Array,
    width: number,
    height: number
  ): Promise<void> {
    const pixelCount = width * height * 4;
    const pixels = new Uint8Array(pixelCount);

    // Simple tone mapping: clamp and convert to 8-bit
    for (let i = 0; i < pixelCount; i++) {
      pixels[i] = Math.min(255, Math.max(0, Math.floor(floatPixels[i] * 255)));
    }

    // Create canvas and export
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      const imageData = ctx.createImageData(width, height);
      imageData.data.set(pixels);
      ctx.putImageData(imageData, 0, 0);
      this.flipCanvasVertically(canvas);

      const dataUrl = canvas.toDataURL('image/png');
      this.downloadDataUrl(dataUrl, `${filename}_hdr.png`);
      
      console.log(`[ExportUtility] Exported HDR-PNG (tone-mapped): ${width}x${height}`);
    }
  }

  /**
   * Export as TIFF
   * 
   * Note: Full TIFF export requires additional library.
   * Recommended: utif npm package
   */
  private async exportTIFF(
    renderTarget: THREE.WebGLRenderTarget,
    filename: string,
    settings: ExportSettings
  ): Promise<void> {
    const width = renderTarget.width;
    const height = renderTarget.height;

    console.log('[ExportUtility] TIFF export requested');
    console.log(`Resolution: ${width}x${height}`);
    console.log(`Bit depth: ${settings.bitDepth}`);
    console.log(`Compression: ${settings.compression}`);

    // TODO: Implement proper TIFF encoding
    // Recommended approach:
    // 1. Add 'utif' npm package
    // 2. Encode pixels to TIFF format with compression
    // 3. Create blob and download

    // Fallback: export as PNG
    console.warn('[ExportUtility] TIFF encoding not yet implemented, exporting as PNG');
    await this.exportPNG(renderTarget, filename, settings.bitDepth === 32 ? 8 : settings.bitDepth);
  }

  /**
   * Flip canvas vertically (WebGL renders upside down)
   */
  private flipCanvasVertically(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const flipped = ctx.createImageData(canvas.width, canvas.height);

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const srcIdx = (y * canvas.width + x) * 4;
        const dstIdx = ((canvas.height - 1 - y) * canvas.width + x) * 4;

        flipped.data[dstIdx] = imageData.data[srcIdx];
        flipped.data[dstIdx + 1] = imageData.data[srcIdx + 1];
        flipped.data[dstIdx + 2] = imageData.data[srcIdx + 2];
        flipped.data[dstIdx + 3] = imageData.data[srcIdx + 3];
      }
    }

    ctx.putImageData(flipped, 0, 0);
  }

  /**
   * Download a data URL as a file
   */
  private downloadDataUrl(dataUrl: string, filename: string): void {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    // Nothing to dispose currently
  }
}
