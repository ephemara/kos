/**
 * ZenMocap — Root Session Shell
 *
 * Two pipeline modes:
 *  • RECORD   — Sequencer-driven take capture
 *  • LIVELINK — Real-time DCC broadcast
 *
 * Bottom panel shows:
 *  - SequencerTimeline while a recording session is active / sequencer has content
 *  - TimelinePanel when reviewing a saved take
 *
 * Right-panel tabs are data-driven (DockTab[]).
 * All state is lifted here. Zero hardcoded wiring per-feature.
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Activity, Sliders, Wifi, Film, Database, Video, Cpu } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { AppShell } from '@mocap/shared/shell/AppShell';
import type { DockTab } from '@mocap/shared/shell/DockPanel';
import SessionViewport from './ui/SessionViewport';
import { CHARACTER_OPTIONS, type CharacterId } from './characterOptions';
import CameraSessionModal from './ui/CameraSessionModal';
import PipelineControls from './ui/PipelineControls';
import IKConstraintPanel from './ui/IKConstraintPanel';
import TrackingSettingsPanel from './ui/TrackingSettingsPanel';
import LiveLinkStatus from './ui/LiveLinkStatus';
import TimelinePanel from './ui/TimelinePanel';
import VideoDropZone from './ui/VideoDropZone';
import { GpuDoctorPanel } from './ui/GpuDoctorPanel';
import KContentBrowser from '@mocap/shared/systems/content-browser/KContentBrowser';
import { useMocapSession } from './hooks/useMocapSession';
import { usePipelineStats } from './hooks/usePipelineStats';
import { useSkeletonFrame } from './hooks/useSkeletonFrame';
import { useTakes } from './hooks/useTakes';
import { DCC_TARGET_CONFIG } from './types';
import type { DccTarget, SessionConfig, JointFrame, TakeSummary } from './types';
import { setTrackingProjectScope } from './trackingConfig';
import { mocapService } from './MocapService';
import { TIMELINE_RUNTIME_PERSISTENCE_POLICY } from './timelinePersistencePolicy';
import type {
  TimelineRuntimeDiagnosticsMutationMetadata,
  TimelineRuntimeDiagnosticsPolicy,
  TimelineRuntimeDiagnosticsReport,
} from './MocapService';
import { coerceTimelineRuntimeDiagnosticsChangedPayload } from './timelineDiagnosticsEvent';
import { FALLBACK_TIMELINE_DIAGNOSTICS_POLICY } from './timelineDiagnosticsFallbackPolicy';
import {
  shouldApplyTimelineDiagnosticsUpdate,
  timelineDiagnosticsVersion,
} from './timelineDiagnosticsFreshness';

// Sequencer
import { useSequencer, createEmptySession } from '../Sequencer';
import { SequencerTimeline } from '../Sequencer';

const TIMELINE_RUNTIME_DIAGNOSTICS_CHANGED_EVENT = 'mocap://timeline_runtime_diagnostics_changed';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ZenMocapLaunchConfig {
  cameraDeviceId?: string;
  modelId?: string;
  targetHost?: string;
  characterId?: CharacterId;
  previewMode?: 'skeleton' | 'video';
  fps?: number;
  projectId?: string;
}

interface ZenMocapProps {
  launchConfig?: ZenMocapLaunchConfig;
  /** Controlled from App.tsx top-bar View menu */
  webcamOpen?: boolean;
  onWebcamClose?: () => void;
}

// ─── Root Component ───────────────────────────────────────────────────────────

