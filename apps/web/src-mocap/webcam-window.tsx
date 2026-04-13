/**
 * Webcam Window Entry Point
 * 
 * Separate Tauri window for webcam preview.
 * Displays backend-owned camera stream to avoid "device in use" errors.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { WebcamWindowApp } from './features/webcam/WebcamWindowApp';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WebcamWindowApp />
  </React.StrictMode>
);
