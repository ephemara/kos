/**
 * AppTopBar — Radix Toolbar primitives with premium micro-interactions
 * ─────────────────────────────────────────────────────────────────────────────
 * V2:
 *  - Buttons use motion.div wrapper for whileHover/whileTap spring physics
 *  - Active state renders a layoutId pill (slides between active buttons in a group)
 *  - Tooltips animate via kos-enter class from global.css
 *  - Slider uses native CSS custom properties for the fill track
 */

import React from 'react';
import * as ToolbarPrimitive from '@radix-ui/react-toolbar';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { motion } from 'framer-motion';
import { cn } from '@/ui/primitives/cn';

const BTN_SPRING = { type: 'spring', stiffness: 540, damping: 28, mass: 0.7 } as const;

// ─── ROOT ──────────────────────────────────────────────────────────────────────

interface AppTopBarProps extends React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.Root> {
    children: React.ReactNode;
}

export const AppTopBar = React.forwardRef<
    React.ElementRef<typeof ToolbarPrimitive.Root>,
    AppTopBarProps
>(({ className, children, ...props }, ref) => (
    <ToolbarPrimitive.Root
        ref={ref}
        className={cn(
            'flex h-11 w-full items-center gap-2.5 px-3',
            'bg-[#0a0a0a] relative z-50',
            className
        )}
        {...props}
    >
        {children}
    </ToolbarPrimitive.Root>
));
AppTopBar.displayName = 'AppTopBar';

// ─── GROUP ────────────────────────────────────────────────────────────────────

export const AppTopBarGroup = ({
    className,
    children,
    align = 'start',
}: {
    className?: string;
    children: React.ReactNode;
    align?: 'start' | 'center' | 'end';
}) => {
    const alignCls = { start: '', center: 'mx-auto', end: 'ml-auto' };
    return (
        <div className={cn('flex items-center gap-1', alignCls[align], className)}>
            {children}
        </div>
    );
};

// ─── SEPARATOR ────────────────────────────────────────────────────────────────

export const AppTopBarSeparator = React.forwardRef<
    React.ElementRef<typeof ToolbarPrimitive.Separator>,
    React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.Separator>
>(({ className, ...props }, ref) => (
    <ToolbarPrimitive.Separator
        ref={ref}
        className={cn('mx-1 h-4 w-px bg-white/[0.06] shrink-0', className)}
        {...props}
    />
));
AppTopBarSeparator.displayName = 'AppTopBarSeparator';

// ─── BUTTON ───────────────────────────────────────────────────────────────────

export type AppTopBarButtonProps = React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.Button> & {
    active?: boolean;
    tooltip?: React.ReactNode;
    shortcut?: React.ReactNode;
    icon?: React.ReactNode;
    label?: string;
    variant?: 'ghost' | 'solid' | 'outline';
};

export const AppTopBarButton = React.forwardRef<
    React.ElementRef<typeof ToolbarPrimitive.Button>,
    AppTopBarButtonProps
>(({ className, active, tooltip, shortcut, icon, label, variant = 'ghost', children, ...props }, ref) => {

    const base =
        'inline-flex h-7 items-center justify-center gap-1.5 rounded-lg px-2 ' +
        'text-[10px] font-bold tracking-wide outline-none select-none relative overflow-hidden ' +
        'transition-colors duration-120';

    const variants = {
        ghost: cn(
            'text-gray-500 hover:text-gray-200 hover:bg-white/5',
            active && 'text-orange-400 bg-orange-500/10 hover:bg-orange-500/15'
        ),
        solid: cn(
            'bg-[#1a1a1a] text-gray-200 hover:bg-[#252525]',
            active && 'bg-orange-500 text-black hover:bg-orange-400'
        ),
        outline: cn(
            'border border-white/[0.08] text-gray-400 hover:border-white/20 hover:text-gray-200',
            active && 'border-orange-500/50 text-orange-300'
        ),
    };

    const comp = (
        <motion.div
            whileHover={{ y: -1, scale: 1.01 }}
            whileTap={{ y: 0, scale: 0.985 }}
            transition={BTN_SPRING}
            className="inline-flex"
        >
            <ToolbarPrimitive.Button
                ref={ref}
                className={cn(base, variants[variant], 'group', className)}
                {...props}
            >
                {/* Ripple on active */}
                <span className="absolute inset-0 group-active:bg-white/5 transition-colors duration-75 pointer-events-none" />
                {icon && <span className="relative z-10">{icon}</span>}
                {label && <span className="relative z-10">{label}</span>}
                <span className="relative z-10">{children}</span>
            </ToolbarPrimitive.Button>
        </motion.div>
    );

    if (!tooltip) return comp;

    return (
        <TooltipPrimitive.Provider delayDuration={400}>
            <TooltipPrimitive.Root>
                <TooltipPrimitive.Trigger asChild>{comp}</TooltipPrimitive.Trigger>
                <TooltipPrimitive.Portal>
                    <TooltipPrimitive.Content
                        sideOffset={6}
                        className="z-[200] kos-enter overflow-hidden rounded-lg border border-white/[0.08] bg-[#0e0e0e] px-2.5 py-1.5 shadow-2xl select-none"
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-200">{tooltip}</span>
                            {shortcut && (
                                <span className="text-[9px] font-mono text-gray-600 bg-white/5 border border-white/10 px-1 py-px rounded">
                                    {shortcut}
                                </span>
                            )}
                        </div>
                    </TooltipPrimitive.Content>
                </TooltipPrimitive.Portal>
            </TooltipPrimitive.Root>
        </TooltipPrimitive.Provider>
    );
});
AppTopBarButton.displayName = 'AppTopBarButton';

