import { describe, expect, it } from 'vitest';
import {
  getShellGridMotionClass,
  getShellPanelMotionClass,
  resolveLightningDriveTier,
  resolveShellMotionMode,
  resolveUiCapacitorState,
} from '../motionSystem';

describe('Shell Motion System', () => {
  it('selects full mode by default when motion is allowed', () => {
    expect(resolveShellMotionMode({ prefersReducedMotion: false })).toBe('full');
  });

  it('selects reduced mode when reduced-motion is preferred', () => {
    expect(resolveShellMotionMode({ prefersReducedMotion: true })).toBe('reduced');
  });

  it('selects balanced mode on low-power mode without reduced-motion', () => {
    expect(
      resolveShellMotionMode({ prefersReducedMotion: false, lowPowerMode: true })
    ).toBe('balanced');
  });

  it('prefers reduced over low-power when both are true', () => {
    expect(
      resolveShellMotionMode({ prefersReducedMotion: true, lowPowerMode: true })
    ).toBe('reduced');
  });

  it('returns full grid transition class in full mode', () => {
    expect(getShellGridMotionClass('full', false)).toBe('kos-shell-grid--full');
  });

  it('returns balanced grid transition class in balanced mode', () => {
    expect(getShellGridMotionClass('balanced', false)).toBe('kos-shell-grid--balanced');
  });

  it('disables grid transitions while actively resizing', () => {
    expect(getShellGridMotionClass('full', true)).toBe('');
    expect(getShellGridMotionClass('balanced', true)).toBe('');
  });

  it('disables grid transitions in reduced mode', () => {
    expect(getShellGridMotionClass('reduced', false)).toBe('');
  });

  it('disables grid transitions in safe lightning drive tier', () => {
    expect(getShellGridMotionClass('full', false, 'safe')).toBe('');
  });

  it('maps panel class for each motion mode', () => {
    expect(getShellPanelMotionClass('full')).toBe('kos-shell-panel--full');
    expect(getShellPanelMotionClass('balanced')).toBe('kos-shell-panel--balanced');
    expect(getShellPanelMotionClass('reduced')).toBe('kos-shell-panel--reduced');
  });

  it('forces reduced panel class in safe lightning drive tier', () => {
    expect(getShellPanelMotionClass('full', 'safe')).toBe('kos-shell-panel--reduced');
  });

  it('returns safe lightning drive when reduced-motion is preferred', () => {
    expect(
      resolveLightningDriveTier({
        frameTimes: [14, 15, 16, 15.5],
        prefersReducedMotion: true,
      })
    ).toBe('safe');
  });

  it('returns warp tier for strong frame times', () => {
    expect(
      resolveLightningDriveTier({
        frameTimes: [15.8, 16.1, 16.0, 16.2, 15.9, 16.3],
        prefersReducedMotion: false,
      })
    ).toBe('warp');
  });

  it('returns safe tier for weak frame times', () => {
    expect(
      resolveLightningDriveTier({
        frameTimes: [24, 30, 26, 28, 35, 27],
        prefersReducedMotion: false,
      })
    ).toBe('safe');
  });

  it('resolves ui capacitor states from motion and interaction inputs', () => {
    expect(
      resolveUiCapacitorState({
        mode: 'full',
        lightningDriveTier: 'warp',
        isResizing: false,
        isPointerActive: true,
      })
    ).toBe('charged');

    expect(
      resolveUiCapacitorState({
        mode: 'full',
        lightningDriveTier: 'safe',
        isResizing: false,
        isPointerActive: false,
      })
    ).toBe('priming');

    expect(
      resolveUiCapacitorState({
        mode: 'reduced',
        lightningDriveTier: 'warp',
        isResizing: false,
        isPointerActive: true,
      })
    ).toBe('discharged');
  });
});
