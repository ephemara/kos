import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as THREE from 'three';
import {
  createChainInstance,
  createModifierInstance,
  fract,
  hash,
  noise,
} from '@/features/cloner/KClonerUtils';
import { DEFAULT_PARAMS, MATERIAL_CATEGORIES } from '@/features/autopbr/KAutopbrpresets';
import { calculateSunDirection } from '@/features/tecton/KTectonlighting';
import { generateTerrainData } from '@/features/tecton/KTectonheightmapgen';
import { KBinPacker } from '@/features/atlas/KBinPacker';
import { setupMaterialLink, updateMaterialView } from '@/features/atlas/KAtlasUVmatlink';
import { GRAPHOS_SIMS } from '@/features/graphos/KGraphosSpaceMenu';
import LeftPanel from '@/features/scatter/ui/LeftPanel';
import { BevyViewportOverlay } from '@/features/bevy/ui/BevyViewportOverlay';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@/features/bevy/ui/BevyLayerPanel', () => ({
  BevyLayerPanel: () => <div data-testid="bevy-layer-panel">Layer Panel</div>,
}));

vi.mock('@/features/bevy/ui/BevySculptPanel', () => ({
  BevySculptPanel: () => <div data-testid="bevy-sculpt-panel">Sculpt Panel</div>,
}));

describe('DCC Suite Wide Coverage', () => {
  it('cloner math helpers remain deterministic and stable', () => {
    expect(fract(2.75)).toBeCloseTo(0.75, 6);
    expect(fract(-1.25)).toBeCloseTo(0.75, 6);
    expect(hash(42)).toBe(hash(42));
    expect(noise(3.5)).toBeCloseTo(noise(3.5), 10);
  });

  it('cloner creates isolated modifier slider state for CODE modifiers', () => {
    const modA = createModifierInstance('CODE');
    const modB = createModifierInstance('CODE');
    expect(modA.type).toBe('code');
    expect(modA.instanceId).not.toBe(modB.instanceId);
    expect(modA.params.sliders).toBeDefined();
    expect(modB.params.sliders).toBeDefined();
    expect(modA.params.sliders).not.toBe(modB.params.sliders);
  });

  it('cloner chain factory names chains by index and starts empty', () => {
    const chain = createChainInstance(2);
    expect(chain.name).toBe('CHAIN 3');
    expect(chain.duration).toBe(4.0);
    expect(chain.modifiers).toEqual([]);
  });

  it('autopbr defaults and categories include core expected structure', () => {
    expect(DEFAULT_PARAMS.makeSeamless).toBe(false);
    expect(DEFAULT_PARAMS.invert).toBe(false);
    expect(DEFAULT_PARAMS.normalStrength).toBeGreaterThan(0);

    const categories = Object.values(MATERIAL_CATEGORIES);
    expect(categories.length).toBeGreaterThan(3);
    categories.forEach((category) => {
      expect(category.presets.length).toBeGreaterThan(0);
    });
  });

  it('autopbr preset ids are unique across all categories', () => {
    const presetIds = Object.values(MATERIAL_CATEGORIES).flatMap((c) => c.presets.map((p: any) => p.id));
    const unique = new Set(presetIds);
    expect(unique.size).toBe(presetIds.length);
  });

  it('tecton sun direction produces expected cardinal result and normalized vectors', () => {
    const dir = calculateSunDirection(0, 0);
    expect(dir.x).toBeCloseTo(1, 6);
    expect(dir.y).toBeCloseTo(0, 6);
    expect(dir.z).toBeCloseTo(0, 6);

    const dir2 = calculateSunDirection(137, 33);
    expect(dir2.length()).toBeCloseTo(1, 6);
  });

  it('tecton terrain generation is deterministic for same seed and bounded in [0,1]', () => {
    const a = generateTerrainData(16, 16, 12345);
    const b = generateTerrainData(16, 16, 12345);
    expect(a.length).toBe(16 * 16 * 4);
    expect(Array.from(a)).toEqual(Array.from(b));

    for (let i = 0; i < a.length; i += 4) {
      expect(a[i]).toBeGreaterThanOrEqual(0);
      expect(a[i]).toBeLessThanOrEqual(1);
      expect(a[i + 3]).toBe(1);
    }
  });

  it('atlas bin packer normalizes packed rectangles into UV space', () => {
    const packer = new KBinPacker(1, 1);
    const blocks = [
      { id: 1, w: 0.4, h: 0.2, x: 0, y: 0 },
      { id: 2, w: 0.2, h: 0.2, x: 0, y: 0 },
      { id: 3, w: 0.1, h: 0.3, x: 0, y: 0 },
    ];
    packer.fit(blocks, 0.01);

    blocks.forEach((b) => {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(1.01);
      expect(b.y + b.h).toBeLessThanOrEqual(1.01);
      expect(b.w).toBeGreaterThan(0);
      expect(b.h).toBeGreaterThan(0);
    });
  });

  it('atlas material link caches and restores original materials', () => {
    const root = new THREE.Group();
    const original = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const grid = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), original);
    root.add(mesh);

    setupMaterialLink(root);
    expect(mesh.userData.originalMaterial).toBeDefined();

    updateMaterialView(root, false, grid);
    expect(mesh.material).toBe(grid);

    updateMaterialView(root, true, grid);
    expect(mesh.material).not.toBe(grid);
    expect((mesh.material as THREE.Material).type).toBe('MeshStandardMaterial');
  });

  it('graphos simulation catalog is stable and includes core modes', () => {
    const ids = GRAPHOS_SIMS.map((s) => s.id);
    expect(ids.length).toBeGreaterThan(20);
    expect(ids).toContain('wind');
    expect(ids).toContain('blackhole');
    expect(ids).toContain('datamosh');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('bevy viewport overlay renders viewport mode status when tool is not sculpt', async () => {
    vi.mocked(invoke).mockResolvedValue('viewport');
    render(<BevyViewportOverlay />);

    await waitFor(() => {
      expect(screen.getByText('VIEWPORT MODE')).toBeTruthy();
    });
    expect(screen.getByTestId('bevy-layer-panel')).toBeTruthy();
    expect(screen.queryByTestId('bevy-sculpt-panel')).toBeNull();
  });

  it('scatter left panel exposes primitive controls and dispatches selection', async () => {
    const user = userEvent.setup();
    const setActivePrimitive = vi.fn();
    const updatePaletteFromPrimitive = vi.fn();

    render(
      <LeftPanel
        mode="primitives"
        activePrimitive="CUBE"
        setActivePrimitive={setActivePrimitive}
        updatePaletteFromPrimitive={updatePaletteFromPrimitive}
        activeStorageId={null}
        setActiveStorageId={vi.fn()}
        updatePaletteFromStorage={vi.fn()}
        sharedState={{ storage: [] }}
      />
    );

    const primitiveButtons = screen.getAllByRole('button');
    expect(primitiveButtons.length).toBe(5);

    await user.click(primitiveButtons[1]);
    expect(setActivePrimitive).toHaveBeenCalled();
    expect(updatePaletteFromPrimitive).toHaveBeenCalled();
  });
});
