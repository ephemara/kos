/**
 * Log entry type for console logging
 */

import { LogLevel } from './LogLevel';

export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: number;
  source?: string;
  target?: string;
  frame?: number;
  data?: any;
}

export function createLogEntry(
  level: LogLevel,
  message: string,
  source?: string,
  data?: any
): LogEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    level,
    message,
    timestamp: Date.now(),
    source,
    data
  };
}
