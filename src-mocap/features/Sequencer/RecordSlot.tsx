/**
 * RecordSlot — Pipeline tab, Record mode
 *
 * Shows the sequencer and recording controls.
 * Wires into useSequencer + useMocapSession.
 */

import React, { useState } from 'react';
import {
    Circle, Square, Film, Clock, Hash, RefreshCw, ChevronDown,
    Plus, Mic, Bone
} from 'lucide-react';
import { cn } from '@mocap/shared/primitives/cn';
import { SequencerTimeline } from './SequencerTimeline';
import type { useSequencer } from './useSequencer';
import type { SequencerTrack } from './types';
import { TRACK_STYLE_PRESETS } from './types';

type SequencerControls = ReturnType<typeof useSequencer>;

interface RecordSlotProps {
    sequencer: SequencerControls;
    /** Mocap session status — needed to gate recording */
    sessionStatus: string;
    onStartSession: () => void;
}

export function RecordSlot({ sequencer, sessionStatus, onStartSession }: RecordSlotProps) {
    const { session, recordConfig, setRecordConfig } = sequencer;
    const [activeTrackId, setActiveTrackId] = useState<string | null>(null);

    const isIdle = sessionStatus === 'idle' || sessionStatus === 'error';
    const isLive = sessionStatus === 'running' || sessionStatus === 'recording';
    const isRecording = session.playback.status === 'recording';

    // ── Add a default pose track ────────────────────────────────────────────────
    const addPoseTrack = () => {
        const id = crypto.randomUUID();
        const track: SequencerTrack = {
            id,
            label: `Pose ${session.tracks.length + 1}`,
            kind: 'pose',
            style: TRACK_STYLE_PRESETS.pose,
            keyframes: [],
            visible: true,
            locked: false,
            muted: false,
        };
        sequencer.addTrack(track);
        setActiveTrackId(id);
    };

    const handleRecord = () => {
        if (!isLive) {
            // Need a live session first
            onStartSession();
            return;
        }
        if (isRecording) {
            sequencer.stopRecord();
        } else {
            if (session.tracks.length === 0) addPoseTrack();
            sequencer.startRecord();
        }
    };

    return (
        <div className="flex flex-col gap-3">

            {/* ── Take Config ─────────────────────────────────────────────────────── */}
            <div className="flex flex-col gap-2">
                <span className="text-[10px] font-bold tracking-widest text-[color:var(--kos-text-muted)] uppercase">
                    Take
                </span>

                {/* Take name */}
                <div className="flex items-center gap-2 bg-[#050505] border border-[#1a1a1a] rounded-lg px-3 py-2">
                    <Film size={11} className="text-[color:var(--kos-accent-primary)] flex-shrink-0" />
                    <input
                        type="text"
                        value={recordConfig.takeName}
                        onChange={e => setRecordConfig(prev => ({ ...prev, takeName: e.target.value }))}
                        className="flex-1 bg-transparent text-[11px] font-bold text-white outline-none placeholder:text-gray-600"
                        placeholder="Take_001"
                    />
                    {/* Auto-increment */}
                    <button
                        onClick={() => {
                            const match = recordConfig.takeName.match(/^(.+?)(\d+)$/);
                            if (match) {
                                const num = String(parseInt(match[2]) + 1).padStart(match[2].length, '0');
                                setRecordConfig(prev => ({ ...prev, takeName: match[1] + num }));
                            } else {
                                setRecordConfig(prev => ({ ...prev, takeName: prev.takeName + '_001' }));
                            }
                        }}
                        title="Auto-increment take name"
                        className="text-gray-600 hover:text-gray-400 transition-colors"
                    >
                        <RefreshCw size={10} />
                    </button>
                </div>

                {/* FPS + Duration row */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 bg-[#050505] border border-[#1a1a1a] rounded-lg px-3 py-1.5">
                        <Hash size={9} className="text-gray-600" />
                        <span className="text-[9px] text-gray-600">FPS</span>
                        <input
                            type="number"
                            value={session.fps}
                            onChange={e => { }} // fps is set on session load
                            className="flex-1 bg-transparent text-[10px] font-mono text-white text-right outline-none"
                            min={1} max={120} readOnly
                        />
                    </div>
                    <div className="flex items-center gap-2 bg-[#050505] border border-[#1a1a1a] rounded-lg px-3 py-1.5">
                        <Clock size={9} className="text-gray-600" />
                        <span className="text-[9px] text-gray-600">Frames</span>
                        <input
                            type="number"
                            value={session.totalFrames}
                            onChange={e => sequencer.setTotalFrames(Number(e.target.value))}
                            className="flex-1 bg-transparent text-[10px] font-mono text-white text-right outline-none"
                            min={1}
                        />
                    </div>
                </div>
            </div>

            <hr className="border-t border-[#1a1a1a]" />

            {/* ── Tracks ──────────────────────────────────────────────────────────── */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold tracking-widest text-[color:var(--kos-text-muted)] uppercase">
                        Tracks
                    </span>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={addPoseTrack}
                            title="Add pose track"
                            className="flex items-center gap-1 px-2 py-1 rounded text-[8px] font-bold text-gray-500 hover:text-[color:var(--kos-accent-primary)] border border-[#1a1a1a] hover:border-[color:var(--kos-accent-primary)]/30 transition-all"
                        >
                            <Plus size={9} /> POSE
                        </button>
                    </div>
                </div>

                {/* Track chips */}
                {session.tracks.length === 0 ? (
                    <div
                        className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#222] py-4 gap-1 cursor-pointer group hover:border-[color:var(--kos-accent-primary)]/30 transition-all"
                        onClick={addPoseTrack}
                    >
                        <Bone size={14} className="text-gray-700 group-hover:text-[color:var(--kos-accent-primary)]/50 transition-colors" />
                        <span className="text-[8px] text-gray-700 group-hover:text-gray-500">Add pose track</span>
                    </div>
                ) : (
                    <div className="flex flex-col gap-1">
                        {session.tracks.map(t => (
                            <div
                                key={t.id}
                                onClick={() => setActiveTrackId(t.id === activeTrackId ? null : t.id)}
                                className={cn(
                                    'flex items-center gap-2 px-2 py-1.5 rounded-lg border cursor-pointer transition-all',
                                    t.id === activeTrackId
                                        ? 'bg-[color:var(--kos-accent-primary)]/8 border-[color:var(--kos-accent-primary)]/20'
                                        : 'border-[#1a1a1a] hover:border-[#2a2a2a]'
                                )}
                            >
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.style.color }} />
                                <span className="text-[9px] font-bold text-white flex-1">{t.label}</span>
                                <span className="text-[8px] text-gray-600 font-mono">{t.keyframes.length}kf</span>
                                <span className="text-[7px] bg-[#1a1a1a] text-gray-600 px-1 rounded uppercase">{t.kind}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <hr className="border-t border-[#1a1a1a]" />

            {/* ── Record Button ────────────────────────────────────────────────────── */}
            <button
                onClick={handleRecord}
                className={cn(
                    'flex items-center justify-center gap-2 w-full rounded-xl py-3 text-[11px] font-black tracking-wider transition-all',
                    isRecording
                        ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-pulse'
                        : isLive
                            ? 'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20'
                            : 'bg-[color:var(--kos-accent-primary)] text-black hover:brightness-110 shadow-[0_0_20px_rgba(0,255,180,0.3)]'
                )}
            >
                {isRecording ? (
                    <><Square size={13} /> STOP REC</>
                ) : isLive ? (
                    <><Circle size={13} className="fill-current" /> REC</>
                ) : (
                    <><Circle size={13} className="fill-current" /> START &amp; REC</>
                )}
            </button>

            {/* Status */}
            {isRecording && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                    <span className="text-[9px] font-bold text-red-400 tracking-widest">
                        RECORDING — Frame {session.playback.currentFrame}
                    </span>
                </div>
            )}
        </div>
    );
}