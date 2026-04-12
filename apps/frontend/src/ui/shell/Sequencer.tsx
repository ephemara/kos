import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Square, ChevronDown, Film, GripVertical, ZoomIn, ZoomOut, Plus, Trash2, Key, SkipBack, SkipForward } from 'lucide-react';
import * as Slider from '@radix-ui/react-slider';
import * as Toggle from '@radix-ui/react-toggle';
import { cn } from '@/ui/primitives/cn';

export interface Keyframe {
    frame: number;
    value: number | any;
    ease?: string;
}

export interface SequencerTrack {
    id: string;
    label: string;
    keyframes: Keyframe[];
    color?: string; // hex color
    visible?: boolean;
    locked?: boolean;
}

export interface SequencerProps {
    currentFrame: number;
    totalFrames: number;
    fps?: number;
    isPlaying: boolean;
    onSeek: (frame: number) => void;
    onPlayPause: (playing: boolean) => void;
    onSetTotalFrames?: (frames: number) => void;

    // Track Data
    tracks: SequencerTrack[];
    activeTrackId: string | null;
    onSelectTrack: (id: string | null) => void;

    // Keyframe Actions
    onAddKeyframe?: (trackId: string, frame: number) => void;
    onDeleteKeyframe?: (trackId: string, frame: number) => void;

    className?: string;
}

