import * as THREE from '../vendor/three.module.js';

// Singleton State
let renderer, scene, camera;
let loopId;
const callbacks = new Set(); // Functions to run every frame

export const initRenderer = () => {
    if (renderer) return; // Already initialized

    console.log('📷 CORE: Initializing Renderer...');

    const canvas = document.getElementById('kos-canvas');
    const rect = canvas.getBoundingClientRect();

    // 1. Renderer
    renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true // Allow CSS background to show through if needed, or false for performance
    });
    renderer.setSize(rect.width, rect.height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x111111, 1); // Dark K_OS background

    // 2. Scene
    scene = new THREE.Scene();

    // Default Lighting (Can be cleared/modified by apps)
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10, 10, 10);
    scene.add(dirLight);

    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    // 3. Camera
    camera = new THREE.PerspectiveCamera(75, rect.width / rect.height, 0.1, 1000);
    camera.position.z = 5;

    // 4. Resize Handler
    window.addEventListener('resize', onResize);

    // 5. Start Loop
    startLoop();

    console.log('📷 CORE: Renderer Ready');
};

const onResize = () => {
    if (!renderer || !camera) return;
    const canvas = renderer.domElement;
    // We might want to look at the container size instead of window if we want to be precise,
    // but the canvas usually fills the screen behind the UI.
    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
};

const startLoop = () => {
    if (loopId) cancelAnimationFrame(loopId);

    const animate = () => {
        loopId = requestAnimationFrame(animate);

        // Run registered callbacks (e.g., input handling, generic animations)
        callbacks.forEach(cb => cb());

        renderer.render(scene, camera);
    };
    animate();
};

// --- API for Features ---

export const getScene = () => scene;
export const getCamera = () => camera;
export const getRenderer = () => renderer;

/**
 * Register a callback to run every frame.
 * @param {Function} cb 
 * @returns {Function} Unsubscribe function
 */
export const onFrame = (cb) => {
    callbacks.add(cb);
    return () => callbacks.delete(cb);
};

/**
 * Helper to add objects to the global scene
 */
export const add = (obj) => {
    if (scene) scene.add(obj);
};

/**
 * Helper to remove objects
 */
export const remove = (obj) => {
    if (scene) scene.remove(obj);
};
