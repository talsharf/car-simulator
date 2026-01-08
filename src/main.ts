import * as THREE from 'three';
import { PhysicsEngine } from './core/PhysicsEngine';
import { Environment } from './models/Environment';
import { Vehicle } from './models/Vehicle';
import { FIXED_TIMESTEP } from './utils/constants';

// Import config directly (Vite handles JSON)
import vehicleConfig from '../assets/vehicle_config.json';

// --- PHYSICS SETUP ---
const env = new Environment();
const vehicle = new Vehicle(vehicleConfig as any); // Cast to any if interface mismatch, strict type checking later
const engine = new PhysicsEngine(vehicle, env);

// --- THREE.JS SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa0a0a0);
scene.fog = new THREE.Fog(0xa0a0a0, 10, 500);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, -10, 5);
camera.up.set(0, 0, 1);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Lights
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
hemiLight.position.set(0, 0, 20);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff);
dirLight.position.set(10, 10, 10);
dirLight.castShadow = true;
scene.add(dirLight);

// Ground
const groundMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1000, 1000),
    new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false })
);
groundMesh.receiveShadow = true;
scene.add(groundMesh);

const grid = new THREE.GridHelper(1000, 100);
grid.rotation.x = Math.PI / 2;
scene.add(grid);

// Car Body (Transparent Box)
const carGeometry = new THREE.BoxGeometry(4.8, 2.0, 1.5);
const carMaterial = new THREE.MeshPhongMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.3,
    depthWrite: false
});
const carMesh = new THREE.Mesh(carGeometry, carMaterial);
carMesh.castShadow = true;

// Wireframe
const carEdges = new THREE.EdgesGeometry(carGeometry);
const carLines = new THREE.LineSegments(carEdges, new THREE.LineBasicMaterial({ color: 0x000000 }));
carMesh.add(carLines);

scene.add(carMesh);

// Wheels (4 Cylinders)
const wheelMeshes: THREE.Mesh[] = [];
const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 32);
const wheelMat = new THREE.MeshPhongMaterial({ color: 0x333333 });

for (let i = 0; i < 4; i++) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.castShadow = true;
    scene.add(w);
    wheelMeshes.push(w);
}

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
// We use a fixed timestep for physics, but variable frame rate for rendering.
// To keep it simple (and matching the Node approach), we'll do:
// On every requestAnimationFrame:
// 1. Process Input
// 2. Step Physics (maybe multiple times if lagging? simple step for now)
// 3. Render

function animate() {
    requestAnimationFrame(animate);

    // 1. Input
    const input = getInput();
    engine.applyInput(input);

    // 2. Physics Step
    // For smoother physics in the browser, we should ideally use delta time.
    // The engine.step(dt) handles accumulation, so passing a small dt (like 1/60) is fine 
    // or passing the actual frame delta if we measured it. 
    // For strict determinism match with your backend, we'll feed it fixed slices.
    // But engine.step(FIXED_TIMESTEP) is designed for the server loop.
    // Let's call engine.step(1/60) approximately.
    engine.step(1 / 60);

    // 3. Get State
    const state = engine.getState();

    // 4. Update Visuals
    // Update Car Position/Rotation
    carMesh.position.set(state.position.x, state.position.y, state.position.z);
    carMesh.quaternion.set(state.orientation.x, state.orientation.y, state.orientation.z, state.orientation.w);

    // Update Wheels
    if (state.wheelTransforms) {
        for (let i = 0; i < 4; i++) {
            const t = state.wheelTransforms[i];
            if (t) {
                wheelMeshes[i].position.set(t.position.x, t.position.y, t.position.z);
                wheelMeshes[i].quaternion.set(t.orientation.x, t.orientation.y, t.orientation.z, t.orientation.w);
            }
        }
    }

    // Update UI
    const speed = Math.sqrt(state.velocity.x ** 2 + state.velocity.y ** 2 + state.velocity.z ** 2) * 3.6; // km/h
    const rpm = state.engineRPM ? state.engineRPM.toFixed(0) : "0";
    const gear = state.gear;

    const speedEl = document.getElementById('speed');
    if (speedEl) {
        speedEl.innerText = `${speed.toFixed(0)} km/h | ${rpm} RPM | G: ${gear}`;
    }

    // Camera Follow
    const relativeOffset = new THREE.Vector3(-9, 3, 3.5);
    const cameraOffset = relativeOffset.applyQuaternion(carMesh.quaternion);
    const targetPos = carMesh.position.clone().add(cameraOffset);
    camera.position.lerp(targetPos, 0.1); // Smooth follow
    camera.lookAt(carMesh.position);

    renderer.render(scene, camera);
}

// Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start
animate();
