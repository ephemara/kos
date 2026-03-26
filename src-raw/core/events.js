/**
 * K_OS EVENT BUS
 * A lightweight Pub/Sub system (since we ditched React Context).
 * Everything is global. No prop drilling.
 */

class EventBus {
    constructor() {
        this.events = {};
    }

    // Subscribe
    on(event, callback) {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(callback);
        // Return unsubscribe function
        return () => this.off(event, callback);
    }

    // Subscribe Once
    once(event, callback) {
        const wrapper = (...args) => {
            callback(...args);
            this.off(event, wrapper);
        };
        this.on(event, wrapper);
    }

    // Unsubscribe
    off(event, callback) {
        if (!this.events[event]) return;
        this.events[event] = this.events[event].filter(cb => cb !== callback);
    }

    // Publish
    emit(event, data) {
        if (!this.events[event]) return;
        this.events[event].forEach(cb => cb(data));
    }
}

// Global Singleton instance
export const bus = new EventBus();

// EVENT CONSTANTS (Typesafe-ish)
export const EVENTS = {
    APP_INIT: 'app:init',
    APP_SWITCH: 'app:switch',

    TOOL_CHANGE: 'tool:change',
    BRUSH_UPDATE: 'brush:update',

    LAYER_SELECT: 'layer:select',
    LAYER_VISIBILITY: 'layer:visibility',

    ASSET_DROP: 'asset:drop',
    ASSET_LOAD: 'asset:load',

    VIEWPORT_RESIZE: 'viewport:resize',
};
