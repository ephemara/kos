/**
 * K_OS CORE BRIDGE
 * Wraps window.__TAURI__ for type-safe-ish invocations.
 * Mocks calls in browser mode for easier debugging.
 */

// Detect if we are in Tauri
const isTauri = !!(window.__TAURI__);

/**
 * Send a specific KosMessage to the backend.
 * Uses the GOD COMMAND 'kos_send'.
 * 
 * @param {string} type - The Enum variant name (e.g. "Subdivide", "SetActiveTool")
 * @param {object|null} payload - The data for the variant (or null if unit variant)
 */
export const send = async (type, payload = null) => {
    // Construct the Enum object Rust expects: { "VariantName": payload }
    const msg = { [type]: payload };
    return invoke('kos_send', { msg });
};

// The core invoke function
export const invoke = async (cmd, args = {}) => {
    if (isTauri) {
        try {
            const { invoke } = window.__TAURI__.core;
            // Performance mark
            /* performance.mark(`req-${cmd}`); */
            const result = await invoke(cmd, args);
            /* performance.measure(`invoke-${cmd}`, `req-${cmd}`); */
            return result;
        } catch (err) {
            console.error(`[Bridage] Error invoking '${cmd}':`, err);
            // Optional: Toast error
            // events.emit('error', err);
            return null;
        }
    } else {
        // MOCK MODE (Browser Dev)
        console.log(`[Bridge-Mock] invoke('${cmd}',`, args, `)`);
        return await mockResponse(cmd, args);
    }
};




// Listen for backend events (e.g. 'download-progress')
export const listen = async (event, callback) => {
    if (isTauri) {
        const { listen } = window.__TAURI__.event;
        return await listen(event, callback);
    } else {
        console.log(`[Bridge-Mock] Listening for '${event}'`);
        return () => { }; // Unlisten placeholder
    }
};

// --- MOCK RESPONSES ---
const mockResponse = async (cmd, args) => {
    // Simulate network delay
    /* await new Promise(r => setTimeout(r, 50)); */

    switch (cmd) {
        case 'get_engine_status':
            return { version: '0.8.0-RAW', mode: 'DEBUG' };
        case 'get_assets':
            return [
                { id: '1', name: 'Hero_Mesh.glb', type: 'MESH', size: 102400 },
                { id: '2', name: 'Clay_Mat.json', type: 'MAT', size: 4096 },
            ];
        default:
            return {};
    }
};


