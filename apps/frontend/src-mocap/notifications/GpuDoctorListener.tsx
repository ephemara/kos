/**
 * GPU Doctor Toast - Real-time GPU Error Notifications
 * 
 * Catches GPU crashes that would normally kill the app and shows them
 * as dismissible toasts. You can keep sculpting while fixing shaders!
 * 
 * ## Usage
 * 
 * ```tsx
 * // Add to your root layout
 * <GpuDoctorListener />
 * ```
 */

import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { X, Copy, CheckCircle } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface GpuErrorPayload {
    error: string;
    category: 'Shader' | 'Buffer' | 'Texture' | 'Pipeline' | 'Validation' | 'OutOfMemory' | 'DeviceLost' | 'Other';
    context: string;
    timestamp: number;
    error_hash: number;
}

interface GpuToast {
    id: string;
    payload: GpuErrorPayload;
    dismissed: boolean;
    copied: boolean;
}

// ============================================================================
// STATE
// ============================================================================

// Simple state management (no extra deps)
let toasts: GpuToast[] = [];
let listeners: (() => void)[] = [];

function addToast(payload: GpuErrorPayload) {
    const toast: GpuToast = {
        id: `${payload.error_hash}-${Date.now()}`,
        payload,
        dismissed: false,
        copied: false,
    };

    // Dedup by hash (don't show same error twice)
    if (toasts.some(t => t.payload.error_hash === payload.error_hash && !t.dismissed)) {
        return;
    }

    toasts = [...toasts, toast];
    notifyListeners();
}

function dismissToast(id: string) {
    toasts = toasts.map(t => t.id === id ? { ...t, dismissed: true } : t);
    notifyListeners();

    // Remove after animation
    setTimeout(() => {
        toasts = toasts.filter(t => t.id !== id);
        notifyListeners();
    }, 300);
}

function markCopied(id: string) {
    toasts = toasts.map(t => t.id === id ? { ...t, copied: true } : t);
    notifyListeners();
}

function notifyListeners() {
    listeners.forEach(fn => fn());
}

function useGpuToasts() {
    const [, forceUpdate] = useState({});

    useEffect(() => {
        const listener = () => forceUpdate({});
        listeners.push(listener);
        return () => {
            listeners = listeners.filter(l => l !== listener);
        };
    }, []);

    return toasts.filter(t => !t.dismissed);
}

// ============================================================================
// CATEGORY STYLING
// ============================================================================

const categoryStyles: Record<GpuErrorPayload['category'], { bg: string; border: string; icon: string }> = {
    Shader: { bg: 'bg-purple-500/20', border: 'border-purple-500/50', icon: '📜' },
    Buffer: { bg: 'bg-blue-500/20', border: 'border-blue-500/50', icon: '📦' },
    Texture: { bg: 'bg-green-500/20', border: 'border-green-500/50', icon: '🖼️' },
    Pipeline: { bg: 'bg-orange-500/20', border: 'border-orange-500/50', icon: '🔧' },
    Validation: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/50', icon: '⚠️' },
    OutOfMemory: { bg: 'bg-red-500/20', border: 'border-red-500/50', icon: '💾' },
    DeviceLost: { bg: 'bg-red-600/30', border: 'border-red-600/50', icon: '💀' },
    Other: { bg: 'bg-gray-500/20', border: 'border-gray-500/50', icon: '❓' },
};

// ============================================================================
// COMPONENTS
// ============================================================================

function GpuToastItem({ toast, onDismiss }: { toast: GpuToast; onDismiss: () => void }) {
    const { payload } = toast;
    const style = categoryStyles[payload.category] || categoryStyles.Other;

    const copyError = async () => {
        try {
            await navigator.clipboard.writeText(payload.error);
            markCopied(toast.id);
        } catch (e) {
            console.error('Failed to copy:', e);
        }
    };

    // Extract first line for summary
    const firstLine = payload.error.split('\n')[0].slice(0, 80);

    return (
        <div
            className={`
                flex flex-col gap-2 p-3 rounded-lg border backdrop-blur-sm
                ${style.bg} ${style.border}
                animate-in slide-in-from-right-full duration-300
                max-w-md shadow-2xl
            `}
        >
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className="text-lg">{style.icon}</span>
                    <span className="font-bold text-white text-sm">
                        GPU {payload.category} Error
                    </span>
                </div>
                <button
                    onClick={onDismiss}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                    <X size={14} className="text-gray-400" />
                </button>
            </div>

            {/* Context */}
            <div className="text-xs text-gray-300">
                {payload.context}
            </div>

            {/* Error Preview */}
            <div className="text-xs font-mono bg-black/50 p-2 rounded border border-red-900/30 text-red-300 max-h-20 overflow-y-auto">
                {firstLine}
                {payload.error.includes('\n') && (
                    <span className="text-gray-500">... (click copy for full)</span>
                )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
                <button
                    onClick={copyError}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-white/5 hover:bg-white/10 rounded transition-colors"
                >
                    {toast.copied ? (
                        <>
                            <CheckCircle size={12} className="text-green-400" />
                            <span className="text-green-400">Copied!</span>
                        </>
                    ) : (
                        <>
                            <Copy size={12} className="text-gray-400" />
                            <span className="text-gray-400">Copy Error</span>
                        </>
                    )}
                </button>
                <span className="text-[10px] text-gray-500">
                    {payload.timestamp.toFixed(1)}s
                </span>
            </div>

            {/* Tip */}
            <div className="text-[10px] text-gray-500 italic">
                💡 Your work is safe! Fix the issue and hot reload.
            </div>
        </div>
    );
}

/**
 * The main listener component - add to your root layout
 */
export function GpuDoctorListener() {
    const activeToasts = useGpuToasts();

    // Listen for GPU errors from Tauri
    useEffect(() => {
        let unlisten: (() => void) | null = null;

        (async () => {
            try {
                unlisten = await listen<GpuErrorPayload>('kos-gpu-error', (event) => {
                    addToast(event.payload);

                    // Play error sound (optional)
                    // new Audio('/error.mp3').play().catch(() => {});
                });
                console.log('[GPU Doctor] Listening for GPU errors');
            } catch (e) {
                console.warn('[GPU Doctor] Failed to start listener:', e);
            }
        })();

        return () => {
            if (unlisten) unlisten();
        };
    }, []);

    if (activeToasts.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
            {activeToasts.map(toast => (
                <GpuToastItem
                    key={toast.id}
                    toast={toast}
                    onDismiss={() => dismissToast(toast.id)}
                />
            ))}
        </div>
    );
}

export default GpuDoctorListener;
