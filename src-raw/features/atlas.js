import { invoke } from '../core/bridge.js';

let containerEl;
let canvas, ctx;
let animationFrameId;

// State
let vertices = []; // Mock UV vertices

export async function mount(container) {
    console.log('🗺️ ATLAS: Mounting...');
    containerEl = container;
    containerEl.classList.add('atlas-mode'); // Optional CSS

    // 1. Create 2D Canvas for UV View
    initCanvas();

    // 2. Inject Toolbar
    injectUI();

    // 3. Load Initial UVs (Mock)
    loadUVs();

    // 4. Start Loop
    animate();
}

export function unmount() {
    console.log('🗺️ ATLAS: Unmounting...');
    cancelAnimationFrame(animationFrameId);
    if (containerEl) {
        containerEl.innerHTML = '';
        containerEl.classList.remove('atlas-mode');
    }
}

function initCanvas() {
    // Create a canvas overlay for the UV Editor
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        display: flex; align-items: center; justify-content: center;
        background: radial-gradient(circle at center, #222 0%, #111 100%);
    `;

    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 800;
    canvas.style.cssText = `
        background: #1a1a1a;
        box-shadow: 0 0 20px black;
        border: 1px solid #333;
    `;

    wrapper.appendChild(canvas);
    containerEl.appendChild(wrapper);

    ctx = canvas.getContext('2d');
}

function injectUI() {
    const tools = document.getElementById('active-tool-ui');
    if (!tools) return;

    tools.innerHTML = `
        <div class="tool-panel">
            <h3>ATLAS TOOLS</h3>
            <button id="btn-unwrap" class="w-full bg-blue-600 p-2 rounded text-white font-bold mb-2">Auto Unwrap</button>
            <button id="btn-pack" class="w-full bg-gray-700 p-2 rounded text-white mb-2">Pack UVs</button>
            
            <div class="control-group mt-4">
                <label>Margin</label>
                <input type="range" min="0" max="0.1" step="0.001" value="0.005">
            </div>
        </div>
    `;

    document.getElementById('btn-unwrap').onclick = async () => {
        console.log('Generating UVs...');
        // Mock async call
        await new Promise(r => setTimeout(r, 500));
        loadUVs(true); // Randomize
    };

    document.getElementById('btn-pack').onclick = () => {
        console.log('Packing UVs...');
    };
}

function loadUVs(random = false) {
    // Mock UV Data
    vertices = [];
    for (let i = 0; i < 50; i++) {
        vertices.push({
            x: random ? Math.random() * 800 : 400 + (Math.random() - 0.5) * 200,
            y: random ? Math.random() * 800 : 400 + (Math.random() - 0.5) * 200
        });
    }
}

function animate() {
    animationFrameId = requestAnimationFrame(animate);

    // Draw Background Grid
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    for (let i = 0; i < 800; i += 50) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 800); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(800, i); ctx.stroke();
    }

    // Draw UV Vertex Cloud (Mock)
    ctx.fillStyle = '#f97316';
    vertices.forEach(v => {
        ctx.beginPath();
        ctx.arc(v.x, v.y, 3, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw "Islands" (Lines between points)
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.3)';
    ctx.beginPath();
    vertices.forEach((v, i) => {
        if (i < vertices.length - 1) {
            ctx.moveTo(v.x, v.y);
            ctx.lineTo(vertices[i + 1].x, vertices[i + 1].y);
        }
    });
    ctx.stroke();
}
