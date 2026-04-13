/**
 * Log level enumeration for console logging
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

export function logLevelToString(level: LogLevel): string {
  return level.toString();
}

export function stringToLogLevel(str: string): LogLevel {
  switch (str.toLowerCase()) {
    case 'debug':
      return LogLevel.DEBUG;
    case 'info':
      return LogLevel.INFO;
    case 'warn':
      return LogLevel.WARN;
    case 'error':
      return LogLevel.ERROR;
    case 'fatal':
      return LogLevel.FATAL;
    default:
      return LogLevel.INFO;
  }
}

export function logLevelToColor(level: LogLevel): string {
  switch (level) {
    case LogLevel.DEBUG:
      return '#888888';
    case LogLevel.INFO:
      return '#4a9eff';
    case LogLevel.WARN:
      return '#ffaa00';
    case LogLevel.ERROR:
      return '#ff4444';
    case LogLevel.FATAL:
      return '#ff0000';
    default:
      return '#ffffff';
  }
}
