import { el, Store } from '../core/components.js';

/**
 * K_OS SYSTEM CONSOLE
 * Captures all browser logs and allows user to interact with the system.
 */
export class SystemConsole {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.store = new Store({
            messages: [],
            filter: 'ALL', // ALL, LOG, WARN, ERROR
            isExpanded: false
        });

        this.interceptLogs();
        this.store.subscribe(() => this.render());

        if (this.container) this.render();
    }

    interceptLogs() {
        const types = ['log', 'warn', 'error', 'info', 'debug'];
        types.forEach(type => {
            const original = console[type];
            console[type] = (...args) => {
                original.apply(console, args);
                this.addMessage(type, args.join(' '));
            };
        });
    }

    addMessage(type, content) {
        const msg = {
            id: Date.now() + Math.random(),
            type,
            content,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        };

        const messages = [...this.store.state.messages, msg].slice(-100); // Keep last 100
        this.store.set({ messages });
    }

    clear() {
        this.store.set({ messages: [] });
    }

    render() {
        if (!this.container) return;
        this.container.innerHTML = '';

        const { messages, filter } = this.store.state;

        // 1. Header
        const header = el('div', 'panel-header flex items-center justify-between', {
            style: { borderBottom: '1px solid var(--kos-border)', padding: '4px 8px' }
        }, [
            el('div', 'flex gap-4 items-center', {}, [
                el('span', 'text-[10px] font-bold tracking-tighter', {}, 'TERMINAL'),
                el('div', 'flex gap-2', {}, ['ALL', 'LOG', 'WARN', 'ERROR'].map(f =>
                    el('button', `text-[9px] px-1 hover:text-white ${filter === f ? 'text-orange-500' : 'text-gray-500'}`, {
                        onclick: () => this.store.set({ filter: f })
                    }, f)
                ))
            ]),
            el('button', 'text-[10px] text-gray-500 hover:text-red-500', { onclick: () => this.clear() }, 'CLEAR')
        ]);

        // 2. Log List
        const list = el('div', 'console-list flex-1 overflow-y-auto custom-scrollbar font-mono text-[10px] p-2 leading-relaxed', {
            style: { display: 'flex', flexDirection: 'column', gap: '2px' }
        });

        const filtered = messages.filter(m => {
            if (filter === 'ALL') return true;
            if (filter === 'LOG') return m.type === 'log' || m.type === 'info';
            return m.type.toUpperCase() === filter;
        });

        filtered.forEach(m => {
            const color = m.type === 'error' ? 'text-red-400' : (m.type === 'warn' ? 'text-yellow-400' : 'text-gray-400');
            const row = el('div', `flex gap-2 p-1 border-l-2 border-transparent hover:bg-white/5`, {
                style: { borderLeftColor: m.type === 'error' ? '#ef4444' : (m.type === 'warn' ? '#f59e0b' : 'transparent') }
            }, [
                el('span', 'text-gray-600 shrink-0', {}, `[${m.time}]`),
                el('span', `${color} break-all`, {}, m.content)
            ]);
            list.appendChild(row);
        });

        // Auto-scroll to bottom
        requestAnimationFrame(() => {
            list.scrollTop = list.scrollHeight;
        });

        this.container.appendChild(header);
        this.container.appendChild(list);
    }
}

// Singleton init helper
export const mount = (container) => {
    new SystemConsole(container.id);
};
