/**
 * Vitest Test Setup
 *
 * Full jsdom environment bootstrap for K-OS frontend tests.
 * Sets up: Tauri mocks, Three.js WebGL stubs, ResizeObserver,
 * IntersectionObserver, matchMedia, and @testing-library/jest-dom matchers.
 */

import '@testing-library/jest-dom';
import { expect, afterEach, vi, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';

// ─── Cleanup after every test ────────────────────────────────────────────────
afterEach(() => {
  cleanup();
});

// ─── Tauri API mocks ─────────────────────────────────────────────────────────
// These are re-set per-test via vi.mocked(invoke).mockResolvedValue(...)
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => { /* unlisten no-op */ }),
  emit:   vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn().mockResolvedValue('/mock/path/file.glb'),
}));

// ─── WebGL context stub for Three.js ────────────────────────────────────────
HTMLCanvasElement.prototype.getContext = function (contextId: string) {
  if (contextId === 'webgl' || contextId === 'webgl2') {
    return {
      canvas:              this,
      drawingBufferWidth:  800,
      drawingBufferHeight: 600,
      // Minimal WebGL interface used by Three.js renderer init
      getExtension:            () => null,
      getParameter:            (param: number) => {
        // MAX_TEXTURE_SIZE
        if (param === 0x0D33) return 4096;
        return null;
      },
      getShaderPrecisionFormat: () => ({ precision: 23, rangeMin: 127, rangeMax: 127 }),
      createBuffer:    () => ({}),
      bindBuffer:      () => {},
      bufferData:      () => {},
      enable:          () => {},
      disable:         () => {},
      viewport:        () => {},
      clear:           () => {},
      clearColor:      () => {},
      clearDepth:      () => {},
      depthFunc:       () => {},
      createProgram:   () => ({}),
      createShader:    () => ({}),
      shaderSource:    () => {},
      compileShader:   () => {},
      attachShader:    () => {},
      linkProgram:     () => {},
      getProgramParameter: () => true,
      getShaderParameter:  () => true,
      useProgram:      () => {},
    };
  }
  if (contextId === '2d') {
    return {
      fillRect:     () => {},
      clearRect:    () => {},
      getImageData: (_x: number, _y: number, w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
        width: w,
        height: h,
      }),
      putImageData:   () => {},
      drawImage:      () => {},
      save:           () => {},
      restore:        () => {},
      scale:          () => {},
      rotate:         () => {},
      translate:      () => {},
      createImageData: (w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
        width: w,
        height: h,
      }),
      canvas: this,
    };
  }
  return null;
} as any;

// ─── ResizeObserver (jsdom doesn't ship it) ──────────────────────────────────
beforeAll(() => {
  class ResizeObserverStub {
    observe()   {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);

  // ─── IntersectionObserver ─────────────────────────────────────────────────
  class IntersectionObserverStub {
    observe()    {}
    unobserve()  {}
    disconnect() {}
  }
  vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);

  // ─── matchMedia (used by some Radix UI components) ────────────────────────
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches:             false,
      media:               query,
      onchange:            null,
      addListener:         vi.fn(),
      removeListener:      vi.fn(),
      addEventListener:    vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent:       vi.fn(),
    })),
  });

  // ─── window.URL.createObjectURL ───────────────────────────────────────────
  if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    window.URL.revokeObjectURL = vi.fn();
  }

  // ─── PointerEvent (ResizeHandle uses setPointerCapture) ──────────────────
  if (!window.PointerEvent) {
    class PointerEvent extends MouseEvent {
      pointerId: number;
      constructor(type: string, params: any = {}) {
        super(type, params);
        this.pointerId = params.pointerId ?? 1;
      }
    }
    vi.stubGlobal('PointerEvent', PointerEvent);
  }

  // ─── HTMLElement pointer capture (ResizeHandle) ───────────────────────────
  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture    = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
  }
});
