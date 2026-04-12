/**
 * Event Bus
 * 
 * Simple event bus for cross-component communication without prop drilling.
 * Use sparingly - prefer React context or state management for most cases.
 */

type EventCallback = (...args: any[]) => void;

class EventBus {
    private events: Map<string, Set<EventCallback>> = new Map();

    /**
     * Subscribe to an event
     */
    on(event: string, callback: EventCallback): () => void {
        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }
        this.events.get(event)!.add(callback);

        // Return unsubscribe function
        return () => this.off(event, callback);
    }

    /**
     * Unsubscribe from an event
     */
    off(event: string, callback: EventCallback): void {
        const callbacks = this.events.get(event);
        if (callbacks) {
            callbacks.delete(callback);
            if (callbacks.size === 0) {
                this.events.delete(event);
            }
        }
    }

    /**
     * Emit an event
     */
    emit(event: string, ...args: any[]): void {
        const callbacks = this.events.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    console.error(`Error in event handler for "${event}":`, error);
                }
            });
        }
    }

    /**
     * Subscribe to an event once
     */
    once(event: string, callback: EventCallback): () => void {
        const wrappedCallback = (...args: any[]) => {
            callback(...args);
            this.off(event, wrappedCallback);
        };
        return this.on(event, wrappedCallback);
    }

    /**
     * Clear all listeners for an event
     */
    clear(event?: string): void {
        if (event) {
            this.events.delete(event);
        } else {
            this.events.clear();
        }
    }

    /**
     * Get number of listeners for an event
     */
    listenerCount(event: string): number {
        return this.events.get(event)?.size ?? 0;
    }
}

// Export singleton instance
export const eventBus = new EventBus();

// Export class for testing
export { EventBus };

/**
 * Example usage:
 * 
 * // Subscribe to event
 * const unsubscribe = eventBus.on('mesh:updated', (meshId) => {
 *     console.log('Mesh updated:', meshId);
 * });
 * 
 * // Emit event
 * eventBus.emit('mesh:updated', 'mesh-123');
 * 
 * // Unsubscribe
 * unsubscribe();
 * 
 * // Subscribe once
 * eventBus.once('app:ready', () => {
 *     console.log('App is ready!');
 * });
 */
