/**
 * CameraSessionModal
 *
 * Full-screen session setup modal. Enumerates real cameras via
 * `mocap_enumerate_cameras`, lists inference models from
 * `mocap_list_models`, and fires `mocap_start_session` on confirm.
 *
 * Data-driven: all camera/model entries come from Rust — no hardcoding.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
    Camera, Cpu, Wifi, Play, X, RefreshCw, AlertTriangle,
    CheckCircle, ChevronRight, Zap, Monitor, Box, Download, HardDrive
} from 'lucide-react';
import type { CameraInfo, ModelEntry, ModelStatus, DccTarget, SessionConfig } from '../types';
import { DCC_TARGET_CONFIG } from '../types';
import { isRetargetCompatibleKeypoints } from '../trackingConfig';

// ─── Props ────────────────────────────────────────────────────────────────────

interface CameraSessionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStart: (config: SessionConfig) => void;
}

// ─── DCC Target options — data-driven from types config ──────────────────────

const DCC_ICONS: Record<DccTarget, React.ElementType> = {
    ue5: Monitor,
    unity: Box,
    blender: Zap,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function CameraSessionModal({
    isOpen,
    onClose,
    onStart,
}: CameraSessionModalProps) {
    // ── Enumerated data from Rust ─────────────────────────────────────────────
    const [cameras, setCameras] = useState<CameraInfo[]>([]);
    const [models, setModels] = useState<ModelEntry[]>([]);
    const [modelStatuses, setModelStatuses] = useState<Record<string, ModelStatus>>({});
    const [downloading, setDownloading] = useState<Record<string, number>>({}); // model_id -> progress%
    const [loadingDevices, setLoadingDevices] = useState(false);
    const [enumError, setEnumError] = useState<string | null>(null);

    // ── Config state ──────────────────────────────────────────────────────────
    const [selectedCamera, setSelectedCamera] = useState<number>(0);
    const [selectedModel, setSelectedModel] = useState<string>('yolov11s_pose');
    const [selectedDcc, setSelectedDcc] = useState<DccTarget>('ue5');
    const [precision, setPrecision] = useState<'fp32' | 'fp16'>('fp32');

    // ── Enumerate cameras + models ────────────────────────────────────────────
    const fetchModelStatuses = useCallback(async () => {
        try {
            const statuses = await invoke<ModelStatus[]>('mocap_check_models');
            const map: Record<string, ModelStatus> = {};
            statuses.forEach(s => { map[s.model_id] = s; });
            setModelStatuses(map);
        } catch (e) {
            console.warn('[CameraSessionModal] mocap_check_models failed:', e);
        }
    }, []);

    const enumerate = useCallback(async () => {
        setLoadingDevices(true);
        setEnumError(null);
        try {
            const [cams, mods] = await Promise.all([
                invoke<CameraInfo[]>('mocap_enumerate_cameras'),
                invoke<ModelEntry[]>('mocap_list_models'),
            ]);
            setCameras(cams);
            setModels(mods);
            if (cams.length > 0) setSelectedCamera(cams[0].index);
            if (mods.length > 0) setSelectedModel(mods[0].id);
            await fetchModelStatuses();
        } catch (e) {
            setEnumError(String(e));
        } finally {
            setLoadingDevices(false);
        }
    }, [fetchModelStatuses]);

    // Listen for download progress events
    useEffect(() => {
        let unlisten: (() => void) | null = null;
        listen<{ model_id: string; percent: number }>('mocap://model_download_progress', e => {
            const { model_id, percent } = e.payload;
            setDownloading(prev => ({ ...prev, [model_id]: percent }));
            if (percent >= 100) {
                setTimeout(() => {
                    setDownloading(prev => { const n = { ...prev }; delete n[model_id]; return n; });
                    fetchModelStatuses();
                }, 800);
            }
        }).then(fn => { unlisten = fn; });
        return () => { unlisten?.(); };
    }, [fetchModelStatuses]);

    useEffect(() => {
        if (isOpen) enumerate();
    }, [isOpen, enumerate]);

    // ── Start session ─────────────────────────────────────────────────────────
    const handleStart = useCallback(() => {
        const isCached = modelStatuses[selectedModel]?.cached ?? false;
        if (!isCached) return; // guard — UI should disable button anyway
        const dccConf = DCC_TARGET_CONFIG[selectedDcc];
        const config: SessionConfig = {
            camera_device_id: selectedCamera,  // number — matches Rust u32
            model_id: selectedModel as any,
            precision,
            dcc_target: selectedDcc,
            target_host: '127.0.0.1',
            target_port: dccConf.defaultPort,
            enable_preview: true,
        };
        onStart(config);
        onClose();
    }, [selectedCamera, selectedModel, precision, selectedDcc, modelStatuses, onStart, onClose]);

    const handleDownload = useCallback(async (modelId: string) => {
        setDownloading(prev => ({ ...prev, [modelId]: 0 }));
        try {
            await invoke('mocap_download_model', { modelId });
        } catch (e) {
            setDownloading(prev => { const n = { ...prev }; delete n[modelId]; return n; });
            console.error('[CameraSessionModal] Download failed:', e);
        }
    }, []);

    if (!isOpen) return null;

    const selectedModelEntry = models.find(m => m.id === selectedModel);
    const selectedModelCached = modelStatuses[selectedModel]?.cached ?? false;
    const selectedModelLiveCompatible = isRetargetCompatibleKeypoints(selectedModelEntry?.keypoints ?? 0);
    const canStart = cameras.length > 0 && !loadingDevices && selectedModelCached && selectedModelLiveCompatible;

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div
                className="relative w-[680px] max-h-[90vh] overflow-y-auto rounded-2xl border border-white/8 shadow-2xl"
                style={{
                    background: 'linear-gradient(145deg, #0e0e10 0%, #0a0a0d 100%)',
                    boxShadow: '0 0 80px rgba(0,255,180,0.04), 0 32px 64px rgba(0,0,0,0.6)',
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-8 pt-8 pb-6 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[color:var(--kos-accent-primary)]/15 flex items-center justify-center border border-[color:var(--kos-accent-primary)]/20">
                            <Camera size={16} className="text-[color:var(--kos-accent-primary)]" />
                        </div>
                        <div>
                            <h2 className="text-[13px] font-black tracking-[0.15em] text-white uppercase">
                                Start Capture Session
                            </h2>
                            <p className="text-[10px] text-white/30 tracking-wider mt-0.5">
                                Configure camera, model, and broadcast target
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/5 transition-all"
                    >
                        <X size={14} />
                    </button>
                </div>

                <div className="px-8 py-6 space-y-7">

                    {/* ── Camera Selection ──────────────────────────────────────────── */}
                    <Section
                        icon={Camera}
                        label="Camera Device"
                        action={
                            <button
                                onClick={enumerate}
                                disabled={loadingDevices}
                                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-bold tracking-wider text-white/30 hover:text-white/60 hover:bg-white/5 transition-all uppercase"
                            >
                                <RefreshCw size={10} className={loadingDevices ? 'animate-spin' : ''} />
                                Refresh
                            </button>
                        }
                    >
                        {enumError && (
                            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/8 border border-red-500/20 text-red-400 text-[10px]">
                                <AlertTriangle size={12} />
                                {enumError}
                            </div>
                        )}
                        {loadingDevices ? (
                            <div className="flex items-center gap-2 py-3 text-white/30 text-[10px]">
                                <RefreshCw size={12} className="animate-spin" />
                                Enumerating devices...
                            </div>
                        ) : cameras.length === 0 ? (
                            <div className="flex items-center gap-2 px-3 py-3 rounded-lg bg-yellow-500/8 border border-yellow-500/15 text-yellow-400/70 text-[10px]">
                                <AlertTriangle size={12} />
                                No cameras detected. Check connections and refresh.
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                {cameras.map((cam) => {
                                    const isSelected = selectedCamera === cam.index;
                                    return (
                                        <div
                                            key={cam.index}
                                            id={`cam-select-${cam.index}`}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => setSelectedCamera(cam.index)}
                                            onKeyDown={(e) => e.key === 'Enter' && setSelectedCamera(cam.index)}
                                            className={[
                                                'flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer',
                                                isSelected
                                                    ? 'bg-[color:var(--kos-accent-primary)]/10 border-[color:var(--kos-accent-primary)]/30 shadow-[0_0_12px_rgba(0,255,180,0.06)]'
                                                    : 'bg-white/3 border-white/6 hover:bg-white/5 hover:border-white/10',
                                            ].join(' ')}
                                        >
                                            <Camera size={13} className={isSelected ? 'text-[color:var(--kos-accent-primary)] mt-0.5' : 'text-white/30 mt-0.5'} />
                                            <div className="min-w-0">
                                                <div className={`text-[10px] font-bold truncate ${isSelected ? 'text-white' : 'text-white/60'}`}>
                                                    {cam.name}
                                                </div>
                                                <div className="text-[9px] text-white/25 font-mono mt-0.5">
                                                    Device #{cam.index}
                                                </div>
                                            </div>
                                            {isSelected && (
                                                <CheckCircle size={10} className="text-[color:var(--kos-accent-primary)] ml-auto mt-0.5 flex-shrink-0" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Section>

                    {/* ── Inference Model ───────────────────────────────────────────── */}
                    <Section icon={Cpu} label="Inference Model">
                        <div className="space-y-1.5">
                            {models.map((model) => {
                                const isSelected = selectedModel === model.id;
                                const isLiveCompatible = isRetargetCompatibleKeypoints(model.keypoints);
                                return (
                                    <div
                                        key={model.id}
                                        id={`model-select-${model.id}`}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setSelectedModel(model.id)}
                                        onKeyDown={(e) => e.key === 'Enter' && setSelectedModel(model.id)}
                                        className={[
                                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer',
                                            isSelected
                                                ? 'bg-[color:var(--kos-accent-primary)]/8 border-[color:var(--kos-accent-primary)]/25'
                                                : 'bg-white/2 border-white/5 hover:bg-white/4 hover:border-white/10',
                                        ].join(' ')}
                                    >
                                        <div className={[
                                            'w-1.5 h-1.5 rounded-full flex-shrink-0',
                                            isSelected ? 'bg-[color:var(--kos-accent-primary)]' : 'bg-white/15',
                                        ].join(' ')} />
                                        <div className="flex-1 min-w-0">
                                            <div className={`text-[10px] font-bold ${isSelected ? 'text-white' : 'text-white/50'}`}>
                                                {model.name}
                                            </div>
                                            <div className="text-[9px] text-white/25 mt-0.5 truncate">
                                                {model.description}
                                            </div>
                                            {!isLiveCompatible && (
                                                <div className="mt-1 text-[8px] text-yellow-400/70 tracking-wide">
                                                    Live character retarget currently supports COCO-17 only
                                                </div>
                                            )}
                                            {downloading[model.id] !== undefined && (
                                                <div className="mt-1.5 h-0.5 w-full bg-white/10 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-[color:var(--kos-accent-primary)] transition-all duration-300"
                                                        style={{ width: `${downloading[model.id]}%` }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        {/* Cached / not cached badge — no nested button */}
                                        {downloading[model.id] !== undefined ? (
                                            <span className="text-[8px] font-black tracking-wider px-1.5 py-0.5 rounded-md border flex-shrink-0 bg-yellow-500/10 border-yellow-500/20 text-yellow-400">
                                                {Math.round(downloading[model.id])}%
                                            </span>
                                        ) : modelStatuses[model.id]?.cached ? (
                                            <span className="flex items-center gap-1 text-[8px] font-black tracking-wider px-1.5 py-0.5 rounded-md border flex-shrink-0 bg-green-500/10 border-green-500/20 text-green-400">
                                                <HardDrive size={8} /> READY
                                            </span>
                                        ) : (
                                            <span
                                                role="button"
                                                tabIndex={0}
                                                onClick={(e) => { e.stopPropagation(); handleDownload(model.id); }}
                                                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleDownload(model.id); } }}
                                                className="flex items-center gap-1 text-[8px] font-black tracking-wider px-1.5 py-0.5 rounded-md border flex-shrink-0 bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-colors cursor-pointer"
                                            >
                                                <Download size={8} /> GET
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                            {models.length === 0 && !loadingDevices && (
                                <div className="px-3 py-3 text-[10px] text-white/30 text-center">
                                    No models loaded — check engine initialization
                                </div>
                            )}
                        </div>
                    </Section>

                    {/* ── Broadcast Target ──────────────────────────────────────────── */}
                    <Section icon={Wifi} label="Broadcast Target">
                        <div className="grid grid-cols-3 gap-2">
                            {(Object.entries(DCC_TARGET_CONFIG) as [DccTarget, typeof DCC_TARGET_CONFIG[DccTarget]][]).map(([id, cfg]) => {
                                const isSelected = selectedDcc === id;
                                const Icon = DCC_ICONS[id];
                                return (
                                    <button
                                        key={id}
                                        id={`dcc-select-${id}`}
                                        onClick={() => setSelectedDcc(id)}
                                        className={[
                                            'flex flex-col items-center gap-2 py-4 px-2 rounded-xl border transition-all',
                                            isSelected
                                                ? 'bg-orange-500/10 border-orange-500/30 shadow-[0_0_16px_rgba(249,115,22,0.08)]'
                                                : 'bg-white/2 border-white/5 hover:bg-white/4 hover:border-white/10',
                                        ].join(' ')}
                                    >
                                        <Icon size={18} className={isSelected ? 'text-orange-400' : 'text-white/25'} />
                                        <div>
                                            <div className={`text-[10px] font-black tracking-wider ${isSelected ? 'text-white' : 'text-white/35'}`}>
                                                {cfg.label}
                                            </div>
                                            <div className="text-[8px] text-white/20 font-mono mt-0.5">
                                                :{cfg.defaultPort}
                                            </div>
                                        </div>
                                        {isSelected && (
                                            <div className="w-1 h-1 rounded-full bg-orange-400" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </Section>

                    {/* ── Summary + Start ───────────────────────────────────────────── */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                        <div className="text-[9px] text-white/20 font-mono space-y-0.5">
                            {selectedModelEntry && (
                                <div className="flex items-center gap-1.5">
                                    <span className="text-white/30">MODEL</span>
                                    <span>{selectedModelEntry.name}</span>
                                    <span className="text-white/15">·</span>
                                    <span className="text-[color:var(--kos-accent-primary)]/50">
                                        {selectedModelEntry.input_shape[3]}x{selectedModelEntry.input_shape[2]}
                                    </span>
                                    <span className="text-white/15">·</span>
                                    <span className={isRetargetCompatibleKeypoints(selectedModelEntry.keypoints) ? "text-green-400/70" : "text-yellow-400/70"}>
                                        {isRetargetCompatibleKeypoints(selectedModelEntry.keypoints) ? 'live-ready' : `${selectedModelEntry.keypoints}kp (not live-ready)`}
                                    </span>
                                    {!selectedModelCached && (
                                        <span className="text-yellow-400/60 ml-1">⚠ not downloaded</span>
                                    )}
                                </div>
                            )}
                            <div className="flex items-center gap-1.5">
                                <span className="text-white/30">TARGET</span>
                                <span>{DCC_TARGET_CONFIG[selectedDcc].label}</span>
                                <span className="text-white/15">·</span>
                                <span>127.0.0.1:{DCC_TARGET_CONFIG[selectedDcc].defaultPort}</span>
                            </div>
                        </div>

                        <button
                            id="session-start-btn"
                            onClick={handleStart}
                            disabled={!canStart}
                            className={[
                                'flex items-center gap-2 px-6 py-3 rounded-xl font-black text-[11px] tracking-[0.15em] uppercase',
                                'transition-all duration-200 select-none',
                                canStart
                                    ? [
                                        'bg-[color:var(--kos-accent-primary)] text-black',
                                        'hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]',
                                        'shadow-[0_0_24px_rgba(0,255,180,0.25)]',
                                    ].join(' ')
                                    : 'bg-white/5 text-white/20 cursor-not-allowed',
                            ].join(' ')}
                        >
                            <Play size={12} fill="currentColor" />
                            Start Capture
                            {cameras.length > 0 && <ChevronRight size={12} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
    icon: Icon,
    label,
    action,
    children,
}: {
    icon: React.ElementType;
    label: string;
    action?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Icon size={11} className="text-white/30" />
                    <span className="text-[9px] font-black tracking-[0.2em] uppercase text-white/30">
                        {label}
                    </span>
                </div>
                {action}
            </div>
            {children}
        </div>
    );
}
