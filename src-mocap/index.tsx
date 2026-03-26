import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { UnifiedPassthroughProvider } from '@mocap/input/UnifiedPassthrough';
import { ErrorBoundary } from '@mocap/error/ErrorBoundary';
import { ToastProvider, GpuDoctorListener } from '@mocap/notifications';
import { ConsolePanel } from '@mocap/shared/dev-tools';
import { startLogListener } from '@mocap/shared/state/consoleStore';
import { startKosPolling } from '@mocap/shared/protocol/store';

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
          <App />
          <ConsolePanel />
        </ToastProvider>
      </ErrorBoundary>
    </UnifiedPassthroughProvider>
  </React.StrictMode>
);
