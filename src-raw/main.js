/**
 * K_OS RAW DOG ENTRY POINT
 * Now powered by Golden Layout
 */
import { state, subscribe } from './core/state.js';
import { bus, EVENTS } from './core/events.js';
import { invoke } from './core/bridge.js';

// --- GOLDEN LAYOUT CONFIG ---
const initLayout = () => {
    // Basic Layout Config
    const config = {
        settings: {
            hasHeaders: true,
            constrainDragToContainer: true,
            reorderEnabled: true,
            selectionEnabled: false,
            popoutWholeStack: false,
            showPopoutIcon: false,
            showMaximiseIcon: false,
            showCloseIcon: false
        },
        dimensions: {
            borderWidth: 2,
            headerHeight: 25
        },
        content: [{
            type: 'row',
            content: [
                {
                    type: 'component',
                    componentName: 'Tools',
                    title: 'TOOLS',
                    width: 20,
                    isClosable: false,
                },
                {
                    type: 'component',
                    componentName: 'Viewport',
                    title: 'VIEWPORT',
                    width: 60,
                    isClosable: false,
                },
                {
                    type: 'column',
                    width: 20,
                    content: [
                        {
                            type: 'component',
                            componentName: 'Layers',
                            title: 'SCENE',
                            height: 50,
                            isClosable: false,
                        },
                        {
                            type: 'component',
                            componentName: 'Properties',
                            title: 'PROPERTIES',
                            height: 50,
                            isClosable: false,
                        }
                    ]
                }
            ]
        }]
    };

    // Init
    const layout = new GoldenLayout(config, $('#dock-root'));

    // 1. TOOLS PANEL
    layout.registerComponent('Tools', function (container) {
        container.getElement().html('<div id="active-tool-ui" class="panel-content"></div>');
    });

    // 2. VIEWPORT (Simulated Overlay)
    layout.registerComponent('Viewport', function (container) {
        // Transparent to let canvas show through
        container.getElement().addClass('viewport-container');
        container.getElement().html('<div id="viewport-overlay"></div>');

        container.on('resize', () => {
            const { width, height } = container.getElement()[0].getBoundingClientRect();
            invoke('resize_viewport', { width: Math.round(width), height: Math.round(height) });
            state.viewport = { width, height };
        });
    });

    // 3. LAYERS PANEL (Inject our Vanilla Class)
    layout.registerComponent('Layers', async function (container) {
        container.getElement().html('<div id="scene-tree" class="panel-content h-full"></div>');
        // Lazy load the class
        const { LayersPanel } = await import('./ui/LayersPanel.js');
        new LayersPanel('scene-tree');
    });

    // 4. PROPERTIES (Active Selection)
    layout.registerComponent('Properties', async function (container) {
        container.getElement().html('<div id="props-ui" class="panel-content h-full"></div>');
        const { PropertiesPanel } = await import('./ui/PropertiesPanel.js');
        new PropertiesPanel('props-ui');
    });

    layout.init();

    // Handle Window Resize
    window.addEventListener('resize', () => layout.updateSize());
};

