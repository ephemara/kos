/**
 * Application message types for IPC communication
 */

export interface AppMessage {
  id: string;
  type: string;
  payload?: any;
  timestamp?: number;
}

export type AppMessageType = 
  | 'command'
  | 'query'
  | 'event'
  | 'response'
  | 'error';

export interface CommandMessage extends AppMessage {
  type: 'command';
  command: string;
  args?: any[];
}

export interface QueryMessage extends AppMessage {
  type: 'query';
  query: string;
  params?: Record<string, any>;
}

export interface EventMessage extends AppMessage {
  type: 'event';
  event: string;
  data?: any;
}

export interface ResponseMessage extends AppMessage {
  type: 'response';
  requestId: string;
  result?: any;
  error?: string;
}

export interface ErrorMessage extends AppMessage {
  type: 'error';
  error: string;
  details?: any;
}
