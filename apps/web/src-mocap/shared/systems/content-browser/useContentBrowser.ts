import { useState, useEffect, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';

export function useContentBrowser(initialState = false) {
    const [isOpen, setIsOpen] = useState(initialState);

    const toggle = useCallback(() => setIsOpen(prev => !prev), []);
    const open = useCallback(() => setIsOpen(true), []);
    const close = useCallback(() => setIsOpen(false), []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check for Ctrl + Space
            if (e.ctrlKey && e.code === 'Space') {
                e.preventDefault(); // Prevent scroll or other default actions
                toggle();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        const isTauri = typeof (window as any).__TAURI__ !== 'undefined';
        const unlistenPromise = isTauri ? listen('toggle-content-browser', () => {
            toggle();
        }) : Promise.resolve(() => {});

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            unlistenPromise.then(unlisten => unlisten && unlisten());
        };
    }, [toggle]);

    return {
        isOpen,
        toggle,
        open,
        close
    };
}
