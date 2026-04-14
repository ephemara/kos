import { el } from '../core/components.js';

/**
 * K_OS GRAPHOS (Node Editor)
 * High-performance 2D Canvas Node Graph.
 */
export class Graphos {
    constructor(container) {
        this.container = container;
        if (!this.container) return;

        // Setup Canvas
        this.canvas = el('canvas', 'absolute inset-0 w-full h-full pointer-events-auto', {
            style: { cursor: 'crosshair', position: 'absolute', top: 0, left: 0 }
        });
        this.ctx = this.canvas.getContext('2d');

        this.nodes = [
            { id: 1, x: 100, y: 100, w: 120, h: 80, title: 'Input', type: 'source' },
            { id: 2, x: 340, y: 150, w: 140, h: 100, title: 'Texture Mix', type: 'math' },
            { id: 3, x: 600, y: 120, w: 120, h: 80, title: 'Output', type: 'sink' }
        ];

        this.wires = [
            { from: 1, to: 2 },
            { from: 2, to: 3 }
        ];

        this.dragging = null;
        this.offset = { x: 0, y: 0 };
        this.isActive = true;

        this.handleResize = this.handleResize.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.loop = this.loop.bind(this);

        window.addEventListener('resize', this.handleResize);
        this.canvas.addEventListener('mousedown', this.onMouseDown);
        window.addEventListener('mousemove', this.onMouseMove);
        window.addEventListener('mouseup', this.onMouseUp);

        this.container.appendChild(this.canvas);
        this.handleResize();
        this.loop();
    }

    destroy() {
        this.isActive = false;
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('mousemove', this.onMouseMove);
        window.removeEventListener('mouseup', this.onMouseUp);
        if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    }

    handleResize() {
        const rect = this.container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        this.nodes.forEach(node => {
            if (mx >= node.x && mx <= node.x + node.w &&
                my >= node.y && my <= node.y + 24) {
                this.dragging = node;
                this.offset.x = mx - node.x;
                this.offset.y = my - node.y;
            }
        });
    }

    onMouseMove(e) {
        if (!this.dragging) return;
        const rect = this.canvas.getBoundingClientRect();
        this.dragging.x = (e.clientX - rect.left) - this.offset.x;
        this.dragging.y = (e.clientY - rect.top) - this.offset.y;
    }

    onMouseUp() {
        this.dragging = null;
    }

    loop() {
        if (!this.isActive) return;
        this.render();
        requestAnimationFrame(this.loop);
    }

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Grid
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x < this.canvas.width; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, this.canvas.height); }
        for (let y = 0; y < this.canvas.height; y += 40) { ctx.moveTo(0, y); ctx.lineTo(this.canvas.width, y); }
        ctx.stroke();

        // Draw Wires
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 2;
        this.wires.forEach(wire => {
            const n1 = this.nodes.find(n => n.id === wire.from);
            const n2 = this.nodes.find(n => n.id === wire.to);
            if (n1 && n2) {
                const x1 = n1.x + n1.w;
                const y1 = n1.y + n1.h / 2;
                const x2 = n2.x;
                const y2 = n2.y + n2.h / 2;
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.bezierCurveTo(x1 + 80, y1, x2 - 80, y2, x2, y2);
                ctx.stroke();
            }
        });

        // Draw Nodes
        this.nodes.forEach(node => {
            // Body
            ctx.fillStyle = 'rgba(20, 20, 20, 0.9)';
            ctx.shadowBlur = 10; ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.fillRect(node.x, node.y, node.w, node.h);
            ctx.shadowBlur = 0;
            ctx.strokeStyle = '#333';
            ctx.strokeRect(node.x, node.y, node.w, node.h);

            // Header
            ctx.fillStyle = node.type === 'math' ? '#3b82f6' : (node.type === 'source' ? '#22b55e' : '#f97316');
            ctx.fillRect(node.x, node.y, node.w, 24);

            // Text
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 9px "Inter", sans-serif';
            ctx.fillText(node.title.toUpperCase(), node.x + 10, node.y + 16);

            // Ports
            ctx.fillStyle = '#555';
            if (node.type !== 'source') ctx.beginPath(), ctx.arc(node.x, node.y + node.h / 2, 4, 0, Math.PI * 2), ctx.fill();
            if (node.type !== 'sink') ctx.beginPath(), ctx.arc(node.x + node.w, node.y + node.h / 2, 4, 0, Math.PI * 2), ctx.fill();
        });
    }
}

let instance = null;

export const mount = (container) => {
    instance = new Graphos(container);
};

export const unmount = () => {
    if (instance) {
        instance.destroy();
        instance = null;
    }
};