export function Sequencer({
    currentFrame,
    totalFrames,
    fps = 30,
    isPlaying,
    onSeek,
    onPlayPause,
    onSetTotalFrames,
    tracks,
    activeTrackId,
    onSelectTrack,
    onAddKeyframe,
    onDeleteKeyframe,
    className
}: SequencerProps) {
    const timelineRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
    const [zoom, setZoom] = useState(1.0);

    const BASE_FRAME_WIDTH = 8;
    const frameWidth = BASE_FRAME_WIDTH * zoom;
    const timelineWidth = Math.max(totalFrames * frameWidth, 200); // Ensure minimal width

    // Scrub handler
    const handleScrub = (e: React.MouseEvent | MouseEvent) => {
        if (!timelineRef.current) return;
        const rect = timelineRef.current.getBoundingClientRect();
        const scrollLeft = scrollContainerRef.current?.scrollLeft || 0;
        const x = Math.max(0, e.clientX - rect.left + scrollLeft);
        const frame = Math.min(totalFrames - 1, Math.max(0, Math.round(x / frameWidth)));
        onSeek(frame);
    };

    // Global drag handlers
    useEffect(() => {
        if (!isDraggingPlayhead) return;
        const handleMove = (e: MouseEvent) => handleScrub(e);
        const handleUp = () => setIsDraggingPlayhead(false);
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
    }, [isDraggingPlayhead, totalFrames, frameWidth]);

    const playheadX = currentFrame * frameWidth;
    const gridInterval = zoom >= 1.5 ? 5 : zoom >= 0.5 ? 10 : 20;

    return (
        <div className={cn("flex flex-col h-full bg-[#0a0a0a] border-t border-[#222] text-[#e0e0e0] select-none font-sans", className)}>
            {/* TOOLBAR */}
            <div className="h-9 flex items-center justify-between px-2 border-b border-[#222] bg-[#111]">
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onSeek(0)}
                        className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                    >
                        <SkipBack size={14} />
                    </button>
                    <button
                        onClick={() => onPlayPause(!isPlaying)}
                        className={cn(
                            "p-1.5 rounded transition-colors flex items-center justify-center w-8 h-8",
                            isPlaying ? "bg-cyan-900/50 text-cyan-400 border border-cyan-800" : "hover:bg-cyan-900/20 text-gray-300 border border-transparent"
                        )}
                    >
                        {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                    </button>

                    <div className="h-4 w-px bg-[#333] mx-2" />

                    <div className="flex items-center bg-[#050505] border border-[#222] rounded px-2 py-0.5 font-mono text-xs gap-2">
                        <span className="text-cyan-400 font-bold w-8 text-right">{currentFrame}</span>
                        <span className="text-gray-600">/</span>
                        <span className="text-gray-500">{totalFrames}</span>
                    </div>

                    {activeTrackId && onAddKeyframe && (
                        <button
                            onClick={() => onAddKeyframe(activeTrackId, currentFrame)}
                            className="ml-4 flex items-center gap-1.5 px-2 py-1 rounded bg-[#1a1a1a] border border-[#333] hover:border-cyan-500/50 hover:text-cyan-400 text-xs transition-colors"
                        >
                            <div className="rotate-45 w-2 h-2 bg-current border border-current" />
                            <span>Key</span>
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <ZoomOut size={12} className="text-gray-500" />
                        <Slider.Root
                            className="relative flex items-center select-none touch-none w-20 h-5"
                            value={[zoom]}
                            min={0.2}
                            max={3.0}
                            step={0.1}
                            onValueChange={([v]) => setZoom(v)}
                        >
                            <Slider.Track className="bg-[#222] relative grow rounded-full h-[2px]">
                                <Slider.Range className="absolute bg-cyan-700 rounded-full h-full" />
                            </Slider.Track>
                            <Slider.Thumb className="block w-3 h-3 bg-gray-300 shadow rounded-full hover:bg-white focus:outline-none transition-colors" />
                        </Slider.Root>
                        <ZoomIn size={12} className="text-gray-500" />
                    </div>
                </div>
            </div>

            {/* TIMELINE AREA */}
            <div className="flex-1 flex overflow-hidden">
                {/* LEFT LIST: TRACK NAMES */}
                <div className="w-48 border-r border-[#222] bg-[#0f0f0f] flex flex-col cursor-default z-10 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.5)]">
                    <div className="h-6 border-b border-[#222] flex items-center px-2 text-[9px] font-bold text-gray-500 bg-[#161616]">
                        TRACKS
                    </div>
                    <div className="flex-1 overflow-y-hidden hover:overflow-y-auto custom-scrollbar">
                        {tracks.map(track => (
                            <div
                                key={track.id}
                                onClick={() => onSelectTrack(track.id)}
                                className={cn(
                                    "h-8 flex items-center px-3 border-b border-[#1a1a1a] transition-colors text-[10px]",
                                    track.id === activeTrackId ? "bg-cyan-900/20 text-cyan-300" : "text-gray-400 hover:bg-[#1a1a1a] hover:text-gray-200"
                                )}
                            >
                                <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: track.id === activeTrackId ? '#22d3ee' : (track.color || '#444') }} />
                                <span className="truncate flex-1 font-medium">{track.label}</span>
                                {track.keyframes.length > 0 && <span className="text-[9px] bg-[#222] px-1 rounded text-gray-500">{track.keyframes.length}</span>}
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT AREA: RULER + KEYFRAMES */}
                <div
                    ref={scrollContainerRef}
                    className="flex-1 overflow-x-auto overflow-y-hidden relative bg-[#080808]"
                >
                    <div style={{ width: timelineWidth, minWidth: '100%' }}>

                        {/* RULER */}
                        <div
                            className="h-6 border-b border-[#222] flex bg-[#0f0f0f] relative sticky top-0 z-10"
                            onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const x = e.clientX - rect.left + (scrollContainerRef.current?.scrollLeft || 0);
                                const f = Math.round(x / frameWidth);
                                onSeek(Math.min(totalFrames, Math.max(0, f)));
                            }}
                        >
                            {Array.from({ length: Math.ceil(totalFrames / gridInterval) + 1 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="border-l border-[#333] pl-1 text-[9px] font-mono text-gray-600 h-full flex items-end pb-0.5 select-none"
                                    style={{
                                        position: 'absolute',
                                        left: i * gridInterval * frameWidth,
                                        width: gridInterval * frameWidth
                                    }}
                                >
                                    {i * gridInterval}
                                </div>
                            ))}
                        </div>

                        {/* TRACK ROWS (Aligned with Left List) */}
                        <div
                            ref={timelineRef}
                            className="relative cursor-crosshair pb-10"
                            onMouseDown={(e) => { setIsDraggingPlayhead(true); handleScrub(e); }}
                        >
                            {/* BACKGROUND GRID LINES */}
                            <div className="absolute inset-0 pointer-events-none">
                                {Array.from({ length: Math.ceil(totalFrames / gridInterval) + 1 }).map((_, i) => (
                                    <div
                                        key={`grid-${i}`}
                                        className="absolute top-0 bottom-0 border-r border-[#1a1a1a]"
                                        style={{ left: i * gridInterval * frameWidth }}
                                    />
                                ))}
                            </div>

                            {tracks.map(track => (
                                <div
                                    key={track.id}
                                    className={cn(
                                        "h-8 border-b border-[#111] relative",
                                        track.id === activeTrackId ? "bg-cyan-900/5" : ""
                                    )}
                                >
                                    {track.keyframes.map((kf, i) => (
                                        <div
                                            key={`${track.id}-kf-${kf.frame}`}
                                            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rotate-45 border border-black transform transition-transform hover:scale-125 z-10 cursor-pointer"
                                            style={{
                                                left: kf.frame * frameWidth - 5,
                                                backgroundColor: track.color || '#fbbf24'
                                            }}
                                            onDoubleClick={(e) => {
                                                e.stopPropagation();
                                                onDeleteKeyframe?.(track.id, kf.frame);
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSeek(kf.frame);
                                            }}
                                            title={`Value: ${JSON.stringify(kf.value)}`}
                                        />
                                    ))}
                                </div>
                            ))}

                            {/* PLAYHEAD LINE */}
                            <div
                                className="absolute top-0 bottom-0 w-px bg-cyan-400 pointer-events-none z-20 shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                                style={{ left: playheadX }}
                            >
                                <div className="absolute -top-[5px] -left-[4px] w-2.5 h-2.5 bg-cyan-400 rotate-45" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
