import React from 'react';
import { cn } from './cn';

type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'accent';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
};

const variantClasses: Record<ButtonVariant, string> = {
    // Default: uses theme surface colors
    default: [
        'bg-[color:var(--kos-surface-tertiary)]',
        'border border-[color:var(--kos-border-primary)]',
        'text-[color:var(--kos-text-primary)]',
        'hover:bg-[color:var(--kos-surface-hover)]',
        'hover:border-[color:var(--kos-border-hover)]',
        'active:bg-[color:var(--kos-surface-active)]',
    ].join(' '),

    // Secondary: subtle background
    secondary: [
        'bg-[color:var(--kos-surface-secondary)]',
        'border border-[color:var(--kos-border-secondary)]',
        'text-[color:var(--kos-text-primary)]',
        'hover:bg-[color:var(--kos-surface-hover)]',
        'hover:border-[color:var(--kos-border-hover)]',
    ].join(' '),

    // Outline: transparent with visible border
    outline: [
        'bg-transparent',
        'border border-[color:var(--kos-border-secondary)]',
        'text-[color:var(--kos-text-primary)]',
        'hover:bg-[color:var(--kos-surface-tertiary)]',
        'hover:border-[color:var(--kos-border-hover)]',
    ].join(' '),

    // Ghost: minimal styling
    ghost: [
        'bg-transparent',
        'border border-transparent',
        'text-[color:var(--kos-text-secondary)]',
        'hover:bg-[color:var(--kos-surface-tertiary)]',
        'hover:text-[color:var(--kos-text-primary)]',
    ].join(' '),

    // Danger: error/destructive actions
    danger: [
        'bg-[color:var(--kos-error)]/20',
        'border border-[color:var(--kos-error)]/50',
        'text-[color:var(--kos-error)]',
        'hover:bg-[color:var(--kos-error)]/30',
        'hover:border-[color:var(--kos-error)]/70',
    ].join(' '),

    // Accent: primary action button (NEW)
    accent: [
        'bg-[color:var(--kos-accent-primary)]',
        'border border-[color:var(--kos-accent-primary)]',
        'text-[color:var(--kos-text-inverse)]',
        'hover:brightness-110',
        'active:brightness-90',
        'shadow-[0_0_12px_var(--kos-accent-glow)]',
    ].join(' '),
};

const sizeClasses: Record<ButtonSize, string> = {
    sm: 'h-8 px-2.5 text-[11px]',
    md: 'h-9 px-3 text-[11px]',
    lg: 'h-10 px-4 text-[12px]',
    icon: 'h-9 w-9 p-0',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'default', size = 'md', type, disabled, ...props }, ref) => {
        return (
            <button
                ref={ref}
                type={type ?? 'button'}
                disabled={disabled}
                className={cn(
                    'inline-flex items-center justify-center gap-2 rounded-md font-bold tracking-wide transition-colors select-none',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-0',
                    'disabled:opacity-50 disabled:pointer-events-none',
                    variantClasses[variant],
                    sizeClasses[size],
                    className
                )}
                {...props}
            />
        );
    }
);
Button.displayName = 'Button';
