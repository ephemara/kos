/**
 * Notifications System
 * 
 * Toast notifications, GPU error handling, and alerts.
 */

export { ToastProvider } from './ToastProvider';
export type { ToastProviderProps } from './ToastProvider';

export { GpuDoctorListener } from './GpuDoctorListener';

// Re-export sonner's toast function for convenience
export { toast } from 'sonner';
