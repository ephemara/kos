/**
 * WebcamPreview
 *
 * Floating, draggable, resizable camera preview panel.
 *
 * Shows:
 *  - Live <video> element from the selected camera device
 *  - Skeleton overlay (canvas) drawn from latestFrame ref at rAF rate
 *  - "Session Offline" / "LIVE f{N}" status badge
 *
 * Position and size persist to localStorage under 'zen:webcam-preview'.
 * Data-driven: zero hardcoded positions.
 */

import React, { useRef, useEffect, useState, useCallback, type RefObject } from 'react';
import { motion, useMotionValue, useDragControls, animate } from 'framer-motion';
import {
    Video, VideoOff, X, Pin, PinOff, Maximize2, Minimize2, Eye, EyeOff,
} from 'lucide-react';
import { cn } from '@mocap/shared/primitives/cn';
import type { JointFrame } from '../types';
import { SKELETON_BONES, JOINT_NAMES } from '../types';
import { useTrackingSettings } from '../trackingConfig';

// ─── Config ───────────────────────────────────────────────────────────────────

const PERSIST_KEY = 'zen:webcam-preview';
const MIN_W = 280;
const MIN_H = 210;
const DEF_W = 380;
const DEF_H = 285;

function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)); }
function safeJson<T>(s: string | null): T | null {
    if (!s) return null;
    try { return JSON.parse(s); } catch { return null; }
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface WebcamPreviewProps {
    open: boolean;
    onClose: () => void;
    cameraIndex: number;
    latestFrame: RefObject<JointFrame | null>;
    showOverlay?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WebcamPreview({
    open,
    onClose,
    cameraIndex,
    latestFrame,
    showOverlay: showOverlayProp = true,
}: WebcamPreviewProps) {
    const { settings: trackingSettings } = useTrackingSettings();

    const [pinned, setPinned] = useState(() => safeJson<boolean>(localStorage.getItem(`${PERSIST_KEY}:pinned`)) ?? false);
    const [overlay, setOverlay] = useState(showOverlayProp);
    const [streamErr, setStreamErr] = useState<string | null>(null);
    const [isMax, setIsMax] = useState(false);
    const [streaming, setStreaming] = useState(false);
    const [overlayStats, setOverlayStats] = useState<{ visible: number; total: number; stale: boolean }>({
        visible: 0,
        total: JOINT_NAMES.length,
        stale: false,
    });

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const rafRef = useRef<number>(0);
    const smoothedPointsRef = useRef<Map<string, { x: number; y: number; conf: number; ts: number }>>(new Map());

    // Persist pinned
    useEffect(() => {
        localStorage.setItem(`${PERSIST_KEY}:pinned`, JSON.stringify(pinned));
    }, [pinned]);

    // ── Position + size (persisted) ──────────────────────────────────────────
    const [pos, setPos] = useState(() =>
        safeJson<{ x: number; y: number }>(localStorage.getItem(`${PERSIST_KEY}:pos`)) ?? { x: 20, y: 60 }
    );
    const [sz, setSz] = useState(() =>
        safeJson<{ w: number; h: number }>(localStorage.getItem(`${PERSIST_KEY}:size`)) ?? { w: DEF_W, h: DEF_H }
    );

    const mx = useMotionValue(pos.x);
    const my = useMotionValue(pos.y);
    const mw = useMotionValue(sz.w);
    const mh = useMotionValue(sz.h);

    useEffect(() => { mx.set(pos.x); my.set(pos.y); }, []);
    useEffect(() => { mw.set(sz.w); mh.set(sz.h); }, []);

    const dragControls = useDragControls();

    const handleDragEnd = useCallback(() => {
        const cx = mx.get(), cy = my.get(), cw = mw.get(), ch = mh.get();
        const vw = window.innerWidth, vh = window.innerHeight;
        const SNAP = 28;
        let nx = clamp(cx, 4, vw - cw - 4);
        let ny = clamp(cy, 4, vh - ch - 4);
        let snapped = false;
        if (cx < SNAP) { nx = 8; snapped = true; }
        if (cx + cw > vw - SNAP) { nx = vw - cw - 8; snapped = true; }
        if (cy < SNAP) { ny = 48; snapped = true; } // clearTopBar
        if (cy + ch > vh - SNAP) { ny = vh - ch - 8; snapped = true; }
        if (snapped) {
            animate(mx, nx, { type: 'spring', stiffness: 300, damping: 30 });
            animate(my, ny, { type: 'spring', stiffness: 300, damping: 30 });
            if (!pinned) setPinned(true);
        }
        const fp = { x: mx.get(), y: my.get() };
        setPos(fp);
        localStorage.setItem(`${PERSIST_KEY}:pos`, JSON.stringify(fp));
    }, [mx, my, mw, mh, pinned]);

    // Keep panel onscreen whenever it opens (handles stale persisted coords)
    useEffect(() => {
        if (!open || isMax) return;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const cw = mw.get();
        const ch = mh.get();
        const nx = clamp(mx.get(), 4, Math.max(4, vw - cw - 4));
        const ny = clamp(my.get(), 48, Math.max(48, vh - ch - 4));
        mx.set(nx);
        my.set(ny);
        const fp = { x: nx, y: ny };
        setPos(fp);
        localStorage.setItem(`${PERSIST_KEY}:pos`, JSON.stringify(fp));
    }, [open, isMax, mx, my, mw, mh]);

    // ── Camera stream ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (!open) {
            // Stop stream when closed
            streamRef.current?.getTracks().forEach(t => t.stop());
            streamRef.current = null;
            setStreaming(false);
            setStreamErr(null);
            smoothedPointsRef.current.clear();
            setOverlayStats({ visible: 0, total: JOINT_NAMES.length, stale: false });
            return;
        }

        let cancelled = false;
        setStreamErr(null);
        setStreaming(false);

        const start = async () => {
            try {
                if (!navigator.mediaDevices?.getUserMedia) {
                    throw new Error('Webcam API unavailable (navigator.mediaDevices.getUserMedia not supported in this context).');
                }
                // Build constraints — enumerate first to pick exact deviceId
                let deviceId: ConstrainDOMString | undefined;
                if (cameraIndex > 0) {
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    const cameras = devices.filter(d => d.kind === 'videoinput');
                    deviceId = cameras[cameraIndex]?.deviceId;
                }

                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        deviceId: deviceId ? deviceId : undefined,
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        frameRate: { ideal: 30 },
                    },
                    audio: false,
                });

                if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

                streamRef.current = stream;

                // Wait for video element to be in DOM
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play().catch(() => { });
                    if (!cancelled) setStreaming(true);
                }
            } catch (err: any) {
                if (!cancelled) {
                    const msg = err?.message ?? String(err);
                    setStreamErr(msg);
                    console.error('[WebcamPreview] getUserMedia failed:', err);
                }
            }
        };

        start();

        return () => {
            cancelled = true;
            streamRef.current?.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        };
    }, [open, cameraIndex]);

    // Re-attach stream if video ref initialises after stream is ready
    const handleVideoRef = useCallback((el: HTMLVideoElement | null) => {
        videoRef.current = el;
        if (el && streamRef.current && !el.srcObject) {
            el.srcObject = streamRef.current;
            el.play().catch(() => { });
        }
    }, []);

    // ── Skeleton overlay on canvas ────────────────────────────────────────────
    useEffect(() => {
        if (!open || !overlay) {
            cancelAnimationFrame(rafRef.current);
            smoothedPointsRef.current.clear();
            setOverlayStats({ visible: 0, total: JOINT_NAMES.length, stale: false });
            return;
        }

        const draw = () => {
            rafRef.current = requestAnimationFrame(draw);
            const canvas = canvasRef.current;
            const video = videoRef.current;
            const frame = latestFrame.current;
            if (!canvas || !video) return;

            const vw = video.videoWidth;
            const vh = video.videoHeight;
            if (!vw || !vh) return;

            canvas.width = vw;
            canvas.height = vh;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.clearRect(0, 0, vw, vh);

            if (!frame) {
                setOverlayStats({ visible: 0, total: JOINT_NAMES.length, stale: false });
                return;
            }

            const { joints } = frame;
            const nowMs = Date.now();
            const stale = Number.isFinite(frame.timestamp_ms) && frame.timestamp_ms > 1_000_000_000_000
                ? (nowMs - frame.timestamp_ms) > trackingSettings.staleFrameMs
                : false;

            if (stale) {
                setOverlayStats({ visible: 0, total: JOINT_NAMES.length, stale: true });
                return;
            }

            const maxSegPx = Math.max(vw, vh) * trackingSettings.maxBoneSegmentDistance2DNorm;
            const minConf = trackingSettings.minOverlayConfidence;
            const alpha = trackingSettings.overlaySmoothingAlpha;
            const framePoints = new Map<string, { x: number; y: number; conf: number } | null>();

            // COCO joints are [0,1] normalised — map to canvas pixels
            const px = (name: string) => {
                if (framePoints.has(name)) return framePoints.get(name) ?? null;
                const j = joints[name as keyof typeof joints];
                const prev = smoothedPointsRef.current.get(name);
                if (!j) {
                    if (prev && (nowMs - prev.ts) <= trackingSettings.historyHoldMs) {
                        const held = { x: prev.x, y: prev.y, conf: prev.conf };
                        framePoints.set(name, held);
                        return held;
                    }
                    framePoints.set(name, null);
                    return null;
                }
                const [nx, ny] = j.position;
                const valid = Number.isFinite(nx) && Number.isFinite(ny) && nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1;
                const conf = Number.isFinite(j.confidence) ? j.confidence : 0;
                if (!valid || conf < minConf) {
                    if (prev && (nowMs - prev.ts) <= trackingSettings.historyHoldMs) {
                        const holdRatio = 1 - ((nowMs - prev.ts) / trackingSettings.historyHoldMs);
                        const heldConf = Math.max(
                            trackingSettings.historyConfidenceDecayFloor,
                            prev.conf * Math.max(holdRatio, 0),
                        );
                        const held = { x: prev.x, y: prev.y, conf: heldConf };
                        framePoints.set(name, held);
                        return held;
                    }
                    smoothedPointsRef.current.delete(name);
                    framePoints.set(name, null);
                    return null;
                }
                const targetX = nx * vw;
                const targetY = ny * vh;
                const sx = prev ? (prev.x + (targetX - prev.x) * alpha) : targetX;
                const sy = prev ? (prev.y + (targetY - prev.y) * alpha) : targetY;
                const next = { x: sx, y: sy, conf, ts: nowMs };
                smoothedPointsRef.current.set(name, next);
                const point = { x: sx, y: sy, conf };
                framePoints.set(name, point);
                return point;
            };

            // Draw bones
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = '#00ffcc';
            ctx.globalAlpha = 0.8;
            for (const [a, b] of SKELETON_BONES) {
                const pa = px(a), pb = px(b);
                if (!pa || !pb || pa.conf < minConf || pb.conf < minConf) continue;
                const dx = pa.x - pb.x;
                const dy = pa.y - pb.y;
                const segLen = Math.sqrt(dx * dx + dy * dy);
                if (!Number.isFinite(segLen) || segLen > maxSegPx) continue;
                ctx.beginPath();
                ctx.moveTo(pa.x, pa.y);
                ctx.lineTo(pb.x, pb.y);
                ctx.stroke();
            }

            // Draw joints
            ctx.globalAlpha = 1;
            for (const name of JOINT_NAMES) {
                const p = px(name);
                if (!p || p.conf < minConf) continue;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
                ctx.fillStyle = p.conf > 0.7 ? '#ffffff' : '#ffcc44';
                ctx.fill();
            }
            const visible = JOINT_NAMES.reduce((acc, name) => {
                const p = framePoints.get(name);
                return acc + (p && p.conf >= minConf ? 1 : 0);
            }, 0);
            setOverlayStats({ visible, total: JOINT_NAMES.length, stale: false });
        };

        rafRef.current = requestAnimationFrame(draw);
        return () => {
            cancelAnimationFrame(rafRef.current);
            smoothedPointsRef.current.clear();
        };
    }, [open, overlay, latestFrame, trackingSettings]);

    const effW = isMax ? window.innerWidth : mw;
    const effH = isMax ? window.innerHeight : mh;
    const effX = isMax ? 0 : mx;
    const effY = isMax ? 0 : my;

    return (
        <motion.div
            drag={!isMax}
            dragControls={dragControls}
            dragMomentum={false}
            dragElastic={0}
            dragListener={false}
            onDragEnd={handleDragEnd}
            className={cn(
                'fixed z-[9999] flex flex-col overflow-hidden pointer-events-auto select-none',
                'bg-[#060606]/95 backdrop-blur-xl border border-white/10',
                'shadow-[0_24px_80px_rgba(0,0,0,0.7)]',
                isMax ? 'rounded-none' : 'rounded-2xl',
            )}
            style={{ x: effX, y: effY, width: effW, height: effH, minWidth: MIN_W, minHeight: MIN_H }}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.15 }}
        >
            {/* ── Header ── */}
            <motion.div
                onPointerDown={e => !isMax && dragControls.start(e)}
                className={cn(
                    'flex items-center gap-2 px-3 py-2 border-b border-white/8 shrink-0',
                    'bg-black/30 hover:bg-black/40 transition-colors',
                    isMax ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
                )}
                style={{ touchAction: 'none' }}
            >
                {/* Live indicator dot */}
                <div className={cn(
                    'w-1.5 h-1.5 rounded-full shrink-0',
                    streamErr ? 'bg-red-500' :
                        streaming ? 'bg-[color:var(--kos-accent-primary)] animate-pulse' :
                            'bg-yellow-500 animate-pulse',
                )} />
                <Video size={11} className="text-gray-400 shrink-0" />
                <span className="text-[10px] font-black tracking-widest text-gray-300 select-none">
                    CAM PREVIEW
                </span>
                {streaming && (
                    <span className="text-[8px] font-mono text-[color:var(--kos-accent-primary)]/70 ml-1">
                        LIVE
                    </span>
                )}

                <div className="flex-1" />

                <div className="flex items-center gap-0.5" onPointerDown={e => e.stopPropagation()}>
                    <HeaderBtn icon={overlay ? Eye : EyeOff} title="Toggle skeleton overlay" active={overlay} onClick={() => setOverlay(v => !v)} />
                    <HeaderBtn icon={pinned ? PinOff : Pin} title={pinned ? 'Unpin' : 'Pin to edge'} active={pinned} onClick={() => setPinned(v => !v)} />
                    <HeaderBtn icon={isMax ? Minimize2 : Maximize2} title={isMax ? 'Restore' : 'Maximize'} onClick={() => setIsMax(v => !v)} />
                    <HeaderBtn icon={X} title="Close" danger onClick={onClose} />
                </div>
            </motion.div>

            {/* ── Video area ── */}
            <div className="relative flex-1 bg-black overflow-hidden">
                {streamErr ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#080808]">
                        <VideoOff size={28} className="text-red-500/50" />
                        <span className="text-[9px] font-bold text-red-400/70 text-center px-6 leading-relaxed max-w-[260px]">
                            {streamErr}
                        </span>
                        <button
                            onClick={() => { setStreamErr(null); }}
                            className="px-3 py-1 text-[9px] font-bold rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 border border-white/10 transition-all"
                        >
                            Retry
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Video — NOTE: no mirror flip, so skeleton coords align */}
                        <video
                            ref={handleVideoRef}
                            muted
                            playsInline
                            autoPlay
                            className="absolute inset-0 w-full h-full object-cover"
                        />

                        {/* Skeleton overlay canvas */}
                        {overlay && (
                            <canvas
                                ref={canvasRef}
                                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                                style={{ mixBlendMode: 'screen' }}
                            />
                        )}

                        {/* Status badges */}
                        {!streaming && !streamErr && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/60 border border-white/10">
                                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
                                    <span className="text-[9px] font-bold text-yellow-400/80 tracking-widest">CONNECTING...</span>
                                </div>
                            </div>
                        )}

                        {streaming && !latestFrame.current && (
                            <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded-md bg-black/70 border border-white/8">
                                <div className="w-1 h-1 rounded-full bg-gray-500" />
                                <span className="text-[8px] font-bold text-gray-500 tracking-widest uppercase">Session Offline</span>
                            </div>
                        )}

                        {streaming && latestFrame.current && (
                            <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md bg-black/70 border border-[color:var(--kos-accent-primary)]/25">
                                <div className="w-1 h-1 rounded-full bg-[color:var(--kos-accent-primary)] animate-pulse" />
                                <span className="text-[8px] font-mono font-bold text-[color:var(--kos-accent-primary)] tracking-wider">
                                    {overlayStats.stale
                                        ? 'STALE'
                                        : `LIVE f${latestFrame.current.frame_id} · ${overlayStats.visible}/${overlayStats.total}`
                                    }
                                </span>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ── Resize handle ── */}
            {!isMax && (
                <motion.div
                    drag
                    dragMomentum={false}
                    dragElastic={0}
                    dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                    onDrag={(_, info) => {
                        mw.set(Math.max(MIN_W, mw.get() + info.delta.x));
                        mh.set(Math.max(MIN_H, mh.get() + info.delta.y));
                    }}
                    onDragEnd={() => {
                        const ns = { w: mw.get(), h: mh.get() };
                        setSz(ns);
                        localStorage.setItem(`${PERSIST_KEY}:size`, JSON.stringify(ns));
                    }}
                    className="absolute bottom-0 right-0 w-7 h-7 cursor-nwse-resize z-10 flex items-end justify-end p-1.5 hover:bg-white/8 rounded-br-2xl transition-colors"
                    style={{ touchAction: 'none' }}
                >
                    <div className="w-2.5 h-2.5 border-r-2 border-b-2 border-white/20 rounded-br" />
                </motion.div>
            )}
        </motion.div>
    );
}

// ─── Tiny header button ───────────────────────────────────────────────────────

function HeaderBtn({ icon: Icon, title, onClick, active = false, danger = false }: {
    icon: React.ElementType;
    title: string;
    onClick: () => void;
    active?: boolean;
    danger?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            title={title}
            className={cn(
                'w-6 h-6 rounded-md flex items-center justify-center transition-all',
                danger
                    ? 'text-gray-600 hover:text-red-400 hover:bg-red-500/15'
                    : active
                        ? 'text-[color:var(--kos-accent-primary)] bg-[color:var(--kos-accent-primary)]/10'
                        : 'text-gray-600 hover:text-white hover:bg-white/8',
            )}
        >
            <Icon size={10} />
        </button>
    );
}
