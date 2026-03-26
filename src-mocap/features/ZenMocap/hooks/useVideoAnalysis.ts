/**
 * useVideoAnalysis — Phase 4 offline video analysis hook
 *
 * Manages the full lifecycle of dropping a video file and converting it
 * to a .zenmocap take:
 *   1. probeVideo → show file info
 *   2. analyzeVideo → starts Rust worker, listen for progress events
 *   3. mocap://take_saved → done, useTakes auto-refreshes
 *
 * State machine: idle → probing → ready → analyzing → done | error
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { mocapService } from '../MocapService';
import type {
    VideoAnalysisConfig,
    VideoAnalysisProgress,
    VideoProbeResult,
} from '../types';

export type AnalysisPhase =
    | 'idle'
    | 'probing'
    | 'ready'      // probed, config shown, waiting for user to confirm
    | 'analyzing'
    | 'done'
    | 'error';

export interface VideoFileInfo {
    path: string;
    preview_path?: string;
    name: string;
    width: number;
    height: number;
    fps: number;
    frames: number;
    duration_s: number;
}

export interface UseVideoAnalysisResult {
    phase: AnalysisPhase;
    fileInfo: VideoFileInfo | null;
    progress: VideoAnalysisProgress | null;
    error: string | null;
    cancelling: boolean;
    config: VideoAnalysisConfig;
    setConfig: (patch: Partial<VideoAnalysisConfig>) => void;
    pickFile: () => Promise<void>;
    dropFile: (path: string) => Promise<void>;
    startAnalysis: () => Promise<void>;
    cancelAnalysis: () => Promise<void>;
    reset: () => void;
}

const DEFAULT_CONFIG: VideoAnalysisConfig = {
    video_path: '',
    // Filled from mocap_list_models() on mount (data-driven from manifest)
    model_id: '',
    frame_step: 1,
    output_fps: 30,
    tags: [],
    subject: 'unknown',
};

export function useVideoAnalysis(): UseVideoAnalysisResult {
    const [phase, setPhase] = useState<AnalysisPhase>('idle');
    const [fileInfo, setFileInfo] = useState<VideoFileInfo | null>(null);
    const [progress, setProgress] = useState<VideoAnalysisProgress | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [cancelling, setCancelling] = useState(false);
    const [config, setConfigState] = useState<VideoAnalysisConfig>(DEFAULT_CONFIG);
    const unlistenProgressRef = useRef<UnlistenFn | null>(null);
    const unlistenErrorRef = useRef<UnlistenFn | null>(null);
    const unlistenTakeSavedRef = useRef<UnlistenFn | null>(null);

    const cleanupListeners = useCallback(() => {
        unlistenProgressRef.current?.();
        unlistenErrorRef.current?.();
        unlistenTakeSavedRef.current?.();
        unlistenProgressRef.current = null;
        unlistenErrorRef.current = null;
        unlistenTakeSavedRef.current = null;
    }, []);

    const setConfig = useCallback((patch: Partial<VideoAnalysisConfig>) => {
        setConfigState(prev => ({ ...prev, ...patch }));
    }, []);

    // ─── Probe a video path ───────────────────────────────────────────────────

    const probe = useCallback(async (path: string) => {
        setPhase('probing');
        setError(null);
        try {
            const result: VideoProbeResult = await mocapService.probeVideo(path);
            let previewPath: string | undefined;
            try {
                previewPath = await invoke<string>('mocap_prepare_video_preview', { path });
            } catch (e) {
                console.warn('[useVideoAnalysis] Preview transcode unavailable:', e);
            }
            const stream = result.streams?.[0];

            // Parse r_frame_rate fraction "num/den"
            const parseFps = (raw?: string): number => {
                if (!raw) return 30;
                const [n, d] = raw.split('/').map(Number);
                return d ? n / d : n ?? 30;
            };

            const info: VideoFileInfo = {
                path,
                preview_path: previewPath,
                name: path.split(/[\\/]/).pop() ?? path,
                width: stream?.width ?? 0,
                height: stream?.height ?? 0,
                fps: parseFps(stream?.r_frame_rate),
                frames: parseInt(stream?.nb_frames ?? '0', 10) || 0,
                duration_s: parseFloat(stream?.duration ?? '0') || 0,
            };

            setFileInfo(info);
            setConfig({ video_path: path });
            setPhase('ready');
        } catch (e: any) {
            setError(String(e));
            setPhase('error');
        }
    }, [setConfig]);

    // ─── Pick file via native dialog ──────────────────────────────────────────

    const pickFile = useCallback(async () => {
        // Try native dialog via Rust; falls back gracefully to null
        // (VideoDropZone then shows a path input field instead)
        try {
            const selected = await invoke<string | null>('mocap_open_video_dialog');
            if (selected) await probe(selected);
        } catch {
            // Dialog not available — VideoDropZone will show path input
            console.warn('[useVideoAnalysis] Native dialog unavailable; use path input or drag-and-drop');
        }
    }, [probe]);

    // ─── Drop a path (from drag-and-drop) ────────────────────────────────────

    const dropFile = useCallback(async (path: string) => {
        await probe(path);
    }, [probe]);

    // ─── Start analysis ───────────────────────────────────────────────────────

    const startAnalysis = useCallback(async () => {
        if (phase !== 'ready' || !config.video_path) return;

        setPhase('analyzing');
        setCancelling(false);
        setProgress({ frame: 0, total: fileInfo?.frames ?? 0, fps_actual: 0, phase: 'inference' });
        setError(null);

        // Listen for progress events
        cleanupListeners();
        unlistenProgressRef.current = await listen<VideoAnalysisProgress>(
            'mocap://video_progress',
            e => {
                setProgress(e.payload);
                if (e.payload.phase === 'done') {
                    setPhase('done');
                    cleanupListeners();
                }
            }
        );

        // Error path
        unlistenErrorRef.current = await listen<string>('mocap://error', e => {
            setError(e.payload);
            setPhase('error');
            cleanupListeners();
        });

        // Completion fallback: some backend paths emit take_saved even if
        // progress stream's final done packet is dropped.
        unlistenTakeSavedRef.current = await listen('mocap://take_saved', () => {
            setPhase(prev => prev === 'analyzing' ? 'done' : prev);
            setCancelling(false);
            cleanupListeners();
        });
        const unlistenCancelled = await listen<string>('mocap://video_cancelled', (e) => {
            setError(e.payload);
            setProgress(null);
            setPhase(prev => (prev === 'analyzing' ? 'ready' : prev));
            setCancelling(false);
            cleanupListeners();
        });
        // chain into existing cleanup list
        const prevTakeUnlisten = unlistenTakeSavedRef.current;
        unlistenTakeSavedRef.current = () => {
            prevTakeUnlisten?.();
            unlistenCancelled();
        };

        try {
            await mocapService.analyzeVideo(config);
        } catch (e: any) {
            setError(String(e));
            setPhase('error');
            setCancelling(false);
            cleanupListeners();
        }
    }, [phase, config, fileInfo, cleanupListeners]);

    const cancelAnalysis = useCallback(async () => {
        if (phase !== 'analyzing' || cancelling) return;
        setCancelling(true);
        try {
            await mocapService.cancelVideoAnalysis();
        } catch (e: any) {
            setError(String(e));
            setCancelling(false);
        }
    }, [phase, cancelling]);

    const reset = useCallback(() => {
        cleanupListeners();
        setPhase('idle');
        setFileInfo(null);
        setProgress(null);
        setError(null);
        setCancelling(false);
        setConfigState(DEFAULT_CONFIG);
    }, [cleanupListeners]);

    useEffect(() => () => { cleanupListeners(); }, [cleanupListeners]);

    return {
        phase, fileInfo, progress, error, cancelling, config, setConfig,
        pickFile, dropFile, startAnalysis, cancelAnalysis, reset,
    };
}
