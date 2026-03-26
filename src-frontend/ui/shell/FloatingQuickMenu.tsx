import React from 'react';
import { motion, useMotionValue, useDragControls, animate } from 'framer-motion';
import { Command } from 'cmdk';
import { ArrowDownAZ, Pin, PinOff, X } from 'lucide-react';
import { cn } from '@/ui/primitives/cn';

export type FloatingQuickMenuCommand = {
    id: string;
    label: string;
    description?: string;
    icon?: React.ComponentType<any>;
    keywords?: string[];
    disabled?: boolean;
    action: () => void;
};

export type FloatingQuickMenuSortMode = 'default' | 'alpha';

export type FloatingQuickMenuProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;

    title: React.ReactNode;
    placeholder?: string;

    commands: FloatingQuickMenuCommand[];
    isCommandActive?: (cmd: FloatingQuickMenuCommand) => boolean;

    pinned: boolean;
    onPinnedChange: (pinned: boolean) => void;

    persistKey?: string;

    headerRight?: React.ReactNode;

    footer?: React.ReactNode;

    defaultSize?: { width: number; height: number };
};

function clamp(v: number, min: number, max: number) {
    return Math.min(max, Math.max(min, v));
}

function safeJsonParse<T>(text: string | null): T | null {
    if (!text) return null;
    try {
        return JSON.parse(text) as T;
    } catch {
        return null;
    }
}


