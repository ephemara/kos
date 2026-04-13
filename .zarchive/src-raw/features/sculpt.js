import * as THREE from '../vendor/three.module.js';
import { invoke } from '../core/bridge.js';
import { initRenderer, getScene, getCamera, getRenderer, onFrame } from '../core/renderer.js';

/**
 * K_OS SCULPT FEATURE (Agent Beta Refined)
 * High-performance sculpting with GPU-accelerated subdivision.
 */

let meshHandle = null;
let mesh = null;
let raycaster, mouse;
let isSculpting = false;
let brushCursor;
let lastNdc = { x: 0, y: 0 };
let stopLoop = null;
let containerEl;
let statsEl;

// Brush Settings
const settings = {
    radius: 0.5,
    intensity: 0.5,
    tool: 'clay', // String match for Rust: "clay", "smooth", "flatten", "grab"
    symmetry: true,
    wireframe: false
};

export async function mount(container) {
    console.log('🗿 SCULPT: Mounting...');
    containerEl = container;

    // 1. Core Renderer Sync
    initRenderer();
    const scene = getScene();
    const camera = getCamera();
    const renderer = getRenderer();

    // 2. Setup Raycaster
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // 3. Initialize Mesh
    await setupInitialMesh();

    // 4. Setup Brush Cursor
    setupCursor();

    // 5. Input Listeners
    containerEl.addEventListener('pointermove', onPointerMove);
    containerEl.addEventListener('pointerdown', onPointerDown);
    containerEl.addEventListener('pointerup', onPointerUp);

    // 6. UI
    injectUI();

    // 7. Loop
    stopLoop = onFrame(update);

    console.log('✅ SCULPT: Ready');
}

export function unmount() {
    console.log('🗿 SCULPT: Unmounting...');
    if (stopLoop) stopLoop();

    const scene = getScene();
    if (mesh) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
    }
    if (brushCursor) scene.remove(brushCursor);

    if (meshHandle !== null) {
        invoke('dispose_sculpt_mesh', { handle: meshHandle }).catch(() => { });
    }

    const ui = document.getElementById('sculpt-ui-panel');
    if (ui) ui.remove();
}

async function setupInitialMesh() {
    const scene = getScene();

    // Create Three.js Sphere
    const geo = new THREE.IcosahedronGeometry(2, 5); // Base resolution
    const mat = new THREE.MeshStandardMaterial({
        color: 0x666666,
        roughness: 0.7,
        metalness: 0.2,
        flatShading: true
    });

    mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'SculptMesh';
    scene.add(mesh);

    // Register with Rust Backend
    await syncToBackend();
}

async function syncToBackend() {
    const positions = Array.from(mesh.geometry.attributes.position.array);
    const indices = Array.from(mesh.geometry.index.array);

    try {
        meshHandle = await invoke('init_sculpt_mesh', {
            positions,
            indices
        });
        console.log('🗿 Mesh Registered with Handle:', meshHandle);
    } catch (e) {
        console.error('Failed to init sculpt mesh:', e);
    }
}

function setupCursor() {
    const scene = getScene();
    const cursorGeo = new THREE.RingGeometry(0.95, 1.0, 32);
    const cursorMat = new THREE.MeshBasicMaterial({
        color: 0xffaa00,
        transparent: true,
        opacity: 0.8,
        depthTest: false,
        side: THREE.DoubleSide
    });
    brushCursor = new THREE.Mesh(cursorGeo, cursorMat);
    brushCursor.visible = false;
    scene.add(brushCursor);
}

function update() {
    // Per-frame logic if needed
}

function onPointerMove(e) {
    const camera = getCamera();
    const renderer = getRenderer();
    if (!renderer || !mesh) return;

    const rect = containerEl.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(mesh);

    if (intersects.length > 0) {
        const hit = intersects[0];
        brushCursor.position.copy(hit.point);
        brushCursor.lookAt(hit.point.clone().add(hit.face.normal));
        brushCursor.visible = true;
        brushCursor.scale.set(settings.radius, settings.radius, settings.radius);

        if (isSculpting) {
            applyBrush(hit);
        }
    } else {
        brushCursor.visible = false;
    }
}

function onPointerDown(e) {
    if (e.button === 0) {
        isSculpting = true;
        lastNdc.x = mouse.x;
        lastNdc.y = mouse.y;
    }
}

function onPointerUp() {
    isSculpting = false;
}

async function applyBrush(hit) {
    if (meshHandle === null) return;

    try {
        const result = await invoke('apply_brush', {
            handle: meshHandle,
            point: [hit.point.x, hit.point.y, hit.point.z],
            normal: [hit.face.normal.x, hit.face.normal.y, hit.face.normal.z],
            tool: settings.tool,
            radius: settings.radius,
            intensity: settings.intensity,
            symmetry: settings.symmetry ? 'X' : null
        });

        if (result && result.modified_indices) {
            updateGeometry(result);
        }
    } catch (e) {
        console.warn('Brush application failed:', e);
    }
}

