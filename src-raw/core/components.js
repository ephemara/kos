/**
 * K_OS RAW DOG UI KIT
 * A tiny, zero-dep replacement for React.
 */

// Create DOM Element
export const el = (tag, classes = '', attrs = {}, children = []) => {
    const element = document.createElement(tag);
    if (classes) element.className = classes;

    // Attributes
    for (const [key, value] of Object.entries(attrs)) {
        if (key.startsWith('on') && typeof value === 'function') {
            element.addEventListener(key.substring(2).toLowerCase(), value);
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
        } else if (value !== false && value !== null && value !== undefined) {
            element.setAttribute(key, value);
        }
    }

    // Children
    if (!Array.isArray(children)) children = [children];
    children.forEach(child => {
        if (child instanceof Node) {
            element.appendChild(child);
        } else if (child !== null && child !== undefined && child !== false) {
            element.appendChild(document.createTextNode(String(child)));
        }
    });

    return element;
};

// Re-render helper (Quick & Dirty VDOM-ish)
export const mount = (container, componentInstance) => {
    container.innerHTML = '';
    container.appendChild(componentInstance.render());
};

// Icons (Lucide wrapper)
export const icon = (name, size = 14, className = '') => {
    const i = document.createElement('i');
    i.dataset.lucide = name;
    i.setAttribute('width', size);
    i.setAttribute('height', size);
    if (className) i.classList.add(...className.split(' '));
    // Lucide auto-replace needs to be called later or we manually svg it.
    // simpler: return a placeholder and let lucide.createIcons() handle it? 
    // better: return SVG string if possible, but for now relies on Lucide global.
    return i;
};

// Simple State Store
export class Store {
    constructor(initialState = {}) {
        this.state = initialState;
        this.listeners = new Set();
    }

    set(newState) {
        this.state = { ...this.state, ...newState };
        this.notify();
    }

    subscribe(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    notify() {
        this.listeners.forEach(fn => fn(this.state));
    }
}
