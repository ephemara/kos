/**
 * Error Boundary Component
 * 
 * Catches React errors and displays a user-friendly error message.
 * Prevents the entire app from crashing when a component fails.
 */

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@mocap/shared/primitives/Button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="flex items-center justify-center min-h-screen bg-zinc-950 p-8">
          <div className="max-w-2xl w-full">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8">
              {/* Error Icon */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-100">Something went wrong</h2>
                  <p className="text-sm text-gray-400 mt-1">
                    An unexpected error occurred in the application
                  </p>
                </div>
              </div>

              {/* Error Details */}
              {this.state.error && (
                <div className="mb-6">
                  <div className="bg-zinc-950 border border-zinc-800 rounded-md p-4">
                    <div className="text-xs font-mono text-red-400 mb-2">
                      {this.state.error.name}: {this.state.error.message}
                    </div>
                    {this.state.error.stack && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
                          Stack trace
                        </summary>
                        <pre className="text-xs text-gray-600 mt-2 overflow-x-auto">
                          {this.state.error.stack}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button onClick={this.handleReset} className="flex-1">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => window.location.reload()}
                  className="flex-1"
                >
                  Reload Page
                </Button>
              </div>

              {/* Help Text */}
              <div className="mt-6 text-xs text-gray-500">
                <p>If this error persists:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Try reloading the page</li>
                  <li>Clear your browser cache</li>
                  <li>Check the browser console for more details</li>
                  <li>Report the issue with the error details above</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook-based error boundary wrapper
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary fallback={fallback} onError={onError}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
