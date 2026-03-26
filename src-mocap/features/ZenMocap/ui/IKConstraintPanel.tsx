/**
 * IKConstraintPanel
 *
 * Live-tunable WGSL compute shader parameters.
 * Config is data-driven — add/remove/reorder sliders by editing
 * IK_SLIDER_CONFIG. The component itself has zero hardcoded values.
 *
 * Uses ButterSlider from shared/primitives — the established slider
 * component across the entire K_OS design system.
 */

import React, { useState, useCallback } from 'react';
import { ButterSlider } from '@mocap/shared/primitives/ButterSlider';
import { mocapService } from '../MocapService';
import { DEFAULT_IK_CONSTRAINTS } from '../types';
import type { IKConstraints } from '../types';

// ─── Data-Driven Slider Config ───────────────────────────────────────────────
// Each entry maps 1:1 to a key in IKConstraints (enforced by `key` type).
// To add a new tunable: add an entry here + add the field to IKConstraints in types.ts.

interface SliderEntry {
  key: keyof IKConstraints;
  label: string;
  min: number;
  max: number;
  step: number;
  snapPoints?: number[];
  description: string;
  format?: (v: number) => string;
}

const IK_SLIDER_CONFIG: SliderEntry[] = [
  {
    key: 'foot_lock_strength',
    label: 'FOOT LOCK',
    min: 0,
    max: 1,
    step: 0.01,
    snapPoints: [0, 0.5, 1],
    description: 'FABRIK y=0 floor constraint strength',
    format: (v) => `${(v * 100).toFixed(0)}%`,
  },
  {
    key: 'bone_length_tolerance',
    label: 'BONE TOLERANCE',
    min: 0,
    max: 0.1,
    step: 0.001,
    snapPoints: [0.01, 0.02, 0.05],
    description: 'Max deviation before IK snap (m)',
    format: (v) => `${v.toFixed(3)}m`,
  },
  {
    key: 'filter_min_cutoff',
    label: 'FILTER CUTOFF',
    min: 0.1,
    max: 10,
    step: 0.1,
    snapPoints: [1, 2, 5],
    description: '1Euro min cutoff frequency (Hz)',
    format: (v) => `${v.toFixed(1)}Hz`,
  },
  {
    key: 'filter_beta',
    label: 'FILTER SPEED β',
    min: 0,
    max: 0.1,
    step: 0.001,
    snapPoints: [0.007],
    description: '1Euro speed coefficient',
    format: (v) => v.toFixed(3),
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface IKConstraintPanelProps {
  active: boolean;
}

export default function IKConstraintPanel({ active }: IKConstraintPanelProps) {
  const [constraints, setConstraints] = useState<IKConstraints>(DEFAULT_IK_CONSTRAINTS);

  const handleChange = useCallback(
    async (key: keyof IKConstraints, value: number) => {
      const next = { ...constraints, [key]: value };
      setConstraints(next);
      if (active) {
        await mocapService.updateIK(next).catch(() => { });
      }
    },
    [constraints, active],
  );

  return (
    <div className="space-y-4 px-1">
      {IK_SLIDER_CONFIG.map((entry) => (
        <div key={entry.key}>
          <ButterSlider
            label={entry.label}
            value={constraints[entry.key]}
            onValueChange={(v) => handleChange(entry.key, v)}
            min={entry.min}
            max={entry.max}
            step={entry.step}
            snapPoints={entry.snapPoints}
            disabled={!active}
            formatValue={entry.format}
          />
          <p className="text-[8px] text-gray-600 mt-0.5 pl-0.5">{entry.description}</p>
        </div>
      ))}
    </div>
  );
}
