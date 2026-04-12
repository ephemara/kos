/**
 * K_OS Kernel Launcher
 * 
 * Unified boot and project selection screen.
 * Completely separate from app initialization - apps only load AFTER this completes.
 * 
 * Features:
 * - System diagnostics on boot
 * - Project creation / loading
 * - Recent projects
 * - Quick settings access
 * - GPU/System info display
 * - Viewport mode selection (Simple vs Advanced)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Hexagon, Terminal, HardDrive, Zap, Settings, ChevronRight,
    Clock, CheckCircle2, AlertTriangle, Loader2, ArrowRight, RefreshCw,
    Database, Wifi, WifiOff, Video, VideoOff
} from 'lucide-react';
import { mocapService } from '@mocap/features/ZenMocap/MocapService';
import { POSE_MODELS, type CameraInfo } from '@mocap/features/ZenMocap/types';
import { CHARACTER_OPTIONS, type CharacterId } from '@mocap/features/ZenMocap/characterOptions';

// ============================================================================
// TYPES
// ============================================================================

export interface KernelLauncherProps {
    onComplete: (config: LaunchConfig) => void;
    onOpenSettings: () => void;
    hasApiKey: boolean;
    kernelStatus: string;
    kernelArtifactCount: number;
    kernelMaterialCount: number;
    kernelAlphaCount: number;
}

export interface LaunchConfig {
    cameraDeviceId?: string;
    modelId?: keyof typeof POSE_MODELS;
    targetHost?: string;
    previewMode?: 'skeleton' | 'video';
    characterId?: CharacterId;
    projectId?: string;
    projectType?: 'new' | 'load' | 'recent';
}

interface RecentProject {
    id: string;
    name: string;
    path: string;
    lastOpened: Date;
    thumbnailUrl?: string;
    artifactCount: number;
}

interface SystemDiagnostic {
    id: string;
    label: string;
    status: 'pending' | 'running' | 'ok' | 'warning' | 'error';
    detail?: string;
    color: string;
}

// ============================================================================
// UTILITIES
// ============================================================================

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const CAMERA_SELECT_LATER = '__camera_select_later__';

const getCameraId = (camera: CameraInfo): string => {
    const c = camera as any;
    return c.deviceId ?? c.device_id ?? String(c.index ?? '0');
};

const getCameraName = (camera: CameraInfo): string => {
    const c = camera as any;
    return c.displayName ?? c.display_name ?? c.name ?? `Camera ${c.index ?? ''}`.trim();
};

function getWebGLInfo(): { ok: boolean; renderer: string; vendor: string; version: string } {
    try {
        const canvas = document.createElement('canvas');
        const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as WebGLRenderingContext | null;
        if (!gl) return { ok: false, renderer: 'Unavailable', vendor: 'Unknown', version: 'N/A' };
        
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        const vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : 'Unknown';
        const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'Unknown';
        const version = gl.getParameter(gl.VERSION) || 'Unknown';
        
        return { ok: true, renderer, vendor, version };
    } catch {
        return { ok: false, renderer: 'Error', vendor: 'Unknown', version: 'N/A' };
    }
}

function formatDate(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function KernelLauncher({
    onComplete,
    onOpenSettings,
    hasApiKey,
    kernelStatus,
    kernelArtifactCount,
    kernelMaterialCount,
    kernelAlphaCount,
}: KernelLauncherProps) {
    // State
    const [phase, setPhase] = useState<'boot' | 'select'>('boot');
    const [diagnostics, setDiagnostics] = useState<SystemDiagnostic[]>([]);
    const [bootProgress, setBootProgress] = useState(0);
    const [bootComplete, setBootComplete] = useState(false);
    const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [webglInfo, setWebglInfo] = useState<ReturnType<typeof getWebGLInfo> | null>(null);
    const [cameraOptions, setCameraOptions] = useState<CameraInfo[]>([]);
    const [cameraScanError, setCameraScanError] = useState<string | null>(null);
    const [isScanningCameras, setIsScanningCameras] = useState(false);
    const [selectedCamera, setSelectedCamera] = useState(CAMERA_SELECT_LATER);
    const [selectedModel, setSelectedModel] = useState<keyof typeof POSE_MODELS>('yolov11s_pose');
    const [selectedPreviewMode, setSelectedPreviewMode] = useState<'skeleton' | 'video'>('skeleton');
    const [selectedCharacter, setSelectedCharacter] = useState<CharacterId>('mixamo_bot');
    const [targetHost, setTargetHost] = useState('127.0.0.1');
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
    const [previewError, setPreviewError] = useState<string | null>(null);
    
    const bootStartedRef = useRef(false);
    const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

    // Boot sequence
    useEffect(() => {
        if (bootStartedRef.current) return;
        bootStartedRef.current = true;
        
        const runBoot = async () => {
            const steps: SystemDiagnostic[] = [
                { id: 'post', label: 'POWER-ON SELF TEST', status: 'pending', color: 'text-cyan-400' },
                { id: 'gpu', label: 'GPU CONTEXT', status: 'pending', color: 'text-teal-400' },
                { id: 'storage', label: 'STORAGE INDEX', status: 'pending', color: 'text-emerald-400' },
                { id: 'kernel', label: 'KERNEL LINK', status: 'pending', color: 'text-blue-400' },
                { id: 'api', label: 'API UPLINK', status: 'pending', color: 'text-violet-400' },
                { id: 'modules', label: 'MODULE REGISTRY', status: 'pending', color: 'text-rose-400' },
            ];
            
            setDiagnostics(steps);
            
            for (let i = 0; i < steps.length; i++) {
                // Update current step to running
                setDiagnostics(prev => prev.map((s, idx) => 
                    idx === i ? { ...s, status: 'running' } : s
                ));
                
                setBootProgress((i / steps.length) * 100);
                
                // Simulate step execution
                await sleep(200 + Math.random() * 300);
                
                let status: 'ok' | 'warning' | 'error' = 'ok';
                let detail = 'Ready';
                
                switch (steps[i].id) {
                    case 'post':
                        detail = 'System OK';
                        break;
                    case 'gpu':
                        const info = getWebGLInfo();
                        setWebglInfo(info);
                        status = info.ok ? 'ok' : 'warning';
                        detail = info.ok ? info.renderer.slice(0, 30) : 'WebGL unavailable';
                        break;
                    case 'storage':
                        const total = kernelArtifactCount + kernelMaterialCount + kernelAlphaCount;
                        detail = `${total} objects indexed`;
                        break;
                    case 'kernel':
                        detail = kernelStatus || 'Linked';
                        break;
                    case 'api':
                        status = hasApiKey ? 'ok' : 'warning';
                        detail = hasApiKey ? 'Connected' : 'No API key';
                        break;
                    case 'modules':
                        detail = '6 modules loaded';
                        break;
                }
                
                // Update step result
                setDiagnostics(prev => prev.map((s, idx) => 
                    idx === i ? { ...s, status, detail } : s
                ));
            }
            
            setBootProgress(100);
            await sleep(300);
            setBootComplete(true);
            
            // Auto-advance to select phase after a brief pause
            await sleep(500);
            setPhase('select');
        };
        
        runBoot();
    }, [hasApiKey, kernelArtifactCount, kernelMaterialCount, kernelAlphaCount, kernelStatus]);

    // Load recent projects from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem('k_os_recent_projects');
            if (stored) {
                const projects = JSON.parse(stored).map((p: any) => ({
                    ...p,
                    lastOpened: new Date(p.lastOpened)
                }));
                setRecentProjects(projects.slice(0, 5));
            }
        } catch {
            // Ignore parse errors
        }
    }, []);

    const scanCameras = useCallback(async () => {
        setIsScanningCameras(true);
        setCameraScanError(null);
        try {
            const cameras = await mocapService.enumerateCameras();
            setCameraOptions(cameras);
            setSelectedCamera(current => (
                current === CAMERA_SELECT_LATER && cameras.length > 0
                    ? getCameraId(cameras[0])
                    : current
            ));
        } catch (error) {
            setCameraScanError(error instanceof Error ? error.message : 'Camera scan failed');
            setCameraOptions([]);
        } finally {
            setIsScanningCameras(false);
        }
    }, []);

    useEffect(() => {
        if (phase !== 'select') return;
        void scanCameras();
    }, [phase, scanCameras]);

    // Webcam preview stream management - always show when camera is selected
    useEffect(() => {
        if (selectedCamera === CAMERA_SELECT_LATER) {
            // Stop stream when no camera selected
            if (previewStream) {
                previewStream.getTracks().forEach(t => t.stop());
                setPreviewStream(null);
            }
            setPreviewError(null);
            return;
        }

        let cancelled = false;
        let currentStream: MediaStream | null = null;
        setPreviewError(null);

        const startPreview = async () => {
            try {
                if (!navigator.mediaDevices?.getUserMedia) {
                    throw new Error('Webcam API unavailable');
                }

                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        deviceId: selectedCamera,
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        frameRate: { ideal: 30 },
                    },
                    audio: false,
                });

                if (cancelled) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }

                currentStream = stream;
                setPreviewStream(stream);

                // Attach to video element
                if (videoPreviewRef.current) {
                    videoPreviewRef.current.srcObject = stream;
                    await videoPreviewRef.current.play().catch(() => {});
                }
            } catch (err: any) {
                if (!cancelled) {
                    setPreviewError(err?.message ?? 'Camera access failed');
                }
            }
        };

        startPreview();

        return () => {
            cancelled = true;
            if (currentStream) {
                currentStream.getTracks().forEach(t => t.stop());
            }
        };
    }, [selectedCamera]); // Removed previewStream from dependencies - it was causing infinite loop

    // Attach stream to video element when ref becomes available or stream changes
    useEffect(() => {
        const videoEl = videoPreviewRef.current;
        if (videoEl && previewStream && videoEl.srcObject !== previewStream) {
            videoEl.srcObject = previewStream;
            videoEl.play().catch(() => {});
        }
    }, [previewStream]);

    // Handlers
    const buildLaunchConfig = useCallback((): LaunchConfig => ({
        cameraDeviceId: selectedCamera === CAMERA_SELECT_LATER ? undefined : selectedCamera,
        modelId: selectedModel,
        targetHost: targetHost.trim() || '127.0.0.1',
        previewMode: selectedPreviewMode,
        characterId: selectedCharacter,
        projectId: selectedProjectId ?? undefined,
        projectType: selectedProjectId ? 'recent' : 'new',
    }), [selectedCamera, selectedModel, targetHost, selectedPreviewMode, selectedCharacter, selectedProjectId]);

    const handleStartSession = useCallback(() => {
        setIsLoading(true);
        // Brief delay for visual feedback
        setTimeout(() => {
            onComplete(buildLaunchConfig());
        }, 300);
    }, [buildLaunchConfig, onComplete]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && phase === 'boot') {
                setPhase('select');
            }
            if (e.key === 'Enter' && phase === 'select' && !isLoading) {
                handleStartSession();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [phase, isLoading, handleStartSession]);

    // ========================================================================
    // RENDER: BOOT PHASE
    // ========================================================================
    if (phase === 'boot') {
        return (
            <div className="fixed inset-0 bg-black text-white font-mono overflow-hidden">
                {/* Background effects */}
                <div className="absolute inset-0 opacity-30" style={{
                    backgroundImage: 'radial-gradient(circle at 30% 30%, rgba(0,255,204,0.15), transparent 50%), radial-gradient(circle at 70% 70%, rgba(139,92,246,0.1), transparent 50%)',
                }} />
                
                {/* Scanlines effect */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
                    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)',
                }} />

                {/* Header */}
                <div className="absolute top-6 left-6 flex items-center gap-3">
                    <div className="relative">
                        <div className="absolute inset-0 bg-[#00ffcc]/30 blur-xl animate-pulse" />
                        <Hexagon className="relative text-[#00ffcc] fill-[#00ffcc]/10" size={28} />
                    </div>
                    <div>
                        <div className="text-sm font-black tracking-[0.4em] text-white">K_OS</div>
                        <div className="text-[9px] text-gray-500 tracking-widest">SECURE BOOT v9.0</div>
                    </div>
                </div>

                {/* Skip button */}
                <button
                    onClick={() => setPhase('select')}
                    className="absolute top-6 right-6 flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-[11px] font-bold tracking-wide text-gray-300 transition-all"
                >
                    SKIP <ChevronRight size={14} />
                </button>

                {/* Main content */}
                <div className="absolute inset-0 flex items-center justify-center p-8">
                    <div className="w-full max-w-3xl">
                        {/* Boot panel */}
                        <div className="rounded-2xl border border-white/10 bg-[#0a0a0a]/80 backdrop-blur-xl shadow-2xl overflow-hidden">
                            {/* Header */}
                            <div className="p-6 border-b border-white/10">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Terminal className="text-[#00ffcc]" size={20} />
                                        <div>
                                            <div className="text-xs font-black tracking-[0.2em] text-white">SYSTEM INITIALIZATION</div>
                                            <div className="text-[10px] text-gray-500 mt-1">Running pre-flight diagnostics...</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${bootComplete ? 'bg-[#00ffcc]' : 'bg-yellow-500 animate-pulse'}`} />
                                        <span className="text-[10px] text-gray-400 font-bold tracking-wider">
                                            {bootComplete ? 'READY' : 'INITIALIZING'}
                                        </span>
                                    </div>
                                </div>
                                
                                {/* Progress bar */}
                                <div className="mt-4 h-1.5 rounded-full bg-white/5 overflow-hidden">
                                    <div 
                                        className="h-full bg-gradient-to-r from-[#00ffcc] via-teal-400 to-violet-500 transition-all duration-300"
                                        style={{ width: `${bootProgress}%` }}
                                    />
                                </div>
                                <div className="mt-2 flex justify-between text-[10px] text-gray-500">
                                    <span>{Math.round(bootProgress)}%</span>
                                    <span className="font-mono">ESC = SKIP</span>
                                </div>
                            </div>

                            {/* Diagnostics grid */}
                            <div className="p-6">
                                <div className="grid grid-cols-2 gap-3">
                                    {diagnostics.map((diag, idx) => (
                                        <div
                                            key={diag.id}
                                            className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                                diag.status === 'running' 
                                                    ? 'bg-white/5 border-white/20' 
                                                    : 'bg-black/30 border-white/5'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <span className={`text-[10px] font-black ${diag.color}`}>
                                                    {String(idx + 1).padStart(2, '0')}
                                                </span>
                                                <div className="min-w-0">
                                                    <div className={`text-[11px] font-bold tracking-wide ${
                                                        diag.status !== 'pending' ? 'text-white' : 'text-gray-500'
                                                    }`}>
                                                        {diag.label}
                                                    </div>
                                                    {diag.detail && (
                                                        <div className="text-[9px] text-gray-500 truncate">{diag.detail}</div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="shrink-0 ml-2">
                                                {diag.status === 'running' && (
                                                    <Loader2 size={14} className="text-white/50 animate-spin" />
                                                )}
                                                {diag.status === 'ok' && (
                                                    <CheckCircle2 size={14} className="text-[#00ffcc]" />
                                                )}
                                                {diag.status === 'warning' && (
                                                    <AlertTriangle size={14} className="text-yellow-500" />
                                                )}
                                                {diag.status === 'error' && (
                                                    <AlertTriangle size={14} className="text-red-500" />
                                                )}
                                                {diag.status === 'pending' && (
                                                    <div className="w-3.5 h-3.5" />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* System info footer */}
                                {webglInfo && (
                                    <div className="mt-4 p-3 rounded-xl bg-black/30 border border-white/5">
                                        <div className="flex items-center justify-between">
                                            <div className="text-[9px] text-gray-500">
                                                <span className="text-gray-400">GPU:</span> {webglInfo.renderer.slice(0, 40)}
                                            </div>
                                            <div className="text-[9px] text-gray-500">
                                                {window.innerWidth}×{window.innerHeight}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ========================================================================
    // RENDER: PROJECT SELECT PHASE
    // ========================================================================
    return (
        <div className="fixed inset-0 bg-black text-white font-mono overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 opacity-40" style={{
                backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(0,255,204,0.1), transparent 40%), radial-gradient(circle at 80% 20%, rgba(139,92,246,0.08), transparent 40%)',
            }} />

            {/* Header */}
            <div className="absolute top-6 left-6 flex items-center gap-3">
                <Hexagon className="text-[#00ffcc] fill-[#00ffcc]/10" size={28} />
                <div>
                    <div className="text-sm font-black tracking-[0.4em] text-white">ZENMOCAP</div>
                    <div className="text-[9px] text-gray-500 tracking-widest">SESSION LAUNCHER</div>
                </div>
            </div>

            {/* Settings button */}
            <button
                onClick={onOpenSettings}
                className="absolute top-6 right-6 flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-[11px] font-bold tracking-wide text-gray-300 transition-all"
            >
                <Settings size={14} /> SETTINGS
            </button>

            {/* Main content - Fixed size container */}
            <div className="absolute inset-0 flex items-center justify-center p-8">
                <div className="w-full max-w-6xl h-[700px]">
                    <div className="h-full rounded-2xl border border-white/10 bg-[#0a0a0a]/90 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col">
                        {/* Main grid - Fixed height */}
                        <div className="flex-1 grid grid-cols-12 overflow-hidden">
                            {/* Left: Webcam Preview (60%) */}
                            <div className="col-span-7 p-8 border-r border-white/10 flex flex-col">
                                <div className="text-[10px] font-black tracking-[0.3em] text-gray-400 mb-4">
                                    CAMERA INPUT
                                </div>

                                {/* Camera Selection */}
                                <div className="mb-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-[9px] text-gray-500 uppercase tracking-wider">Select Camera</label>
                                        <button
                                            onClick={() => void scanCameras()}
                                            className="p-1 rounded hover:bg-white/5 transition-colors"
                                            title="Rescan cameras"
                                        >
                                            <RefreshCw
                                                size={12}
                                                className={`text-gray-500 ${isScanningCameras ? 'animate-spin' : ''}`}
                                            />
                                        </button>
                                    </div>
                                    <select
                                        value={selectedCamera}
                                        onChange={(e) => setSelectedCamera(e.target.value)}
                                        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-[12px] text-gray-200 focus:outline-none focus:border-cyan-500/60"
                                    >
                                        <option value={CAMERA_SELECT_LATER}>Select Later (launch offline)</option>
                                        {cameraOptions.map((camera) => (
                                            <option key={getCameraId(camera)} value={getCameraId(camera)}>
                                                {getCameraName(camera)}
                                            </option>
                                        ))}
                                    </select>
                                    {!isScanningCameras && cameraOptions.length === 0 && (
                                        <div className="text-[9px] text-yellow-500 mt-2">
                                            No cameras detected. You can select one later inside ZenMocap.
                                        </div>
                                    )}
                                    {cameraScanError && (
                                        <div className="text-[9px] text-red-400 mt-2">
                                            Camera scan error: {cameraScanError}
                                        </div>
                                    )}
                                </div>

                                {/* Large Webcam Preview */}
                                <div className="flex-1 rounded-xl border border-white/10 bg-black/60 overflow-hidden flex flex-col">
                                    <div className="flex items-center gap-2 px-3 py-2 border-b border-white/8 bg-black/30">
                                        <div className={`w-2 h-2 rounded-full ${
                                            selectedCamera === CAMERA_SELECT_LATER 
                                                ? 'bg-gray-600' 
                                                : previewError 
                                                    ? 'bg-red-500' 
                                                    : previewStream 
                                                        ? 'bg-[#00ffcc] animate-pulse' 
                                                        : 'bg-yellow-500 animate-pulse'
                                        }`} />
                                        <Video size={12} className="text-gray-400" />
                                        <span className="text-[10px] font-black tracking-widest text-gray-300">
                                            {selectedCamera === CAMERA_SELECT_LATER ? 'NO CAMERA' : 'LIVE PREVIEW'}
                                        </span>
                                    </div>
                                    <div className="flex-1 relative bg-black">
                                        {selectedCamera === CAMERA_SELECT_LATER ? (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                                                <VideoOff size={48} className="text-gray-700" />
                                                <span className="text-[11px] font-bold text-gray-600 text-center px-4">
                                                    Select a camera to see preview
                                                </span>
                                            </div>
                                        ) : previewError ? (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                                                <VideoOff size={48} className="text-red-500/50" />
                                                <span className="text-[11px] font-bold text-red-400/70 text-center px-4">
                                                    {previewError}
                                                </span>
                                            </div>
                                        ) : previewStream ? (
                                            <video
                                                ref={videoPreviewRef}
                                                muted
                                                playsInline
                                                autoPlay
                                                className="absolute inset-0 w-full h-full object-contain"
                                            />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-black/60 border border-white/10">
                                                    <Loader2 size={16} className="animate-spin text-yellow-400" />
                                                    <span className="text-[11px] font-bold text-yellow-400/80 tracking-widest">CONNECTING...</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Start Session Button */}
                                <button
                                    onClick={handleStartSession}
                                    disabled={isLoading}
                                    className="mt-4 w-full group relative p-4 rounded-xl border-2 border-[#00ffcc]/30 hover:border-[#00ffcc]/60 bg-gradient-to-br from-[#00ffcc]/10 to-transparent hover:from-[#00ffcc]/20 transition-all"
                                >
                                    <div className="flex items-center justify-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-[#00ffcc]/20 group-hover:bg-[#00ffcc]/30 flex items-center justify-center transition-all">
                                            <Zap className="text-[#00ffcc]" size={20} />
                                        </div>
                                        <div className="text-lg font-black text-white group-hover:text-[#00ffcc] transition-colors">
                                            START SESSION
                                        </div>
                                        <ArrowRight className="text-gray-600 group-hover:text-[#00ffcc] group-hover:translate-x-1 transition-all" size={20} />
                                    </div>
                                    {isLoading && (
                                        <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                                            <Loader2 className="animate-spin text-[#00ffcc]" size={24} />
                                        </div>
                                    )}
                                </button>
                            </div>

                            {/* Right: Configuration & Status (40%) */}
                            <div className="col-span-5 p-8 bg-black/30 overflow-y-auto">
                                {/* Mocap Configuration */}
                                <div className="mb-6">
                                    <div className="text-[10px] font-black tracking-[0.3em] text-gray-400 mb-4">
                                        CAPTURE SETUP
                                    </div>

                                    <div className="space-y-3">
                                        <label className="block">
                                            <div className="text-[9px] text-gray-500 mb-1 uppercase tracking-wider">Model</div>
                                            <select
                                                value={selectedModel}
                                                onChange={(e) => setSelectedModel(e.target.value as keyof typeof POSE_MODELS)}
                                                className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-[11px] text-gray-200 focus:outline-none focus:border-cyan-500/60"
                                            >
                                                {Object.entries(POSE_MODELS).map(([id, def]) => (
                                                    <option key={id} value={id}>
                                                        {def.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>

                                        <label className="block">
                                            <div className="text-[9px] text-gray-500 mb-1 uppercase tracking-wider">Character</div>
                                            <select
                                                value={selectedCharacter}
                                                onChange={(e) => setSelectedCharacter(e.target.value as CharacterId)}
                                                className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-[11px] text-gray-200 focus:outline-none focus:border-cyan-500/60"
                                            >
                                                {CHARACTER_OPTIONS.map((character) => (
                                                    <option key={character.id} value={character.id}>
                                                        {character.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>

                                        <label className="block">
                                            <div className="text-[9px] text-gray-500 mb-1 uppercase tracking-wider">Preview</div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    onClick={() => setSelectedPreviewMode('skeleton')}
                                                    className={`px-2 py-2 rounded-lg border text-[10px] font-bold transition-all ${
                                                        selectedPreviewMode === 'skeleton'
                                                            ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300'
                                                            : 'border-white/10 bg-black/30 text-gray-400'
                                                    }`}
                                                >
                                                    Skeleton
                                                </button>
                                                <button
                                                    onClick={() => setSelectedPreviewMode('video')}
                                                    className={`px-2 py-2 rounded-lg border text-[10px] font-bold transition-all ${
                                                        selectedPreviewMode === 'video'
                                                            ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300'
                                                            : 'border-white/10 bg-black/30 text-gray-400'
                                                    }`}
                                                >
                                                    Video
                                                </button>
                                            </div>
                                        </label>

                                        <label className="block">
                                            <div className="text-[9px] text-gray-500 mb-1 uppercase tracking-wider">Target Host</div>
                                            <input
                                                value={targetHost}
                                                onChange={(e) => setTargetHost(e.target.value)}
                                                placeholder="127.0.0.1"
                                                className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-[11px] text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/60"
                                            />
                                        </label>
                                    </div>
                                </div>

                                {/* Recent Projects */}
                                {recentProjects.length > 0 && (
                                    <div className="mb-6 pt-6 border-t border-white/10">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="text-[10px] font-black tracking-[0.3em] text-gray-400">
                                                RECENT
                                            </div>
                                            <Clock size={12} className="text-gray-600" />
                                        </div>

                                        <div className="space-y-2">
                                            <button
                                                onClick={() => setSelectedProjectId(null)}
                                                className={`w-full p-3 rounded-lg border text-left transition-all ${
                                                    selectedProjectId === null
                                                        ? 'border-cyan-500/50 bg-cyan-500/10'
                                                        : 'border-white/5 bg-black/30 hover:border-white/15'
                                                }`}
                                            >
                                                <div className="text-[11px] font-bold text-gray-200 truncate">
                                                    Global Defaults
                                                </div>
                                                <div className="text-[9px] text-gray-500">
                                                    Tracking presets shared across projects
                                                </div>
                                            </button>
                                            {recentProjects.slice(0, 3).map(project => (
                                                <button
                                                    key={project.id}
                                                    onClick={() => setSelectedProjectId(project.id)}
                                                    className={`w-full p-3 rounded-lg border text-left transition-all ${
                                                        selectedProjectId === project.id
                                                            ? 'border-cyan-500/50 bg-cyan-500/10'
                                                            : 'border-white/5 bg-black/30 hover:border-white/15'
                                                    }`}
                                                >
                                                    <div className="text-[11px] font-bold text-gray-200 truncate">
                                                        {project.name}
                                                    </div>
                                                    <div className="text-[9px] text-gray-500">
                                                        {formatDate(project.lastOpened)}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* System Status */}
                                <div className="pt-6 border-t border-white/10">
                                    <div className="text-[10px] font-black tracking-[0.3em] text-gray-400 mb-3">
                                        SYSTEM STATUS
                                    </div>
                                    
                                    <div className="space-y-2">
                                        {/* Kernel */}
                                        <div className="flex items-center justify-between p-2 rounded-lg bg-black/30">
                                            <div className="flex items-center gap-2">
                                                <Database size={12} className="text-cyan-400" />
                                                <span className="text-[10px] text-gray-400">Kernel</span>
                                            </div>
                                            <span className="text-[10px] text-cyan-400 font-bold">{kernelStatus}</span>
                                        </div>

                                        {/* Storage */}
                                        <div className="flex items-center justify-between p-2 rounded-lg bg-black/30">
                                            <div className="flex items-center gap-2">
                                                <HardDrive size={12} className="text-emerald-400" />
                                                <span className="text-[10px] text-gray-400">Storage</span>
                                            </div>
                                            <span className="text-[10px] text-emerald-400 font-bold">
                                                {kernelArtifactCount + kernelMaterialCount + kernelAlphaCount} objects
                                            </span>
                                        </div>

                                        {/* API */}
                                        <div className="flex items-center justify-between p-2 rounded-lg bg-black/30">
                                            <div className="flex items-center gap-2">
                                                {hasApiKey ? (
                                                    <Wifi size={12} className="text-violet-400" />
                                                ) : (
                                                    <WifiOff size={12} className="text-gray-500" />
                                                )}
                                                <span className="text-[10px] text-gray-400">API</span>
                                            </div>
                                            <span className={`text-[10px] font-bold ${hasApiKey ? 'text-violet-400' : 'text-gray-500'}`}>
                                                {hasApiKey ? 'Connected' : 'Offline'}
                                            </span>
                                        </div>

                                        {/* GPU */}
                                        {webglInfo && (
                                            <div className="flex items-center justify-between p-2 rounded-lg bg-black/30">
                                                <div className="flex items-center gap-2">
                                                    <Zap size={12} className="text-yellow-400" />
                                                    <span className="text-[10px] text-gray-400">GPU</span>
                                                </div>
                                                <span className="text-[10px] text-yellow-400 font-bold truncate max-w-[120px]">
                                                    {webglInfo.ok ? 'Ready' : 'Limited'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-8 py-4 border-t border-white/10 bg-black/30 flex items-center justify-between">
                            <div className="text-[9px] text-gray-600 font-mono">
                                ZenMocap v1.0 // Real-Time AI Mocap
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-[9px] text-gray-500">
                                    Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-gray-400">ENTER</kbd> to start
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
