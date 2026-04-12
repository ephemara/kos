import React from 'react';
import * as ToolbarPrimitive from '@radix-ui/react-toolbar';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from './cn';

// --- ROOT ---

export const Root = React.forwardRef<
    React.ElementRef<typeof ToolbarPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.Root>
>(({ className, ...props }, ref) => (
    <ToolbarPrimitive.Root
        ref={ref}
        className={cn(
            'flex h-14 w-full items-center justify-between gap-4 rounded-2xl border border-[#333]/50 bg-[#0a0a0a]/80 px-5 shadow-2xl backdrop-blur-xl transition-all',
            className
        )}
        {...props}
    />
));
Root.displayName = 'Toolbar.Root';

// --- BUTTON ---

export type ButtonProps = React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.Button> & {
    active?: boolean;
    tooltip?: React.ReactNode;
    shortcut?: React.ReactNode;
};

export const Button = React.forwardRef<React.ElementRef<typeof ToolbarPrimitive.Button>, ButtonProps>(
    ({ className, active, tooltip, shortcut, children, ...props }, ref) => {
        const comp = (
            <ToolbarPrimitive.Button
                ref={ref}
                className={cn(
                    'inline-flex h-8 items-center justify-center rounded-md px-2.5 text-[11px] font-bold tracking-wide outline-none transition-all',
                    'text-gray-400 hover:bg-white/10 hover:text-gray-100 focus-visible:ring-2 focus-visible:ring-white/20',
                    active ? 'bg-orange-500 text-black hover:bg-orange-400' : '',
                    className
                )}
                {...props}
            >
                {children}
            </ToolbarPrimitive.Button>
        );

        if (!tooltip) return comp;

        return (
            <TooltipPrimitive.Provider delayDuration={300}>
                <TooltipPrimitive.Root>
                    <TooltipPrimitive.Trigger asChild>{comp}</TooltipPrimitive.Trigger>
                    <TooltipPrimitive.Portal>
                        <TooltipPrimitive.Content
                            sideOffset={5}
                            className="z-[200] animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95 overflow-hidden rounded-md border border-white/10 bg-[#111] px-3 py-1.5 shadow-xl"
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-bold text-gray-200">{tooltip}</span>
                                {shortcut && <span className="text-[9px] font-bold text-gray-500">{shortcut}</span>}
                            </div>
                        </TooltipPrimitive.Content>
                    </TooltipPrimitive.Portal>
                </TooltipPrimitive.Root>
            </TooltipPrimitive.Provider>
        );
    }
);
Button.displayName = 'Toolbar.Button';

// --- TOGGLE GROUP (Single/Multiple) ---

export const ToggleGroup = React.forwardRef<
    React.ElementRef<typeof ToolbarPrimitive.ToggleGroup>,
    React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.ToggleGroup>
>(({ className, ...props }, ref) => (
    <ToolbarPrimitive.ToggleGroup
        ref={ref}
        className={cn('flex items-center gap-0.5 rounded-lg border border-[#222] bg-[#050505] p-1', className)}
        {...props}
    />
));
ToggleGroup.displayName = 'Toolbar.ToggleGroup';

// --- TOGGLE ITEM ---

export type ToggleItemProps = React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.ToggleItem> & {
    tooltip?: React.ReactNode;
};

export const ToggleItem = React.forwardRef<
    React.ElementRef<typeof ToolbarPrimitive.ToggleItem>,
    ToggleItemProps
>(({ className, children, tooltip, ...props }, ref) => {
    const comp = (
        <ToolbarPrimitive.ToggleItem
            ref={ref}
            className={cn(
                'inline-flex h-6 flex-1 items-center justify-center rounded px-3 text-[9px] font-bold transition-all',
                'text-gray-500 hover:text-gray-300',
                'data-[state=on]:bg-[#222] data-[state=on]:text-white data-[state=on]:shadow-sm',
                'focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20',
                className
            )}
            {...props}
        >
            {children}
        </ToolbarPrimitive.ToggleItem>
    );

    if (!tooltip) return comp;

    return (
        <TooltipPrimitive.Provider delayDuration={300}>
            <TooltipPrimitive.Root>
                <TooltipPrimitive.Trigger asChild>{comp}</TooltipPrimitive.Trigger>
                <TooltipPrimitive.Portal>
                    <TooltipPrimitive.Content
                        sideOffset={5}
                        className="z-[200] animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95 overflow-hidden rounded-md border border-white/10 bg-[#111] px-3 py-1.5 shadow-xl"
                    >
                        <span className="text-[10px] font-bold text-gray-200">{tooltip}</span>
                    </TooltipPrimitive.Content>
                </TooltipPrimitive.Portal>
            </TooltipPrimitive.Root>
        </TooltipPrimitive.Provider>
    );
});
ToggleItem.displayName = 'Toolbar.ToggleItem';

// --- SEPARATOR ---

export const Separator = React.forwardRef<
    React.ElementRef<typeof ToolbarPrimitive.Separator>,
    React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.Separator>
>(({ className, ...props }, ref) => (
    <ToolbarPrimitive.Separator ref={ref} className={cn('mx-2 h-6 w-px bg-[#333]', className)} {...props} />
));
Separator.displayName = 'Toolbar.Separator';

// --- GROUP (Visual only) ---

export const Group = ({ className, children }: { className?: string; children: React.ReactNode }) => (
    <div className={cn('flex items-center gap-2', className)}>{children}</div>
);
