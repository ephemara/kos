import { el } from '../core/components.js';

/**
 * K_OS GLOBAL TOAST SYSTEM
 * Replaces complex notification libraries with a lightweight Vanilla implementation.
 */
export class NotificationSystem {
    constructor() {
        this.container = document.createElement('div');
        this.container.id = 'notification-layer';
        this.container.style.cssText = `
            position: fixed; bottom: 20px; right: 20px; z-index: 10000;
            display: flex; flex-direction: column; gap: 10px; pointer-events: none;
        `;
        document.body.appendChild(this.container);

        // Expose globally
        window.toast = (msg, type = 'info') => this.add(msg, type);
    }

    add(message, type = 'info') {
        const typeColors = {
            info: 'var(--kos-accent-blue)',
            success: 'var(--kos-accent-green)',
            warning: 'var(--kos-accent-orange)',
            error: '#ef4444'
        };

        const accent = typeColors[type] || typeColors.info;

        const toast = el('div', 'notification glass-panel', {
            style: {
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '8px',
                color: 'white',
                minWidth: '200px',
                borderLeft: `4px solid ${accent}`,
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }
        }, [
            el('div', '', {
                style: { width: '8px', height: '8px', borderRadius: '50%', background: accent, boxShadow: `0 0 10px ${accent}` }
            }),
            el('span', '', {
                style: { fontSize: '10px', fontWeight: '900', letterSpacing: '1px', flex: 1 }
            }, message.toUpperCase()),
            el('button', '', {
                style: { background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '16px' },
                onclick: () => this.remove(toast)
            }, '×')
        ]);

        this.container.appendChild(toast);

        // Auto remove
        setTimeout(() => this.remove(toast), 5000);
    }

    remove(toast) {
        toast.style.transform = 'translateX(120%)';
        toast.style.opacity = '0';
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 500);
    }
}

// Singleton
new NotificationSystem();
