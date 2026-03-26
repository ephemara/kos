/**
 * VideoDropZone — Phase 4 offline video analysis UI
 *
 * Model list is DATA-DRIVEN: loaded from `mocap_list_models` (Rust manifest).
 * All models ship bundled with the app — no downloads needed at runtime.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
    Film, Upload, Play, RotateCcw, CheckCircle2,
    AlertTriangle, Loader2, Settings2, FolderOpen,
    HardDrive
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useVideoAnalysis } from '../hooks/useVideoAnalysis';
import { JOINT_NAMES, SKELETON_BONES } from '../types';
import type { Joint, ModelEntry, ModelStatus, RawJointFrame } from '../types';
import { isRetargetCompatibleKeypoints, useTrackingSettings } from '../trackingConfig';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(s: number): string {
    if (!s) return '—';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function progressPercent(frame: number, total: number): number {
    if (!total) return 0;
    return Math.min(100, Math.round((frame / total) * 100));
}

const JOINT_INDEX: Record<string, number> = Object.fromEntries(
    JOINT_NAMES.map((name, i) => [name, i])
) as Record<string, number>;

// ─── Component ───────────────────────────────────────────────────────────────

export default function VideoDropZone() {
    const { settings: trackingSettings } = useTrackingSettings();

    const {
        phase, fileInfo, progress, error, cancelling,
        config, setConfig,
        pickFile, dropFile, startAnalysis, cancelAnalysis, reset,
    } = useVideoAnalysis();

    // ── Data-driven model list from Rust manifest (all bundled) ────────────
    const [models, setModels] = useState<ModelEntry[]>([]);
    const [modelStatuses, setModelStatuses] = useState<Record<string, ModelStatus>>({});
    const [visibleJoints, setVisibleJoints] = useState<number>(0);
    const [jointTotal, setJointTotal] = useState<number>(17);
    const [previewSourceIndex, setPreviewSourceIndex] = useState(0);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [previewReady, setPreviewReady] = useState(false);
    const [previewJoints, setPreviewJoints] = useState<Joint[]>([]);
    const previewRef = useRef<HTMLVideoElement | null>(null);
    const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        invoke<ModelEntry[]>('mocap_list_models')
            .then(allMods => {
                // Offline mesh driving currently consumes COCO-17 joint layout.
                // Hide incompatible model families until the 133-keypoint path
                // has dedicated frontend/retarget wiring.
                const mods = allMods.filter(m => isRetargetCompatibleKeypoints(m.keypoints));
                setModels(mods);
                if (mods.length > 0 && (!config.model_id || !mods.some(m => m.id === config.model_id))) {
                    setConfig({ model_id: mods[0].id });
                }
            })
            .catch(console.warn);

        // Check which bundled models resolved successfully
        invoke<ModelStatus[]>('mocap_check_models')
            .then(statuses => {
                const map: Record<string, ModelStatus> = {};
                statuses.forEach(s => { map[s.model_id] = s; });
                setModelStatuses(map);
            })
            .catch(console.warn);
    }, []);

    // Track how many joints survive confidence gate while analyzing.
    useEffect(() => {
        let unlistenRaw: (() => void) | null = null;
        let unlistenSolved: (() => void) | null = null;
        let hasRawStream = false;
        const applyJoints = (joints: Joint[]) => {
            const visible = joints.filter(j => (j?.confidence ?? 0) >= 0.05).length;
            setVisibleJoints(visible);
            setJointTotal(joints.length || 17);
            setPreviewJoints(joints);
        };

        listen<RawJointFrame>('mocap://raw_joint_frame', e => {
            if (phase !== 'analyzing') return;
            const joints = e.payload?.joints ?? [];
            hasRawStream = true;
            applyJoints(joints);
        }).then(fn => { unlistenRaw = fn; });

        // Fallback for older backend builds that do not emit mocap://raw_joint_frame yet.
        listen<RawJointFrame>('mocap://joint_frame', e => {
            if (phase !== 'analyzing' || hasRawStream) return;
            applyJoints(e.payload?.joints ?? []);
        }).then(fn => { unlistenSolved = fn; });

        return () => {
            unlistenRaw?.();
            unlistenSolved?.();
        };
    }, [phase]);

    const videoPreviewSources = useMemo(() => {
        const path = fileInfo?.preview_path || fileInfo?.path;
        if (!path) return [] as string[];
        if (/^(https?:|file:|asset:|tauri:|blob:)/i.test(path)) return [path];

        const normalized = path.replace(/\\/g, '/');
        const fileUrl = /^[a-zA-Z]:\//.test(normalized)
            ? `file:///${normalized}`
            : `file://${normalized}`;

        return [
            convertFileSrc(path),
            encodeURI(fileUrl),
        ];
    }, [fileInfo?.path, fileInfo?.preview_path]);

    const videoPreviewSrc = videoPreviewSources[previewSourceIndex] ?? '';

    useEffect(() => {
        setPreviewSourceIndex(0);
        setPreviewError(null);
        setPreviewReady(false);
    }, [fileInfo?.path]);

    // Snap preview video to currently analyzed source timestamp.
    useEffect(() => {
        if (phase !== 'analyzing' || !progress || !fileInfo) return;
        const v = previewRef.current;
        if (!v || !previewReady || !Number.isFinite(fileInfo.fps) || fileInfo.fps <= 0) return;

        const sourceFrame = progress.frame * Math.max(1, config.frame_step);
        const t = sourceFrame / fileInfo.fps;
        if (Math.abs((v.currentTime || 0) - t) > 0.05) {
            try { v.currentTime = t; } catch { /* metadata not ready yet */ }
        }
    }, [phase, progress, fileInfo, config.frame_step]);

    // Draw tracking overlay directly on the source preview so analysis quality
    // is visible without relying on the character retarget stage.
    useEffect(() => {
        const video = previewRef.current;
        const canvas = previewCanvasRef.current;
        if (!video || !canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = video.clientWidth;
        const height = video.clientHeight;
        if (width <= 0 || height <= 0) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.max(1, Math.round(width * dpr));
        canvas.height = Math.max(1, Math.round(height * dpr));
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);

        if (phase !== 'analyzing' || !previewReady || previewJoints.length === 0) {
            return;
        }

        const vw = Math.max(1, video.videoWidth || width);
        const vh = Math.max(1, video.videoHeight || height);
        const scale = Math.min(width / vw, height / vh);
        const drawW = vw * scale;
        const drawH = vh * scale;
        const offsetX = (width - drawW) * 0.5;
        const offsetY = (height - drawH) * 0.5;
        const confMin = trackingSettings.minOverlayConfidence;
        const maxSeg = trackingSettings.maxBoneSegmentDistance2DNorm;

        const pointFor = (name: string) => {
            const idx = JOINT_INDEX[name];
            if (idx === undefined || idx >= previewJoints.length) return null;
            const j = previewJoints[idx];
            if (!j || (j.confidence ?? 0) < confMin) return null;
            return {
                x: offsetX + j.position[0] * drawW,
                y: offsetY + j.position[1] * drawH,
            };
        };

        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(94, 234, 212, 0.95)';
        ctx.beginPath();
        for (const [a, b] of SKELETON_BONES) {
            const pa = pointFor(a);
            const pb = pointFor(b);
            if (!pa || !pb) continue;
            const dx = pa.x - pb.x;
            const dy = pa.y - pb.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (!Number.isFinite(len) || len > Math.max(width, height) * maxSeg) continue;
            ctx.moveTo(pa.x, pa.y);
            ctx.lineTo(pb.x, pb.y);
        }
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        for (const name of JOINT_NAMES) {
            const p = pointFor(name);
            if (!p) continue;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
            ctx.fill();
        }
    }, [phase, previewReady, previewJoints, progress?.frame, trackingSettings]);

    // ─── Drag-and-drop handlers ─────────────────────────────────────────────
    const onDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    }, []);

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) {
            const path = (file as any).path ?? file.name;
            dropFile(path);
        }
    }, [dropFile]);

    const selectedModel = models.find(m => m.id === config.model_id);
    const selectedCached = modelStatuses[config.model_id]?.cached ?? false;

    // ─── Render ──────────────────────────────────────────────────────────────
    return (
        <div className="h-full flex flex-col p-3 gap-3 overflow-y-auto">

            {/* ── Idle / Drop zone ── */}
            {phase === 'idle' && (
                <div
                    onDragOver={onDragOver}
                    onDrop={onDrop}
                    className="flex-1 flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-[#222] hover:border-orange-500/40 transition-all cursor-pointer group"
                    onClick={pickFile}
                >
                    <div className="w-16 h-16 rounded-2xl bg-orange-500/10 group-hover:bg-orange-500/15 flex items-center justify-center transition-all">
                        <Upload size={28} className="text-orange-500/60 group-hover:text-orange-400 transition-colors" />
                    </div>
                    <div className="text-center">
                        <div className="text-sm font-bold text-gray-400 mb-1">Drop Video File</div>
                        <div className="text-xs text-gray-600">MP4, MOV, AVI, MKV, WebM, MXF</div>
                        <div className="text-[10px] text-gray-700 mt-2">or click to browse</div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
                        <FolderOpen size={12} className="text-orange-400" />
                        <span className="text-[10px] font-bold text-orange-400">BROWSE FILES</span>
                    </div>
                </div>
            )}

            {/* ── Probing ── */}
            {phase === 'probing' && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3">
                    <Loader2 size={32} className="text-orange-400 animate-spin" />
                    <div className="text-xs text-gray-500">Reading video metadata…</div>
                </div>
            )}

            {/* ── Ready — show info + config ── */}
            {(phase === 'ready') && fileInfo && (
                <>
                    {/* File info card */}
                    <div className="rounded-xl bg-[#0f0f0f] border border-[#1a1a1a] p-3">
                        <div className="flex items-start gap-2">
                            <Film size={14} className="text-orange-400 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0">
                                <div className="text-[11px] font-bold text-white truncate">{fileInfo.name}</div>
                                <div className="grid grid-cols-3 gap-2 mt-2">
                                    {[
                                        { label: 'RES', value: `${fileInfo.width}×${fileInfo.height}` },
                                        { label: 'FPS', value: fileInfo.fps.toFixed(1) },
                                        { label: 'DUR', value: formatDuration(fileInfo.duration_s) },
                                    ].map(({ label, value }) => (
                                        <div key={label} className="flex flex-col items-center p-1.5 rounded-lg bg-black/30">
                                            <span className="text-[8px] text-gray-600 font-mono">{label}</span>
                                            <span className="text-[10px] font-bold text-gray-300">{value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Config */}
                    <div className="rounded-xl bg-[#0f0f0f] border border-[#1a1a1a] p-3 flex flex-col gap-3">
                        <div className="flex items-center gap-1.5 text-[9px] font-black tracking-widest text-gray-600 uppercase">
                            <Settings2 size={10} />
                            Analysis Settings
                        </div>

                        {/* ── Model picker (data-driven from manifest) ── */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] text-gray-600 font-mono flex items-center justify-between">
                                <span>POSE MODEL</span>
                                {selectedModel && (
                                    <span className="text-[8px] text-gray-700">
                                        {selectedModel.input_shape[3]}×{selectedModel.input_shape[2]} · {selectedModel.keypoints}kp
                                    </span>
                                )}
                            </label>

                            {models.length === 0 ? (
                                <div className="flex items-center gap-2 text-[10px] text-gray-600 py-1">
                                    <Loader2 size={10} className="animate-spin" /> Loading models…
                                </div>
                            ) : (
                                <div className="flex flex-col gap-1">
                                    {models.map(model => {
                                        const isSelected = config.model_id === model.id;
                                        const cached = modelStatuses[model.id]?.cached ?? false;
                                        return (
                                            <div
                                                key={model.id}
                                                role="button"
                                                tabIndex={0}
                                                onClick={() => setConfig({ model_id: model.id })}
                                                onKeyDown={e => e.key === 'Enter' && setConfig({ model_id: model.id })}
                                                className={[
                                                    'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left transition-all text-[10px] cursor-pointer select-none',
                                                    isSelected
                                                        ? 'bg-orange-500/8 border-orange-500/30 text-white'
                                                        : 'bg-white/2 border-white/5 hover:bg-white/4 text-gray-400',
                                                ].join(' ')}
                                            >
                                                <div className={[
                                                    'w-1.5 h-1.5 rounded-full flex-shrink-0 mt-0.5',
                                                    isSelected ? 'bg-orange-400' : 'bg-white/15',
                                                ].join(' ')} />

                                                <div className="flex-1 min-w-0">
                                                    <div className="font-bold truncate">{model.name}</div>
                                                    {model.description && (
                                                        <div className="text-[9px] text-gray-600 mt-0.5 truncate">{model.description}</div>
                                                    )}
                                                </div>

                                                {/* Status: green = bundled, yellow = missing */}
                                                {cached ? (
                                                    <span className="flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded border bg-green-500/10 border-green-500/20 text-green-400 flex-shrink-0">
                                                        <HardDrive size={7} />OK
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded border bg-yellow-500/10 border-yellow-500/20 text-yellow-400 flex-shrink-0">
                                                        <AlertTriangle size={7} />MISSING
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Warning if selected model missing (Model file not in resources/) */}
                            {selectedModel && !selectedCached && (
                                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-yellow-500/5 border border-yellow-500/15 text-[9px] text-yellow-400/80">
                                    <AlertTriangle size={9} />
                                    Model file missing from resources — see docs for bundled model setup
                                </div>
                            )}
                        </div>

                        {/* Frame step */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[9px] text-gray-600 font-mono flex justify-between">
                                FRAME STEP
                                <span className="text-orange-400">every {config.frame_step} frame{config.frame_step > 1 ? 's' : ''}</span>
                            </label>
                            <input
                                type="range" min={1} max={10} step={1}
                                value={config.frame_step}
                                onChange={e => setConfig({ frame_step: Number(e.target.value) })}
                                className="accent-orange-500"
                            />
                            <div className="flex justify-between text-[8px] text-gray-700 font-mono">
                                <span>full quality</span>
                                <span>10× faster</span>
                            </div>
                        </div>

                        {/* Output FPS */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[9px] text-gray-600 font-mono flex justify-between">
                                OUTPUT FPS
                                <span className="text-orange-400">{config.output_fps}</span>
                            </label>
                            <input
                                type="range" min={10} max={120} step={5}
                                value={config.output_fps}
                                onChange={e => setConfig({ output_fps: Number(e.target.value) })}
                                className="accent-orange-500"
                            />
                        </div>

                        {/* Subject */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[9px] text-gray-600 font-mono">SUBJECT</label>
                            <input
                                type="text"
                                placeholder="unknown"
                                value={config.subject}
                                onChange={e => setConfig({ subject: e.target.value })}
                                className="bg-[#080808] border border-[#222] text-[10px] text-white rounded-lg px-2 py-1.5 focus:outline-none focus:border-orange-500/40 placeholder-gray-700"
                            />
                        </div>
                    </div>

                    {/* Action row */}
                    <div className="flex gap-2">
                        <button
                            onClick={reset}
                            className="p-2 rounded-lg border border-[#222] text-gray-600 hover:text-gray-400 hover:border-[#333] transition-all"
                            title="Choose different file"
                        >
                            <RotateCcw size={13} />
                        </button>
                        <button
                            onClick={startAnalysis}
                            disabled={!selectedCached}
                            className={[
                                'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-black transition-all border',
                                selectedCached
                                    ? 'bg-orange-500/20 hover:bg-orange-500/30 border-orange-500/30 text-orange-300'
                                    : 'bg-white/3 border-white/5 text-white/20 cursor-not-allowed',
                            ].join(' ')}
                        >
                            <Play size={12} />
                            ANALYSE VIDEO
                        </button>
                    </div>
                </>
            )}

            {/* ── Analyzing ── */}
            {phase === 'analyzing' && progress && (
                <div className="flex-1 flex flex-col gap-4">
                    {videoPreviewSrc && (
                        <div className="rounded-xl bg-[#0b0b0b] border border-[#1a1a1a] p-2">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[9px] font-black tracking-widest text-gray-500 uppercase">Source Preview</span>
                                <span className="text-[9px] font-mono text-orange-400">
                                    joints {visibleJoints}/{jointTotal}
                                </span>
                            </div>
                            <div className="relative rounded-lg overflow-hidden border border-[#202020] bg-black">
                                <video
                                    ref={previewRef}
                                    src={videoPreviewSrc}
                                    muted
                                    controls
                                    preload="metadata"
                                    className="w-full h-auto max-h-44 object-contain"
                                    onLoadedMetadata={() => {
                                        setPreviewReady(true);
                                        setPreviewError(null);
                                    }}
                                    onError={() => {
                                        const hasNext = previewSourceIndex + 1 < videoPreviewSources.length;
                                        if (hasNext) {
                                            setPreviewSourceIndex(i => i + 1);
                                            return;
                                        }
                                        setPreviewReady(false);
                                        setPreviewError('Preview decode failed in webview (path/protocol/codec). Analysis can still run via backend ffmpeg.');
                                    }}
                                />
                                <canvas
                                    ref={previewCanvasRef}
                                    className="absolute inset-0 pointer-events-none"
                                />
                            </div>
                            {previewError && (
                                <div className="mt-1.5 text-[9px] text-yellow-400/80 font-mono">
                                    {previewError}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <Loader2 size={14} className="text-orange-400 animate-spin flex-shrink-0" />
                        <span className="text-[11px] font-bold text-white">{fileInfo?.name}</span>
                        <button
                            onClick={cancelAnalysis}
                            disabled={cancelling}
                            className={[
                                'ml-auto px-2.5 py-1 rounded-md border text-[9px] font-black tracking-wider uppercase transition-colors',
                                cancelling
                                    ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400/70 cursor-not-allowed'
                                    : 'border-red-500/35 bg-red-500/10 text-red-300 hover:bg-red-500/20',
                            ].join(' ')}
                        >
                            {cancelling ? 'Cancelling…' : 'Cancel'}
                        </button>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between text-[9px] text-gray-600 font-mono">
                            <span className="capitalize">{progress.phase}</span>
                            <span>
                                {progress.total
                                    ? `${progress.frame} / ${progress.total} frames`
                                    : `${progress.frame} frames`}
                            </span>
                        </div>
                        <div className="h-2 rounded-full bg-[#111] overflow-hidden">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all"
                                style={{ width: `${progressPercent(progress.frame, progress.total)}%` }}
                            />
                        </div>
                        {progress.fps_actual > 0 && (
                            <div className="text-[9px] text-gray-600 font-mono text-right">
                                {progress.fps_actual.toFixed(1)} fps processing
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                        {[
                            { label: 'PHASE', value: progress.phase.toUpperCase() },
                            { label: 'FRAME', value: `${progress.frame}${progress.total ? ` / ${progress.total}` : ''}` },
                            { label: 'THROUGHPUT', value: progress.fps_actual > 0 ? `${progress.fps_actual.toFixed(1)} fps` : '—' },
                        ].map(({ label, value }) => (
                            <div key={label} className="flex justify-between items-center">
                                <span className="text-[9px] font-mono text-gray-600">{label}</span>
                                <span className="text-[9px] font-bold text-gray-400">{value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Done ── */}
            {phase === 'done' && (
                <div className="flex-1 flex flex-col items-center justify-center gap-4">
                    <CheckCircle2 size={40} className="text-emerald-400" />
                    <div className="text-center">
                        <div className="text-sm font-bold text-white mb-1">Take Saved!</div>
                        <div className="text-xs text-gray-500">
                            Check the <strong className="text-orange-400">TAKES</strong> tab<br />
                            in the content browser.
                        </div>
                    </div>
                    <button
                        onClick={reset}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#111] border border-[#222] text-gray-400 text-[10px] font-bold hover:border-[#333] transition-all"
                    >
                        <Upload size={11} />
                        Analyse Another
                    </button>
                </div>
            )}

            {/* ── Error ── */}
            {phase === 'error' && (
                <div className="flex-1 flex flex-col items-center justify-center gap-4">
                    <AlertTriangle size={36} className="text-red-400" />
                    <div className="text-center">
                        <div className="text-xs font-bold text-red-400 mb-2">Analysis Failed</div>
                        <div className="text-[10px] text-gray-600 font-mono max-w-[200px] break-words">{error}</div>
                    </div>
                    <button
                        onClick={reset}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold hover:bg-red-500/20 transition-all"
                    >
                        <RotateCcw size={11} />
                        Try Again
                    </button>
                </div>
            )}
        </div>
    );
}