// --- FEATURE LOADER ---
const loadAppFeatures = async () => {
    try {
        // 1. Global UI features (Asset Browser)
        try {
            const { initAssetBrowser } = await import('./ui/AssetBrowser.js');
            const browserRoot = document.getElementById('asset-grid');
            if (browserRoot) initAssetBrowser(browserRoot);
        } catch (e) { console.error('Failed to load AssetBrowser', e); }

        // 2. App Switcher Logic
        const appTabs = [
            { id: 'sculpt', label: 'Sculpt' },
            { id: 'paint', label: 'Paint' },
            { id: 'greeble', label: 'Greeble' },
            { id: 'atlas', label: 'Atlas (UV)' },
            { id: 'autopbr', label: 'AutoPBR' },
            { id: 'graphos', label: 'Graphos' },
            { id: 'quantum', label: 'Quantum' },
        ];

        const tabContainer = document.getElementById('app-switcher');

        if (tabContainer) {
            tabContainer.innerHTML = appTabs.map(tab =>
                `<button class="app-tab ${state.activeApp === tab.id ? 'active' : ''}" data-id="${tab.id}">${tab.label}</button>`
            ).join('');

            // Tab Event Listeners
            tabContainer.querySelectorAll('.app-tab').forEach(btn => {
                btn.onclick = () => {
                    const appId = btn.dataset.id;
                    state.activeApp = appId;

                    // Simple UI Update
                    tabContainer.querySelectorAll('.app-tab').forEach(t => t.classList.remove('active'));
                    btn.classList.add('active');

                    bus.emit(EVENTS.APP_SWITCH, appId);
                };
            });
        }

        // 3. App Mounting (Subscriber)
        subscribe(async (prop, val, oldVal) => {
            if (prop === 'activeApp' && val !== oldVal) {
                console.log(`[App] Switching: ${oldVal} -> ${val}`);

                // A. Unmount Old
                const toolUI = document.getElementById('active-tool-ui');
                if (toolUI) toolUI.innerHTML = ''; // Clear tools

                const viewport = document.getElementById('viewport-overlay');
                if (viewport) {
                    viewport.innerHTML = ''; // Brute force clear

                    // --- DRAG & DROP HANDLING ---
                    viewport.ondragover = (e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'copy';
                    };

                    viewport.ondrop = async (e) => {
                        e.preventDefault();
                        try {
                            const data = JSON.parse(e.dataTransfer.getData('application/json'));
                            console.log('Viewport: Drop Asset', data);

                            // Send to Rust with screen space coords
                            const rect = viewport.getBoundingClientRect();
                            const x = e.clientX - rect.left;
                            const y = e.clientY - rect.top;

                            await invoke('handle_viewport_drop', {
                                assetId: data.id,
                                assetType: data.type,
                                x, y
                            });

                            if (window.toast) window.toast(`LOADED: ${data.name}`, 'success');
                        } catch (err) {
                            console.error('Drop error:', err);
                        }
                    };

                    // Ideally call module.unmount()
                }// Creating a proper module cache would be better, but for now we rely on the module knowing how to clean itself up via DOM checks or we re-import.
                // Re-importing is cheap in ESM once cached.
                // We rely on the module's `mount` to handle everything.
                // Ideally we should call `unmount`. We can store the current module handle.
                if (window.currentModule && window.currentModule.unmount) {
                    window.currentModule.unmount();
                }

                // B. Mount New
                try {
                    const module = await import(`./features/${val}.js`);
                    window.currentModule = module;
                    if (module && module.mount) {
                        await module.mount(viewport);
                    }
                } catch (e) {
                    console.warn(`Feature ${val} not implemented or failed to load`, e);
                    if (viewport) viewport.innerHTML = `<div style="color:red; padding:20px;">Feature '${val}' Missing</div>`;
                }
            }
        });

        // 4. Initial Trigger
        bus.emit(EVENTS.APP_SWITCH, state.activeApp);
        // Force state update to trigger subscriber if needed, or manally call logic
        // Just mocking a switch to ensure load
        if (state.activeApp) {
            const module = await import(`./features/${state.activeApp}.js`);
            window.currentModule = module;
            if (module && module.mount) {
                await module.mount(document.getElementById('viewport-overlay'));
            }
        }

    } catch (e) {
        console.error("Failed to load features:", e);
    }
};

// --- INIT ---
const init = async () => {
    console.log('☢️ K_OS RAW DOG: INIT SEQUENCE STARTED');
    console.log('Location:', window.location.href);

    // 1. Rust Handshake
    try {
        const appInfo = await invoke('get_engine_status');
        console.log('Rust Backend Connected:', appInfo);
    } catch (e) {
        console.error('Rust Handshake Failed:', e);
    }

    // 2. Initialize Golden Layout
    initLayout();

    // 3. Load UI Features (Wait for layout to be ready)
    // GL takes a microtask to settle?
    setTimeout(async () => {
        await loadAppFeatures();

        // 4. Global Hotkeys
        window.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.code === 'Space') {
                e.preventDefault();
                const browser = document.getElementById('k-content-browser');
                if (browser) browser.classList.toggle('hidden');
            }
        });

        console.log('✅ K_OS RAW DOG: READY');
        const statusMsg = document.getElementById('status-msg');
        if (statusMsg) statusMsg.textContent = 'K_OS READY | MODE: RAW | GOLDEN LAYOUT: ACTIVE';
    }, 100);
};

// Boot
window.addEventListener('DOMContentLoaded', init);
