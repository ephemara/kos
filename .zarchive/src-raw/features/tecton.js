import { el, Store } from '../core/components.js';
import { invoke } from '../core/bridge.js';

/**
 * K_OS TECTON (World Builder)
 * Procedural terrain and erosion simulation.
 */
export class TectonModule {
    constructor(container) {
        this.container = container;
        this.store = new Store({
            resolution: 1024,
            scale: 50.0,
            octaves: 6,
            erosionSteps: 250,
            seed: 42
        });

        this.store.subscribe(state => invoke('update_tecton', state));
        this.render();
    }

    render() {
        if (!this.container) return;
        this.container.innerHTML = '';

        const s = this.store.state;

        const slider = (id, label, min, max, step) => el('div', 'mb-4', [
            el('div', 'flex justify-between text-[10px] text-gray-500 mb-1', {}, [
                el('span', '', {}, label),
                el('span', 'text-gray-300', {}, s[id])
            ]),
            el('input', 'w-full accent-emerald-500', {
                type: 'range', min, max, step, value: s[id],
                oninput: (e) => this.store.set({ [id]: parseFloat(e.target.value) })
            })
        ]);

        const panel = el('div', 'p-4 glass-panel h-full overflow-y-auto', {}, [
            el('h2', 'text-xs font-black tracking-widest mb-6 text-emerald-500', {}, 'TECTON TERRAIN'),

            el('div', 'mb-4', [
                el('label', 'text-[10px] text-gray-500 block mb-1', {}, 'RESOLUTION'),
                el('select', 'w-full bg-[#1a1a1a] text-xs p-1 rounded', {
                    onchange: (e) => this.store.set({ resolution: parseInt(e.target.value) })
                }, [512, 1024, 2048, 4096].map(res => el('option', '', { selected: res === s.resolution }, `${res} x ${res}`)))
            ]),

            slider('scale', 'Noise Scale', 1, 200, 1),
            slider('octaves', 'Detail Level (Octaves)', 1, 10, 1),
            slider('erosionSteps', 'Hydraulic Erosion Steps', 0, 1000, 10),

            el('button', 'w-full mt-6 py-2 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 font-bold rounded text-xs', {
                onclick: () => invoke('generate_terrain')
            }, 'GENERATE NEW WORLD')
        ]);

        this.container.appendChild(panel);
    }
}

export const mount = (container) => new TectonModule(container);
