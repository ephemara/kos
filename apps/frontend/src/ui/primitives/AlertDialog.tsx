import React from 'react';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { cn } from './cn';

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
export const AlertDialogCancel = AlertDialogPrimitive.Cancel;
export const AlertDialogAction = AlertDialogPrimitive.Action;

export const AlertDialogOverlay = React.forwardRef<
    React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <AlertDialogPrimitive.Overlay
        ref={ref}
        className={cn('fixed inset-0 z-50 bg-black/70 backdrop-blur-sm', className)}
        {...props}
    />
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

export const AlertDialogContent = React.forwardRef<
    React.ElementRef<typeof AlertDialogPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
    <AlertDialogPrimitive.Portal>
        <AlertDialogOverlay />
        <AlertDialogPrimitive.Content
            ref={ref}
            className={cn(
                'fixed left-1/2 top-1/2 z-50 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2',
                'rounded-lg border border-white/10 bg-[#0b0b0b] p-4 shadow-2xl',
                className
            )}
            {...props}
        >
            {children}
        </AlertDialogPrimitive.Content>
    </AlertDialogPrimitive.Portal>
));
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

export function AlertDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('flex flex-col gap-1 pb-3', className)} {...props} />;
}

export function AlertDialogTitle({ className, ...props }: React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>) {
    return <AlertDialogPrimitive.Title className={cn('text-[12px] font-black tracking-wider text-white', className)} {...props} />;
}

export function AlertDialogDescription({ className, ...props }: React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>) {
    return (
        <AlertDialogPrimitive.Description
            className={cn('text-[11px] font-bold text-gray-400', className)}
            {...props}
        />
    );
}

export function AlertDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('pt-4 flex items-center justify-end gap-2', className)} {...props} />;
}
