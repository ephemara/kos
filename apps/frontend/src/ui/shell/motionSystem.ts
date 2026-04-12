export type ShellMotionMode = 'full' | 'balanced' | 'reduced';
export type LightningDriveTier = 'warp' | 'cruise' | 'safe';
export type UiCapacitorState = 'charged' | 'priming' | 'discharged';

type ResolveMotionModeInput = {
  prefersReducedMotion: boolean;
  lowPowerMode?: boolean;
};

export function resolveShellMotionMode(input: ResolveMotionModeInput): ShellMotionMode {
  if (input.prefersReducedMotion) return 'reduced';
  if (input.lowPowerMode) return 'balanced';
  return 'full';
}

export function getShellGridMotionClass(
  mode: ShellMotionMode,
  isResizing: boolean,
  tier: LightningDriveTier = 'warp'
): string {
  if (tier === 'safe') return '';
  if (isResizing || mode === 'reduced') return '';
  if (mode === 'balanced') return 'kos-shell-grid--balanced';
  return 'kos-shell-grid--full';
}

export function getShellPanelMotionClass(
  mode: ShellMotionMode,
  tier: LightningDriveTier = 'warp'
): string {
  if (tier === 'safe') return 'kos-shell-panel--reduced';
  if (mode === 'reduced') return 'kos-shell-panel--reduced';
  if (mode === 'balanced') return 'kos-shell-panel--balanced';
  return 'kos-shell-panel--full';
}

type ResolveLightningDriveTierInput = {
  frameTimes: number[];
  prefersReducedMotion: boolean;
  targetFrameMs?: number;
};

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.floor((sorted.length - 1) * p);
  return sorted[index] ?? sorted[sorted.length - 1] ?? 0;
}

export function resolveLightningDriveTier(
  input: ResolveLightningDriveTierInput
): LightningDriveTier {
  if (input.prefersReducedMotion) return 'safe';
  if (!input.frameTimes.length) return 'cruise';

  const target = input.targetFrameMs ?? 16.7;
  const average =
    input.frameTimes.reduce((sum, frame) => sum + frame, 0) / input.frameTimes.length;
  const p95 = percentile(input.frameTimes, 0.95);

  if (average <= target * 1.02 && p95 <= target * 1.35) return 'warp';
  if (average <= target * 1.42 && p95 <= target * 2.1) return 'cruise';
  return 'safe';
}

type ResolveUiCapacitorStateInput = {
  mode: ShellMotionMode;
  lightningDriveTier: LightningDriveTier;
  isResizing: boolean;
  isPointerActive: boolean;
};

export function resolveUiCapacitorState(
  input: ResolveUiCapacitorStateInput
): UiCapacitorState {
  if (input.mode === 'reduced') return 'discharged';
  if (input.isResizing) return 'priming';
  if (input.lightningDriveTier === 'safe') return 'priming';
  if (input.isPointerActive) return 'charged';
  return input.lightningDriveTier === 'warp' ? 'charged' : 'priming';
}