export default function ZenMocap({ launchConfig = {}, webcamOpen = false, onWebcamClose }: ZenMocapProps) {
  const [dccTarget, setDccTarget] = useState<DccTarget>('ue5');
  const [browserOpen, setBrowserOpen] = useState(false);
  const [characterId, setCharacterId] = useState<CharacterId>(launchConfig.characterId ?? 'mixamo_bot');
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [activeCameraIndex, setActiveCameraIndex] = useState<number>(0);

  const [gpuDoctorOpen, setGpuDoctorOpen] = useState(false);
  const [timelineRuntimeDiagnosticsPolicy, setTimelineRuntimeDiagnosticsPolicy] =
    useState<TimelineRuntimeDiagnosticsPolicy>(FALLBACK_TIMELINE_DIAGNOSTICS_POLICY);
  const [timelineRuntimeDiagnostics, setTimelineRuntimeDiagnostics] =
    useState<TimelineRuntimeDiagnosticsReport | null>(null);
  const [timelineRuntimeMutation, setTimelineRuntimeMutation] =
    useState<TimelineRuntimeDiagnosticsMutationMetadata | null>(null);
  const timelineDiagnosticsVersionRef = useRef(0);
  const refreshTimelineRuntimeDiagnostics = useCallback(async () => {
    try {
      const report = await mocapService.getTimelineRuntimeDiagnostics();
      const accepted = shouldApplyTimelineDiagnosticsUpdate(
        timelineDiagnosticsVersionRef.current,
        report,
        null,
      );
      if (!accepted) {
        return;
      }
      const nextVersion = timelineDiagnosticsVersion(report, null);
      const previousVersion = timelineDiagnosticsVersionRef.current;
      timelineDiagnosticsVersionRef.current = nextVersion;
      setTimelineRuntimeDiagnostics(report);
      if (nextVersion > previousVersion) {
        setTimelineRuntimeMutation(null);
      }
    } catch {
      timelineDiagnosticsVersionRef.current = 0;
      setTimelineRuntimeDiagnostics(null);
      setTimelineRuntimeMutation(null);
    }
  }, []);

  const { session, start, stop, pause, resume, record, stopRecord, isActive } = useMocapSession();
  const { stats } = usePipelineStats(isActive);
  const { latestFrame, pipelineError, gpuHealth, clearErrors } = useSkeletonFrame(isActive);
  const { takes, activeTake, timelineCommitTakePath, openTake, closeTake, deleteTake } = useTakes();

  useEffect(() => {
    setTrackingProjectScope(launchConfig.projectId);
  }, [launchConfig.projectId]);

  // Sequencer — initialized with project fps (default 30)
  const sequencer = useSequencer(
    createEmptySession('New Take', launchConfig.fps ?? 30)
  );
  const isFlushingTimelineBridgeRef = useRef(false);

  // Auto-open GPU Doctor when errors arrive
  useEffect(() => {
    if (pipelineError || gpuHealth.length > 0 || sequencer.timelineBridgeState.lastError) {
      setGpuDoctorOpen(true);
    }
  }, [pipelineError, gpuHealth.length, sequencer.timelineBridgeState.lastError]);

  // Show sequencer timeline when: recording active OR sequencer has tracks
  const showSequencer =
    sequencer.session.playback.status !== 'stopped' ||
    sequencer.session.tracks.length > 0;

  // ── Playback frame handler (takes playback → viewport) ────────────────────
  const handlePlaybackFrame = useCallback((frame: JointFrame) => {
    latestFrame.current = frame;
  }, [latestFrame]);

  // ── Camera modal ──────────────────────────────────────────────────────────
  const openCameraModal = useCallback(() => setCameraModalOpen(true), []);

  const handleSessionStart = useCallback((config: SessionConfig) => {
    setDccTarget(config.dcc_target);
    setActiveCameraIndex(config.camera_device_id); // sync preview to same camera
    closeTake();
    start(config);
  }, [start, closeTake]);

  const handleOpenTake = useCallback(async (take: TakeSummary) => {
    await openTake(take);
    if (isActive) stop();
  }, [openTake, isActive, stop]);

  const handleCloseTake = useCallback(() => {
    closeTake();
    latestFrame.current = null;
  }, [closeTake, latestFrame]);

  useEffect(() => {
    if (isFlushingTimelineBridgeRef.current) {
      return;
    }
    const pendingRequests = sequencer.timelineBridgeState.pendingRequests;
    if (pendingRequests.length === 0) {
      return;
    }

    let cancelled = false;
    isFlushingTimelineBridgeRef.current = true;
    void mocapService
      .applyTimelineRuntimeRequests(pendingRequests)
      .then(async ack => {
        if (cancelled) {
          return;
        }
        sequencer.acknowledgeTimelineRuntimeRequests(ack.applied_request_count);
        const ackPolicy = TIMELINE_RUNTIME_PERSISTENCE_POLICY.ack_commit;
        if (
          ackPolicy.enabled
          && timelineCommitTakePath
          && ack.applied_request_count > 0
        ) {
          await mocapService.commitTimelineRuntimeToActiveTake({
            merge_strategy: ackPolicy.merge_strategy,
          });
        }
        sequencer.setTimelineBridgeError(null);
      })
      .catch(error => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : String(error);
          sequencer.setTimelineBridgeError(`timeline runtime commit failed: ${message}`);
          console.error('[ZenMocap] Failed to flush timeline runtime requests:', error);
        }
      })
      .finally(() => {
        isFlushingTimelineBridgeRef.current = false;
      });

    return () => {
      cancelled = true;
    };
  }, [
    sequencer.acknowledgeTimelineRuntimeRequests,
    sequencer.setTimelineBridgeError,
    sequencer.timelineBridgeState.pendingRequests,
    timelineCommitTakePath,
  ]);

  useEffect(() => {
    let mounted = true;
    void mocapService
      .getTimelineRuntimeDiagnosticsPolicy()
      .then(policy => {
        if (mounted) {
          setTimelineRuntimeDiagnosticsPolicy(policy);
        }
      })
      .catch(() => {
        if (mounted) {
          setTimelineRuntimeDiagnosticsPolicy(FALLBACK_TIMELINE_DIAGNOSTICS_POLICY);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refreshDiagnostics = async () => {
      await refreshTimelineRuntimeDiagnostics();
      if (mounted && timelineRuntimeDiagnosticsPolicy.refresh.enabled) {
        timer = setTimeout(
          refreshDiagnostics,
          timelineRuntimeDiagnosticsPolicy.refresh.interval_ms
        );
      }
    };
    void refreshDiagnostics();
    return () => {
      mounted = false;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [
    refreshTimelineRuntimeDiagnostics,
    timelineRuntimeDiagnosticsPolicy.refresh.enabled,
    timelineRuntimeDiagnosticsPolicy.refresh.interval_ms,
  ]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;

    void listen<unknown>(
      TIMELINE_RUNTIME_DIAGNOSTICS_CHANGED_EVENT,
      event => {
        if (!disposed) {
          const payload = coerceTimelineRuntimeDiagnosticsChangedPayload(event.payload);
          if (!payload) {
            return;
          }
          if (
            !shouldApplyTimelineDiagnosticsUpdate(
              timelineDiagnosticsVersionRef.current,
              payload.report,
              payload.mutation,
            )
          ) {
            return;
          }
          timelineDiagnosticsVersionRef.current = timelineDiagnosticsVersion(
            payload.report,
            payload.mutation,
          );
          setTimelineRuntimeDiagnostics(payload.report);
          setTimelineRuntimeMutation(payload.mutation);
          const trendSummary = payload.mutation.trend_summary;
          if (trendSummary && trendSummary.highest_severity !== 'info' && trendSummary.top_reasons.length > 0) {
            setGpuDoctorOpen(true);
          }
        }
      }
    ).then(fn => {
      if (disposed) {
        fn();
      } else {
        unlisten = fn;
      }
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  // ── Right dock tabs (data-driven) ─────────────────────────────────────────
  const rightTabs = useMemo<DockTab[]>(() => [
    {
      id: 'pipeline',
      label: 'PIPELINE',
      icon: Activity,
      content: (
        <PipelineControls
          status={session.status}
          dccTarget={dccTarget}
          characterId={characterId}
          showSkeleton={showSkeleton}
          sequencer={sequencer}
          onDccTargetChange={setDccTarget}
          onCharacterChange={setCharacterId}
          onSkeletonToggle={() => setShowSkeleton(v => !v)}
          onStart={openCameraModal}
          onStop={stop}
          onPause={pause}
          onResume={resume}
          onRecord={record}
          onStopRecord={stopRecord}
        />
      ),
    },
    {
      id: 'ik',
      label: 'IK',
      icon: Sliders,
      content: <IKConstraintPanel active={isActive} />,
    },
    {
      id: 'tracking',
      label: 'TRACK',
      icon: Cpu,
      content: <TrackingSettingsPanel />,
    },
    {
      id: 'status',
      label: 'STATUS',
      icon: Wifi,
      content: (
        <div className="flex flex-col gap-2">
          <LiveLinkStatus
            stats={stats}
            status={session.status}
            error={pipelineError ?? session.error}
            timelineRuntimeDiagnostics={timelineRuntimeDiagnostics}
            timelineRuntimeMutation={timelineRuntimeMutation}
            timelineRuntimeDiagnosticsPolicy={timelineRuntimeDiagnosticsPolicy}
            pendingTimelineRequestCount={sequencer.timelineBridgeState.pendingRequests.length}
          />
          <button
            onClick={async () => {
              try {
                await invoke('spawn_webcam_window');
              } catch (err) {
                console.error('Failed to spawn webcam window:', err);
              }
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#00ffcc]/10 hover:bg-[#00ffcc]/20 border border-[#00ffcc]/20 text-[#00ffcc] text-[10px] font-bold transition-all"
          >
            <Video size={12} />
            Open Webcam Preview
          </button>
        </div>
      ),
    },
    {
      id: 'analyze',
      label: 'ANALYZE',
      icon: Video,
      content: <VideoDropZone />,
    },
    {
      id: 'library',
      label: 'TAKES',
      icon: Film,
      content: (
        <div className="h-full flex flex-col gap-2 p-2">
          <span className="text-[9px] font-bold tracking-widest text-[color:var(--kos-text-muted)] uppercase px-1">
            Animation Library
          </span>
          <button
            onClick={() => setBrowserOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 text-orange-400 text-[10px] font-bold transition-all"
          >
            <Database size={12} />
            Open Content Browser
            {takes.length > 0 && (
              <span className="ml-auto text-[9px] bg-orange-500/20 px-1.5 py-0.5 rounded-full font-mono">
                {takes.length}
              </span>
            )}
          </button>
          {takes.slice(0, 5).map(take => (
            <button
              key={take.id}
              onClick={() => handleOpenTake(take)}
              className="flex items-start gap-2 p-2 rounded-lg bg-[#0f0f0f] hover:bg-[#161616] border border-[#1a1a1a] text-left transition-all"
            >
              <Film size={10} className="text-orange-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-white truncate">{take.name}</div>
                <div className="text-[8px] text-gray-600 font-mono">
                  {(take.duration_ms / 1000).toFixed(1)}s · {take.frame_count}f
                </div>
              </div>
            </button>
          ))}
          {takes.length > 5 && (
            <button
              onClick={() => setBrowserOpen(true)}
              className="text-[9px] text-gray-600 hover:text-gray-400 text-center py-1 transition-colors"
            >
              +{takes.length - 5} more in browser
            </button>
          )}
        </div>
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [
    session.status, session.error, dccTarget, isActive, stats, pipelineError,
    stop, pause, resume, record, stopRecord, openCameraModal,
    takes, handleOpenTake, characterId, showSkeleton,
    sequencer, timelineRuntimeDiagnostics, timelineRuntimeDiagnosticsPolicy,
  ]);

  // ── Bottom Panel: sequencer or take timeline ───────────────────────────────

  const bottomPanel = useMemo(() => {
    // Saved take playback takes priority
    if (activeTake) {
      return (
        <TimelinePanel
          take={activeTake}
          onFrame={handlePlaybackFrame}
          onClose={handleCloseTake}
        />
      );
    }
    // Sequencer (record mode)
    if (showSequencer) {
      return (
        <SequencerTimeline
          session={sequencer.session}
          onPlay={sequencer.play}
          onPause={sequencer.pause}
          onStop={sequencer.stop}
          onSeek={sequencer.seek}
          onStartRecord={sequencer.startRecord}
          onStopRecord={sequencer.stopRecord}
          onSetLoopIn={sequencer.setLoopIn}
          onSetLoopOut={sequencer.setLoopOut}
          onSetTotalFrames={sequencer.setTotalFrames}
          onAddKeyframe={sequencer.addKeyframe}
          onRemoveKeyframe={sequencer.removeKeyframe}
          onUpdateTrack={sequencer.updateTrack}
          onRemoveTrack={sequencer.removeTrack}
          activeTrackId={activeTrackId}
          onSelectTrack={setActiveTrackId}
          className="h-48"
        />
      );
    }
    return undefined;
  }, [
    activeTake, showSequencer, handlePlaybackFrame, handleCloseTake,
    sequencer, activeTrackId,
  ]);

  return (
    <>
      <AppShell
        layoutKey="zen-mocap"
        right={{
          title: 'ZEN MOCAP',
          tabs: rightTabs,
          defaultTabId: 'pipeline',
          defaultSize: 22,
          minSize: 15,
        }}
        bottom={bottomPanel}
      >
        <SessionViewport
          latestFrame={latestFrame}
          active={isActive || !!activeTake}
          characterId={characterId}
          showSkeleton={showSkeleton}
          onCharacterChange={setCharacterId}
          onSkeletonToggle={() => setShowSkeleton(v => !v)}
        />
      </AppShell>

      <KContentBrowser
        isOpen={browserOpen}
        onClose={() => setBrowserOpen(false)}
        onDropAsset={() => { }}
        artifacts={[]}
        materials={[]}
        alphas={[]}
        takes={takes}
        onOpenTake={handleOpenTake}
        onDeleteTake={deleteTake}
        activeAppId="zen-mocap"
      />
      <CameraSessionModal
        isOpen={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        onStart={handleSessionStart}
      />

      {/* GPU Doctor — auto-opens on errors, also openable from View menu */}
      <GpuDoctorPanel
        open={gpuDoctorOpen}
        onClose={() => setGpuDoctorOpen(false)}
        pipelineError={pipelineError}
        gpuHealth={gpuHealth}
        pendingTimelineRequestCount={sequencer.timelineBridgeState.pendingRequests.length}
        timelineBridgeError={sequencer.timelineBridgeState.lastError}
        timelineRuntimeDiagnostics={timelineRuntimeDiagnostics}
        timelineRuntimeMutation={timelineRuntimeMutation}
        timelineRuntimeDiagnosticsPolicy={timelineRuntimeDiagnosticsPolicy}
        onClearErrors={clearErrors}
      />
    </>
  );
}
