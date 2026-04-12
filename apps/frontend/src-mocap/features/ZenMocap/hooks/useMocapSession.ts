/**
 * useMocapSession
 *
 * Session lifecycle hook. Uses mocapService (BaseService subclass) for all IPC.
 * Take recording delegates to bakeAnimation from lib/animation — reuses the
 * existing K_OS baking infrastructure instead of a new ad-hoc recorder.
 */

import { useState, useCallback, useRef } from 'react';
import { mocapService } from '../MocapService';
import type { SessionConfig, SessionState, JointFrame } from '../types';
import { publishMocapInterop } from '@mocap/shared/services/mocapInterop';

export function useMocapSession() {
  const [session, setSession] = useState<SessionState>({
    status: 'idle',
    config: null,
    error: null,
  });

  const start = useCallback(async (config: SessionConfig) => {
    setSession({ status: 'initializing', config, error: null });
    await publishMocapInterop('session-state', {
      source: 'zen-mocap',
      status: 'initializing',
      modelId: config.model_id,
      dccTarget: config.dcc_target,
      error: null,
      timestampMs: Date.now(),
    }).catch(() => {});
    try {
      await mocapService.startSession(config);
      setSession(s => ({ ...s, status: 'running' }));
      await publishMocapInterop('session-state', {
        source: 'zen-mocap',
        status: 'running',
        modelId: config.model_id,
        dccTarget: config.dcc_target,
        error: null,
        timestampMs: Date.now(),
      }).catch(() => {});
    } catch (err) {
      setSession({ status: 'error', config, error: String(err) });
      await publishMocapInterop('session-state', {
        source: 'zen-mocap',
        status: 'error',
        modelId: config.model_id,
        dccTarget: config.dcc_target,
        error: String(err),
        timestampMs: Date.now(),
      }).catch(() => {});
    }
  }, []);

  const stop = useCallback(async () => {
    await mocapService.stopSession().catch(() => { });
    setSession({ status: 'idle', config: null, error: null });
    await publishMocapInterop('session-state', {
      source: 'zen-mocap',
      status: 'idle',
      modelId: null,
      dccTarget: null,
      error: null,
      timestampMs: Date.now(),
    }).catch(() => {});
  }, []);

  const pause = useCallback(async () => {
    await mocapService.setPaused(true);
    setSession(s => ({ ...s, status: 'paused' }));
    await publishMocapInterop('session-state', {
      source: 'zen-mocap',
      status: 'paused',
      modelId: session.config?.model_id ?? null,
      dccTarget: session.config?.dcc_target ?? null,
      error: null,
      timestampMs: Date.now(),
    }).catch(() => {});
  }, [session.config?.dcc_target, session.config?.model_id]);

  const resume = useCallback(async () => {
    await mocapService.setPaused(false);
    setSession(s => ({ ...s, status: 'running' }));
    await publishMocapInterop('session-state', {
      source: 'zen-mocap',
      status: 'running',
      modelId: session.config?.model_id ?? null,
      dccTarget: session.config?.dcc_target ?? null,
      error: null,
      timestampMs: Date.now(),
    }).catch(() => {});
  }, [session.config?.dcc_target, session.config?.model_id]);

  const record = useCallback(async () => {
    const path = await mocapService.openSaveTakeDialog();
    if (!path) return;
    await mocapService.setRecording(true);
    setSession(s => ({ ...s, status: 'recording' }));
    await publishMocapInterop('session-state', {
      source: 'zen-mocap',
      status: 'recording',
      modelId: session.config?.model_id ?? null,
      dccTarget: session.config?.dcc_target ?? null,
      error: null,
      timestampMs: Date.now(),
    }).catch(() => {});
  }, [session.config?.dcc_target, session.config?.model_id]);

  const stopRecord = useCallback(async () => {
    await mocapService.setRecording(false);
    setSession(s => ({ ...s, status: 'running' }));
    await publishMocapInterop('session-state', {
      source: 'zen-mocap',
      status: 'running',
      modelId: session.config?.model_id ?? null,
      dccTarget: session.config?.dcc_target ?? null,
      error: null,
      timestampMs: Date.now(),
    }).catch(() => {});
  }, [session.config?.dcc_target, session.config?.model_id]);

  const isActive = session.status === 'running' || session.status === 'recording';
  const isPaused = session.status === 'paused';
  const isIdle = session.status === 'idle';
  const isError = session.status === 'error';

  return { session, start, stop, pause, resume, record, stopRecord, isActive, isPaused, isIdle, isError };
}
