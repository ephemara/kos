import { useSyncExternalStore } from 'react';

/**
 * Tracking settings are runtime-tunable and persisted.
 * Scope can be global or project-specific (selected by launch flow).
 */

export interface TrackingSettings {
  minRenderConfidence: number;
  minOverlayConfidence: number;
  maxBoneSegmentDistance3D: number;
  maxBoneSegmentDistance2DNorm: number;
  minRetargetConfidence: number;
  minCalibrationConfidence: number;
  historyMinConfidence: number;
  historyHoldMs: number;
  historyConfidenceDecayFloor: number;
  staleFrameMs: number;
  statusRefreshMs: number;
  overlaySmoothingAlpha: number;
  maxBoneRotationDeg: number;
  rotationSlerpMin: number;
  rotationSlerpMax: number;
  diagnosticsMinVisibleJoints: number;
}

export type TrackingPresetId = 'studio' | 'fast' | 'aggressive' | 'custom';

export interface TrackingPresetDefinition {
  id: Exclude<TrackingPresetId, 'custom'>;
  label: string;
  description: string;
  settings: TrackingSettings;
}

const TRACKING_SETTING_KEYS: (keyof TrackingSettings)[] = [
  'minRenderConfidence',
  'minOverlayConfidence',
  'maxBoneSegmentDistance3D',
  'maxBoneSegmentDistance2DNorm',
  'minRetargetConfidence',
  'minCalibrationConfidence',
  'historyMinConfidence',
  'historyHoldMs',
  'historyConfidenceDecayFloor',
  'staleFrameMs',
  'statusRefreshMs',
  'overlaySmoothingAlpha',
  'maxBoneRotationDeg',
  'rotationSlerpMin',
  'rotationSlerpMax',
  'diagnosticsMinVisibleJoints',
];

const TRACKING_PRESET_DATA: Record<Exclude<TrackingPresetId, 'custom'>, TrackingPresetDefinition> = {
  studio: {
    id: 'studio',
    label: 'Studio',
    description: 'Balanced quality with stable limbs and reduced deformation spikes.',
    settings: {
      minRenderConfidence: 0.05,
      minOverlayConfidence: 0.08,
      maxBoneSegmentDistance3D: 0.65,
      maxBoneSegmentDistance2DNorm: 0.65,
      minRetargetConfidence: 0.08,
      minCalibrationConfidence: 0.20,
      historyMinConfidence: 0.12,
      historyHoldMs: 320,
      historyConfidenceDecayFloor: 0.35,
      staleFrameMs: 450,
      statusRefreshMs: 200,
      overlaySmoothingAlpha: 0.35,
      maxBoneRotationDeg: 145,
      rotationSlerpMin: 0.35,
      rotationSlerpMax: 0.70,
      diagnosticsMinVisibleJoints: 8,
    },
  },
  fast: {
    id: 'fast',
    label: 'Fast',
    description: 'Lower hold and smoothing for responsive realtime feedback.',
    settings: {
      minRenderConfidence: 0.04,
      minOverlayConfidence: 0.06,
      maxBoneSegmentDistance3D: 0.72,
      maxBoneSegmentDistance2DNorm: 0.72,
      minRetargetConfidence: 0.06,
      minCalibrationConfidence: 0.18,
      historyMinConfidence: 0.10,
      historyHoldMs: 120,
      historyConfidenceDecayFloor: 0.20,
      staleFrameMs: 260,
      statusRefreshMs: 120,
      overlaySmoothingAlpha: 0.60,
      maxBoneRotationDeg: 165,
      rotationSlerpMin: 0.55,
      rotationSlerpMax: 0.88,
      diagnosticsMinVisibleJoints: 6,
    },
  },
  aggressive: {
    id: 'aggressive',
    label: 'Aggressive Stabilize',
    description: 'Heavy stabilization and stricter segment rejection for noisy sources.',
    settings: {
      minRenderConfidence: 0.08,
      minOverlayConfidence: 0.12,
      maxBoneSegmentDistance3D: 0.55,
      maxBoneSegmentDistance2DNorm: 0.55,
      minRetargetConfidence: 0.14,
      minCalibrationConfidence: 0.24,
      historyMinConfidence: 0.16,
      historyHoldMs: 520,
      historyConfidenceDecayFloor: 0.45,
      staleFrameMs: 650,
      statusRefreshMs: 220,
      overlaySmoothingAlpha: 0.22,
      maxBoneRotationDeg: 120,
      rotationSlerpMin: 0.22,
      rotationSlerpMax: 0.58,
      diagnosticsMinVisibleJoints: 9,
    },
  },
};

