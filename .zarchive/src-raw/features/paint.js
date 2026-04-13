import * as THREE from '../vendor/three.module.js';
import { invoke } from '../core/bridge.js';
import { initRenderer, getScene, getCamera, getRenderer, onFrame } from '../core/renderer.js';

// Global State
let mesh;
let svtHandle = null;
let stopLoop = null;
let containerEl;
let statsEl;
let isPainting = false;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let paintTexture;
let paintGroup;

// Brush Settings
const settings = {
    color: '#ff6600',
    radius: 0.05,
    opacity: 1.0
};

export async function mount(container) {
    console.log('🎨 PAINT: Mounting to Core Renderer...');
    containerEl = container;

    // 1. Setup Core Renderer
    initRenderer();
    const scene = getScene();

    paintGroup = new THREE.Group();
    scene.add(paintGroup);

    // 2. Init SVT Backend
    try {
        svtHandle = await invoke('svt_init', {
            width: 4096,
            height: 4096,
            tileSize: 128
        });
        console.log('✅ SVT Initialized:', svtHandle);
    } catch (e) { console.error(e); }

    // 3. Create Paintable Mesh
    setupMesh();

    // 4. Inject UI
    injectUI();

    // 5. Input Events (on the canvas managed by core)
    const canvas = getRenderer().domElement;
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);

    // 6. Loop
    stopLoop = onFrame(update);
}

export function unmount() {
    console.log('🎨 PAINT: Unmounting...');
    if (stopLoop) stopLoop();

    const scene = getScene();
    if (paintGroup) {
        scene.remove(paintGroup);
        paintGroup.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (obj.material.map) obj.material.map.dispose();
                obj.material.dispose();
            }
        });
    }

    if (svtHandle !== null) {
        invoke('svt_dispose', { handle: svtHandle }).catch(() => { });
    }

    const ui = document.getElementById('paint-ui-panel');
    if (ui) ui.remove();
}

function setupMesh() {
    const size = 1024;
    const data = new Uint8Array(size * size * 4).fill(255);
    paintTexture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    paintTexture.needsUpdate = true;

    const geometry = new THREE.SphereGeometry(1.5, 64, 64);
    const material = new THREE.MeshStandardMaterial({
        map: paintTexture,
        roughness: 0.4,
        metalness: 0.3
    });

    mesh = new THREE.Mesh(geometry, material);
    paintGroup.add(mesh);
}

function update() {
    if (mesh && !isPainting) {
        mesh.rotation.y += 0.001;
    }
}

function onPointerMove(e) {
    const renderer = getRenderer();
    const camera = getCamera();
    if (!renderer || !mesh) return;

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    if (isPainting) {
        paintAtCursor();
    }
}

function onPointerDown(e) {
    if (e.button === 0) {
        isPainting = true;
        paintAtCursor();
    }
}

function onPointerUp() {
    isPainting = false;
    syncTexture();
}

async function paintAtCursor() {
    if (svtHandle === null) return;
    const camera = getCamera();

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(mesh);

    if (intersects.length > 0 && intersects[0].uv) {
        const uv = intersects[0].uv;
        const color = hexToRgb(settings.color);

        try {
            await invoke('svt_stroke', {
                handle: svtHandle,
                centerUv: [uv.x, uv.y],
                radius: settings.radius,
                color: [...color, settings.opacity]
            });
            throttledSync();
        } catch (e) { console.error(e); }
    }
}

let lastSync = 0;
function throttledSync() {
    const now = performance.now();
    if (now - lastSync > 150) {
        syncTexture();
        lastSync = now;
    }
}

async function syncTexture() {
    if (svtHandle === null) return;
    try {
        const rawData = await invoke('svt_export_raw', { handle: svtHandle });
        const size = 4096;
        if (!paintTexture || paintTexture.image.width !== size) {
            paintTexture = new THREE.DataTexture(new Uint8Array(rawData), size, size, THREE.RGBAFormat);
            mesh.material.map = paintTexture;
        } else {
            paintTexture.image.data.set(rawData);
        }
        paintTexture.needsUpdate = true;
    } catch (e) { console.error(e); }
}

function injectUI() {
    const panel = document.createElement('div');
    panel.id = 'paint-ui-panel';
    panel.style.cssText = `
        position: absolute; top: 10px; right: 10px; 
        background: rgba(20,20,30,0.8); color: white; 
        backdrop-filter: blur(10px);
        padding: 15px; border-radius: 12px; font-family: 'Inter', sans-serif;
        width: 200px; border: 1px solid rgba(255,255,255,0.1);
    `;

    panel.innerHTML = `
        <h3 style="margin:0 0 10px 0; color:#ff6600;">SVT PAINT</h3>
        <input type="color" id="paint-color" value="${settings.color}" style="width:100%; height:30px; border:none; border-radius:4px; background:none; cursor:pointer; margin-bottom:10px;">
        <label style="font-size:10px; opacity:0.6;">RADIUS</label>
        <input type="range" id="paint-radius" min="0.01" max="0.3" step="0.01" value="${settings.radius}" style="width:100%; margin-bottom:10px;">
        <button id="btn-export" style="width:100%; padding:10px; background:#ff6600; border:none; border-radius:6px; color:white; font-weight:bold; cursor:pointer;">
            EXPORT
        </button>
    `;

    containerEl.appendChild(panel);
    document.getElementById('paint-color').oninput = e => settings.color = e.target.value;
    document.getElementById('paint-radius').oninput = e => settings.radius = parseFloat(e.target.value);
}

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b];
}
