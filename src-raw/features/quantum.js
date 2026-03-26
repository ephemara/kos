import * as THREE from '../vendor/three.module.js';
import { invoke } from '../core/bridge.js';
import { initRenderer, getScene, getCamera, getRenderer, onFrame } from '../core/renderer.js';

// Global State
let worldId = null;
let bodies = new Map(); // id -> THREE.Mesh
let stopLoop = null;
let containerEl;
let isSimulating = false;
let physicsGroup;

export async function mount(container) {
    console.log('⚛️ QUANTUM: Mounting to Core Renderer...');
    containerEl = container;

    // 1. Setup Core Renderer
    initRenderer();
    const scene = getScene();

    // Create a group for physics objects to allow easy cleanup
    physicsGroup = new THREE.Group();
    scene.add(physicsGroup);

    // 2. Initialize Physics World
    try {
        worldId = await invoke('create_physics_world', { gravityY: -9.81 });
        console.log('✅ Physics World Created:', worldId);

        // Add Floor
        await addFloor();
    } catch (e) {
        console.error('❌ Failed to init physics:', e);
    }

    // 3. Setup UI
    injectUI();

    // 4. Start Loop
    stopLoop = onFrame(stepPhysics);
}

export function unmount() {
    console.log('⚛️ QUANTUM: Unmounting...');
    if (stopLoop) stopLoop();

    const scene = getScene();
    if (physicsGroup) {
        scene.remove(physicsGroup);
        physicsGroup.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
    }

    // Cleanup Physics
    if (worldId !== null) {
        invoke('dispose_physics_world', { worldId }).catch(console.error);
    }

    bodies.clear();

    const ui = document.getElementById('quantum-ui-panel');
    if (ui) ui.remove();
}

async function addFloor() {
    // Visual Floor
    const floorGeo = new THREE.PlaneGeometry(50, 50);
    const floorMat = new THREE.MeshStandardMaterial({
        color: 0x111111,
        roughness: 0.8
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    physicsGroup.add(floor);

    // Quad vertices for physics (flat on y=0)
    const v = [
        [-25.0, 0.0, -25.0],
        [25.0, 0.0, -25.0],
        [25.0, 0.0, 25.0],
        [-25.0, 0.0, 25.0]
    ];
    const i = [
        [0, 1, 2],
        [0, 2, 3]
    ];

    try {
        await invoke('add_physics_mesh', {
            worldId,
            vertices: v,
            indices: i
        });
    } catch (e) { console.error(e); }
}

async function spawnBody() {
    if (worldId === null) return;

    const x = (Math.random() - 0.5) * 10;
    const z = (Math.random() - 0.5) * 10;
    const y = 8 + Math.random() * 4;
    const radius = 0.3 + Math.random() * 0.4;

    try {
        const id = await invoke('add_physics_body', {
            worldId,
            position: [x, y, z],
            radius
        });

        const geometry = new THREE.SphereGeometry(radius, 16, 16);
        const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(Math.random(), 0.7, 0.5),
            roughness: 0.2,
            metalness: 0.8
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);
        physicsGroup.add(mesh);

        bodies.set(id, mesh);
    } catch (e) {
        console.error('Spawn failed:', e);
    }
}

async function stepPhysics() {
    if (worldId === null || !isSimulating) return;

    try {
        const updates = await invoke('step_physics', { worldId });

        for (const update of updates) {
            const mesh = bodies.get(update.id);
            if (mesh) {
                mesh.position.set(update.position[0], update.position[1], update.position[2]);
            }
        }
    } catch (e) {
        console.warn('Physics stepping failed:', e);
    }
}

function injectUI() {
    const panel = document.createElement('div');
    panel.id = 'quantum-ui-panel';
    panel.style.cssText = `
        position: absolute; top: 10px; right: 10px; 
        background: rgba(10,10,20,0.7); color: white; 
        backdrop-filter: blur(10px);
        padding: 15px; border-radius: 12px; font-family: 'Inter', sans-serif;
        width: 200px; border: 1px solid rgba(255,255,255,0.1);
    `;

    panel.innerHTML = `
        <h3 style="margin-top:0; color:#55aaff;">QUANTUM</h3>
        <button id="btn-spawn" style="width:100%; padding:10px; background:#4f46e5; border:none; border-radius:6px; color:white; cursor:pointer; margin-bottom:10px; font-weight:bold;">
            SPAWN BATCH
        </button>
        <button id="btn-toggle" style="width:100%; padding:10px; background:#10b981; border:none; border-radius:6px; color:white; cursor:pointer; font-weight:bold;">
            START
        </button>
        <div id="sim-stats" style="margin-top:12px; font-size:10px; opacity:0.5;">Objects: 0</div>
    `;

    containerEl.appendChild(panel);

    document.getElementById('btn-spawn').onclick = () => {
        for (let i = 0; i < 10; i++) setTimeout(() => spawnBody(), i * 50);
    };

    const toggleBtn = document.getElementById('btn-toggle');
    toggleBtn.onclick = () => {
        isSimulating = !isSimulating;
        toggleBtn.innerText = isSimulating ? 'PAUSE' : 'RESUME';
        toggleBtn.style.background = isSimulating ? '#f59e0b' : '#10b981';
    };

    // Auto-update stats
    const interval = setInterval(() => {
        const stats = document.getElementById('sim-stats');
        if (stats) stats.innerText = `Objects: ${bodies.size}`;
        else clearInterval(interval);
    }, 500);
}
