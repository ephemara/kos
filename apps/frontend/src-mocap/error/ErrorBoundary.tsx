/**
 * ErrorBoundary.tsx - Global Error Recovery System
 * 
 * Catches React errors and provides recovery UI instead of white screen of death.
 * Logs errors to console and optionally to telemetry.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { useInteractiveZone } from '@mocap/input/InteractiveZoneContext';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
    showDetails: boolean;
    copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            showDetails: false,
            copied: false,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        this.setState({ errorInfo });
        
        // Log to console
        console.error('[ErrorBoundary] Caught error:', error);
        console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
        
        // Call optional error handler (for telemetry, etc.)
        this.props.onError?.(error, errorInfo);
    }

    handleReload = () => {
        window.location.reload();
    };

    handleRecover = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
            showDetails: false,
        });
    };

    handleCopyError = async () => {
        const { error, errorInfo } = this.state;
        const errorText = `
K_OS Error Report
=================
Error: ${error?.message}
Stack: ${error?.stack}

Component Stack:
${errorInfo?.componentStack}

Timestamp: ${new Date().toISOString()}
User Agent: ${navigator.userAgent}
        `.trim();

        try {
            await navigator.clipboard.writeText(errorText);
            this.setState({ copied: true });
            setTimeout(() => this.setState({ copied: false }), 2000);
        } catch (err) {
            console.error('Failed to copy error:', err);
        }
    };

    toggleDetails = () => {
        this.setState(prev => ({ showDetails: !prev.showDetails }));
    };

    render() {
        const { hasError, error, errorInfo, showDetails, copied } = this.state;
        const { children, fallback } = this.props;

        if (hasError) {
            if (fallback) {
                return fallback;
            }

            return (
                <ErrorModalWrapper>
                    <div className="max-w-2xl w-full bg-zinc-900 rounded-xl border border-red-500/30 overflow-hidden">
                        {/* Header */}
                        <div className="bg-red-500/10 border-b border-red-500/20 p-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                                    <AlertTriangle className="w-6 h-6 text-red-400" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-white">Something went wrong</h1>
                                    <p className="text-zinc-400 text-sm mt-1">
                                        K_OS encountered an error but your work is safe
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Error Message */}
                        <div className="p-6 space-y-4">
                            <div className="bg-zinc-800/50 rounded-lg p-4 font-mono text-sm text-red-300 break-all">
                                {error?.message || 'Unknown error'}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    onClick={this.handleRecover}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Try to Recover
                                </button>
                                <button
                                    onClick={this.handleReload}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-medium transition-colors"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Reload App
                                </button>
                            </div>

                            {/* Details Toggle */}
                            <button
                                onClick={this.toggleDetails}
                                className="w-full flex items-center justify-between px-4 py-2 text-zinc-400 hover:text-zinc-300 text-sm transition-colors"
                            >
                                <span>Technical Details</span>
                                {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>

                            {/* Stack Trace */}
                            {showDetails && (
                                <div className="space-y-3">
                                    <div className="bg-zinc-950 rounded-lg p-4 max-h-48 overflow-auto">
                                        <pre className="text-xs text-zinc-500 whitespace-pre-wrap font-mono">
                                            {error?.stack}
                                        </pre>
                                    </div>
                                    
                                    {errorInfo?.componentStack && (
                                        <div className="bg-zinc-950 rounded-lg p-4 max-h-32 overflow-auto">
                                            <p className="text-xs text-zinc-600 mb-2">Component Stack:</p>
                                            <pre className="text-xs text-zinc-500 whitespace-pre-wrap font-mono">
                                                {errorInfo.componentStack}
                                            </pre>
                                        </div>
                                    )}

                                    <button
                                        onClick={this.handleCopyError}
                                        className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
                                    >
                                        <Copy className="w-3 h-3" />
                                        {copied ? 'Copied!' : 'Copy Error Report'}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="bg-zinc-800/30 border-t border-zinc-800 px-6 py-3">
                            <p className="text-xs text-zinc-500 text-center">
                                Your sculpts and assets are saved automatically. No data was lost.
                            </p>
                        </div>
                    </div>
                </ErrorModalWrapper>
            );
        }

        return children;
    }
}

/**
 * Wrapper component that registers the error modal as an interactive zone
 * This ensures the modal captures input instead of passing to Bevy
 */
function ErrorModalWrapper({ children }: { children: ReactNode }) {
    // Priority 1000 = highest, always captures input over everything
    const modalRef = useInteractiveZone('error-boundary-modal', { priority: 1000 });
    
    return (
        <div 
            ref={modalRef} 
            className="fixed inset-0 bg-black/95 flex items-center justify-center p-8 z-[9999]"
        >
            {children}
        </div>
    );
}

/**
 * Hook to programmatically trigger error boundary
 */
export function useErrorHandler() {
    const [, setError] = React.useState<Error | null>(null);
    
    return React.useCallback((error: Error) => {
        setError(() => {
            throw error;
        });
    }, []);
}

export default ErrorBoundary;
