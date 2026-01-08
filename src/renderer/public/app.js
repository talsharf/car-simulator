const socket = io();

// Three.js Setup
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
const wheelMeshes = [];
const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 32);
// Cylinder is Y-up. Rotate PI/2 around Z to align? No.
// If Cylinder is Y-up, and we want it to roll along X, axis is Y.
// ThreeJS Cylinder is aligned along Y axis. 
// Car Wheel axis is Y (Left/Right). 
// So Cylinder geometry is already correctly aligned with the local wheel frame axis (Y).
// BUT wait, we orient the wheel quaternion based on World Frame.
// If we send a Quaternion that transforms (1,0,0) to Forward, (0,1,0) to Left...
// And the cylinder geometry is aligned along Y.
// Then applying the Quaternion will align the cylinder along the Left vector. Correct.
// However, typically wheels are cylinders with flat sides on +/- Y.
// Let's create `wheelGeo` and rotate it if needed.
// Actually, standard cylinder has flat faces at +Y and -Y.
// This matches the "Axle" axis.
// So yes, default Cylinder geometry matches the Wheel Spin Axis (Y).

const wheelMat = new THREE.MeshPhongMaterial({ color: 0x333333 });

for (let i = 0; i < 4; i++) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.castShadow = true;
    scene.add(w);
    wheelMeshes.push(w);
}

// Input Handling
const keys = {
    w: false, a: false, s: false, d: false,
    ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false
};

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = true;
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
});

function sendInput() {
    let throttle = 0;
    let brake = 0;
    let steering = 0;

    if (keys.w || keys.ArrowUp) throttle = 1.0;
    if (keys.s || keys.ArrowDown) brake = 1.0;
    if (keys.a || keys.ArrowLeft) steering = 1.0;
    if (keys.d || keys.ArrowRight) steering = -1.0;

    socket.emit('control_input', { throttle, brake, steering });
}

// State Update
socket.on('update_state', (state) => {
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

                // Correction: My Quaternion calculation in Vehicle.ts produces a frame where:
                // X = Forward, Y = Left, Z = Up.
                // ThreeJS Cylinder is aligned along Y (Height).
                // So if we apply this Q, the cylinder will align with the Left axis.
                // This results in the "rolling face" facing Fore/Aft? No.
                // A cylinder along Y looks like a wheel. Its round face rolls along X.
                // So this should be correct.

                // However, ThreeJS rotation order or Cylinder orientation might need a visual check.
                // Usually for a wheel rolling forward (X), the axle is Y.
                // Cylinder is "tall" along Y. So yes, it represents the axle/width.
                // The flat caps are Left/Right.
                // This seems correct.
            }
        }
    }

    // Update Speed UI
    const speed = Math.sqrt(state.velocity.x ** 2 + state.velocity.y ** 2 + state.velocity.z ** 2) * 3.6; // km/h
    const rpm = state.engineRPM ? state.engineRPM.toFixed(0) : "0";
    const gear = state.gear;

    document.getElementById('speed').innerText = `${speed.toFixed(0)} km/h | ${rpm} RPM | G: ${gear}`;

    // Camera Follow
    const relativeOffset = new THREE.Vector3(-9, 3, 3.5);
    const cameraOffset = relativeOffset.applyQuaternion(carMesh.quaternion);
    const targetPos = carMesh.position.clone().add(cameraOffset);
    camera.position.lerp(targetPos, 0.1); // Smooth follow
    camera.lookAt(carMesh.position);
});

// Animation Loop
function animate() {
    requestAnimationFrame(animate);
    sendInput();
    renderer.render(scene, camera);
}

animate();

// Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
