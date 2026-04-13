import './styles/global.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { UnifiedPassthroughProvider } from '@/systems/input/UnifiedPassthrough';
import { ErrorBoundary } from '@/systems/error/ErrorBoundary';
import { ToastProvider } from '@/systems/notifications/ToastProvider';
import { GpuDoctorListener } from '@/features/notifications/GpuDoctorListener';
import { EvalBridgeListener } from '@/features/notifications/EvalBridgeListener';
import { ConsolePanel } from '@/features/console/ConsolePanel';
import { startLogListener } from '@/lib/kos-proto/consoleStore';
import { startKosPolling } from '@/lib/kos-proto/store';
import { bootThemeEngine } from '@/systems/ui-engine/extensionRegistry';
import { loadFontState, applyFontState } from '@/systems/ui-engine/fontSystem';

// ── Boot UI engine before first paint ── no flash of un-themed content
bootThemeEngine();
applyFontState(loadFontState());

const isTauri = typeof (window as any).__TAURI__ !== 'undefined';
if (isTauri) {
  startLogListener();
  startKosPolling(100);
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <UnifiedPassthroughProvider>
      <ErrorBoundary>
        <ToastProvider>
          <GpuDoctorListener />
          <EvalBridgeListener />
          <App />
          <ConsolePanel />
        </ToastProvider>
      </ErrorBoundary>
    </UnifiedPassthroughProvider>
  </React.StrictMode>
);
