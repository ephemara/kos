import { el, Store } from '../core/components.js';
import { invoke } from '../core/bridge.js';

/**
 * K_OS ASSET BROWSER
 * Central repository for artifacts, materials, and alphas.
 * Supports: Drag & Drop to Viewport, Search, Tab filtering.
 */
export class AssetBrowser {
  constructor(container) {
    this.container = container;
    if (!this.container) return;

    this.store = new Store({
      activeTab: 'ARTIFACTS',
      searchQuery: '',
      items: [],
      loading: false
    });

    this.store.subscribe(() => this.render());
    this.loadAssets('ARTIFACTS');
  }

  async loadAssets(tab) {
    this.store.set({ loading: true, activeTab: tab });

    try {
      // Call Rust backend for real assets
      const assets = await invoke('get_assets', { category: tab });
      this.store.set({ items: assets || [], loading: false });
    } catch (e) {
      console.warn(`Kernel: Failed to fetch assets for ${tab}. Using mocks.`);
      // Mock data for dev
      const mock = Array.from({ length: 8 }, (_, i) => ({
        id: `id-${tab}-${i}`,
        name: `${tab} Item ${i + 1}.kmat`,
        thumbnail: `https://picsum.photos/seed/${tab}${i}/200`,
        type: tab
      }));
      this.store.set({ items: mock, loading: false });
    }
  }

  handleDragStart(e, item) {
    e.dataTransfer.setData('application/json', JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'copyMove';

    // Custom drag image could be set here
    const img = new Image();
    img.src = item.thumbnail;
    e.dataTransfer.setDragImage(img, 50, 50);

    console.log(`Dragging ${item.name}`);
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = '';

    const { activeTab, items, loading, searchQuery } = this.store.state;

    // 1. Header & Controls
    const tabs = ['ARTIFACTS', 'MATERIALS', 'ALPHAS', 'SKETCHFAB'];
    const controls = el('div', 'browser-controls p-4 border-b border-[#222]', {}, [
      el('div', 'flex gap-2 mb-4', {}, tabs.map(t =>
        el('button', `px-3 py-1 text-[10px] font-bold rounded uppercase transition-all ${activeTab === t ? 'bg-orange-600 text-black shadow-[0_0_10px_rgba(249,115,22,0.5)]' : 'bg-[#111] text-gray-500 hover:text-white'}`, {
          onclick: () => this.loadAssets(t)
        }, t)
      )),
      el('input', 'w-full bg-[#0a0a0a] border border-[#222] rounded p-2 text-xs text-white outline-none focus:border-orange-500', {
        placeholder: 'Filter Kernel registry...',
        value: searchQuery,
        oninput: (e) => this.store.set({ searchQuery: e.target.value })
      })
    ]);

    // 2. Grid Content
    const grid = el('div', 'browser-grid p-4 flex-1 overflow-y-auto grid gap-4 custom-scrollbar', {
      style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))' }
    });

    if (loading) {
      grid.appendChild(el('div', 'flex items-center justify-center py-20 text-[10px] text-orange-500 tracking-[0.2em] animate-pulse', {}, 'AUTHENTICATING KERNEL REGISTRY...'));
    } else {
      const filtered = items.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));

      if (filtered.length === 0) {
        grid.appendChild(el('div', 'text-center py-20 text-gray-600 text-xs', {}, 'No items found in this sector.'));
      }

      filtered.forEach(item => {
        const card = el('div', 'asset-card group relative bg-[#111] border border-[#222] rounded overflow-hidden hover:border-orange-500 transition-all cursor-grab active:cursor-grabbing', {
          draggable: true,
          ondragstart: (e) => this.handleDragStart(e, item)
        }, [
          el('div', 'aspect-square bg-black overflow-hidden', {}, [
            el('img', 'w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity', { src: item.thumbnail })
          ]),
          el('div', 'p-2 bg-[#1a1a1a]', {}, [
            el('div', 'text-[9px] font-bold text-gray-500 group-hover:text-white truncate uppercase tracking-tighter', {}, item.name)
          ])
        ]);
        grid.appendChild(card);
      });
    }

    this.container.appendChild(controls);
    this.container.appendChild(grid);
  }
}

export const initAssetBrowser = (container) => new AssetBrowser(container);
