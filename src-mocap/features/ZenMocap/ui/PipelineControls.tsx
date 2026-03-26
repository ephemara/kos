/**
 * PipelineControls
 *
 * Pipeline tab — two discrete slots:
 *   • RECORD  — sequencer-driven take capture
 *   • LIVELINK — DCC broadcast (Unreal/Unity/Blender)
 *
 * Data-driven: DCC targets via DCC_TARGET_CONFIG, characters via CHARACTER_OPTIONS.
 * No hardcoded values anywhere.
 */

import React, { useState } from 'react';
import {
  Play, Square, Pause, RotateCcw, Bone, Eye, EyeOff,
  Circle, Wifi, WifiOff, Radio, Settings2,
} from 'lucide-react';
import { Button } from '@mocap/shared/primitives/Button';
import { cn } from '@mocap/shared/primitives/cn';
import { DCC_TARGET_CONFIG } from '../types';
import { CHARACTER_OPTIONS, type CharacterId } from '../characterOptions';
import type { DccTarget, SessionStatus } from '../types';
import { RecordSlot } from '../../Sequencer/RecordSlot';
import type { useSequencer } from '../../Sequencer/useSequencer';

// ─── Slot types (data-driven tab registry) ────────────────────────────────────

type PipelineSlot = 'record' | 'livelink';

