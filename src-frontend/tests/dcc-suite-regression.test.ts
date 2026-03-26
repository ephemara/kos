import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BLEND_MODES,
  DEFAULT_ACTIVE_CHANNELS,
  DEFAULT_BRUSH,
  PBR_CHANNELS,
  TEXTURE_RESOLUTIONS,
  VIEW_CHANNELS,
  VIEW_MODES,
} from '@/features/paint/constants';
import {
  ALL_BRUSHES,
  SIMULATION_BRUSHES,
  STANDARD_BRUSHES,
} from '@/features/sculpting/constants';
import { isRustMode, RUST_MODE_CONFIG } from '@/features/quantum/KQuantumPresets';
import {
  getQuickMenuCommands,
  registerQuickMenuCommands,
  subscribeQuickMenuCommands,
  unregisterQuickMenuCommands,
} from '@/ui/shell/quickMenuRegistry';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('DCC Suite Regression Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('painting: default brush uses a supported blend mode', () => {
    const blendIds = BLEND_MODES.map((m) => m.id);
    expect(blendIds).toContain(DEFAULT_BRUSH.blendMode);
  });

  it('painting: default active channels match channel registry defaults', () => {
    const channelIds = PBR_CHANNELS.map((c) => c.id).sort();
    const activeIds = Object.keys(DEFAULT_ACTIVE_CHANNELS).sort();
    expect(activeIds).toEqual(channelIds);

    PBR_CHANNELS.forEach((channel) => {
      expect(DEFAULT_ACTIVE_CHANNELS[channel.id as keyof typeof DEFAULT_ACTIVE_CHANNELS]).toBe(channel.defaultEnabled);
    });
  });

  it('viewport: modes and channels expose core material + uv workflows', () => {
    expect(VIEW_MODES).toEqual(['3D', '2D']);
    expect(VIEW_CHANNELS.some((c) => c.id === 'MATERIAL')).toBe(true);
    expect(VIEW_CHANNELS.some((c) => c.id === 'UV')).toBe(true);
    expect(TEXTURE_RESOLUTIONS).toContain(2048);
  });

  it('particle simulation: rust mode boundary is enforced at 300+', () => {
    expect(isRustMode(299)).toBe(false);
    expect(isRustMode(300)).toBe(true);
  });

  it('particle simulation: rust mode configs are present and sane', () => {
    expect(RUST_MODE_CONFIG[300]?.particle_count).toBeGreaterThan(0);
    expect(RUST_MODE_CONFIG[331]?.particle_count).toBeGreaterThan(0);
    expect(RUST_MODE_CONFIG[303]?.nbody?.enabled).toBe(true);
    expect(RUST_MODE_CONFIG[303]?.particle_count).toBeLessThan(RUST_MODE_CONFIG[300]?.particle_count ?? Infinity);
  });

  it('sculpting pipeline: standard brush IDs are unique', () => {
    const ids = STANDARD_BRUSHES.map((b) => b.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('glitches: simulation brush catalog includes GLITCH brush', () => {
    const glitch = SIMULATION_BRUSHES.find((b) => b.id === 'GLITCH');
    expect(glitch).toBeDefined();
    expect(glitch?.category).toBe('simulation');
    expect(glitch?.desc.toLowerCase()).toContain('distortion');
  });

  it('sculpting pipeline: combined brush catalog stays sorted for stable UI menus', () => {
    const labels = ALL_BRUSHES.map((b) => b.label);
    const sorted = [...labels].sort((a, b) => a.localeCompare(b));
    expect(labels).toEqual(sorted);
  });

  it('asset handling: particle GLB export calls backend and browser download flow', async () => {
    const originalCreateElement = document.createElement.bind(document);
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-glb');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as unknown as Node);
    const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as unknown as Node);
    const clickSpy = vi.fn();
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName.toLowerCase() === 'a') {
        return {
          click: clickSpy,
          href: '',
          download: '',
        } as unknown as HTMLAnchorElement;
      }
      return originalCreateElement(tagName);
    });

    vi.mocked(invoke)
      .mockResolvedValueOnce(42) // quantum_particle_count
      .mockResolvedValueOnce([1, 2, 3, 4]); // quantum_export_gltf

    const { exportParticlesGLBToFile } = await import('@/services/quantumClient');
    await exportParticlesGLBToFile(7, 0.5, 2, 'particles.glb');

    expect(invoke).toHaveBeenNthCalledWith(1, 'quantum_particle_count', { simId: 7 });
    expect(invoke).toHaveBeenNthCalledWith(2, 'quantum_export_gltf', {
      simId: 7,
      particleRadius: 0.5,
      subdivisions: 2,
    });
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test-glb');

    createElementSpy.mockRestore();
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });

  it('controls: quick menu registry notifies listeners on register and unregister', () => {
    const sourceId = 'test-controls-registry';
    const listener = vi.fn();
    const unsubscribeListener = subscribeQuickMenuCommands(listener);

    const unregister = registerQuickMenuCommands(sourceId, [
      {
        id: 'toggle-grid',
        label: 'Toggle Grid',
        category: 'viewport',
        action: vi.fn(),
      },
    ]);

    expect(getQuickMenuCommands().some((c) => c.id === 'toggle-grid')).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    unregister();
    expect(getQuickMenuCommands().some((c) => c.id === 'toggle-grid')).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribeListener();
    unregisterQuickMenuCommands(sourceId);
  });
});
