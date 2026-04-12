/**
 * Base Service Class
 * 
 * Base class for all service clients that interact with the Tauri backend.
 * Provides common functionality for error handling, logging, and type safety.
 */

import { invoke } from '@tauri-apps/api/core';

export abstract class BaseService {
    protected serviceName: string;

    constructor(serviceName: string) {
        this.serviceName = serviceName;
    }

    /**
     * Invoke a Tauri command with type safety and error handling
     */
    protected async invoke<T = void>(command: string, args?: Record<string, any>): Promise<T> {
        try {
            const result = await invoke<T>(command, args);
            return result;
        } catch (error) {
            this.handleError(error, command);
            throw error;
        }
    }

    /**
     * Handle errors with context
     */
    protected handleError(error: unknown, context: string): void {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[${this.serviceName}] Error in ${context}:`, errorMessage);
    }

    /**
     * Log debug information
     */
    protected log(message: string, ...args: any[]): void {
        if (process.env.NODE_ENV === 'development') {
            console.log(`[${this.serviceName}]`, message, ...args);
        }
    }

    /**
     * Log warnings
     */
    protected warn(message: string, ...args: any[]): void {
        console.warn(`[${this.serviceName}]`, message, ...args);
    }
}

/**
 * Example usage:
 * 
 * export class SculptService extends BaseService {
 *     constructor() {
 *         super('SculptService');
 *     }
 * 
 *     async stroke(handle: number, points: Float32Array): Promise<void> {
 *         return await this.invoke('app_sculpt_stroke', {
 *             handle,
 *             points: Array.from(points)
 *         });
 *     }
 * }
 * 
 * export const sculptService = new SculptService();
 */