const PIPELINE_SLOTS: { id: PipelineSlot; label: string; icon: React.ElementType }[] = [
  { id: 'record', label: 'RECORD', icon: Circle },
  { id: 'livelink', label: 'LIVELINK', icon: Radio },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface PipelineControlsProps {
  status: SessionStatus;
  dccTarget: DccTarget;
  characterId: CharacterId;
  showSkeleton: boolean;
  sequencer: ReturnType<typeof useSequencer>;
  onDccTargetChange: (target: DccTarget) => void;
  onCharacterChange: (id: CharacterId) => void;
  onSkeletonToggle: () => void;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onRecord: () => void;
  onStopRecord: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PipelineControls({
  status, dccTarget, onDccTargetChange,
  characterId, showSkeleton, onCharacterChange, onSkeletonToggle,
  sequencer,
  onStart, onStop, onPause, onResume, onRecord, onStopRecord,
}: PipelineControlsProps) {
  const [activeSlot, setActiveSlot] = useState<PipelineSlot>('record');

  const isIdle = status === 'idle' || status === 'error';
  const isRunning = status === 'running';
  const isRecording = status === 'recording';
  const isPaused = status === 'paused';
  const isLoading = status === 'initializing';
  const isLive = isRunning || isRecording;

  return (
    <div className="flex flex-col gap-0">

      {/* ── Slot Tabs ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0.5 mb-4 p-1 rounded-xl bg-[#050505] border border-[#1a1a1a]">
        {PIPELINE_SLOTS.map(slot => {
          const Icon = slot.icon;
          const active = activeSlot === slot.id;
          return (
            <button
              key={slot.id}
              onClick={() => setActiveSlot(slot.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[9px] font-black tracking-widest transition-all',
                active
                  ? slot.id === 'record'
                    ? 'bg-red-500/15 text-red-400 border border-red-500/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                    : 'bg-[color:var(--kos-accent-primary)]/12 text-[color:var(--kos-accent-primary)] border border-[color:var(--kos-accent-primary)]/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                  : 'text-gray-600 hover:text-gray-400 border border-transparent'
              )}
            >
              <Icon size={9} className={active && slot.id === 'record' ? 'fill-current' : ''} />
              {slot.label}
            </button>
          );
        })}
      </div>

      {/* ── RECORD SLOT ───────────────────────────────────────────────────── */}
      {activeSlot === 'record' && (
        <RecordSlot
          sequencer={sequencer}
          sessionStatus={status}
          onStartSession={onStart}
        />
      )}

      {/* ── LIVELINK SLOT ─────────────────────────────────────────────────── */}
      {activeSlot === 'livelink' && (
        <LiveLinkSlot
          status={status}
          dccTarget={dccTarget}
          characterId={characterId}
          showSkeleton={showSkeleton}
          onDccTargetChange={onDccTargetChange}
          onCharacterChange={onCharacterChange}
          onSkeletonToggle={onSkeletonToggle}
          onStart={onStart}
          onStop={onStop}
          onPause={onPause}
          onResume={onResume}
          isIdle={isIdle}
          isLive={isLive}
          isPaused={isPaused}
          isLoading={isLoading}
          isRunning={isRunning}
        />
      )}

      {/* ── Session status pill (always visible) ──────────────────────────── */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#1a1a1a]">
        <span
          className={[
            'w-1.5 h-1.5 rounded-full flex-shrink-0',
            isRunning ? 'bg-[color:var(--kos-success)] animate-pulse' :
              isRecording ? 'bg-red-500 animate-pulse' :
                isPaused ? 'bg-[color:var(--kos-warning)]' :
                  isLoading ? 'bg-[color:var(--kos-info)] animate-pulse' :
                    status === 'error' ? 'bg-[color:var(--kos-error)]' :
                      'bg-[color:var(--kos-text-muted)]',
          ].join(' ')}
        />
        <span className="text-[9px] font-bold tracking-widest text-[color:var(--kos-text-muted)]">
          {status.toUpperCase()}
        </span>

        {/* Live controls — inline with status */}
        <div className="ml-auto flex items-center gap-1">
          {isLive && (
            <button
              onClick={onPause}
              className="w-6 h-6 rounded flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/8 transition-all"
              title="Pause"
            >
              <Pause size={10} />
            </button>
          )}
          {isPaused && (
            <button
              onClick={onResume}
              className="w-6 h-6 rounded flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/8 transition-all"
              title="Resume"
            >
              <RotateCcw size={10} />
            </button>
          )}
          {!isIdle && (
            <button
              onClick={onStop}
              className="w-6 h-6 rounded flex items-center justify-center text-red-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
              title="Stop session"
            >
              <Square size={10} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── LiveLink Slot ────────────────────────────────────────────────────────────

interface LiveLinkSlotProps {
  status: SessionStatus;
  dccTarget: DccTarget;
  characterId: CharacterId;
  showSkeleton: boolean;
  onDccTargetChange: (t: DccTarget) => void;
  onCharacterChange: (id: CharacterId) => void;
  onSkeletonToggle: () => void;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  isIdle: boolean;
  isLive: boolean;
  isPaused: boolean;
  isLoading: boolean;
  isRunning: boolean;
}

function LiveLinkSlot({
  dccTarget, characterId, showSkeleton,
  onDccTargetChange, onCharacterChange, onSkeletonToggle,
  onStart, onStop,
  isIdle, isLive, isPaused, isLoading,
}: LiveLinkSlotProps) {

  return (
    <div className="flex flex-col gap-4">

      {/* Broadcast target */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold tracking-widest text-[color:var(--kos-text-muted)] uppercase">
          Broadcast Target
        </span>
        <div
          role="radiogroup"
          aria-label="DCC broadcast target"
          className="flex items-center gap-0.5 rounded-lg border border-[#1a1a1a] bg-[#050505] p-1"
        >
          {(Object.keys(DCC_TARGET_CONFIG) as DccTarget[]).map(target => {
            const active = target === dccTarget;
            return (
              <button
                key={target}
                role="radio"
                aria-checked={active}
                disabled={!isIdle}
                onClick={() => isIdle && onDccTargetChange(target)}
                title={`${DCC_TARGET_CONFIG[target].label} — port ${DCC_TARGET_CONFIG[target].defaultPort}`}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center rounded px-2 py-1.5',
                  'text-[9px] font-bold transition-all focus-visible:outline-none',
                  active
                    ? 'bg-[color:var(--kos-accent-primary)]/12 text-[color:var(--kos-accent-primary)] border border-[color:var(--kos-accent-primary)]/25'
                    : 'text-gray-600 hover:text-gray-400 disabled:opacity-40 disabled:cursor-not-allowed border border-transparent',
                )}
              >
                <span className="text-[10px] font-black">
                  {DCC_TARGET_CONFIG[target].label.split(' ')[0].toUpperCase()}
                </span>
                <span className="text-[7px] font-mono opacity-60">
                  :{DCC_TARGET_CONFIG[target].defaultPort}
                </span>
              </button>
            );
          })}
        </div>

        {/* Connection status */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#050505] border border-[#1a1a1a] rounded-lg">
          {isLive ? (
            <>
              <Wifi size={10} className="text-[color:var(--kos-accent-primary)] animate-pulse" />
              <span className="text-[9px] text-[color:var(--kos-accent-primary)] font-bold">
                Streaming to {DCC_TARGET_CONFIG[dccTarget].label}
              </span>
            </>
          ) : (
            <>
              <WifiOff size={10} className="text-gray-600" />
              <span className="text-[9px] text-gray-600">Not connected</span>
            </>
          )}
        </div>
      </div>

      <hr className="border-t border-[#1a1a1a]" />

      {/* Character */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-widest text-[color:var(--kos-text-muted)] uppercase">
            Character
          </span>
          <button
            id="btn-skeleton-toggle"
            onClick={onSkeletonToggle}
            className={cn(
              'flex items-center gap-1 rounded px-1.5 py-0.5 text-[8px] font-bold tracking-widest uppercase transition-all border',
              showSkeleton
                ? 'bg-[color:var(--kos-accent-primary)]/20 text-[color:var(--kos-accent-primary)] border-[color:var(--kos-accent-primary)]/40'
                : 'border-[#222] text-gray-600 hover:text-gray-400',
            )}
          >
            {showSkeleton ? <Eye size={8} /> : <EyeOff size={8} />} Skel
          </button>
        </div>

        <div
          role="radiogroup"
          aria-label="Active character"
          className="flex flex-col gap-0.5 rounded-lg border border-[#1a1a1a] bg-[#050505] p-1"
        >
          {CHARACTER_OPTIONS.map(char => {
            const active = char.id === characterId;
            return (
              <button
                key={char.id}
                id={`btn-character-${char.id}`}
                role="radio"
                aria-checked={active}
                onClick={() => onCharacterChange(char.id)}
                className={cn(
                  'flex items-center gap-2 w-full rounded px-2 py-1.5 text-left transition-all',
                  'text-[9px] font-bold tracking-wide',
                  active ? 'bg-[#1a1a1a] text-white' : 'text-gray-600 hover:text-gray-400',
                )}
              >
                <Bone size={10} className={active ? 'text-[color:var(--kos-accent-primary)]' : 'opacity-30'} />
                <span className="uppercase">{char.label}</span>
                {active && <span className="ml-auto w-1 h-1 rounded-full bg-[color:var(--kos-accent-primary)]" />}
              </button>
            );
          })}
        </div>
      </div>

      <hr className="border-t border-[#1a1a1a]" />

      {/* Start / Stop */}
      {isIdle ? (
        <Button
          variant="accent"
          size="lg"
          className="w-full"
          onClick={onStart}
          disabled={isLoading}
          aria-label="Start live session"
        >
          <Play size={14} />
          {isLoading ? 'INITIALIZING…' : 'GO LIVE'}
        </Button>
      ) : (
        <Button
          variant="danger"
          size="lg"
          className="w-full"
          onClick={onStop}
          aria-label="Stop live session"
        >
          <Square size={14} /> END SESSION
        </Button>
      )}
    </div>
  );
}
