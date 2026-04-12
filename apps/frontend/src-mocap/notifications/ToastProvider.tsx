/**
 * ToastProvider.tsx - Sonner Toast Container with K_OS Styling
 * 
 * Wrap your app with this to enable toasts.
 */

import React from 'react';
import { Toaster } from 'sonner';

export interface ToastProviderProps {
    children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
    return (
        <>
            {children}
            <Toaster
                position="bottom-right"
                expand={false}
                richColors
                closeButton
                theme="dark"
                toastOptions={{
                    style: {
                        background: 'rgb(24 24 27)', // zinc-900
                        border: '1px solid rgb(63 63 70)', // zinc-700
                        color: 'rgb(250 250 250)', // zinc-50
                    },
                    className: 'kos-toast',
                }}
            />
        </>
    );
}

export default ToastProvider;
