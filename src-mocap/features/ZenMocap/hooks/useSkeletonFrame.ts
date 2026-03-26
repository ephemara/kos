/**
 * useSkeletonFrame
 *
 * Subscribes to the per-frame joint data stream ('mocap://joint_frame').
 *
 * ALSO listens for:
 *   - `mocap://error`      — pipeline-level fatal errors (session dies after this)
 *   - `mocap://gpu_health` — GPU device-level errors from the wgpu uncaptured error handler
 *
 * Writes frame data to a ref (not state) so the 30Hz event loop never triggers
 * a React re-render. The Three.js rAF loop reads the ref directly.
 * Errors are stored in state so UI components can display them.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import type { JointFrame, RawJointFrame } from '../types';
import { normalizeJointFrame } from '../types';

const JOINT_FRAME_EVENT = 'mocap://joint_frame';
const PIPELINE_ERR_EVENT = 'mocap://error';
const GPU_HEALTH_EVENT = 'mocap://gpu_health';

// ─── GPU health event type (mirrors Rust GpuHealthEvent) ─────────────────────

export interface GpuHealthEvent {
  /** "device_lost" | "out_of_memory" | "validation" | "internal" | "unknown" */
  kind: string;
  message: string;
  timestamp_ms: number;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSkeletonFrame(active: boolean) {
  // Ref for Three.js hot path — zero React renders
  const latestFrame = useRef<JointFrame | null>(null);
  // Lightweight counter for UI
  const [frameCount, setFrameCount] = useState(0);
  // Pipeline errors (fatal — session dead after this)
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  // GPU health events (non-fatal warnings or fatal device errors)
  const [gpuHealth, setGpuHealth] = useState<GpuHealthEvent[]>([]);

  const clearErrors = useCallback(() => {
    setPipelineError(null);
    setGpuHealth([]);
  }, []);

  useEffect(() => {
    const unlisten: Array<() => void> = [];

    // ── Joint frame ──────────────────────────────────────────────────────────
    listen<RawJointFrame>(JOINT_FRAME_EVENT, e => {
      const frame = normalizeJointFrame(e.payload);
      latestFrame.current = frame;
      // Only trigger React re-render every 10 frames for UI counters
      if (frame.frame_id % 10 === 0) {
        setFrameCount(frame.frame_id);
      }
    }).then(fn => unlisten.push(fn));

    // ── Pipeline error (fatal) ───────────────────────────────────────────────
    listen<string>(PIPELINE_ERR_EVENT, e => {
      console.error('[useSkeletonFrame] Pipeline error:', e.payload);
      setPipelineError(e.payload);
    }).then(fn => unlisten.push(fn));

    // ── GPU health (non-fatal or device-lost) ────────────────────────────────
    listen<GpuHealthEvent>(GPU_HEALTH_EVENT, e => {
      console.error('[gpu-doctor]', e.payload.kind, e.payload.message);
      setGpuHealth(prev => [e.payload, ...prev].slice(0, 20)); // keep last 20
    }).then(fn => unlisten.push(fn));

    return () => { unlisten.forEach(fn => fn()); };
  }, [clearErrors]);

  // Preserve previous behavior: when a live session becomes inactive,
  // clear only errors (but keep latest frame so offline analysis playback
  // can still drive the viewport without a running live session).
  useEffect(() => {
    if (!active) {
      clearErrors();
    }
  }, [active, clearErrors]);

  return {
    latestFrame,
    frameCount,
    pipelineError,
    gpuHealth,
    clearErrors,
  };
}
