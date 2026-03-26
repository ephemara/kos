import { el, Store } from '../core/components.js';
import { state, subscribe } from '../core/state.js';

/**
 * VANILLA PROPERTIES PANEL
 * Dynamically shows properties of the selected object/tool.
 */
export class PropertiesPanel {
    constructor(containerId) {
        this.container = document.getElementById(containerId);

        // Internal state for property values
        this.store = new Store({
            selectedId: null,
            type: 'none', // 'mesh', 'light', 'brush', 'material'
            props: {}
        });

        // Subscribe to global state selection changes
        subscribe((s) => {
            if (s.selection !== this.store.state.selectedId) {
                this.updateFromGlobal(s);
            }
        });

        this.store.subscribe(() => this.render());

        if (this.container) {
            this.render();
        } else {
            setTimeout(() => {
                this.container = document.getElementById(containerId);
                if (this.container) this.render();
            }, 100);
        }
    }

    updateFromGlobal(globalState) {
        const id = globalState.selection;
        // Mock logic: detect type from ID or global registry
        let type = 'none';
        let props = {};

        if (id === 'SculptMesh') {
            type = 'mesh';
            props = {
                name: 'Main Sculpt',
                position: [0, 0, 0],
                rotation: [0, 0, 0],
                scale: [1, 1, 1],
                material: 'Standard Grey'
            };
        } else if (globalState.activeApp === 'sculpt') {
            type = 'tool';
            props = {
                tool: 'Brush',
                target: 'SculptMesh'
            };
        }

        this.store.set({ selectedId: id, type, props });
    }

    render() {
        if (!this.container) return;
        this.container.innerHTML = '';

        const { type, props } = this.store.state;

        if (type === 'none') {
            this.container.innerHTML = '<div class="p-4 text-xs text-gray-500">No selection</div>';
            return;
        }

        const sections = [];

        // 1. Header
        sections.push(el('div', 'p-3 border-b border-[#333] bg-[#1a1a1a]', {}, [
            el('div', 'text-[10px] text-orange-500 font-bold uppercase', {}, type),
            el('div', 'text-xs font-bold text-white', {}, props.name || 'Selected Object')
        ]));

        // 2. Transform (if mesh)
        if (type === 'mesh') {
            sections.push(this.renderSection('TRANSFORM', [
                this.renderRow('Position', this.renderVector3(props.position)),
                this.renderRow('Rotation', this.renderVector3(props.rotation)),
                this.renderRow('Scale', this.renderVector3(props.scale))
            ]));

            sections.push(this.renderSection('MATERIAL', [
                this.renderRow('Preset', el('select', 'w-full bg-[#111] text-xs p-1 rounded border border-[#333]', {}, [
                    el('option', '', {}, 'Standard Grey'),
                    el('option', '', {}, 'Matcap Gold'),
                    el('option', '', {}, 'Clay Red'),
                    el('option', '', {}, 'Custom .kmat...')
                ]))
            ]));
        }

        // 3. Tool Properties
        if (type === 'tool') {
            sections.push(this.renderSection('SCULPT SETTINGS', [
                this.renderRow('Mode', el('span', 'text-xs text-gray-400', {}, 'High Frequency')),
                this.renderRow('Subdiv', el('span', 'text-xs text-gray-400', {}, 'GPU Loop'))
            ]));
        }

        sections.forEach(s => this.container.appendChild(s));
    }

    renderSection(title, children) {
        return el('div', 'border-b border-[#333]', {}, [
            el('div', 'p-2 text-[9px] text-gray-600 font-bold uppercase', {}, title),
            el('div', 'px-2 pb-3', {}, children)
        ]);
    }

    renderRow(label, control) {
        return el('div', 'flex items-center gap-2 mt-1 mb-2', {}, [
            el('label', 'w-20 text-[10px] text-gray-400', {}, label),
            el('div', 'flex-1', {}, [control])
        ]);
    }

    renderVector3(vec) {
        return el('div', 'flex gap-1', {}, [
            el('input', 'w-full bg-[#111] text-[10px] p-1 rounded border border-[#333] text-red-500', { value: vec[0], type: 'number' }),
            el('input', 'w-full bg-[#111] text-[10px] p-1 rounded border border-[#333] text-green-500', { value: vec[1], type: 'number' }),
            el('input', 'w-full bg-[#111] text-[10px] p-1 rounded border border-[#333] text-blue-500', { value: vec[2], type: 'number' })
        ]);
    }
}
