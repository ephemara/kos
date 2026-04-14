import { el, Store } from '../core/components.js';

/**
 * VANILLA LAYERS PANEL
 * Replaces UniversalLayerPanel.tsx
 * Supports: Drag & Drop, Visibility, Locking, Selection, Search
 */
export class LayersPanel {
    constructor(containerId) {
        this.container = document.getElementById(containerId);

        // Mock State (In real app, sync with core/state.js)
        this.store = new Store({
            layers: [
                { id: 'l1', name: 'Base Mesh', visible: true, locked: false, active: true },
                { id: 'l2', name: 'Detail Sculpt', visible: true, locked: false, active: false },
                { id: 'l3', name: 'Reference', visible: false, locked: true, active: false },
                { id: 'l4', name: 'Decals', visible: true, locked: false, active: false }
            ],
            searchQuery: '',
            draggingId: null
        });

        this.store.subscribe(() => this.render());

        // Ensure container is ready or retry
        if (this.container) {
            this.render();
        } else {
            console.warn(`LayersPanel container #${containerId} not found, waiting...`);
            setTimeout(() => {
                this.container = document.getElementById(containerId);
                if (this.container) this.render();
            }, 100);
        }
    }

    // --- ACTIONS ---

    toggleVisibility(id) {
        const layers = this.store.state.layers.map(l =>
            l.id === id ? { ...l, visible: !l.visible } : l
        );
        this.store.set({ layers });
    }

    toggleLock(id) {
        const layers = this.store.state.layers.map(l =>
            l.id === id ? { ...l, locked: !l.locked } : l
        );
        this.store.set({ layers });
    }

    selectLayer(id) {
        const layers = this.store.state.layers.map(l =>
            l.id === id ? { ...l, active: true } : { ...l, active: false }
        );
        this.store.set({ layers });
    }

    addLayer() {
        const newLayer = {
            id: `l${Date.now()}`,
            name: `Layer ${this.store.state.layers.length + 1}`,
            visible: true,
            locked: false,
            active: true
        };
        const layers = this.store.state.layers.map(l => ({ ...l, active: false }));
        this.store.set({ layers: [newLayer, ...layers] });
    }

    deleteActive() {
        const layers = this.store.state.layers.filter(l => !l.active);
        if (layers.length > 0) layers[0].active = true;
        this.store.set({ layers });
    }

    // --- DRAG AND DROP ---

    handleDragStart(e, id) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
        this.store.set({ draggingId: id });

        // Add ghost class to row
        e.target.classList.add('dragging');
    }

    handleDragOver(e, targetId) {
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = 'move';

        const row = e.currentTarget;
        const rect = row.getBoundingClientRect();
        const offset = e.clientY - rect.top;

        // Visual indicator logic (top or bottom half)
        row.classList.remove('drop-top', 'drop-bottom');
        if (offset < rect.height / 2) {
            row.classList.add('drop-top');
        } else {
            row.classList.add('drop-bottom');
        }
    }

    handleDragLeave(e) {
        e.currentTarget.classList.remove('drop-top', 'drop-bottom');
    }

    handleDrop(e, targetId) {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('text/plain');
        e.currentTarget.classList.remove('drop-top', 'drop-bottom', 'dragging');
        this.store.set({ draggingId: null });

        if (draggedId === targetId) return;

        // Reorder Logic
        const { layers } = this.store.state;
        const fromIndex = layers.findIndex(l => l.id === draggedId);
        const toIndex = layers.findIndex(l => l.id === targetId);

        if (fromIndex < 0 || toIndex < 0) return;

        const newLayers = [...layers];
        const [movedItem] = newLayers.splice(fromIndex, 1);

        // Calculate insert position based on drop zone (top/bottom)
        // For simplicity, just swap for now or insert before
        // A robust solution uses the rect calculation from dragover
        // Here we just insert at the target index
        newLayers.splice(toIndex, 0, movedItem);

        this.store.set({ layers: newLayers });
    }

    // --- RENDERING ---

    render() {
        if (!this.container) return;
        this.container.innerHTML = '';

        const { layers, searchQuery } = this.store.state;

        // 1. Header
        const header = el('div', 'panel-header flex items-center justify-between', {}, [
            el('span', '', {}, `LAYERS (${layers.length})`),
            el('div', 'flex gap-1', {}, [
                el('button', 'btn-icon', { onclick: () => this.addLayer(), title: 'Add Layer' }, '+'),
                el('button', 'btn-icon', { onclick: () => this.deleteActive(), title: 'Delete Active' }, '×')
            ])
        ]);

        // 2. Search
        const search = el('div', 'p-2 border-b border-[#333]', {}, [
            el('input', 'w-full bg-[#111] text-xs p-1 rounded border border-[#333] text-gray-300 focus:border-orange-500 outline-none', {
                placeholder: 'Filter layers...',
                value: searchQuery,
                oninput: (e) => this.store.set({ searchQuery: e.target.value })
            })
        ]);

        // 3. List
        const list = el('div', 'layer-list panel-content custom-scrollbar', {}, []);

        layers.forEach(layer => {
            if (searchQuery && !layer.name.toLowerCase().includes(searchQuery.toLowerCase())) return;

            const row = el('div',
                `layer-item ${layer.active ? 'active' : ''} flex items-center gap-2 p-2 rounded cursor-pointer border-b border-transparent hover:bg-white/5 transition-colors`,
                {
                    draggable: true,
                    onclick: () => this.selectLayer(layer.id),
                    ondragstart: (e) => this.handleDragStart(e, layer.id),
                    ondragover: (e) => this.handleDragOver(e, layer.id),
                    ondragleave: (e) => this.handleDragLeave(e),
                    ondrop: (e) => this.handleDrop(e, layer.id)
                },
                [
                    // Drag Handle
                    el('span', 'text-gray-600 cursor-move hover:text-gray-400', {}, '⋮⋮'),

                    // Visibility
                    el('button', `btn-icon ${layer.visible ? 'text-gray-400 hover:text-white' : 'text-gray-600'}`, {
                        onclick: (e) => { e.stopPropagation(); this.toggleVisibility(layer.id); }
                    }, layer.visible ? '👁️' : '🙈'),

                    // Name
                    el('input', `flex-1 bg-transparent text-xs font-bold border-none outline-none ${layer.active ? 'text-white' : 'text-gray-400'}`, {
                        value: layer.name,
                        onclick: (e) => e.stopPropagation(), // Allow editing without selecting
                        onchange: (e) => {
                            // Rename logic here
                            const newName = e.target.value;
                            const newLayers = layers.map(l => l.id === layer.id ? { ...l, name: newName } : l);
                            this.store.set({ layers: newLayers });
                        }
                    }),

                    // Lock
                    el('button', `btn-icon ${layer.locked ? 'text-yellow-500' : 'text-gray-700 opacity-0 group-hover:opacity-100'}`, {
                        onclick: (e) => { e.stopPropagation(); this.toggleLock(layer.id); }
                    }, layer.locked ? '🔒' : '🔓')
                ]
            );

            // Conditional Styles
            if (layer.active) {
                row.style.background = 'rgba(249, 115, 22, 0.15)';
                row.style.borderLeft = '2px solid #f97316';
            }

            list.appendChild(row);
        });

        this.container.appendChild(header);
        this.container.appendChild(search);
        this.container.appendChild(list);
    }
}
