import { el, Store } from '../core/components.js';
import { invoke } from '../core/bridge.js';

/**
 * K_OS SCATTER (Surface Placement)
 * Realistic object distribution on geometry.
 */
export class ScatterModule {
    constructor(container) {
        this.container = container;
        this.store = new Store({
            density: 0.5,
            randomSeed: 1234,
            collisionAvoidance: true,
            minScale: 0.8,
            maxScale: 1.2,
            normalAlignment: 1.0
        });

        this.store.subscribe(state => invoke('update_scatter', state));
        this.render();
    }

    render() {
        if (!this.container) return;
        this.container.innerHTML = '';

        const s = this.store.state;

        const sliders = [
            { id: 'density', label: 'Density', min: 0, max: 10, step: 0.1 },
            { id: 'minScale', label: 'Min Scale', min: 0.1, max: 2, step: 0.05 },
            { id: 'maxScale', label: 'Max Scale', min: 0.1, max: 5, step: 0.05 },
            { id: 'normalAlignment', label: 'Normal Align', min: 0, max: 1, step: 0.1 }
        ];

        const panel = el('div', 'p-4 glass-panel h-full overflow-y-auto', {}, [
            el('h2', 'text-xs font-black tracking-widest mb-6 text-green-500', {}, 'SCATTER / FOLIAGE'),

            sliders.map(cfg => el('div', 'mb-4', [
                el('label', 'text-[10px] text-gray-500 block mb-1', {}, cfg.label),
                el('input', 'w-full accent-green-500', {
                    type: 'range', min: cfg.min, max: cfg.max, step: cfg.step, value: s[cfg.id],
                    oninput: (e) => this.store.set({ [cfg.id]: parseFloat(e.target.value) })
                })
            ])),

            el('div', 'mb-4 flex items-center justify-between', {}, [
                el('label', 'text-[10px] text-gray-500', {}, 'COLLISION AVOIDANCE'),
                el('input', '', {
                    type: 'checkbox', checked: s.collisionAvoidance,
                    onchange: (e) => this.store.set({ collisionAvoidance: e.target.checked })
                })
            ]),

            el('button', 'w-full mt-6 py-2 bg-green-600/20 hover:bg-green-600/40 text-green-400 font-bold rounded text-xs', {
                onclick: () => invoke('generate_scatter')
            }, 'SCATTER ON SELECTION')
        ]);

        this.container.appendChild(panel);
    }
}

export const mount = (container) => new ScatterModule(container);