export const TRACKING_PRESETS = Object.freeze(TRACKING_PRESET_DATA);
export const TRACKING_PRESET_OPTIONS = Object.freeze([
  TRACKING_PRESETS.studio,
  TRACKING_PRESETS.fast,
  TRACKING_PRESETS.aggressive,
]);

export const DEFAULT_TRACKING_SETTINGS: TrackingSettings = { ...TRACKING_PRESETS.studio.settings };
export const DEFAULT_TRACKING_PRESET: Exclude<TrackingPresetId, 'custom'> = 'studio';

export const RETARGET_COMPATIBLE_KEYPOINTS = [17] as const;

export function isRetargetCompatibleKeypoints(keypoints: number): boolean {
  return RETARGET_COMPATIBLE_KEYPOINTS.includes(keypoints as (typeof RETARGET_COMPATIBLE_KEYPOINTS)[number]);
}

const STORAGE_KEY_V2 = 'zen:mocap:tracking-settings:v2';
const STORAGE_KEY_V1 = 'zen:mocap:tracking-settings:v1';
const GLOBAL_SCOPE_ID = 'global';

interface TrackingScopeState {
  presetId: TrackingPresetId;
  settings: TrackingSettings;
}

interface TrackingPersistedStateV2 {
  version: 2;
  activeScopeId: string;
  scopes: Record<string, TrackingScopeState>;
}

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

function sanitize(raw: Partial<TrackingSettings> | null | undefined): TrackingSettings {
  const source = raw ?? {};
  const rotationSlerpMin = clamp(source.rotationSlerpMin ?? DEFAULT_TRACKING_SETTINGS.rotationSlerpMin, 0.01, 1);
  const rotationSlerpMaxRaw = clamp(source.rotationSlerpMax ?? DEFAULT_TRACKING_SETTINGS.rotationSlerpMax, 0.01, 1);
  const rotationSlerpMax = Math.max(rotationSlerpMin, rotationSlerpMaxRaw);
  return {
    minRenderConfidence: clamp(source.minRenderConfidence ?? DEFAULT_TRACKING_SETTINGS.minRenderConfidence, 0, 1),
    minOverlayConfidence: clamp(source.minOverlayConfidence ?? DEFAULT_TRACKING_SETTINGS.minOverlayConfidence, 0, 1),
    maxBoneSegmentDistance3D: clamp(source.maxBoneSegmentDistance3D ?? DEFAULT_TRACKING_SETTINGS.maxBoneSegmentDistance3D, 0.05, 2),
    maxBoneSegmentDistance2DNorm: clamp(source.maxBoneSegmentDistance2DNorm ?? DEFAULT_TRACKING_SETTINGS.maxBoneSegmentDistance2DNorm, 0.05, 2),
    minRetargetConfidence: clamp(source.minRetargetConfidence ?? DEFAULT_TRACKING_SETTINGS.minRetargetConfidence, 0, 1),
    minCalibrationConfidence: clamp(source.minCalibrationConfidence ?? DEFAULT_TRACKING_SETTINGS.minCalibrationConfidence, 0, 1),
    historyMinConfidence: clamp(source.historyMinConfidence ?? DEFAULT_TRACKING_SETTINGS.historyMinConfidence, 0, 1),
    historyHoldMs: Math.round(clamp(source.historyHoldMs ?? DEFAULT_TRACKING_SETTINGS.historyHoldMs, 0, 5000)),
    historyConfidenceDecayFloor: clamp(source.historyConfidenceDecayFloor ?? DEFAULT_TRACKING_SETTINGS.historyConfidenceDecayFloor, 0, 1),
    staleFrameMs: Math.round(clamp(source.staleFrameMs ?? DEFAULT_TRACKING_SETTINGS.staleFrameMs, 16, 5000)),
    statusRefreshMs: Math.round(clamp(source.statusRefreshMs ?? DEFAULT_TRACKING_SETTINGS.statusRefreshMs, 16, 5000)),
    overlaySmoothingAlpha: clamp(source.overlaySmoothingAlpha ?? DEFAULT_TRACKING_SETTINGS.overlaySmoothingAlpha, 0.01, 1),
    maxBoneRotationDeg: clamp(source.maxBoneRotationDeg ?? DEFAULT_TRACKING_SETTINGS.maxBoneRotationDeg, 5, 180),
    rotationSlerpMin,
    rotationSlerpMax,
    diagnosticsMinVisibleJoints: Math.round(clamp(source.diagnosticsMinVisibleJoints ?? DEFAULT_TRACKING_SETTINGS.diagnosticsMinVisibleJoints, 1, 17)),
  };
}

