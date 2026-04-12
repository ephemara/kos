/**
 * K_OS Kernel Launcher — PROJECT BRIDGE
 *
 * Post-boot project selection. Clean, premium, zero filler.
 * One mode. Native. Always.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
    FilePlus, FolderOpen, Clock, Trash2, Hexagon,
    ArrowRight, Settings, Minus, Square, X, ChevronRight,
    LayoutGrid, Video, Layers3, Monitor
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface LaunchConfig {
    projectType: 'new' | 'load' | 'recent';
    projectFile?: File;
    recentProjectPath?: string;
    viewportMode: 'simple' | 'universal' | 'mocap' | 'legacy' | 'zen';
}

export interface KernelLauncherProps {
    onComplete: (config: LaunchConfig) => void;
    onOpenSettings: () => void;
    hasApiKey: boolean;
    kernelStatus: string;
    kernelArtifactCount: number;
    kernelMaterialCount: number;
    kernelAlphaCount: number;
}

interface RecentProject {
    id: string;
    name: string;
    path: string;
    lastOpened: Date;
    artifactCount: number;
}

// ─── Utilities ─────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

function relativeDate(d: Date): string {
    const diff = Date.now() - d.getTime();
    const min = Math.floor(diff / 60000);
    const hr = Math.floor(diff / 3600000);
    const day = Math.floor(diff / 86400000);
    if (min < 60) return `${min}m ago`;
    if (hr < 24) return `${hr}h ago`;
    if (day < 7) return `${day}d ago`;
    return d.toLocaleDateString();
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function KernelLauncher({
    onComplete,
    onOpenSettings,
    kernelArtifactCount,
    kernelMaterialCount,
    kernelAlphaCount,
}: KernelLauncherProps) {

    const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
    const [loading, setLoading] = useState(false);
    const [entered, setEntered] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Entrance animation
    useEffect(() => {
        const id = setTimeout(() => setEntered(true), 60);
        return () => clearTimeout(id);
    }, []);

    // Load recents
    useEffect(() => {
        try {
            const raw = localStorage.getItem('k_os_recent_projects');
            if (raw) {
                const arr = JSON.parse(raw).map((p: any) => ({ ...p, lastOpened: new Date(p.lastOpened) }));
                setRecentProjects(arr.slice(0, 6));
            }
        } catch { /* no-op */ }
    }, []);

    // ── Window controls ──────────────────────────────────────────────────
    const wmin = () => getCurrentWindow().minimize().catch(() => { });
    const wmax = async () => {
        const w = getCurrentWindow();
        (await w.isMaximized()) ? w.unmaximize() : w.maximize();
    };
    const wclose = () => getCurrentWindow().close().catch(() => { });
    const wdrag = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button,[data-no-drag]')) return;
        getCurrentWindow().startDragging().catch(() => { });
    };

    // ── Launch handlers ──────────────────────────────────────────────────
    const launch = useCallback((cfg: LaunchConfig) => {
        setLoading(true);
        setTimeout(() => onComplete(cfg), 200);
    }, [onComplete]);

    const handleNew = () => launch({ projectType: 'new', viewportMode: 'simple' });
    const handleUniversal = () => launch({ projectType: 'new', viewportMode: 'universal' });
    const handleMocap = () => launch({ projectType: 'new', viewportMode: 'mocap' });
    const handleZen = () => launch({ projectType: 'new', viewportMode: 'zen' });
    const handleLegacy = () => launch({ projectType: 'new', viewportMode: 'legacy' });

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) launch({ projectType: 'load', projectFile: file, viewportMode: 'simple' });
    };

    const handleRecent = (p: RecentProject) =>
        launch({ projectType: 'recent', recentProjectPath: p.path, viewportMode: 'simple' });

    const removeRecent = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const next = recentProjects.filter(p => p.id !== id);
        setRecentProjects(next);
        localStorage.setItem('k_os_recent_projects', JSON.stringify(next));
    };

    // ── Keyboard shortcut ────────────────────────────────────────────────
    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if (e.key === 'Enter' && !loading) handleNew();
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [loading]);

    const totalObjects = kernelArtifactCount + kernelMaterialCount + kernelAlphaCount;

    return (
        <div
            className="fixed inset-0 overflow-hidden font-mono select-none"
            style={{ background: '#000' }}
        >
            {/* ── Background ──────────────────────────────────────────── */}
            <LauncherBackground />

            {/* ── Window chrome ───────────────────────────────────────── */}
            <div
                className="absolute top-0 inset-x-0 h-10 z-50 flex items-center"
                onMouseDown={wdrag}
            >
                {/* Logo on far left */}
                <div className="flex items-center gap-2 pl-5 shrink-0">
                    <Hexagon size={16} className="text-[#00ffcc]/60" fill="rgba(0,255,204,0.06)" />
                    <span className="text-[11px] font-black tracking-[0.3em] text-white/50">K_OS</span>
                </div>
                <div className="flex-1" />
                {/* Settings to the left of window controls */}
                <button
                    onClick={onOpenSettings}
                    className="flex items-center gap-1.5 px-3 py-1 mr-2 rounded-lg border border-white/8 bg-white/[0.03] hover:bg-white/[0.07] text-[10px] font-bold tracking-wide text-white/30 hover:text-white/60 transition-all"
                    data-no-drag
                >
                    <Settings size={11} /> SETTINGS
                </button>
                <div className="flex items-center gap-0.5 pr-2" data-no-drag>
                    {[
                        { icon: Minus, fn: wmin, hov: 'hover:bg-white/8 hover:text-white/70', sz: 12 },
                        { icon: Square, fn: wmax, hov: 'hover:bg-white/8 hover:text-white/70', sz: 9 },
                        { icon: X, fn: wclose, hov: 'hover:bg-red-500/20 hover:text-red-400', sz: 12 },
                    ].map(({ icon: Icon, fn, hov, sz }, i) => (
                        <button
                            key={i} onClick={fn}
                            className={`w-7 h-7 flex items-center justify-center rounded-lg text-white/20 transition-all duration-150 ${hov}`}
                        >
                            <Icon size={sz} />
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Main layout ─────────────────────────────────────────── */}
            <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ paddingTop: '2.5rem' }}
            >
                <div
                    className="w-full max-w-[860px] px-6"
                    style={{
                        opacity: entered ? 1 : 0,
                        transform: entered ? 'translateY(0)' : 'translateY(16px)',
                        transition: 'opacity 0.5s cubic-bezier(0.16,1,0.3,1), transform 0.5s cubic-bezier(0.16,1,0.3,1)',
                    }}
                >
                    {/* ── Headline ────────────────────────────────────── */}
                    <div className="text-center mb-10">
                        <div
                            className="text-[52px] font-black tracking-[-0.04em] leading-none text-white"
                        >
                            K_OS
                        </div>
                        <div className="mt-2 text-[10px] tracking-[0.5em] text-white/20 uppercase">
                            Select workspace
                        </div>
                    </div>

                    {/* ── Action cards ────────────────────────────────────── */}
                    {/* Primary row */}
                    <div className="grid grid-cols-2 gap-4 mb-3">
                        <ActionCard
                            icon={FilePlus}
                            accent="#00ffcc"
                            title="K_OS WORKSPACE"
                            sub="Launch the current modular workspace shell"
                            badge="↵ ENTER"
                            onClick={handleNew}
                            loading={loading}
                        />
                        <ActionCard
                            icon={FolderOpen}
                            accent="#a855f7"
                            title="MOUNT ARCHIVE"
                            sub="Load a .KIPP project file"
                            onClick={() => fileInputRef.current?.click()}
                            loading={loading}
                        />
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".kipp,.kos"
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                    </div>
                    {/* Secondary row — special modes */}
                    <div className="grid grid-cols-4 gap-4 mb-6">
                        <ActionCard
                            icon={Monitor}
                            accent="#22d3ee"
                            title="ZEN"
                            sub="Launch the native Rust viewport MVP"
                            size="sm"
                            onClick={handleZen}
                            loading={loading}
                        />
                        <ActionCard
                            icon={LayoutGrid}
                            accent="#f59e0b"
                            title="UNIVERSAL WORKSPACE"
                            sub="Multi-module layout — all tools open"
                            size="sm"
                            onClick={handleUniversal}
                            loading={loading}
                        />
                        <ActionCard
                            icon={Video}
                            accent="#ec4899"
                            title="ZEN MOCAP"
                            sub="Open dedicated motion capture workspace"
                            size="sm"
                            onClick={handleMocap}
                            loading={loading}
                        />
                        <ActionCard
                            icon={Layers3}
                            accent="#fb923c"
                            title="K_OS LEGACY"
                            sub="Launch the archived oldkos workspace"
                            size="sm"
                            onClick={handleLegacy}
                            loading={loading}
                        />
                    </div>

                    {/* ── Recent projects ─────────────────────────────── */}
                    {recentProjects.length > 0 && (
                        <div
                            className="rounded-2xl overflow-hidden"
                            style={{
                                border: '1px solid rgba(255,255,255,0.06)',
                                background: 'rgba(255,255,255,0.02)',
                            }}
                        >
                            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04]">
                                <div className="flex items-center gap-2">
                                    <Clock size={11} className="text-white/20" />
                                    <span className="text-[9px] font-black tracking-[0.3em] text-white/25">RECENT</span>
                                </div>
                                <span className="text-[9px] text-white/15 font-mono">{recentProjects.length} sessions</span>
                            </div>
                            <div className="divide-y divide-white/[0.03]">
                                {recentProjects.map(p => (
                                    <RecentRow
                                        key={p.id}
                                        project={p}
                                        onOpen={() => handleRecent(p)}
                                        onRemove={e => removeRecent(p.id, e)}
                                        loading={loading}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Footer ──────────────────────────────────────── */}
                    <div className="mt-5 flex items-center justify-between">
                        <span className="text-[9px] text-white/12 font-mono tracking-widest">
                            K_OS v9.0.2 // KIPP ENGINE
                        </span>
                        {totalObjects > 0 && (
                            <span className="text-[9px] text-white/15 font-mono">
                                {totalObjects} objects in kernel
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Loading overlay ─────────────────────────────────────── */}
            {loading && (
                <div
                    className="fixed inset-0 z-[200]"
                    style={{
                        background: '#000',
                        animation: 'kos-fade-in-fast 0.2s ease both',
                    }}
                >
                    <style>{`
                        @keyframes kos-fade-in-fast {
                            from { opacity: 0; } to { opacity: 1; }
                        }
                    `}</style>
                </div>
            )}
        </div>
    );
}

// ─── Action card ───────────────────────────────────────────────────────────

function ActionCard({
    icon: Icon, accent, title, sub, badge, onClick, loading, size = 'md'
}: {
    icon: any;
    accent: string;
    title: string;
    sub: string;
    badge?: string;
    size?: 'md' | 'sm';
    onClick: () => void;
    loading: boolean;
}) {
    const [hovered, setHovered] = useState(false);

    return (
        <button
            onClick={onClick}
            disabled={loading}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className={`relative text-left rounded-2xl ${size === 'sm' ? 'p-5' : 'p-6'} overflow-hidden transition-all duration-200 group`}
            style={{
                border: `1px solid ${hovered ? `${accent}30` : 'rgba(255,255,255,0.07)'}`,
                background: hovered
                    ? `linear-gradient(135deg, ${accent}0a 0%, rgba(255,255,255,0.03) 100%)`
                    : 'rgba(255,255,255,0.025)',
                boxShadow: hovered ? `0 0 30px ${accent}12` : 'none',
                transform: hovered ? 'translateY(-1px)' : 'none',
            }}
        >
            {/* Icon */}
            <div
                className={`${size === 'sm' ? 'w-9 h-9 mb-3' : 'w-11 h-11 mb-4'} rounded-xl flex items-center justify-center transition-all duration-200`}
                style={{
                    background: hovered ? `${accent}18` : `${accent}0c`,
                    border: `1px solid ${hovered ? `${accent}35` : `${accent}18`}`,
                }}
            >
                <Icon size={size === 'sm' ? 18 : 22} style={{ color: hovered ? accent : `${accent}90` }} />
            </div>

            {/* Text */}
            <div className={`${size === 'sm' ? 'text-[11px]' : 'text-[13px]'} font-black tracking-wide text-white/80 group-hover:text-white transition-colors duration-200`}>
                {title}
            </div>
            <div className="mt-0.5 text-[10px] text-white/25 font-sans">
                {sub}
            </div>

            {/* Badge */}
            {badge && (
                <div
                    className="absolute top-4 right-4 text-[8px] font-mono px-2 py-0.5 rounded"
                    style={{
                        background: `${accent}12`,
                        border: `1px solid ${accent}25`,
                        color: `${accent}80`,
                    }}
                >
                    {badge}
                </div>
            )}

            {/* Arrow */}
            <ArrowRight
                size={14}
                className="absolute bottom-5 right-5 transition-all duration-200"
                style={{
                    color: hovered ? accent : 'rgba(255,255,255,0.1)',
                    transform: hovered ? 'translateX(2px)' : 'none',
                }}
            />
        </button>
    );
}

// ─── Recent row ────────────────────────────────────────────────────────────

function RecentRow({ project, onOpen, onRemove, loading }: {
    project: RecentProject;
    onOpen: () => void;
    onRemove: (e: React.MouseEvent) => void;
    loading: boolean;
}) {
    const [hovered, setHovered] = useState(false);

    return (
        <button
            onClick={onOpen}
            disabled={loading}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="w-full flex items-center justify-between px-5 py-3 group transition-all duration-150 text-left"
            style={{
                background: hovered ? 'rgba(255,255,255,0.03)' : 'transparent',
            }}
        >
            <div className="flex items-center gap-3 min-w-0">
                <div
                    className="w-1 h-6 rounded-full flex-shrink-0 transition-all duration-150"
                    style={{ background: hovered ? 'rgba(0,255,204,0.5)' : 'rgba(255,255,255,0.08)' }}
                />
                <div className="min-w-0">
                    <div className="text-[11px] font-bold text-white/60 group-hover:text-white/85 truncate transition-colors duration-150">
                        {project.name}
                    </div>
                    <div className="text-[9px] text-white/20 mt-0.5 truncate font-sans">
                        {project.path}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-3 shrink-0 ml-4">
                <span className="text-[9px] text-white/20 font-mono whitespace-nowrap">
                    {relativeDate(project.lastOpened)}
                </span>
                <button
                    onClick={onRemove}
                    className="w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 text-white/20 transition-all duration-150"
                >
                    <Trash2 size={11} />
                </button>
            </div>
        </button>
    );
}

// ─── Background ────────────────────────────────────────────────────────────

function LauncherBackground() {
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Deep radial centre glow */}
            <div
                className="absolute inset-0"
                style={{
                    background: 'radial-gradient(ellipse 55% 45% at 50% 50%, rgba(0,255,204,0.04) 0%, transparent 70%)',
                }}
            />
            {/* Corner accents */}
            <div
                className="absolute top-0 left-0 w-64 h-64"
                style={{
                    background: 'radial-gradient(circle at 0% 0%, rgba(0,255,204,0.05) 0%, transparent 70%)',
                }}
            />
            <div
                className="absolute bottom-0 right-0 w-64 h-64"
                style={{
                    background: 'radial-gradient(circle at 100% 100%, rgba(168,85,247,0.05) 0%, transparent 70%)',
                }}
            />
            {/* Top rule */}
            <div
                className="absolute inset-x-0 top-0 h-px"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(0,255,204,0.2), transparent)' }}
            />
            {/* Bottom rule */}
            <div
                className="absolute inset-x-0 bottom-0 h-px"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.12), transparent)' }}
            />
        </div>
    );
}
