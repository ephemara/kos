import { el, Store } from '../core/components.js';
import { invoke } from '../core/bridge.js';

/**
 * K_OS INSPECT (Render Settings)
 * Controls viewport visual quality, post-processing, and environment.
 */
export class InspectModule {
    constructor(container) {
        this.container = container;
        this.store = new Store({
            exposure: 1.0,
            gamma: 2.2,
            bloom: 0.5,
            ao: true,
            environment: 'neutral',
            tonemapping: 'ACES'
        });

        this.store.subscribe(state => this.updateBackend(state));
        this.render();
    }

    updateBackend(state) {
        // Sync with Rust backend
        invoke('update_render_settings', state);
    }

    render() {
        if (!this.container) return;
        this.container.innerHTML = '';

        const s = this.store.state;

        const controlGroup = (label, child) => el('div', 'control-group mb-4', {}, [
            el('label', 'text-[10px] text-gray-500 uppercase font-bold mb-1 block', {}, label),
            child
        ]);

        const slider = (id, val, min, max, step) => el('div', 'flex items-center gap-2', {}, [
            el('input', 'flex-1 accent-orange-500', {
                type: 'range', min, max, step, value: val,
                oninput: (e) => this.store.set({ [id]: parseFloat(e.target.value) })
            }),
            el('span', 'text-[10px] font-mono text-gray-400 w-8 text-right', {}, val.toFixed(2))
        ]);

        const select = (id, options, current) => el('select', 'w-full bg-[#1a1a1a] text-xs text-white p-1 rounded border border-[#333]', {
            onchange: (e) => this.store.set({ [id]: e.target.value })
        }, options.map(opt => el('option', '', { value: opt, selected: opt === current }, opt)));

        const checkbox = (id, checked) => el('label', 'flex items-center gap-2 cursor-pointer', {}, [
            el('input', '', {
                type: 'checkbox', checked,
                onchange: (e) => this.store.set({ [id]: e.target.checked })
            }),
            el('span', 'text-[10px] text-gray-300', {}, 'ENABLED')
        ]);

        const panel = el('div', 'p-4 glass-panel h-full overflow-y-auto custom-scrollbar', {}, [
            el('h2', 'text-xs font-black tracking-widest mb-6 border-b border-orange-500/30 pb-2 text-orange-500', {}, 'RENDER SETTINGS'),

            controlGroup('Exposure', slider('exposure', s.exposure, 0, 5, 0.01)),
            controlGroup('Gamma', slider('gamma', s.gamma, 1, 3, 0.01)),
            controlGroup('Bloom Strength', slider('bloom', s.bloom, 0, 2, 0.01)),

            controlGroup('Ambient Occlusion', checkbox('ao', s.ao)),

            controlGroup('Environment Map', select('environment', ['neutral', 'studio', 'sunny', 'forest'], s.environment)),
            controlGroup('Tonemapping', select('tonemapping', ['Linear', 'Reinhard', 'ACES', 'Uncharted2'], s.tonemapping)),

            el('div', 'mt-10 pt-4 border-t border-white/5', {}, [
                el('button', 'w-full py-2 bg-white/5 hover:bg-white/10 text-[10px] font-bold rounded transition-colors', {
                    onclick: () => invoke('take_screenshot')
                }, 'TAKE HIGH-RES SCREENSHOT')
            ])
        ]);

        this.container.appendChild(panel);
    }
}

export const mount = (container) => {
    new InspectModule(container);
};

export const unmount = (container) => {
    if (container) container.innerHTML = '';
};
