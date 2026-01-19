import { PhysicsEngine } from './core/PhysicsEngine';
import { Environment } from './models/Environment';
import { Vehicle } from './models/Vehicle';
import { SceneRenderer } from './renderer/SceneRenderer';

// Import config directly (Vite handles JSON)
import vehicleConfig from '../assets/vehicle_config.json';

// --- PHYSICS SETUP ---
const env = new Environment();
const vehicle = new Vehicle(vehicleConfig as any); // Cast to any if interface mismatch
const engine = new PhysicsEngine(vehicle, env);

// --- RENDERER SETUP ---
const sceneRenderer = new SceneRenderer();

// --- INPUT HANDLING ---
const keys: { [key: string]: boolean } = {
    w: false, a: false, s: false, d: false,
    ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false
};

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = true;
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
});

function getInput() {
    let throttle = 0;
    let brake = 0;
    let steering = 0;

    if (keys.w || keys.ArrowUp) throttle = 1.0;
    if (keys.s || keys.ArrowDown) brake = 1.0;
    if (keys.a || keys.ArrowLeft) steering = 1.0;
    if (keys.d || keys.ArrowRight) steering = -1.0;

    return { throttle, brake, steering };
}

// --- GAME LOOP ---
function animate() {
    requestAnimationFrame(animate);

    // 1. Input
    const input = getInput();
    engine.applyInput(input);

    // 2. Physics Step
    engine.step(1 / 60);

    // 3. Render
    sceneRenderer.render(engine.getState());
}

// Start
animate();
