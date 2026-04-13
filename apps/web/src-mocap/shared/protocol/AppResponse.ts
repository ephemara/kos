/**
 * Application response types for IPC communication
 */

export interface AppResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp?: number;
}

export interface SuccessResponse<T = any> extends AppResponse<T> {
  success: true;
  data: T;
}

export interface ErrorResponse extends AppResponse {
  success: false;
  error: string;
  details?: any;
}

export type AppResponseResult<T = any> = SuccessResponse<T> | ErrorResponse;