export function FloatingQuickMenu({
    open,
    onOpenChange,
    title,
    placeholder,
    commands,
    isCommandActive,
    pinned,
    onPinnedChange,
    persistKey,
    headerRight,
    footer,
    defaultSize = { width: 320, height: 400 }, // Compact grid size
}: FloatingQuickMenuProps) {
    const containerRef = React.useRef<HTMLDivElement | null>(null);

    const minSize = React.useMemo(() => ({ width: 280, height: 320 }), []); // Compact min size

    const [sortMode, setSortMode] = React.useState<FloatingQuickMenuSortMode>(() => {
        const s = safeJsonParse<{ sortMode?: FloatingQuickMenuSortMode }>(
            persistKey ? localStorage.getItem(`${persistKey}:prefs`) : null
        );
        return s?.sortMode ?? 'default';
    });

    const [pos, setPos] = React.useState(() => {
        const s = safeJsonParse<{ x: number; y: number }>(persistKey ? localStorage.getItem(`${persistKey}:pos`) : null);
        return s ?? { x: 0, y: 0 };
    });

    const [size, setSize] = React.useState(() => {
        const s = safeJsonParse<{ width: number; height: number }>(
            persistKey ? localStorage.getItem(`${persistKey}:size`) : null
        );
        return s ?? defaultSize;
    });

    React.useEffect(() => {
        if (!persistKey) return;
        localStorage.setItem(`${persistKey}:prefs`, JSON.stringify({ sortMode }));
    }, [persistKey, sortMode]);

    React.useEffect(() => {
        if (!persistKey) return;
        localStorage.setItem(`${persistKey}:pos`, JSON.stringify(pos));
    }, [persistKey, pos]);

    React.useEffect(() => {
        if (!persistKey) return;
        localStorage.setItem(`${persistKey}:size`, JSON.stringify(size));
    }, [persistKey, size]);

    // Centering logic - ONLY runs on mount/open if pos is 0,0
    React.useEffect(() => {
        if (!open) return;
        // Check if we are at 0,0 (uninitialized)
        if (Math.abs(pos.x) < 1 && Math.abs(pos.y) < 1) {
            const pad = 12;
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            setPos({
                x: clamp((vw - defaultSize.width) / 2, pad, vw - defaultSize.width - pad),
                y: clamp((vh - defaultSize.height) / 2, pad, vh - defaultSize.height - pad),
            });
        }
    }, [open]); // Only run when open changes, ignore pos/size updates to prevent fighting

    const orderedCommands = React.useMemo(() => {
        if (sortMode === 'alpha') {
            return [...commands].sort((a, b) => a.label.localeCompare(b.label));
        }
        return commands;
    }, [commands, sortMode]);

    // --- FRAMER MOTION DRAG & RESIZE (smooth, no snap, GPU-accelerated) ---
    const x = useMotionValue(pos.x);
    const y = useMotionValue(pos.y);
    const width = useMotionValue(size.width);
    const height = useMotionValue(size.height);

    // Sync motion values when pos/size state changes (e.g., on open with persisted values)
    React.useEffect(() => {
        x.set(pos.x);
        y.set(pos.y);
    }, [pos.x, pos.y]);

    React.useEffect(() => {
        width.set(size.width);
        height.set(size.height);
    }, [size.width, size.height]);

    // Persist position on drag end + EDGE SNAPPING
    const handleDragEnd = () => {
        const currentX = x.get();
        const currentY = y.get();
        const currentWidth = width.get();
        const currentHeight = height.get();

        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const snapThreshold = 30; // px from edge to trigger snap

        let snappedX = currentX;
        let snappedY = currentY;
        let didSnap = false;

        // Left edge snap
        if (currentX < snapThreshold) {
            snappedX = 8; // Small margin from edge
            didSnap = true;
        }
        // Right edge snap
        else if (currentX + currentWidth > vw - snapThreshold) {
            snappedX = vw - currentWidth - 8;
            didSnap = true;
        }

        // Top edge snap
        if (currentY < snapThreshold) {
            snappedY = 8;
            didSnap = true;
        }
        // Bottom edge snap
        else if (currentY + currentHeight > vh - snapThreshold) {
            snappedY = vh - currentHeight - 8;
            didSnap = true;
        }

        // Animate snap if detected
        if (didSnap) {
            // Smooth spring animation to edge
            animate(x, snappedX, { type: 'spring', stiffness: 300, damping: 30 });
            animate(y, snappedY, { type: 'spring', stiffness: 300, damping: 30 });
            // Auto-pin when docked
            if (!pinned) {
                onPinnedChange(true);
            }
        }

        // Persist final position
        setPos({ x: x.get(), y: y.get() });
    };

    // Drag controls - allows dragging from header only
    const dragControls = useDragControls();

    if (!open) return null;

    return (
        <motion.div
            ref={containerRef}
            drag
            dragControls={dragControls}
            dragMomentum={false}
            dragElastic={0}
            dragListener={false}
            onDragEnd={handleDragEnd}
            className={cn(
                'fixed z-[120] bg-[#0a0a0a]/95 backdrop-blur-xl',
                'border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5)]',
                'pointer-events-auto font-sans select-none',
                'flex flex-col'
            )}
            style={{
                x,
                y,
                width,
                height,
                minWidth: minSize.width,
                minHeight: minSize.height,
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
        >
            <Command className="flex flex-col h-full w-full min-h-0" loop>
                {/* DRAGGABLE HEADER - enables drag for the whole component */}
                <motion.div
                    onPointerDown={(e) => {
                        // Start drag from header
                        dragControls.start(e);
                    }}
                    className={cn(
                        'flex items-center gap-2 px-3 py-2 border-b border-white/10',
                        'cursor-grab active:cursor-grabbing bg-white/5 hover:bg-white/10 transition-colors rounded-t-2xl'
                    )}
                    style={{ touchAction: 'none' }}
                >
                    <div className="text-[11px] font-black tracking-[0.22em] text-gray-200 truncate select-none pointer-events-none">
                        {title}
                    </div>

                    <div className="ml-auto flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
                        {headerRight}

                        <div className="h-4 w-[1px] bg-white/10 mx-1" />

                        <button
                            className="p-1.5 rounded-md hover:bg-white/10 text-gray-500 hover:text-gray-200 transition-colors"
                            onClick={() => setSortMode((m) => (m === 'alpha' ? 'default' : 'alpha'))}
                            title={sortMode === 'alpha' ? 'Sort: Alphabetical' : 'Sort: Default'}
                        >
                            <ArrowDownAZ size={14} />
                        </button>

                        <button
                            className={cn(
                                "p-1.5 rounded-md transition-colors",
                                pinned ? "text-orange-400 bg-orange-400/10 hover:bg-orange-400/20" : "text-gray-500 hover:bg-white/10 hover:text-gray-200"
                            )}
                            onClick={() => onPinnedChange(!pinned)}
                            title={pinned ? 'Unpin / Unlock' : 'Pin / Lock'}
                        >
                            {pinned ? <PinOff size={14} /> : <Pin size={14} />}
                        </button>

                        <button
                            className="p-1.5 rounded-md hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors"
                            onClick={() => onOpenChange(false)}
                            title="Close"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </motion.div>

                <div className="px-3 py-2 border-b border-white/10 flex-shrink-0">
                    <Command.Input
                        autoFocus
                        placeholder={placeholder ?? 'Search...'}
                        className="w-full bg-transparent outline-none text-[13px] font-medium text-gray-200 placeholder:text-gray-600 font-mono"
                        onKeyDown={(e) => {
                            // Block Q key since it's the global toggle hotkey
                            if (e.key.toLowerCase() === 'q') {
                                e.preventDefault();
                                e.stopPropagation();
                                return;
                            }
                            if (e.key === 'Escape') {
                                e.preventDefault();
                                onOpenChange(false);
                            }
                        }}
                    />
                </div>

                <Command.List
                    className="flex-1 overflow-y-auto p-2 overscroll-contain"
                    onWheel={(e) => e.stopPropagation()}
                >
                    <Command.Empty className="px-2 py-8 text-[10px] font-bold text-gray-500 text-center">No results.</Command.Empty>

                    {/* GRID LAYOUT - 5 columns of compact icons */}
                    <div className="grid grid-cols-5 gap-1">
                        {orderedCommands.map((cmd) => {
                            const Icon = cmd.icon;
                            const active = isCommandActive ? isCommandActive(cmd) : false;
                            return (
                                <Command.Item
                                    key={cmd.id}
                                    value={[cmd.label, cmd.description, ...(cmd.keywords ?? [])].filter(Boolean).join(' ')}
                                    disabled={cmd.disabled}
                                    onSelect={() => {
                                        if (cmd.disabled) return;
                                        cmd.action();
                                        if (!pinned) onOpenChange(false);
                                    }}
                                    className={cn(
                                        'group relative flex items-center justify-center',
                                        'w-11 h-11 rounded-lg cursor-pointer transition-all duration-100',
                                        cmd.disabled ? 'opacity-30 cursor-not-allowed' : '',
                                        active
                                            ? 'bg-orange-500 text-black shadow-[0_0_12px_rgba(249,115,22,0.5)]'
                                            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white aria-selected:bg-white/15 aria-selected:text-white',
                                        'focus-visible:outline-none'
                                    )}
                                    title={cmd.label}
                                >
                                    {Icon ? <Icon size={18} strokeWidth={2} /> : <span className="text-[10px] font-black">{cmd.label.slice(0, 2)}</span>}

                                    {/* Hover Tooltip */}
                                    <div className={cn(
                                        'absolute -bottom-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded',
                                        'bg-black/90 border border-white/10 text-[9px] font-bold text-white whitespace-nowrap',
                                        'opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50',
                                        'shadow-lg'
                                    )}>
                                        {cmd.label}
                                    </div>
                                </Command.Item>
                            );
                        })}
                    </div>
                </Command.List>

                <div className="flex-shrink-0">
                    {footer}
                </div>
            </Command>

            {/* RESIZE HANDLE */}
            <motion.div
                drag
                dragMomentum={false}
                dragElastic={0}
                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                onDrag={(_, info) => {
                    const newW = Math.max(minSize.width, size.width + info.delta.x);
                    const newH = Math.max(minSize.height, size.height + info.delta.y);
                    width.set(newW);
                    height.set(newH);
                }}
                onDragEnd={() => {
                    setSize({ width: width.get(), height: height.get() });
                }}
                className={cn(
                    'absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize',
                    'hover:bg-white/10 rounded-br-2xl transition-colors',
                    'flex items-center justify-center',
                    'z-[50]'
                )}
                style={{ touchAction: 'none' }}
            >
                <div className="w-2 h-2 border-r-2 border-b-2 border-white/20" />
            </motion.div>
        </motion.div>
    );
}
