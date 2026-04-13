import React, { useCallback } from 'react';
import { ButterSlider } from '@mocap/shared/primitives/ButterSlider';
import {
  DEFAULT_TRACKING_SETTINGS,
  type TrackingSettings,
  useTrackingSettings,
} from '../trackingConfig';

interface SliderEntry {
  key: keyof TrackingSettings;
  label: string;
  min: number;
  max: number;
  step: number;
  description: string;
  format?: (v: number) => string;
  normalize?: (v: number) => number;
}

const TRACKING_SLIDER_CONFIG: SliderEntry[] = [
  { key: 'minRenderConfidence', label: 'RENDER CONF', min: 0, max: 1, step: 0.01, description: '3D viewport joint visibility gate', format: (v) => v.toFixed(2) },
  { key: 'minOverlayConfidence', label: 'OVERLAY CONF', min: 0, max: 1, step: 0.01, description: 'Video/webcam overlay visibility gate', format: (v) => v.toFixed(2) },
  { key: 'minRetargetConfidence', label: 'RETARGET CONF', min: 0, max: 1, step: 0.01, description: 'Minimum confidence to drive bones', format: (v) => v.toFixed(2) },
  { key: 'minCalibrationConfidence', label: 'CALIB CONF', min: 0, max: 1, step: 0.01, description: 'Minimum confidence for body-scale calibration', format: (v) => v.toFixed(2) },
  { key: 'maxBoneSegmentDistance3D', label: 'MAX SEG 3D', min: 0.1, max: 1.5, step: 0.01, description: 'Reject implausible 3D skeleton edges', format: (v) => v.toFixed(2) },
  { key: 'maxBoneSegmentDistance2DNorm', label: 'MAX SEG 2D', min: 0.1, max: 1.5, step: 0.01, description: 'Reject implausible 2D overlay edges', format: (v) => v.toFixed(2) },
  { key: 'historyHoldMs', label: 'HISTORY HOLD', min: 0, max: 1200, step: 10, description: 'Hold lost joints for this long (ms)', format: (v) => `${Math.round(v)}ms`, normalize: (v) => Math.round(v) },
  { key: 'historyConfidenceDecayFloor', label: 'HISTORY FLOOR', min: 0, max: 1, step: 0.01, description: 'Minimum confidence while holding history', format: (v) => v.toFixed(2) },
  { key: 'overlaySmoothingAlpha', label: 'OVERLAY SMOOTH', min: 0.01, max: 1, step: 0.01, description: '2D overlay smoothing blend', format: (v) => v.toFixed(2) },
  { key: 'staleFrameMs', label: 'STALE TIMEOUT', min: 16, max: 2000, step: 10, description: 'Frame age threshold before stale', format: (v) => `${Math.round(v)}ms`, normalize: (v) => Math.round(v) },
  { key: 'maxBoneRotationDeg', label: 'MAX BONE ROT', min: 30, max: 180, step: 1, description: 'Clamp extreme retarget bone rotation', format: (v) => `${Math.round(v)}°`, normalize: (v) => Math.round(v) },
  { key: 'rotationSlerpMin', label: 'SLERP MIN', min: 0.05, max: 1, step: 0.01, description: 'Low-confidence solve blend', format: (v) => v.toFixed(2) },
  { key: 'rotationSlerpMax', label: 'SLERP MAX', min: 0.05, max: 1, step: 0.01, description: 'High-confidence solve blend', format: (v) => v.toFixed(2) },
  { key: 'diagnosticsMinVisibleJoints', label: 'MIN JOINTS HUD', min: 1, max: 17, step: 1, description: 'Minimum visible joints for healthy HUD state', format: (v) => `${Math.round(v)}`, normalize: (v) => Math.round(v) },
];

export default function TrackingSettingsPanel() {
  const {
    settings,
    presetId,
    scopeId,
    presetOptions,
    updateSettings,
    resetSettings,
    applyPreset,
  } = useTrackingSettings();

  const onSlider = useCallback((entry: SliderEntry, value: number) => {
    const normalized = entry.normalize ? entry.normalize(value) : value;
    updateSettings({ [entry.key]: normalized } as Partial<TrackingSettings>);
  }, [updateSettings]);

  return (
    <div className="space-y-4 px-1">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black tracking-widest text-gray-500 uppercase">Tracking Runtime Settings</span>
        <div className="flex items-center gap-1">
          <button
            onClick={resetSettings}
            className="text-[8px] px-2 py-1 rounded border border-[#333] text-gray-400 hover:text-white hover:border-[#555] transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="rounded-md border border-[#202020] bg-[#090909] p-2 text-[8px] text-gray-500 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-black tracking-[0.18em] uppercase text-gray-400">Preset</span>
          <span className="font-mono text-gray-600">
            Scope: {scopeId}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {presetOptions.map((preset) => {
            const active = presetId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset.id)}
                className={[
                  'rounded border px-2 py-1 text-left transition-colors',
                  active
                    ? 'border-[#00ffcc]/45 bg-[#00ffcc]/10 text-[#00ffcc]'
                    : 'border-[#2a2a2a] bg-black/30 text-gray-400 hover:text-white hover:border-[#555]',
                ].join(' ')}
                title={preset.description}
              >
                <div className="text-[8px] font-black tracking-wider uppercase">{preset.label}</div>
              </button>
            );
          })}
          {presetId === 'custom' && (
            <div className="rounded border border-orange-500/30 bg-orange-500/8 px-2 py-1 text-[8px] font-black tracking-wider uppercase text-orange-300">
              Custom
            </div>
          )}
        </div>
      </div>

      {TRACKING_SLIDER_CONFIG.map((entry) => (
        <div key={entry.key}>
          <ButterSlider
            label={entry.label}
            value={settings[entry.key]}
            onValueChange={(v) => onSlider(entry, v)}
            min={entry.min}
            max={entry.max}
            step={entry.step}
            formatValue={entry.format}
          />
          <p className="text-[8px] text-gray-600 mt-0.5 pl-0.5">{entry.description}</p>
        </div>
      ))}

      <div className="rounded-md border border-[#202020] bg-[#090909] p-2 text-[8px] text-gray-500">
        Defaults ({DEFAULT_TRACKING_SETTINGS.minRenderConfidence.toFixed(2)} render / {DEFAULT_TRACKING_SETTINGS.minRetargetConfidence.toFixed(2)} retarget / {DEFAULT_TRACKING_SETTINGS.maxBoneRotationDeg}° max rot)
      </div>
    </div>
  );
}
