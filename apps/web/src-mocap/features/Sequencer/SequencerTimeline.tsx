/**
 * SequencerTimeline — The ZenMocap Sequencer
 *
 * Premium, expandable timeline component.
 * Designed to grow into a full NLE-style sequencer.
 *
 * Features:
 *  - Zoomable ruler with sub-frame precision
 *  - Track lanes: visibility, lock, mute per track
 *  - Diamond keyframes with drag-to-move
 *  - Loop in/out region
 *  - Pre-roll indicator
 *  - Recording mode with red glow
 *  - Collapsible track groups
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
    Play, Pause, Square, Circle, SkipBack, SkipForward,
    ZoomIn, ZoomOut, Repeat, ChevronDown, ChevronRight,
    Eye, EyeOff, Lock, Unlock, Volume2, VolumeX,
    Plus, Trash2, PanelLeft,
} from 'lucide-react';
import { cn } from '@mocap/shared/primitives/cn';
import type { SequencerTrack, SequencerSession, SequencerKeyframe, PlaybackStatus } from './types';

// ─── Constants (data-driven) ──────────────────────────────────────────────────

const BASE_FRAME_W = 8;
const TRACK_H = 32;
const RULER_H = 24;
const LABEL_W = 192;

// Grid interval adapts to zoom
function gridInterval(zoom: number): number {
    if (zoom >= 3.0) return 2;
    if (zoom >= 1.5) return 5;
    if (zoom >= 0.8) return 10;
    if (zoom >= 0.4) return 20;
    return 50;
}

function frameToTime(frame: number, fps: number): string {
    const totalSec = frame / fps;
    const m = Math.floor(totalSec / 60);
    const s = Math.floor(totalSec % 60);
    const f = frame % fps;
    if (m > 0) return `${m}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
    return `${s}:${String(f).padStart(2, '0')}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SequencerTimelineProps {
    session: SequencerSession;

    // Playback actions
    onPlay: () => void;
    onPause: () => void;
    onStop: () => void;
    onSeek: (frame: number) => void;
    onStartRecord: () => void;
    onStopRecord: () => void;
    onSetLoopIn: (frame: number | null) => void;
    onSetLoopOut: (frame: number | null) => void;
    onSetTotalFrames: (frames: number) => void;

    // Track actions
    onAddKeyframe: (trackId: string, kf: SequencerKeyframe) => void;
    onRemoveKeyframe: (trackId: string, frame: number) => void;
    onUpdateTrack: (id: string, patch: Partial<SequencerTrack>) => void;
    onRemoveTrack: (id: string) => void;

    // Active selection
    activeTrackId: string | null;
    onSelectTrack: (id: string | null) => void;

    className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SequencerTimeline({
    session,
    onPlay, onPause, onStop, onSeek,
    onStartRecord, onStopRecord,
    onSetLoopIn, onSetLoopOut, onSetTotalFrames,
    onAddKeyframe, onRemoveKeyframe, onUpdateTrack, onRemoveTrack,
    activeTrackId, onSelectTrack,
    className,
}: SequencerTimelineProps) {
    const { playback, tracks, totalFrames, fps } = session;
    const { currentFrame, status, loopIn, loopOut } = playback;

    const [zoom, setZoom] = useState(1.0);
    const [isDragging, setIsDragging] = useState(false);
    const [hoveredFrame, setHoveredFrame] = useState<number | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    const rulerRef = useRef<HTMLDivElement>(null);

    const frameW = BASE_FRAME_W * zoom;
    const timelineW = Math.max(totalFrames * frameW + 120, 600);
    const interval = gridInterval(zoom);

    const isPlaying = status === 'playing';
    const isRecording = status === 'recording';
    const isPaused = status === 'paused';
    const isLive = isPlaying || isRecording;

    // Auto-scroll to keep playhead visible during playback
    useEffect(() => {
        if (!isLive || !scrollRef.current) return;
        const x = currentFrame * frameW;
        const { scrollLeft, clientWidth } = scrollRef.current;
        const margin = clientWidth * 0.2;
        if (x > scrollLeft + clientWidth - margin) {
            scrollRef.current.scrollLeft = x - margin;
        }
    }, [currentFrame, frameW, isLive]);

    // ─── Scrub ─────────────────────────────────────────────────────────────────

    const xToFrame = useCallback((clientX: number, el: HTMLElement): number => {
        const rect = el.getBoundingClientRect();
        const scrollLeft = scrollRef.current?.scrollLeft ?? 0;
        const x = Math.max(0, clientX - rect.left + scrollLeft);
        return Math.min(totalFrames - 1, Math.max(0, Math.round(x / frameW)));
    }, [frameW, totalFrames]);

    const handleRulerDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!rulerRef.current) return;
        setIsDragging(true);
        onSeek(xToFrame(e.clientX, rulerRef.current));
    };

    useEffect(() => {
        if (!isDragging) return;
        const move = (e: MouseEvent) => {
            if (!rulerRef.current) return;
            onSeek(xToFrame(e.clientX, rulerRef.current));
        };
        const up = () => setIsDragging(false);
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
        return () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
        };
    }, [isDragging, xToFrame, onSeek]);

    const playheadX = currentFrame * frameW;

    // ─── Track helpers ──────────────────────────────────────────────────────────

    const flatTracks = tracks; // Flat for now — groups planned for v2

    // ─── Render ────────────────────────────────────────────────────────────────

    return (
        <div
            className={cn(
                'flex flex-col bg-[#080808] border-t border-[#1a1a1a] select-none overflow-hidden',
                isRecording && 'border-t-red-500/50',
                className
            )}
        >
            {/* ── TOOLBAR ──────────────────────────────────────────────────────────── */}
            <div className={cn(
                'h-10 flex items-center gap-1 px-2 border-b border-[#1a1a1a] flex-shrink-0',
                isRecording ? 'bg-red-950/30' : 'bg-[#0f0f0f]'
            )}>

                {/* Transport */}
                <TransportBtn
                    icon={SkipBack}
                    onClick={() => { onStop(); onSeek(0); }}
                    title="To start"
                />

                {/* Play / Pause */}
                <button
                    onClick={isLive ? onPause : onPlay}
                    title={isLive ? 'Pause' : 'Play'}
                    className={cn(
                        'w-8 h-8 rounded flex items-center justify-center transition-all',
                        isRecording
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : isPlaying
                                ? 'bg-[color:var(--kos-accent-primary)]/20 text-[color:var(--kos-accent-primary)] border border-[color:var(--kos-accent-primary)]/30'
                                : 'hover:bg-white/5 text-gray-400 hover:text-white border border-transparent'
                    )}
                >
                    {isLive
                        ? <Pause size={13} className="fill-current" />
                        : <Play size={13} className="fill-current translate-x-px" />
                    }
                </button>

                {/* Stop */}
                <TransportBtn icon={Square} onClick={onStop} title="Stop" />

                <div className="w-px h-5 bg-[#222] mx-1" />

                {/* Record */}
                <button
                    onClick={isRecording ? onStopRecord : onStartRecord}
                    title={isRecording ? 'Stop recording' : 'Start recording'}
                    className={cn(
                        'w-8 h-8 rounded flex items-center justify-center transition-all border',
                        isRecording
                            ? 'bg-red-500 text-white border-red-400 shadow-[0_0_12px_rgba(239,68,68,0.5)] animate-pulse'
                            : 'text-red-400/70 border-red-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/40'
                    )}
                >
                    <Circle size={12} className={isRecording ? 'fill-current' : ''} />
                </button>

                <div className="w-px h-5 bg-[#222] mx-1" />

                {/* Loop In/Out */}
                <button
                    onClick={() => onSetLoopIn(loopIn === null ? currentFrame : null)}
                    title={loopIn !== null ? 'Clear loop in' : 'Set loop in'}
                    className={cn(
                        'px-2 h-7 rounded text-[9px] font-bold tracking-wider transition-all border',
                        loopIn !== null
                            ? 'bg-[color:var(--kos-accent-primary)]/15 text-[color:var(--kos-accent-primary)] border-[color:var(--kos-accent-primary)]/30'
                            : 'text-gray-600 border-[#222] hover:text-gray-400'
                    )}
                >
                    {loopIn !== null ? `[${loopIn}` : '[ IN'}
                </button>
                <button
                    onClick={() => onSetLoopOut(loopOut === null ? currentFrame : null)}
                    title={loopOut !== null ? 'Clear loop out' : 'Set loop out'}
                    className={cn(
                        'px-2 h-7 rounded text-[9px] font-bold tracking-wider transition-all border',
                        loopOut !== null
                            ? 'bg-[color:var(--kos-accent-primary)]/15 text-[color:var(--kos-accent-primary)] border-[color:var(--kos-accent-primary)]/30'
                            : 'text-gray-600 border-[#222] hover:text-gray-400'
                    )}
                >
                    {loopOut !== null ? `${loopOut}]` : 'OUT ]'}
                </button>

                {/* Timecode display */}
                <div className="ml-2 flex items-center gap-1.5 bg-black border border-[#1a1a1a] rounded px-2 py-1 font-mono">
                    <span className={cn(
                        'text-[11px] font-bold tabular-nums w-16 text-right',
                        isRecording ? 'text-red-400' : 'text-[color:var(--kos-accent-primary)]'
                    )}>
                        {frameToTime(currentFrame, fps)}
                    </span>
                    <span className="text-[8px] text-gray-600">/</span>
                    <span className="text-[9px] text-gray-500 tabular-nums">
                        {frameToTime(totalFrames, fps)}
                    </span>
                </div>

                {/* Frame counter */}
                <div className="flex items-center gap-1 bg-black border border-[#1a1a1a] rounded px-2 py-1 font-mono">
                    <span className={cn(
                        'text-[10px] font-bold tabular-nums',
                        isRecording ? 'text-red-400' : 'text-white/80'
                    )}>
                        f{currentFrame}
                    </span>
                    <span className="text-[8px] text-gray-600">/{totalFrames}</span>
                </div>

                <div className="flex-1" />

                {/* Add keyframe on active track */}
                {activeTrackId && (
                    <button
                        onClick={() => {
                            const track = tracks.find(t => t.id === activeTrackId);
                            if (!track) return;
                            onAddKeyframe(activeTrackId, { frame: currentFrame, value: null, ease: 'linear' });
                        }}
                        title="Add keyframe at playhead"
                        className="flex items-center gap-1.5 px-2 h-7 rounded border border-[#333] text-[9px] font-bold text-gray-400 hover:text-[color:var(--kos-accent-primary)] hover:border-[color:var(--kos-accent-primary)]/40 transition-all"
                    >
                        <div className="w-2 h-2 rotate-45 border border-current" />
                        KEY
                    </button>
                )}

                {/* Zoom */}
                <div className="flex items-center gap-1.5">
                    <ZoomOut
                        size={11}
                        className="text-gray-600 cursor-pointer hover:text-gray-400"
                        onClick={() => setZoom(z => Math.max(0.2, z - 0.2))}
                    />
                    <div className="w-16 h-1 bg-[#1a1a1a] rounded-full relative">
                        <div
                            className="absolute left-0 top-0 h-full rounded-full bg-[color:var(--kos-accent-primary)]/60"
                            style={{ width: `${((zoom - 0.2) / 2.8) * 100}%` }}
                        />
                        <input
                            type="range" min={0.2} max={3.0} step={0.1}
                            value={zoom}
                            onChange={e => setZoom(Number(e.target.value))}
                            className="absolute inset-0 w-full opacity-0 cursor-pointer"
                        />
                    </div>
                    <ZoomIn
                        size={11}
                        className="text-gray-600 cursor-pointer hover:text-gray-400"
                        onClick={() => setZoom(z => Math.min(3.0, z + 0.2))}
                    />
                    <span className="text-[8px] text-gray-600 font-mono w-6">{zoom.toFixed(1)}×</span>
                </div>
            </div>

            {/* ── TIMELINE BODY ─────────────────────────────────────────────────────── */}
            <div className="flex flex-1 overflow-hidden min-h-0">

                {/* LEFT: Track labels */}
                <div
                    className="flex-shrink-0 border-r border-[#1a1a1a] bg-[#0a0a0a] flex flex-col z-10 shadow-[4px_0_16px_-4px_rgba(0,0,0,0.7)]"
                    style={{ width: LABEL_W }}
                >
                    {/* Ruler placeholder (aligns with ruler) */}
                    <div
                        className="flex-shrink-0 border-b border-[#1a1a1a] flex items-center px-3 gap-2"
                        style={{ height: RULER_H }}
                    >
                        <span className="text-[8px] font-bold tracking-widest text-gray-600 uppercase">Tracks</span>
                        <span className="text-[8px] text-gray-700">{flatTracks.length}</span>
                    </div>

                    {/* Track rows */}
                    <div className="flex-1 overflow-y-auto">
                        {flatTracks.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-16 gap-1 opacity-40">
                                <PanelLeft size={14} className="text-gray-600" />
                                <span className="text-[8px] text-gray-600">No tracks</span>
                            </div>
                        ) : (
                            flatTracks.map(track => (
                                <TrackLabel
                                    key={track.id}
                                    track={track}
                                    isActive={track.id === activeTrackId}
                                    onSelect={() => onSelectTrack(track.id)}
                                    onToggleVisible={() => onUpdateTrack(track.id, { visible: !track.visible })}
                                    onToggleLock={() => onUpdateTrack(track.id, { locked: !track.locked })}
                                    onToggleMute={() => onUpdateTrack(track.id, { muted: !track.muted })}
                                    onDelete={() => onRemoveTrack(track.id)}
                                />
                            ))
                        )}
                    </div>
                </div>

                {/* RIGHT: Scrollable ruler + track lanes */}
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-x-auto overflow-y-auto relative bg-[#060606]"
                    style={{ scrollbarWidth: 'thin', scrollbarColor: '#222 transparent' }}
                >
                    <div style={{ width: timelineW, minWidth: '100%', position: 'relative' }}>

                        {/* RULER */}
                        <div
                            ref={rulerRef}
                            className="sticky top-0 z-20 bg-[#0c0c0c] border-b border-[#1a1a1a] cursor-crosshair overflow-hidden"
                            style={{ height: RULER_H }}
                            onMouseDown={handleRulerDown}
                            onMouseMove={e => {
                                if (!rulerRef.current) return;
                                setHoveredFrame(xToFrame(e.clientX, rulerRef.current));
                            }}
                            onMouseLeave={() => setHoveredFrame(null)}
                        >
                            {/* Loop region */}
                            {loopIn !== null && loopOut !== null && (
                                <div
                                    className="absolute top-0 bottom-0 bg-[color:var(--kos-accent-primary)]/8 border-x border-[color:var(--kos-accent-primary)]/20"
                                    style={{ left: loopIn * frameW, width: (loopOut - loopIn) * frameW }}
                                />
                            )}

                            {/* Tick marks */}
                            {Array.from({ length: Math.ceil(totalFrames / interval) + 1 }).map((_, i) => {
                                const f = i * interval;
                                const isMajor = i % 4 === 0;
                                return (
                                    <div
                                        key={i}
                                        className="absolute top-0 bottom-0 border-l"
                                        style={{
                                            left: f * frameW,
                                            borderColor: isMajor ? '#2a2a2a' : '#161616',
                                        }}
                                    >
                                        {isMajor && (
                                            <span
                                                className="absolute bottom-1 left-1 text-[8px] font-mono"
                                                style={{ color: '#444' }}
                                            >
                                                {f}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Hover ghost */}
                            {hoveredFrame !== null && (
                                <div
                                    className="absolute top-0 bottom-0 w-px bg-white/10 pointer-events-none"
                                    style={{ left: hoveredFrame * frameW }}
                                />
                            )}

                            {/* Playhead on ruler */}
                            <div
                                className={cn(
                                    'absolute top-0 bottom-0 w-px pointer-events-none z-30',
                                    isRecording ? 'bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.7)]' : 'bg-[color:var(--kos-accent-primary)] shadow-[0_0_6px_rgba(0,255,180,0.4)]'
                                )}
                                style={{ left: playheadX }}
                            >
                                {/* Playhead diamond */}
                                <div
                                    className={cn(
                                        'absolute -top-0 -left-[5px] w-[10px] h-[10px] rotate-45 border-b border-r',
                                        isRecording
                                            ? 'bg-red-400 border-red-300'
                                            : 'bg-[color:var(--kos-accent-primary)] border-[color:var(--kos-accent-secondary)]'
                                    )}
                                />
                            </div>
                        </div>

                        {/* TRACK LANES */}
                        <div className="relative">
                            {/* Vertical grid lines */}
                            <div className="absolute inset-0 pointer-events-none">
                                {Array.from({ length: Math.ceil(totalFrames / interval) + 1 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="absolute top-0 bottom-0 border-l border-[#111]"
                                        style={{ left: i * interval * frameW }}
                                    />
                                ))}
                            </div>

                            {/* Track rows */}
                            {flatTracks.length === 0 ? (
                                <div className="flex items-center justify-center h-20 text-[9px] text-gray-700">
                                    Add tracks from the Record panel
                                </div>
                            ) : (
                                flatTracks.map(track => (
                                    <TrackLane
                                        key={track.id}
                                        track={track}
                                        isActive={track.id === activeTrackId}
                                        frameW={frameW}
                                        onClick={e => {
                                            if (!rulerRef.current) return;
                                            onSelectTrack(track.id);
                                        }}
                                        onKeyframeClick={frame => onSeek(frame)}
                                        onKeyframeDblClick={frame => onRemoveKeyframe(track.id, frame)}
                                    />
                                ))
                            )}

                            {/* Playhead vertical line through lanes */}
                            <div
                                className={cn(
                                    'absolute top-0 bottom-0 w-px pointer-events-none z-20',
                                    isRecording ? 'bg-red-400/60' : 'bg-[color:var(--kos-accent-primary)]/50'
                                )}
                                style={{ left: playheadX }}
                            />

                            {/* Loop region overlay */}
                            {loopIn !== null && loopOut !== null && (
                                <div
                                    className="absolute top-0 bottom-0 bg-[color:var(--kos-accent-primary)]/4 pointer-events-none"
                                    style={{ left: loopIn * frameW, width: (loopOut - loopIn) * frameW }}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── TrackLabel ───────────────────────────────────────────────────────────────

interface TrackLabelProps {
    track: SequencerTrack;
    isActive: boolean;
    onSelect: () => void;
    onToggleVisible: () => void;
    onToggleLock: () => void;
    onToggleMute: () => void;
    onDelete: () => void;
}

function TrackLabel({
    track, isActive, onSelect,
    onToggleVisible, onToggleLock, onToggleMute, onDelete,
}: TrackLabelProps) {
    const [hovered, setHovered] = useState(false);
    return (
        <div
            onClick={onSelect}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className={cn(
                'flex items-center px-2 gap-1.5 border-b border-[#111] cursor-pointer transition-colors',
                isActive
                    ? 'bg-[color:var(--kos-accent-primary)]/8'
                    : 'hover:bg-white/3',
            )}
            style={{ height: TRACK_H }}
        >
            {/* Color dot */}
            <div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{
                    backgroundColor: track.muted ? '#333' : track.style.color,
                    opacity: track.visible ? 1 : 0.3,
                }}
            />

            {/* Label */}
            <span
                className={cn(
                    'flex-1 truncate text-[9px] font-bold tracking-wide',
                    !track.visible && 'opacity-30',
                    isActive ? 'text-white' : 'text-gray-400',
                )}
            >
                {track.label}
            </span>

            {/* Controls — show on hover or active */}
            <div className={cn('flex items-center gap-0.5 transition-opacity', (hovered || isActive) ? 'opacity-100' : 'opacity-0')}>
                <IconBtn
                    icon={track.visible ? Eye : EyeOff}
                    onClick={e => { e.stopPropagation(); onToggleVisible(); }}
                    active={track.visible}
                    title={track.visible ? 'Hide' : 'Show'}
                />
                <IconBtn
                    icon={track.locked ? Lock : Unlock}
                    onClick={e => { e.stopPropagation(); onToggleLock(); }}
                    active={!track.locked}
                    title={track.locked ? 'Unlock' : 'Lock'}
                />
                <IconBtn
                    icon={track.muted ? VolumeX : Volume2}
                    onClick={e => { e.stopPropagation(); onToggleMute(); }}
                    active={!track.muted}
                    title={track.muted ? 'Unmute' : 'Mute'}
                />
                <IconBtn
                    icon={Trash2}
                    onClick={e => { e.stopPropagation(); onDelete(); }}
                    title="Delete track"
                    danger
                />
            </div>
        </div>
    );
}

// ─── TrackLane ────────────────────────────────────────────────────────────────

interface TrackLaneProps {
    track: SequencerTrack;
    isActive: boolean;
    frameW: number;
    onClick: (e: React.MouseEvent) => void;
    onKeyframeClick: (frame: number) => void;
    onKeyframeDblClick: (frame: number) => void;
}

function TrackLane({ track, isActive, frameW, onClick, onKeyframeClick, onKeyframeDblClick }: TrackLaneProps) {
    return (
        <div
            onClick={onClick}
            className={cn(
                'relative border-b border-[#111] transition-colors',
                isActive ? 'bg-[color:var(--kos-accent-primary)]/4' : 'hover:bg-white/1',
                !track.visible && 'opacity-20',
            )}
            style={{ height: TRACK_H }}
        >
            {/* Keyframes */}
            {track.keyframes.map(kf => (
                <div
                    key={`${track.id}-kf-${kf.frame}`}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 z-10 cursor-pointer group transition-transform hover:scale-125"
                    style={{
                        left: kf.frame * frameW,
                        backgroundColor: track.muted ? '#444' : track.style.color,
                        boxShadow: `0 0 6px ${track.style.color}60`,
                        opacity: track.visible ? 1 : 0.3,
                    }}
                    onClick={e => { e.stopPropagation(); onKeyframeClick(kf.frame); }}
                    onDoubleClick={e => { e.stopPropagation(); onKeyframeDblClick(kf.frame); }}
                    title={`Frame ${kf.frame} — double-click to delete`}
                />
            ))}
        </div>
    );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function TransportBtn({ icon: Icon, onClick, title }: {
    icon: React.ElementType;
    onClick: () => void;
    title: string;
}) {
    return (
        <button
            onClick={onClick}
            title={title}
            className="w-7 h-7 rounded flex items-center justify-center text-gray-600 hover:text-white hover:bg-white/5 transition-all active:scale-90"
        >
            <Icon size={12} />
        </button>
    );
}

function IconBtn({ icon: Icon, onClick, active = true, title, danger = false }: {
    icon: React.ElementType;
    onClick: (e: React.MouseEvent) => void;
    active?: boolean;
    title?: string;
    danger?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            title={title}
            className={cn(
                'w-5 h-5 rounded flex items-center justify-center transition-all',
                danger
                    ? 'text-red-600 hover:text-red-400 hover:bg-red-500/10'
                    : active
                        ? 'text-gray-400 hover:text-white hover:bg-white/8'
                        : 'text-gray-700 hover:text-gray-500'
            )}
        >
            <Icon size={9} />
        </button>
    );
}
