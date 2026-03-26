/**
 * AppTopBarDirect - Direct Access Layout
 * 
 * A sleek, modern top bar that displays ALL apps directly visible
 * without requiring dropdown navigation. Apps are shown as compact
 * icons with smooth hover/active states and micro-animations.
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
    Hexagon, HardDrive, Minus, Square, X,
    Search, Camera, ChevronDown, Video
} from 'lucide-react';
import { TopBarTheme } from '@mocap/shared/theme/topBarThemes';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
} from '@mocap/shared/primitives/DropdownMenu';

interface AppTopBarDirectProps {
    theme: TopBarTheme;
    activeModuleId: string;
    onModuleSwitch: (id: string) => void;
    onSettingsOpen?: () => void;
    onKernelOpen?: () => void;
    onSearchOpen?: () => void;
    kernelCount?: number;
    kernelStatus?: string;
    onNewProject?: () => void;
    onLoadProject?: (file: File) => void;
    onSaveProject?: () => void;
    onSwitchProject?: () => void;
    onMinimize?: () => void;
    onMaximize?: () => void;
    onClose?: () => void;
    /** Camera preview panel toggle */
    onToggleCameraPreview?: () => void;
    cameraPreviewOpen?: boolean;
}

export function AppTopBarDirect({
    theme,
    activeModuleId,
    onModuleSwitch,
    onSettingsOpen,
    onKernelOpen,
    onSearchOpen,
    kernelCount = 0,
    kernelStatus = 'READY',
    onNewProject,
    onLoadProject,
    onSaveProject,
    onSwitchProject,
    onMinimize,
    onMaximize,
    onClose,
    onToggleCameraPreview,
    cameraPreviewOpen = false,
}: AppTopBarDirectProps) {
    const [hoveredModule, setHoveredModule] = useState<string | null>(null);
    const loadInputRef = React.useRef<HTMLInputElement | null>(null);

    const styles = theme.styles;
    const compactHeight = '42px';

    const handleMinimize = useCallback(async () => {
        if (onMinimize) onMinimize();
        else await getCurrentWindow().minimize();
    }, [onMinimize]);

    const handleMaximize = useCallback(async () => {
        if (onMaximize) onMaximize();
        else {
            const win = getCurrentWindow();
            if (await win.isMaximized()) await win.unmaximize();
            else await win.maximize();
        }
    }, [onMaximize]);

    const handleClose = useCallback(async () => {
        if (onClose) onClose();
        else await getCurrentWindow().close();
    }, [onClose]);

    const handleFilePicked = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && onLoadProject) onLoadProject(file);
        event.target.value = '';
    }, [onLoadProject]);

    const menuTriggerClass =
        'h-7 px-2 rounded-md text-[11px] font-bold tracking-wide text-white/70 hover:text-white hover:bg-white/5 transition-all flex items-center gap-1';
    const menuItemClass =
        'text-[11px] text-gray-200 focus:bg-white/10 focus:text-white';
    const handleToggleCameraPreview = useCallback(() => {
        console.log('[AppTopBarDirect] Camera Preview button clicked');
        console.log('[AppTopBarDirect] onToggleCameraPreview exists:', !!onToggleCameraPreview);
        console.log('[AppTopBarDirect] cameraPreviewOpen current state:', cameraPreviewOpen);
        if (onToggleCameraPreview) {
            onToggleCameraPreview();
            console.log('[AppTopBarDirect] onToggleCameraPreview() called');
        } else {
            console.warn('[AppTopBarDirect] onToggleCameraPreview is undefined!');
        }
    }, [onToggleCameraPreview, cameraPreviewOpen]);

    return (
        <header
            className="flex items-center relative z-[100] select-none shadow-2xl overflow-visible transition-all duration-500 ease-in-out"
            style={{
                height: compactHeight,
                background: styles.background,
                borderBottom: styles.borderBottom,
                backdropFilter: `blur(${styles.blur})`,
                WebkitBackdropFilter: `blur(${styles.blur})`
            }}
        >
            {/* Dedicated drag strip to avoid stealing menu/button input */}
            <div className="absolute top-0 left-0 right-0 h-1.5 z-[30]" data-tauri-drag-region />

            <input
                ref={loadInputRef}
                type="file"
                accept=".zip,.kproj,.json"
                onChange={handleFilePicked}
                className="hidden"
                data-no-drag
            />

            {/* AMBIENT GLOW */}
            <div
                className="absolute inset-x-0 bottom-0 h-[2px] pointer-events-none transition-all duration-700"
                style={{
                    background: `linear-gradient(90deg, transparent, ${styles.accentColor}, transparent)`,
                    opacity: styles.glowOpacity
                }}
            />

            {/* LEFT: BRANDING */}
            <div className="flex items-center gap-3 pl-3 relative z-10 shrink-0">
                <motion.div
                    className="flex items-center gap-2 cursor-pointer group"
                    onClick={onSettingsOpen}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    data-no-drag
                >
                    <div className="relative">
                        <Hexagon
                            size={16}
                            style={{ color: styles.logoColor, fill: `${styles.logoColor}1a` }}
                            className="relative z-10 drop-shadow-[0_0_8px_rgba(0,255,204,0.3)]"
                        />
                        <motion.div
                            className="absolute inset-0 blur-md rounded-full pointer-events-none"
                            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                            transition={{ duration: 3, repeat: Infinity }}
                            style={{ background: styles.logoColor }}
                        />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[13px] font-black tracking-tight leading-none" style={{ color: styles.textColor }}>ZenMocap</span>
                        <span className="text-[6px] font-mono tracking-[0.22em] opacity-40" style={{ color: styles.textColor }}>MOCAP ENGINE</span>
                    </div>
                </motion.div>

                {/* Separator */}
                <div className="w-px h-5 bg-white/10" />

                {/* Menubar */}
                <div className="flex items-center gap-0.5" data-no-drag>
                    <DropdownMenu>
                        <DropdownMenuTrigger className={menuTriggerClass}>
                            File <ChevronDown size={12} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-[#0d0d0d] border-white/10 min-w-[210px]" align="start">
                            <DropdownMenuItem className={menuItemClass} onSelect={() => onNewProject?.()}>
                                New Project
                                <DropdownMenuShortcut>Ctrl+N</DropdownMenuShortcut>
                            </DropdownMenuItem>
                            <DropdownMenuItem className={menuItemClass} onSelect={() => loadInputRef.current?.click()}>
                                Open Project...
                                <DropdownMenuShortcut>Ctrl+O</DropdownMenuShortcut>
                            </DropdownMenuItem>
                            <DropdownMenuItem className={menuItemClass} onSelect={() => onSaveProject?.()}>
                                Save Project
                                <DropdownMenuShortcut>Ctrl+S</DropdownMenuShortcut>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-white/10" />
                            <DropdownMenuItem className={menuItemClass} onSelect={() => onSwitchProject?.()}>
                                Switch Project
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuTrigger className={menuTriggerClass}>
                            Edit <ChevronDown size={12} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-[#0d0d0d] border-white/10 min-w-[210px]" align="start">
                            <DropdownMenuItem className={menuItemClass} disabled>
                                Undo
                                <DropdownMenuShortcut>Ctrl+Z</DropdownMenuShortcut>
                            </DropdownMenuItem>
                            <DropdownMenuItem className={menuItemClass} disabled>
                                Redo
                                <DropdownMenuShortcut>Ctrl+Y</DropdownMenuShortcut>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-white/10" />
                            <DropdownMenuItem className={menuItemClass} onSelect={() => onSearchOpen?.()}>
                                Command Palette
                                <DropdownMenuShortcut>Ctrl+K</DropdownMenuShortcut>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuTrigger className={menuTriggerClass}>
                            View <ChevronDown size={12} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-[#0d0d0d] border-white/10 min-w-[210px]" align="start">
                            <DropdownMenuItem className={menuItemClass} onSelect={() => onKernelOpen?.()}>
                                Open Storage Browser
                            </DropdownMenuItem>
                            <DropdownMenuItem className={menuItemClass} onSelect={() => handleMaximize()}>
                                Toggle Maximize
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-white/10" />
                            <DropdownMenuItem
                                className={`${menuItemClass} flex items-center gap-2`}
                                onSelect={() => {
                                    handleToggleCameraPreview();
                                }}
                            >
                                <Video size={12} className={cameraPreviewOpen ? 'text-cyan-400' : 'opacity-40'} />
                                Camera Preview
                                {cameraPreviewOpen && (
                                    <span className="ml-auto text-[8px] font-mono bg-cyan-400/15 text-cyan-400 px-1.5 py-0.5 rounded">
                                        ON
                                    </span>
                                )}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuTrigger className={menuTriggerClass}>
                            Settings <ChevronDown size={12} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-[#0d0d0d] border-white/10 min-w-[210px]" align="start">
                            <DropdownMenuItem className={menuItemClass} onSelect={() => onSettingsOpen?.()}>
                                Preferences
                                <DropdownMenuShortcut>Ctrl+,</DropdownMenuShortcut>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* CENTER: APP NAVIGATION */}
            <nav className="flex-1 flex items-center justify-center h-full px-2 relative z-10 overflow-hidden">
                <div className="flex items-center gap-0.5 p-0.5 bg-black/20 backdrop-blur-xl rounded-lg border border-white/5">

                    {/* ZenMocap Button */}
                    <motion.button
                        onClick={() => onModuleSwitch('zen-mocap')}
                        onMouseEnter={() => setHoveredModule('zen-mocap')}
                        onMouseLeave={() => setHoveredModule(null)}
                        className={`
                            relative flex items-center justify-center h-7 rounded-md transition-all duration-300 group
                            ${activeModuleId === 'zen-mocap'
                                ? 'bg-white/8 text-white px-2.5 gap-1.5'
                                : 'text-white/35 hover:text-white/80 hover:bg-white/5 px-2'
                            }
                        `}
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.95 }}
                        layout
                    >
                        {/* Active background pill */}
                        {activeModuleId === 'zen-mocap' && (
                            <motion.div
                                layoutId="direct-active-pill"
                                className="absolute inset-0 bg-gradient-to-b from-white/10 to-white/5 rounded-lg border border-white/10"
                                transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
                            />
                        )}

                        {/* Icon */}
                        <div className="relative z-10 flex items-center justify-center">
                            <Camera
                                size={13}
                                className={`transition-all duration-300 ${activeModuleId === 'zen-mocap' ? 'text-cyan-400' : 'group-hover:text-white'}`}
                            />
                            {activeModuleId === 'zen-mocap' && (
                                <motion.div
                                    className="absolute inset-0 blur-lg opacity-40 bg-cyan-400"
                                    layoutId="icon-glow-zen-mocap"
                                />
                            )}
                        </div>

                        {/* Label */}
                        <AnimatePresence mode="wait">
                            {(activeModuleId === 'zen-mocap' || hoveredModule === 'zen-mocap') && (
                                <motion.span
                                    initial={{ opacity: 0, width: 0 }}
                                    animate={{ opacity: 1, width: 'auto' }}
                                    exit={{ opacity: 0, width: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className={`relative z-10 text-[8px] font-black tracking-[0.15em] whitespace-nowrap overflow-hidden ${activeModuleId === 'zen-mocap' ? 'opacity-100' : 'opacity-70'}`}
                                >
                                    ZEN MOCAP
                                </motion.span>
                            )}
                        </AnimatePresence>

                        {/* Active indicator dot */}
                        {activeModuleId === 'zen-mocap' && (
                            <motion.div
                                className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-cyan-400"
                                layoutId="direct-active-dot"
                                transition={{ type: "spring", bounce: 0.4, duration: 0.5 }}
                            />
                        )}
                    </motion.button>

                </div>
            </nav>

            {/* RIGHT: SYSTEM & CONTROLS */}
            <div className="flex items-center gap-1.5 pr-2 relative z-10 shrink-0">
                {/* Quick Search Button */}
                <button
                    onClick={onSearchOpen}
                    className="p-1.5 rounded-md hover:bg-white/5 text-white/30 hover:text-white/70 transition-all group"
                    data-no-drag
                    title="Quick Search (Ctrl+K)"
                >
                    <Search size={14} />
                </button>

                {/* Kernel Status - Compact */}
                <motion.button
                    onClick={onKernelOpen}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md border transition-all group"
                    style={{
                        background: styles.buttonBg,
                        borderColor: styles.buttonBorder
                    }}
                    whileHover={{ scale: 1.02, borderColor: styles.accentColor }}
                    whileTap={{ scale: 0.98 }}
                    data-no-drag
                >
                    <div className="relative">
                        <HardDrive size={11} style={{ color: styles.accentColor }} />
                        <motion.div
                            className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full"
                            style={{ background: kernelStatus === 'READY' ? styles.accentColor : '#f59e0b' }}
                            animate={{ scale: [1, 1.3, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        />
                    </div>
                    <span className="text-[8px] font-mono" style={{ color: styles.accentColor }}>
                        {kernelCount}
                    </span>
                </motion.button>

                {/* Window Controls */}
                <div className="flex items-center gap-0.5 ml-1 pl-1.5 border-l border-white/5" data-no-drag>
                    <button
                        onClick={handleMinimize}
                        className="w-7 h-7 flex items-center justify-center hover:bg-white/5 rounded-md text-white/30 hover:text-white/70 transition-colors"
                    >
                        <Minus size={12} />
                    </button>
                    <button
                        onClick={handleMaximize}
                        className="w-7 h-7 flex items-center justify-center hover:bg-white/5 rounded-md text-white/30 hover:text-white/70 transition-colors"
                    >
                        <Square size={9} />
                    </button>
                    <button
                        onClick={handleClose}
                        className="w-7 h-7 flex items-center justify-center hover:bg-red-500/20 hover:text-red-500 rounded-md text-white/30 transition-all"
                    >
                        <X size={12} />
                    </button>
                </div>
            </div>

            {/* Shine effect */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent w-1/2 -skew-x-12 translate-x-[-150%]"
                    animate={{ translateX: ['150%', '-150%'] }}
                    transition={{ duration: 5, repeat: Infinity, repeatDelay: 12 }}
                />
            </div>
        </header>
    );
}

export default AppTopBarDirect;
