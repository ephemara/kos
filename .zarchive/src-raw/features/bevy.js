import { el, Store } from '../core/components.js';
import { invoke } from '../core/bridge.js';

/**
 * K_OS BEVY INTEGRATION
 * Allows inspecting the Bevy ECS and Engine stats.
 */
export class BevyModule {
    constructor(container) {
        this.container = container;
        this.store = new Store({
            entityCount: 0,
            frameTime: 0,
            fps: 0,
            activeSystems: []
        });

        this.render();
        this.pollInterval = setInterval(() => this.pollStats(), 1000);
    }

    async pollStats() {
        const stats = await invoke('get_bevy_stats');
        if (stats) this.store.set(stats);
    }

    destroy() {
        clearInterval(this.pollInterval);
    }

    render() {
        if (!this.container) return;
        this.container.innerHTML = '';

        const s = this.store.state;

        const statRow = (label, value) => el('div', 'flex justify-between p-2 border-b border-white/5', {}, [
            el('span', 'text-gray-500 text-[10px]', {}, label),
            el('span', 'text-orange-400 font-mono text-[10px]', {}, value)
        ]);

        const panel = el('div', 'p-4 glass-panel h-full overflow-y-auto', {}, [
            el('h2', 'text-xs font-black mb-4 tracking-widest text-blue-400', {}, 'BEVY ENGINE ROOT'),

            statRow('FPS', s.fps || '--'),
            statRow('Frame Time', `${(s.frameTime || 0).toFixed(2)}ms`),
            statRow('Total Entities', s.entityCount || 0),

            el('h3', 'text-[10px] font-bold mt-6 mb-2 text-gray-400', {}, 'ACTIVE SYSTEMS'),
            el('div', 'bg-black/50 p-2 rounded max-height-[200px] overflow-y-auto font-mono text-[9px]', {},
                s.activeSystems.length > 0 ? s.activeSystems.map(sys => el('div', 'text-green-500', {}, `+ ${sys}`)) : el('div', 'text-gray-600', {}, 'Idle')
            ),

            el('div', 'mt-10', [
                el('button', 'w-full py-2 border border-blue-500/30 hover:bg-blue-500/10 text-blue-400 text-[10px] rounded', {
                    onclick: () => invoke('bevy_reboot')
                }, 'RELOAD BEVY RUNTIME')
            ])
        ]);

        this.container.appendChild(panel);

        this.store.subscribe(() => this.render());
    }
}

let instance = null;

export const mount = (container) => {
    instance = new BevyModule(container);
};

export const unmount = () => {
    if (instance) {
        instance.destroy();
        instance = null;
    }
};
