/**
 * usePipelineStats
 *
 * Subscribes to Tauri event 'mocap://stats' emitted by the Rust pipeline at ~1Hz.
 *
 * NOTE: Pipeline errors (`mocap://error`) are handled exclusively by
 * `useSkeletonFrame` which also handles `mocap://gpu_health`.
 * This hook only tracks performance stats.
 */

import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import type { PipelineStats } from '../types';

const STATS_EVENT = 'mocap://stats';

const DEFAULT_STATS: PipelineStats = {
  fps: 0, avg_latency_ms: 0, peak_latency_ms: 0,
  frame_drops: 0, vram_mb: 0, udp_tx_count: 0, udp_connected: false,
};

export function usePipelineStats(active: boolean) {
  const [stats, setStats] = useState<PipelineStats>(DEFAULT_STATS);

  useEffect(() => {
    if (!active) { setStats(DEFAULT_STATS); return; }

    let unlisten: (() => void) | null = null;

    listen<PipelineStats>(STATS_EVENT, e => setStats(e.payload))
      .then(fn => { unlisten = fn; });

    return () => { unlisten?.(); };
  }, [active]);

  return { stats };
}
