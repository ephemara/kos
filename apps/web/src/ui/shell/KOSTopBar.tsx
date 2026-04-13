import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
    Hexagon, HardDrive, Minus, Square, X,
    ChevronDown, Zap, Search, Settings, Filter
} from 'lucide-react';
import { topBarThemes, TopBarTheme } from '@/systems/ui/topBarThemes';

type ViewportMode = 'simple' | 'advanced';
type ActiveTool = 'viewport' | 'sculpt' | 'paint' | 'retopo';

interface KOSTopBarProps {
    viewportMode: ViewportMode;
    setViewportMode: (mode: ViewportMode) => void;
    activeTool?: ActiveTool;
    setActiveTool?: (tool: ActiveTool) => void;
    onSettingsOpen?: () => void;
    onKernelOpen?: () => void;
    kernelCount?: number;
    kernelStatus?: string;
    children?: React.ReactNode;
    onMinimize?: () => void;
    onMaximize?: () => void;
    onClose?: () => void;
    themeId?: string;
    mode?: 'workflow' | 'app';
}

export function KOSTopBar({
    viewportMode,
    setViewportMode,
    activeTool = 'viewport',
    setActiveTool,
    onSettingsOpen,
    onKernelOpen,
    kernelCount = 0,
    kernelStatus = 'READY',
    children,
    onMinimize,
    onMaximize,
    onClose,
    themeId = 'obsidian',
    mode = 'workflow'
}: KOSTopBarProps) {
    const [isDragging, setIsDragging] = useState(false);

    const theme = useMemo(() => {
        return topBarThemes.find(t => t.id === themeId) || topBarThemes[0];
    }, [themeId]);

    const styles = theme.styles;

    // Robust window drag handler
    const handleStartDrag = useCallback(async (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('a') || target.closest('[data-no-drag]')) {
            return;
        }

        setIsDragging(true);
        try {
            await getCurrentWindow().startDragging();
        } catch (err) {
            console.error('Failed to start window drag:', err);
        } finally {
            setIsDragging(false);
        }
    }, []);

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

    return (
        <header
            className="flex items-center relative z-[100] select-none shadow-2xl overflow-visible transition-all duration-500 ease-in-out"
            style={{
                height: styles.height,
                background: styles.background,
                borderBottom: styles.borderBottom,
                backdropFilter: `blur(${styles.blur})`,
                WebkitBackdropFilter: `blur(${styles.blur})`
            }}
            onMouseDown={handleStartDrag}
        >
            {/* AMBIENT GLOW */}
            <div
                className="absolute inset-x-0 bottom-0 h-[2px] pointer-events-none transition-all duration-700"
                style={{
                    background: `linear-gradient(90deg, transparent, ${styles.accentColor}, transparent)`,
                    opacity: styles.glowOpacity
                }}
            />

            {/* LEFT: BRANDING */}
            <div className="flex items-center gap-4 pl-6 relative z-10 shrink-0">
                <motion.div
                    className="flex items-center gap-3 cursor-pointer group"
                    onClick={onSettingsOpen}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                >
                    <div className="relative">
                        <Hexagon size={24} style={{ color: styles.logoColor, fill: `${styles.logoColor}1a` }} className="relative z-10 drop-shadow-[0_0_8px_rgba(0,255,204,0.3)]" />
                        <motion.div
                            className="absolute inset-0 blur-md rounded-full pointer-events-none"
                            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                            transition={{ duration: 3, repeat: Infinity }}
                            style={{ background: styles.logoColor }}
                        />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-lg font-black tracking-tighter leading-none" style={{ color: styles.textColor }}>K_OS</span>
                        <span className="text-[8px] font-mono tracking-widest opacity-40" style={{ color: styles.textColor }}>HYPERVISOR v10</span>
                    </div>
                </motion.div>
            </div>

            {/* CENTER: NAVIGATION */}
            <nav className="flex-1 flex items-center justify-center h-full px-4 overflow-hidden relative z-10">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={mode}
                        initial={{ opacity: 0, y: 10, filter: 'blur(10px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: -10, filter: 'blur(10px)' }}
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        className="flex items-center gap-2 max-w-full"
                    >
                        {children}
                    </motion.div>
                </AnimatePresence>
            </nav>

            {/* RIGHT: SYSTEM & CONTROLS */}
            <div className="flex items-center gap-3 pr-4 relative z-10 shrink-0">
                {/* SEARCH TRIGGER */}
                <button
                    className="p-2 rounded-full hover:bg-white/5 text-white/40 hover:text-white transition-all"
                    data-no-drag
                    title="Quick Search (Ctrl+K)"
                >
                    <Search size={18} />
                </button>

                {/* KERNEL STATUS */}
                <motion.button
                    onClick={onKernelOpen}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all group"
                    style={{
                        background: styles.buttonBg,
                        borderColor: styles.buttonBorder
                    }}
                    whileHover={{ scale: 1.02, borderColor: styles.accentColor }}
                    whileTap={{ scale: 0.98 }}
                    data-no-drag
                >
                    <div className="relative">
                        <HardDrive size={14} style={{ color: styles.accentColor }} />
                        <motion.div
                            className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
                            style={{ background: kernelStatus === 'READY' ? styles.accentColor : '#f59e0b' }}
                            animate={{ scale: [1, 1.3, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        />
                    </div>
                    <div className="flex flex-col items-start">
                        <span className="text-[9px] font-black tracking-widest opacity-40 uppercase" style={{ color: styles.textColor }}>Storage</span>
                        <span className="text-[10px] font-mono leading-none" style={{ color: styles.accentColor }}>{kernelCount} ITEMS</span>
                    </div>
                </motion.button>

                {/* WINDOW CONTROLS */}
                <div className="flex items-center gap-0.5 ml-2 pl-2 border-l border-white/5" data-no-drag>
                    <button
                        onClick={handleMinimize}
                        className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors"
                    >
                        <Minus size={16} />
                    </button>
                    <button
                        onClick={handleMaximize}
                        className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors"
                    >
                        <Square size={12} />
                    </button>
                    <button
                        onClick={handleClose}
                        className="w-10 h-10 flex items-center justify-center hover:bg-red-500/20 hover:text-red-500 rounded-lg text-white/40 transition-all"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* EXTRA POLISH: Shine effect */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent w-1/2 -skew-x-12 translate-x-[-150%]"
                    animate={{ translateX: ['150%', '-150%'] }}
                    transition={{ duration: 4, repeat: Infinity, repeatDelay: 10 }}
                />
            </div>
        </header>
    );
}

export default KOSTopBar;