function sameSettings(a: TrackingSettings, b: TrackingSettings): boolean {
  const EPS = 0.0001;
  return TRACKING_SETTING_KEYS.every((key) => Math.abs(a[key] - b[key]) <= EPS);
}

function inferPreset(settings: TrackingSettings): TrackingPresetId {
  const found = TRACKING_PRESET_OPTIONS.find((preset) => sameSettings(settings, preset.settings));
  return found ? found.id : 'custom';
}

function normalizeScopeId(scopeId: string | null | undefined): string {
  const cleaned = (scopeId ?? '').trim();
  return cleaned.length > 0 ? cleaned : GLOBAL_SCOPE_ID;
}

function makeScopeStateFromPreset(presetId: Exclude<TrackingPresetId, 'custom'>): TrackingScopeState {
  return {
    presetId,
    settings: sanitize(TRACKING_PRESETS[presetId].settings),
  };
}

function sanitizeScopeState(raw: Partial<TrackingScopeState> | undefined): TrackingScopeState {
  const settings = sanitize(raw?.settings);
  const presetId = raw?.presetId;
  const normalizedPreset: TrackingPresetId = presetId && (presetId in TRACKING_PRESETS || presetId === 'custom')
    ? presetId
    : inferPreset(settings);
  return {
    presetId: normalizedPreset,
    settings,
  };
}

function migrateLegacyState(): TrackingPersistedStateV2 | null {
  try {
    const rawV1 = localStorage.getItem(STORAGE_KEY_V1);
    if (!rawV1) return null;
    const legacy = sanitize(JSON.parse(rawV1) as Partial<TrackingSettings>);
    return {
      version: 2,
      activeScopeId: GLOBAL_SCOPE_ID,
      scopes: {
        [GLOBAL_SCOPE_ID]: {
          presetId: inferPreset(legacy),
          settings: legacy,
        },
      },
    };
  } catch {
    return null;
  }
}

function loadInitialState(): TrackingPersistedStateV2 {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_V2);
    if (!raw) {
      return migrateLegacyState() ?? {
        version: 2,
        activeScopeId: GLOBAL_SCOPE_ID,
        scopes: {
          [GLOBAL_SCOPE_ID]: makeScopeStateFromPreset(DEFAULT_TRACKING_PRESET),
        },
      };
    }

    const parsed = JSON.parse(raw) as Partial<TrackingPersistedStateV2>;
    const activeScopeId = normalizeScopeId(parsed.activeScopeId);
    const inputScopes = parsed.scopes ?? {};
    const scopes: Record<string, TrackingScopeState> = {};

    for (const [scopeId, scope] of Object.entries(inputScopes)) {
      scopes[normalizeScopeId(scopeId)] = sanitizeScopeState(scope);
    }

    if (!scopes[GLOBAL_SCOPE_ID]) {
      scopes[GLOBAL_SCOPE_ID] = makeScopeStateFromPreset(DEFAULT_TRACKING_PRESET);
    }
    if (!scopes[activeScopeId]) {
      scopes[activeScopeId] = makeScopeStateFromPreset(DEFAULT_TRACKING_PRESET);
    }

    return {
      version: 2,
      activeScopeId,
      scopes,
    };
  } catch {
    return {
      version: 2,
      activeScopeId: GLOBAL_SCOPE_ID,
      scopes: {
        [GLOBAL_SCOPE_ID]: makeScopeStateFromPreset(DEFAULT_TRACKING_PRESET),
      },
    };
  }
}

