/**
 * K_OS GLOBAL STATE (Valtio-style Proxy)
 * 
 * Replace React useState/Context with a single reactive store.
 * Components subscribe to changes automatically (or manually).
 */
import { bus, EVENTS } from './events.js';

// The Single Source of Truth
const initialState = {
    activeApp: 'sculpt',
    activeTool: 'clay_buildup',

    viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        cameraMode: 'orbit'
    },

    brush: {
        radius: 0.5,
        strength: 0.8,
        falloff: 0.2,
        color: '#ffffff'
    },

    scene: {
        activeLayer: null,
        layers: [], // Stores { id, name, visible }
        objects: {}, // Map kId -> Object
    },

    ui: {
        leftPanelWidth: 300,
        rightPanelWidth: 300,
        showAssetBrowser: false
    }
};

// Create a Proxy to detect mutations
const createStore = (obj) => {
    const subscribers = new Set();

    const handler = {
        set(target, prop, value) {
            const oldValue = target[prop];
            if (oldValue === value) return true;

            target[prop] = value;

            // Notify generic listeners
            subscribers.forEach(cb => cb(prop, value, oldValue));

            // Emit event for major changes
            if (prop === 'activeApp') bus.emit(EVENTS.APP_SWITCH, value);

            return true;
        },

        // Recursive proxy for nested objects
        get(target, prop) {
            const value = target[prop];
            if (typeof value === 'object' && value !== null) {
                return new Proxy(value, handler);
            }
            return value;
        }
    };

    const store = new Proxy(obj, handler);

    return {
        state: store,
        subscribe: (cb) => subscribers.add(cb),
        unsubscribe: (cb) => subscribers.delete(cb)
    };
};

export const { state, subscribe } = createStore(initialState);

// Debug: Expose to window for console hacking
window.kState = state;
