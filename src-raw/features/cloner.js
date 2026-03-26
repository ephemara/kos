import { el, Store } from '../core/components.js';
import { invoke } from '../core/bridge.js';

/**
 * K_OS CLONER (Mograph System)
 * High-performance object instancing.
 */
export class ClonerModule {
    constructor(container) {
        this.container = container;
        this.store = new Store({
            mode: 'LINEAR', // LINEAR, GRID, RADIAL
            count: 5,
            offset: { x: 1, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 }
        });

        this.store.subscribe(state => invoke('update_cloner', state));
        this.render();
    }

    render() {
        if (!this.container) return;
        this.container.innerHTML = '';

        const s = this.store.state;

        const vec3 = (id, label) => el('div', 'flex gap-1 items-center mb-2', {}, [
            el('span', 'text-[9px] w-6 text-gray-600', {}, label),
            ['x', 'y', 'z'].map(axis => el('input', 'flex-1 bg-[#111] text-[#fff] text-[10px] p-1 rounded border border-[#222]', {
                type: 'number', value: s[id][axis], step: 0.1,
                oninput: (e) => this.store.set({ [id]: { ...s[id], [axis]: parseFloat(e.target.value) } })
            }))
        ]);

        const panel = el('div', 'p-4 glass-panel h-full overflow-y-auto', {}, [
            el('h2', 'text-xs font-black tracking-widest mb-6 text-purple-500', {}, 'CLONER OBJECT'),

            el('div', 'mb-4', [
                el('label', 'text-[10px] text-gray-500 block mb-1', {}, 'MODE'),
                el('select', 'w-full bg-[#1a1a1a] text-xs p-1 rounded', {
                    onchange: (e) => this.store.set({ mode: e.target.value })
                }, ['LINEAR', 'GRID', 'RADIAL'].map(m => el('option', '', { selected: m === s.mode }, m)))
            ]),

            el('div', 'mb-4', [
                el('label', 'text-[10px] text-gray-500 block mb-1', {}, 'COUNT'),
                el('input', 'w-full', {
                    type: 'range', min: 1, max: 200, value: s.count,
                    oninput: (e) => this.store.set({ count: parseInt(e.target.value) })
                })
            ]),

            vec3('offset', 'POS'),
            vec3('rotation', 'ROT'),
            vec3('scale', 'SCL'),

            el('button', 'w-full mt-6 py-2 bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 font-bold rounded text-xs', {
                onclick: () => invoke('apply_cloner')
            }, 'BAKE INSTANCES')
        ]);

        this.container.appendChild(panel);
    }
}

export const mount = (container) => new ClonerModule(container);