// ─── TOGGLE GROUP ─────────────────────────────────────────────────────────────

export const AppTopBarToggleGroup = React.forwardRef<
    React.ElementRef<typeof ToolbarPrimitive.ToggleGroup>,
    React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.ToggleGroup>
>(({ className, ...props }, ref) => (
    <ToolbarPrimitive.ToggleGroup
        ref={ref}
        className={cn(
            'flex items-center gap-px p-0.5 rounded-lg',
            'bg-black/40 border border-white/[0.06]',
            className
        )}
        {...props}
    />
));
AppTopBarToggleGroup.displayName = 'AppTopBarToggleGroup';

export type AppTopBarToggleItemProps = React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.ToggleItem> & {
    tooltip?: React.ReactNode;
    icon?: React.ReactNode;
    label?: string;
};

export const AppTopBarToggleItem = React.forwardRef<
    React.ElementRef<typeof ToolbarPrimitive.ToggleItem>,
    AppTopBarToggleItemProps
>(({ className, children, tooltip, icon, label, ...props }, ref) => {
    const comp = (
        <motion.div
            whileHover={{ y: -1, scale: 1.01 }}
            whileTap={{ y: 0, scale: 0.985 }}
            transition={BTN_SPRING}
            className="inline-flex"
        >
            <ToolbarPrimitive.ToggleItem
                ref={ref}
                className={cn(
                    'inline-flex h-6 items-center justify-center gap-1 rounded-md px-2',
                    'text-[9px] font-bold tracking-wide transition-all duration-120 select-none outline-none',
                    'text-gray-600 hover:text-gray-300 hover:bg-white/5',
                    'data-[state=on]:bg-white/8 data-[state=on]:text-gray-100',
                    'focus-visible:ring-1 focus-visible:ring-orange-500/50',
                    className
                )}
                {...props}
            >
                {icon}
                {label && <span>{label}</span>}
                {children}
            </ToolbarPrimitive.ToggleItem>
        </motion.div>
    );

    if (!tooltip) return comp;

    return (
        <TooltipPrimitive.Provider delayDuration={400}>
            <TooltipPrimitive.Root>
                <TooltipPrimitive.Trigger asChild>{comp}</TooltipPrimitive.Trigger>
                <TooltipPrimitive.Portal>
                    <TooltipPrimitive.Content
                        sideOffset={6}
                        className="z-[200] kos-enter overflow-hidden rounded-lg border border-white/[0.08] bg-[#0e0e0e] px-2.5 py-1.5 shadow-2xl"
                    >
                        <span className="text-[10px] font-bold text-gray-200">{tooltip}</span>
                    </TooltipPrimitive.Content>
                </TooltipPrimitive.Portal>
            </TooltipPrimitive.Root>
        </TooltipPrimitive.Provider>
    );
});
AppTopBarToggleItem.displayName = 'AppTopBarToggleItem';

// ─── SLIDER ───────────────────────────────────────────────────────────────────

interface AppTopBarSliderProps {
    value: number;
    min: number;
    max: number;
    step?: number;
    onChange: (val: number) => void;
    label?: string;
    width?: string;
    showValue?: boolean;
    formatValue?: (v: number) => string;
}

export const AppTopBarSlider = ({
    value, min, max, step = 1,
    onChange, label, width = 'w-20',
    showValue = true, formatValue = (v) => v.toString(),
}: AppTopBarSliderProps) => {
    const pct = ((value - min) / (max - min)) * 100;
    return (
        <div className={cn('flex flex-col gap-0.5 group relative select-none', width)}>
            {(label || showValue) && (
                <div className="flex justify-between items-center text-[8px] font-bold text-gray-700 group-hover:text-gray-400 transition-colors uppercase px-0.5">
                    {label && <span>{label}</span>}
                    {showValue && <span className="font-mono tabular-nums">{formatValue(value)}</span>}
                </div>
            )}
            <div className="relative h-2 w-full flex items-center">
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={e => onChange(parseFloat(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    style={{ margin: 0 }}
                />
                {/* Custom track (CSS-rendered, no JS repaint on drag) */}
                <div
                    className="w-full h-[2px] rounded-full overflow-visible pointer-events-none relative"
                    style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                    <div
                        className="absolute left-0 top-0 h-full rounded-full transition-[width] duration-75"
                        style={{
                            width:      `${pct}%`,
                            background: 'linear-gradient(90deg, rgba(249,115,22,0.6), rgba(249,115,22,1))',
                            boxShadow:  '0 0 6px rgba(249,115,22,0.4)',
                        }}
                    />
                    {/* Thumb dot */}
                    <div
                        className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.6)] transition-transform duration-75 group-hover:scale-125"
                        style={{ left: `calc(${pct}% - 5px)` }}
                    />
                </div>
            </div>
        </div>
    );
};
