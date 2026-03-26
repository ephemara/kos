/**
 * KOSTopBarDirect — Direct Access Navigation Bar
 * ─────────────────────────────────────────────────────────────────────────────
 * Premium module switcher with Lusion-grade spring animations.
 *
 * Fixes vs previous version:
 *  - Removed `layoutId="icon-glow-${mod.id}"` per-module (caused React warning
 *    when modules changed — shared layout ids must be unique in the tree)
 *  - AnimatePresence on label text replaced with CSS max-width transition
 *    (AnimatePresence caused layout jitter because it briefly double-renders)
 *  - Spring tuning: snappier bounce, less latency
 *  - Added `willRotate` micro-rotation on icon when activating
 *  - Added `kos-ripple` and `kos-focus` classes to all interactive buttons
 *  - Window control hover states use scale() not opacity only
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Hexagon, HardDrive, Minus, Square, X, Search } from 'lucide-react';
import { TopBarTheme } from '@/systems/ui/topBarThemes';
import { ALL_MODULES, WORKFLOW } from '@/config/appConfig';

// ─── Spring presets ────────────────────────────────────────────────────────────
const PILL_SPRING   = { type: 'spring', stiffness: 520, damping: 36, mass: 0.8 } as const;
const GLOW_SPRING   = { type: 'spring', stiffness: 400, damping: 30, mass: 1.0 } as const;
const ICON_SPRING   = { type: 'spring', stiffness: 600, damping: 28, mass: 0.6 } as const;
const FAST_EASE     = { duration: 0.18, ease: [0.16, 1, 0.3, 1] } as const;

interface KOSTopBarDirectProps {
    theme: TopBarTheme;
    activeModuleId: string;
    onModuleSwitch: (id: string) => void;
    onSettingsOpen?: () => void;
    onKernelOpen?: () => void;
    onSearchOpen?: () => void;
    kernelCount?: number;
    kernelStatus?: string;
    onMinimize?: () => void;
    onMaximize?: () => void;
    onClose?: () => void;
}

export function KOSTopBarDirect({
    theme,
    activeModuleId,
    onModuleSwitch,
    onSettingsOpen,
    onKernelOpen,
    onSearchOpen,
    kernelCount = 0,
    kernelStatus = 'READY',
    onMinimize,
    onMaximize,
    onClose,
}: KOSTopBarDirectProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [hoveredModule, setHoveredModule] = useState<string | null>(null);

    const styles = theme.styles;

    // ── Category colour lookup (memoized) ─────────────────────────────────────
    const categoryColorMap = useMemo(() => {
        const map: Record<string, string> = {};
        for (const group of WORKFLOW) {
            for (const mod of group.modules) {
                map[mod.id] = group.color;
            }
        }
        return map;
    }, []);

    const getModuleColor = useCallback(
        (id: string) => categoryColorMap[id] ?? 'text-gray-400',
        [categoryColorMap]
    );

    // ── Window management ─────────────────────────────────────────────────────
    const handleStartDrag = useCallback(async (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('a') || target.closest('[data-no-drag]')) return;
        setIsDragging(true);
        try {
            await getCurrentWindow().startDragging();
        } catch { /* no-op */ } finally {
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
            className="flex items-center relative z-[100] select-none overflow-visible"
            style={{
                height:               styles.height,
                background:           styles.background,
                borderBottom:         styles.borderBottom,
                backdropFilter:       `blur(${styles.blur})`,
                WebkitBackdropFilter: `blur(${styles.blur})`,
                transition:           'background 0.5s, border-color 0.5s',
            }}
            onMouseDown={handleStartDrag}
        >
            {/* ── AMBIENT LOWER GLOW ────────────────────────────────────────── */}
            <div
                className="absolute inset-x-0 bottom-0 h-[1px] pointer-events-none"
                style={{
                    background: `linear-gradient(90deg, transparent 0%, ${styles.accentColor}60 50%, transparent 100%)`,
                    opacity:    styles.glowOpacity,
                }}
            />
            {/* Subtle noise grain for depth */}
            <div
                className="absolute inset-0 pointer-events-none opacity-[0.02]"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                    backgroundSize: '96px 96px',
                }}
            />

            {/* ── LEFT: BRANDING ────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 pl-5 relative z-10 shrink-0">
                <motion.div
                    className="flex items-center gap-2.5 cursor-pointer group kos-ripple rounded-lg px-2 py-1"
                    onClick={onSettingsOpen}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.96 }}
                    transition={ICON_SPRING}
                >
                    <div className="relative">
                        <Hexagon
                            size={20}
                            style={{ color: styles.logoColor, fill: `${styles.logoColor}22` }}
                            className="relative z-10"
                        />
                        {/* Logo ambient glow — CSS animation, no JS RAF */}
                        <div
                            className="absolute inset-0 rounded-full blur-md pointer-events-none kos-pulse-glow"
                            style={{ background: styles.logoColor }}
                        />
                    </div>
                    <div className="flex flex-col leading-none">
                        <span
                            className="text-[13px] font-black tracking-[-0.04em]"
                            style={{ color: styles.textColor }}
                        >
                            K_OS
                        </span>
                        <span
                            className="text-[7px] font-mono tracking-[0.25em] opacity-35"
                            style={{ color: styles.textColor }}
                        >
                            HYPERVISOR
                        </span>
                    </div>
                </motion.div>

                {/* Vertical rule */}
                <div className="w-px h-5 bg-white/5 shrink-0" />
            </div>

            {/* ── CENTER: MODULE NAVIGATION ─────────────────────────────────── */}
            <nav
                className="flex-1 flex items-center justify-center h-full px-2 relative z-10 overflow-hidden"
                data-no-drag
            >
                <div className="flex items-center gap-0.5 p-1 rounded-xl"
                    style={{
                        background:   'rgba(0,0,0,0.25)',
                        border:       '1px solid rgba(255,255,255,0.05)',
                        backdropFilter: 'blur(20px)',
                    }}
                >
                    {ALL_MODULES.map((mod) => {
                        const isActive  = mod.id === activeModuleId;
                        const isHovered = hoveredModule === mod.id;
                        const Icon      = mod.icon as any;
                        const catColor  = getModuleColor(mod.id);
                        // Derive a CSS bg color class from text color class
                        const bgColor   = catColor.replace('text-', 'bg-').replace('-500', '-400');

                        return (
                            <motion.button
                                key={mod.id}
                                onClick={() => onModuleSwitch(mod.id)}
                                onMouseEnter={() => setHoveredModule(mod.id)}
                                onMouseLeave={() => setHoveredModule(null)}
                                layout
                                style={{
                                    position:  'relative',
                                    display:   'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    height:    36,
                                    borderRadius: 8,
                                    gap:       isActive ? 6 : 0,
                                    paddingLeft:  isActive ? 10 : 8,
                                    paddingRight: isActive ? 10 : 8,
                                    color:     isActive ? '#fff' : 'rgba(255,255,255,0.3)',
                                }}
                                whileHover={{ y: -1.5 }}
                                whileTap={{ scale: 0.93 }}
                                transition={{ ...ICON_SPRING, y: { duration: 0.15 } }}
                                className="kos-focus kos-ripple transition-colors duration-150 hover:!text-white/75"
                                title={mod.name}
                            >
                                {/* Active sliding pill */}
                                {isActive && (
                                    <motion.div
                                        layoutId="kos-active-pill"
                                        className="absolute inset-0 rounded-lg"
                                        style={{
                                            background: 'linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)',
                                            border:     '1px solid rgba(255,255,255,0.10)',
                                            boxShadow:  '0 2px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
                                        }}
                                        transition={PILL_SPRING}
                                    />
                                )}

                                {/* Hovered ghost pill */}
                                {isHovered && !isActive && (
                                    <motion.div
                                        layoutId="kos-hover-pill"
                                        className="absolute inset-0 rounded-lg"
                                        initial={{ opacity: 0, scale: 0.92 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.92 }}
                                        transition={FAST_EASE}
                                        style={{
                                            background: 'rgba(255,255,255,0.04)',
                                            border:     '1px solid rgba(255,255,255,0.06)',
                                        }}
                                    />
                                )}

                                {/* Icon */}
                                <motion.div
                                    className="relative z-10"
                                    animate={{
                                        rotate:  isActive ? [0, -8, 4, 0] : 0,
                                        scale:   isActive ? 1 : 1,
                                    }}
                                    transition={{
                                        rotate: { duration: 0.45, ease: [0.34, 1.56, 0.64, 1] },
                                    }}
                                    key={`icon-${mod.id}-${isActive}`}
                                >
                                    <Icon
                                        size={14}
                                        className={`transition-colors duration-200 ${isActive ? catColor : ''}`}
                                    />
                                    {/* Active icon glow — CSS not JS */}
                                    {isActive && (
                                        <div
                                            className={`absolute inset-0 blur-md opacity-50 ${bgColor}`}
                                            style={{ transform: 'scale(2)' }}
                                        />
                                    )}
                                </motion.div>

                                {/* Label — CSS width transition (no AnimatePresence jitter) */}
                                <span
                                    className="relative z-10 text-[9px] font-black tracking-[0.15em] whitespace-nowrap overflow-hidden transition-all duration-200"
                                    style={{
                                        maxWidth:  isActive ? '80px' : (isHovered ? '60px' : '0px'),
                                        opacity:   isActive ? 1 : (isHovered ? 0.6 : 0),
                                    }}
                                >
                                    {mod.name.replace('K-', '')}
                                </span>

                                {/* Active floor dot */}
                                {isActive && (
                                    <motion.div
                                        layoutId="kos-active-dot"
                                        className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-[5px] h-[5px] rounded-full ${bgColor}`}
                                        transition={{ ...GLOW_SPRING, delay: 0.05 }}
                                        style={{
                                            boxShadow: `0 0 6px 1px currentColor`,
                                        }}
                                    />
                                )}
                            </motion.button>
                        );
                    })}
                </div>
            </nav>

            {/* ── RIGHT: CONTROLS ───────────────────────────────────────────── */}
            <div className="flex items-center gap-1.5 pr-3 relative z-10 shrink-0">

                {/* Search */}
                <motion.button
                    onClick={onSearchOpen}
                    className="p-2 rounded-lg text-white/30 kos-ripple kos-focus"
                    style={{ background: 'transparent' }}
                    whileHover={{ scale: 1.08, color: 'rgba(255,255,255,0.7)', backgroundColor: 'rgba(255,255,255,0.05)' }}
                    whileTap={{ scale: 0.92 }}
                    transition={ICON_SPRING}
                    data-no-drag
                    title="Quick Search (Ctrl+K)"
                >
                    <Search size={14} />
                </motion.button>

                {/* Kernel Status */}
                <motion.button
                    onClick={onKernelOpen}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg kos-focus kos-ripple"
                    style={{
                        background:   styles.buttonBg,
                        border:       `1px solid ${styles.buttonBorder}`,
                        transition:   'border-color 0.2s',
                    }}
                    whileHover={{ scale: 1.03, borderColor: styles.accentColor }}
                    whileTap={{ scale: 0.96 }}
                    transition={ICON_SPRING}
                    data-no-drag
                >
                    <div className="relative">
                        <HardDrive size={11} style={{ color: styles.accentColor }} />
                        {/* Pulsing dot — CSS animation, no RAF */}
                        <div
                            className="absolute -top-0.5 -right-0.5 w-[5px] h-[5px] rounded-full kos-pulse-glow"
                            style={{
                                background: kernelStatus === 'READY' ? styles.accentColor : '#f59e0b',
                            }}
                        />
                    </div>
                    <span className="text-[9px] font-mono" style={{ color: styles.accentColor }}>
                        {kernelCount}
                    </span>
                </motion.button>

                {/* Window Controls */}
                <div className="flex items-center gap-0.5 ml-1 pl-2 border-l border-white/5" data-no-drag>
                    {([
                        { icon: Minus,  onClick: handleMinimize, hoverCls: 'hover:bg-white/5 hover:text-white/70',                 size: 13, label: 'Minimize' },
                        { icon: Square, onClick: handleMaximize, hoverCls: 'hover:bg-white/5 hover:text-white/70',                 size: 9,  label: 'Maximize' },
                        { icon: X,      onClick: handleClose,    hoverCls: 'hover:bg-red-500/20 hover:text-red-400 hover:scale-110', size: 13, label: 'Close' },
                    ] as const).map(({ icon: Icon, onClick, hoverCls, size, label }) => (
                        <motion.button
                            key={label}
                            onClick={onClick}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg text-white/25 transition-colors kos-focus ${hoverCls}`}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.88 }}
                            transition={ICON_SPRING}
                            title={label}
                        >
                            <Icon size={size} />
                        </motion.button>
                    ))}
                </div>
            </div>

            {/* Rare shimmer sweep — CSS, fires every ~15s */}
            <div
                className="absolute inset-0 pointer-events-none overflow-hidden"
                style={{ zIndex: 0 }}
            >
                <div
                    className="absolute top-0 bottom-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent kos-shimmer"
                    style={{ animationDuration: '4s', animationDelay: '8s' }}
                />
            </div>
        </header>
    );
}

export default KOSTopBarDirect;
