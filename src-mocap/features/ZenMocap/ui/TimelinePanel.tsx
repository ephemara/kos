/**
 * TimelinePanel
 *
 * Phase 3 — scrub, play, and loop recorded takes.
 *
 * - Renders a seek bar across the full take duration
 * - Play/pause with rAF loop driven by fps from the take header
 * - Emits the current JointFrame via onFrame so SessionViewport
 *   can render playback exactly like live capture
 * - No Tauri calls here — receives the loaded AnimationTake as a prop
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    Play, Pause, SkipBack, SkipForward, Repeat,
    ChevronFirst, ChevronLast, X, Film
} from 'lucide-react';
import type { AnimationTake, JointFrame } from '../types';

interface TimelinePanelProps {
    take: AnimationTake;
    onFrame: (frame: JointFrame) => void;
    onClose: () => void;
}

function formatTime(ms: number): string {
    const s = ms / 1000;
    const m = Math.floor(s / 60);
    const sec = (s % 60).toFixed(1);
    return m > 0 ? `${m}:${sec.padStart(4, '0')}` : `${sec}s`;
}

export default function TimelinePanel({ take, onFrame, onClose }: TimelinePanelProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [looping, setLooping] = useState(false);
    const [cursor, setCursor] = useState(0); // frame index

    const rafRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number>(0);
    const cursorRef = useRef<number>(0);
    const msPerFrame = 1000 / (take.fps || 30);

    // Keep ref in sync for rAF callback
    useEffect(() => { cursorRef.current = cursor; }, [cursor]);

    // Emit frame whenever cursor changes
    useEffect(() => {
        const frame = take.frames[cursor];
        if (frame) onFrame(frame);
    }, [cursor, take.frames, onFrame]);

    // ─── Playback loop ───────────────────────────────────────────────────────────

    const tick = useCallback((now: number) => {
        if (!lastTimeRef.current) lastTimeRef.current = now;
        const elapsed = now - lastTimeRef.current;

        if (elapsed >= msPerFrame) {
            lastTimeRef.current = now - (elapsed % msPerFrame);
            const next = cursorRef.current + 1;
            if (next >= take.frame_count) {
                if (looping) {
                    cursorRef.current = 0;
                    setCursor(0);
                } else {
                    setIsPlaying(false);
                    return;
                }
            } else {
                cursorRef.current = next;
                setCursor(next);
            }
        }

        rafRef.current = requestAnimationFrame(tick);
    }, [take.frame_count, msPerFrame, looping]);

    useEffect(() => {
        if (isPlaying) {
            lastTimeRef.current = 0;
            rafRef.current = requestAnimationFrame(tick);
        } else {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        }
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [isPlaying, tick]);

    // ─── Controls ────────────────────────────────────────────────────────────────

    const seekTo = (idx: number) => {
        const clamped = Math.max(0, Math.min(idx, take.frame_count - 1));
        cursorRef.current = clamped;
        setCursor(clamped);
    };

    const togglePlay = () => setIsPlaying(p => !p);
    const toStart = () => { setIsPlaying(false); seekTo(0); };
    const toEnd = () => { setIsPlaying(false); seekTo(take.frame_count - 1); };
    const stepBack = () => { setIsPlaying(false); seekTo(cursor - 1); };
    const stepForward = () => { setIsPlaying(false); seekTo(cursor + 1); };

    const progress = take.frame_count > 0 ? cursor / (take.frame_count - 1) : 0;
    const currentMs = (cursor / (take.fps || 30)) * 1000;

    // ─── Render ──────────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-full bg-[#090909] border-t border-[#1a1a1a] select-none">

            {/* Header bar */}
            <div className="flex items-center gap-3 px-4 py-2 border-b border-[#1a1a1a]">
                <Film size={14} className="text-orange-400 flex-shrink-0" />
                <span className="text-[11px] font-black text-white truncate">{take.name}</span>
                <span className="text-[9px] text-gray-600 font-mono flex-shrink-0">
                    {take.fps}fps · {take.frame_count}f · {(take.duration_ms / 1000).toFixed(1)}s
                </span>
                <div className="flex-1" />
                {/* Loop toggle */}
                <button
                    onClick={() => setLooping(l => !l)}
                    title="Toggle loop"
                    className={`p-1.5 rounded transition-all ${looping
                            ? 'bg-orange-500/20 text-orange-400'
                            : 'text-gray-600 hover:text-gray-400'
                        }`}
                >
                    <Repeat size={12} />
                </button>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded text-gray-600 hover:text-gray-300 hover:bg-white/5 transition-all"
                    title="Close take"
                >
                    <X size={12} />
                </button>
            </div>

            {/* Scrub bar + time labels */}
            <div className="px-4 pt-3 pb-1">
                <div className="relative h-6 flex items-center group">
                    {/* Track background */}
                    <div className="absolute inset-x-0 h-1.5 rounded-full bg-[#1a1a1a]" />
                    {/* Filled portion */}
                    <div
                        className="absolute left-0 h-1.5 rounded-full bg-gradient-to-r from-orange-600 to-orange-400 transition-none"
                        style={{ width: `${progress * 100}%` }}
                    />
                    {/* Thumb */}
                    <div
                        className="absolute w-3 h-3 rounded-full bg-orange-400 shadow-lg shadow-orange-500/40 -translate-x-1/2 transition-none"
                        style={{ left: `${progress * 100}%` }}
                    />
                    {/* Invisible wide hit target */}
                    <input
                        type="range"
                        min={0}
                        max={take.frame_count - 1}
                        value={cursor}
                        onChange={e => seekTo(Number(e.target.value))}
                        onMouseDown={() => setIsPlaying(false)}
                        className="absolute inset-0 w-full opacity-0 cursor-pointer"
                        style={{ zIndex: 2 }}
                    />
                </div>

                {/* Time labels */}
                <div className="flex justify-between mt-1">
                    <span className="text-[8px] font-mono text-gray-600">
                        {formatTime(currentMs)}
                    </span>
                    <span className="text-[8px] font-mono text-gray-600">
                        f{cursor} / {take.frame_count - 1}
                    </span>
                    <span className="text-[8px] font-mono text-gray-600">
                        {formatTime(take.duration_ms)}
                    </span>
                </div>
            </div>

            {/* Transport controls */}
            <div className="flex items-center justify-center gap-2 px-4 py-2">
                <TransportBtn icon={ChevronFirst} onClick={toStart} title="Start" />
                <TransportBtn icon={SkipBack} onClick={stepBack} title="Step back" />

                <button
                    onClick={togglePlay}
                    title={isPlaying ? 'Pause' : 'Play'}
                    className="w-8 h-8 rounded-full bg-orange-500 hover:bg-orange-400 flex items-center justify-center text-black shadow-lg shadow-orange-500/30 transition-all active:scale-95"
                >
                    {isPlaying
                        ? <Pause size={14} className="fill-black" />
                        : <Play size={14} className="fill-black translate-x-px" />
                    }
                </button>

                <TransportBtn icon={SkipForward} onClick={stepForward} title="Step forward" />
                <TransportBtn icon={ChevronLast} onClick={toEnd} title="End" />
            </div>
        </div>
    );
}

function TransportBtn({ icon: Icon, onClick, title }: {
    icon: React.ElementType;
    onClick: () => void;
    title: string;
}) {
    return (
        <button
            onClick={onClick}
            title={title}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-all active:scale-90"
        >
            <Icon size={13} />
        </button>
    );
}