function updateGeometry(result) {
    const positions = mesh.geometry.attributes.position;
    const normals = mesh.geometry.attributes.normal;

    for (let i = 0; i < result.modified_indices.length; i++) {
        const idx = result.modified_indices[i];
        const offset = idx * 3;

        positions.array[offset] = result.positions[offset];
        positions.array[offset + 1] = result.positions[offset + 1];
        positions.array[offset + 2] = result.positions[offset + 2];

        if (result.normals && result.normals.length > 0) {
            normals.array[offset] = result.normals[offset];
            normals.array[offset + 1] = result.normals[offset + 1];
            normals.array[offset + 2] = result.normals[offset + 2];
        }
    }

    positions.needsUpdate = true;
    if (result.normals && result.normals.length > 0) {
        normals.needsUpdate = true;
    } else {
        mesh.geometry.computeVertexNormals();
    }
}

async function handleSubdivide() {
    if (meshHandle === null) return;

    try {
        if (statsEl) statsEl.innerText = 'Subdividing...';

        const positions = Array.from(mesh.geometry.attributes.position.array);
        const indices = Array.from(mesh.geometry.index.array);

        const [result, newHandle] = await invoke('gpu_subdivide_v2_and_register', {
            positions,
            indices,
            levels: 1
        });

        // Dispose old backend mesh
        invoke('dispose_sculpt_mesh', { handle: meshHandle }).catch(() => { });
        meshHandle = newHandle;

        // Update Three.js Geometry (Rebuild because topology changed)
        const newGeo = new THREE.BufferGeometry();
        newGeo.setAttribute('position', new THREE.Float32BufferAttribute(result.positions, 3));
        newGeo.setIndex(new THREE.Uint32BufferAttribute(result.indices, 1));
        newGeo.computeVertexNormals();

        mesh.geometry.dispose();
        mesh.geometry = newGeo;

        if (statsEl) {
            statsEl.innerText = `Vertices: ${result.vertex_count} | Faces: ${result.face_count}`;
        }

    } catch (e) {
        console.error('Subdivision failed:', e);
        if (statsEl) statsEl.innerText = 'Error: ' + e;
    }
}

function injectUI() {
    const panel = document.createElement('div');
    panel.id = 'sculpt-ui-panel';
    panel.style.cssText = `
        position: absolute; top: 10px; right: 10px; 
        background: rgba(30,30,35,0.8); color: white; 
        backdrop-filter: blur(10px);
        padding: 15px; border-radius: 12px; font-family: 'Inter', sans-serif;
        width: 200px; border: 1px solid rgba(255,255,255,0.1);
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    `;

    panel.innerHTML = `
        <h3 style="margin:0 0 10px 0; color:#ffcc00;">K_SCULPT V2</h3>
        
        <div style="margin-bottom:8px;">
            <label style="font-size:10px; opacity:0.6;">TOOL</label>
            <select id="sel-tool" style="width:100%; background:#111; color:white; border:1px solid #333; padding:5px; border-radius:4px;">
                <option value="clay">Clay</option>
                <option value="smooth">Smooth</option>
                <option value="flatten">Flatten</option>
                <option value="grab">Grab</option>
            </select>
        </div>

        <div style="margin-bottom:8px;">
            <label style="font-size:10px; opacity:0.6;">RADIUS</label>
            <input type="range" id="rng-radius" min="0.05" max="2.0" step="0.05" value="${settings.radius}" style="width:100%;">
        </div>

        <div style="margin-bottom:12px;">
            <label style="font-size:10px; opacity:0.6;">INTENSITY</label>
            <input type="range" id="rng-intensity" min="0.1" max="1.0" step="0.1" value="${settings.intensity}" style="width:100%;">
        </div>

        <div style="margin-bottom:12px; font-size:12px;">
            <label><input type="checkbox" id="chk-sym" checked> Symmetry X</label>
            <br>
            <label><input type="checkbox" id="chk-wire"> Wireframe</label>
        </div>

        <button id="btn-subdiv" style="width:100%; padding:8px; background:#444; border:none; border-radius:4px; color:white; cursor:pointer; font-weight:bold;">
            Subdivide
        </button>
        
        <div id="sculpt-stats" style="margin-top:10px; font-size:10px; color:#888;">Vertices: 2562</div>
    `;

    containerEl.appendChild(panel);
    statsEl = document.getElementById('sculpt-stats');

    // Binds
    document.getElementById('sel-tool').onchange = e => settings.tool = e.target.value;
    document.getElementById('rng-radius').oninput = e => settings.radius = parseFloat(e.target.value);
    document.getElementById('rng-intensity').oninput = e => settings.intensity = parseFloat(e.target.value);
    document.getElementById('chk-sym').onchange = e => settings.symmetry = e.target.checked;
    document.getElementById('chk-wire').onchange = e => mesh.material.wireframe = e.target.checked;

    document.getElementById('btn-subdiv').onclick = handleSubdivide;
}