let currentState: TrackingPersistedStateV2 = loadInitialState();
const listeners = new Set<() => void>();

function persistState(): void {
  try {
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(currentState));
  } catch {
    // Ignore storage failures (private mode / quota).
  }
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

function ensureScope(scopeId: string): TrackingScopeState {
  const normalized = normalizeScopeId(scopeId);
  const existing = currentState.scopes[normalized];
  if (existing) return existing;

  const nextScope = makeScopeStateFromPreset(DEFAULT_TRACKING_PRESET);
  currentState = {
    ...currentState,
    scopes: {
      ...currentState.scopes,
      [normalized]: nextScope,
    },
  };
  return nextScope;
}

function getActiveScopeState(): TrackingScopeState {
  return ensureScope(currentState.activeScopeId);
}

function patchActiveScope(nextScope: TrackingScopeState): void {
  const activeScopeId = normalizeScopeId(currentState.activeScopeId);
  currentState = {
    ...currentState,
    activeScopeId,
    scopes: {
      ...currentState.scopes,
      [activeScopeId]: sanitizeScopeState(nextScope),
    },
  };
}

export function getTrackingProjectScope(): string {
  return normalizeScopeId(currentState.activeScopeId);
}

export function setTrackingProjectScope(scopeId: string | null | undefined): TrackingSettings {
  const normalizedScopeId = normalizeScopeId(scopeId);
  const currentScopeId = normalizeScopeId(currentState.activeScopeId);
  if (normalizedScopeId === currentScopeId && currentState.scopes[normalizedScopeId]) {
    return getTrackingSettings();
  }
  ensureScope(normalizedScopeId);
  currentState = {
    ...currentState,
    activeScopeId: normalizedScopeId,
  };
  persistState();
  emit();
  return getTrackingSettings();
}

export function getTrackingSettings(): TrackingSettings {
  return getActiveScopeState().settings;
}

export function getTrackingPresetId(): TrackingPresetId {
  return getActiveScopeState().presetId;
}

export function applyTrackingPreset(presetId: Exclude<TrackingPresetId, 'custom'>): TrackingSettings {
  patchActiveScope(makeScopeStateFromPreset(presetId));
  persistState();
  emit();
  return getTrackingSettings();
}

export function updateTrackingSettings(partial: Partial<TrackingSettings>): TrackingSettings {
  const active = getActiveScopeState();
  const merged = sanitize({ ...active.settings, ...partial });
  patchActiveScope({
    presetId: inferPreset(merged),
    settings: merged,
  });
  persistState();
  emit();
  return getTrackingSettings();
}

export function resetTrackingSettings(): TrackingSettings {
  return applyTrackingPreset(DEFAULT_TRACKING_PRESET);
}

export function subscribeTrackingSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTrackingSettings() {
  const settings = useSyncExternalStore(
    subscribeTrackingSettings,
    getTrackingSettings,
    getTrackingSettings,
  );
  const presetId = useSyncExternalStore(
    subscribeTrackingSettings,
    getTrackingPresetId,
    getTrackingPresetId,
  );
  const scopeId = useSyncExternalStore(
    subscribeTrackingSettings,
    getTrackingProjectScope,
    getTrackingProjectScope,
  );

  return {
    settings,
    presetId,
    scopeId,
    presetOptions: TRACKING_PRESET_OPTIONS,
    updateSettings: updateTrackingSettings,
    resetSettings: resetTrackingSettings,
    applyPreset: applyTrackingPreset,
    setScope: setTrackingProjectScope,
  };
}
