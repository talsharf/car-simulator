import * as THREE from 'three';
import { ISimulationState, IEnvironment } from '../core/interfaces';

export class SceneRenderer {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private carMesh: THREE.Mesh;
    private wheelMeshes: THREE.Mesh[] = [];

    constructor(env: IEnvironment) {
        // --- THREE.JS SETUP ---
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xa0a0a0);
        this.scene.fog = new THREE.Fog(0xa0a0a0, 10, 500);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, -10, 5);
        this.camera.up.set(0, 0, 1);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);

        // Lights
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
        hemiLight.position.set(0, 0, 20);
        this.scene.add(hemiLight);

        const dirLight = new THREE.DirectionalLight(0xffffff);
        dirLight.position.set(50, 20, 10); // Lower angle for better shadows on hills
        dirLight.castShadow = true;
        this.scene.add(dirLight);

        // Ground
        // Ground
        // Create a segmented plane to represent the terrain
        const size = 400;
        const segments = 100;
        const geometry = new THREE.PlaneGeometry(size, size, segments, segments);

        // Update vertices based on Environment
        const positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            // Height from environment
            const z = env.getGroundHeight(x, y);
            positions.setZ(i, z);
        }

        geometry.computeVertexNormals();

        const groundMesh = new THREE.Mesh(
            geometry,
            new THREE.MeshPhongMaterial({
                color: 0x999999,
                shininess: 0,
                specular: 0x000000
            })
        );
        groundMesh.receiveShadow = true;
        this.scene.add(groundMesh);

        // Add wireframe overlay (slightly darker color)
        // Base is 0x999999 (approx 0.6 gray). Darker would be 0x555555.
        const wireframe = new THREE.WireframeGeometry(geometry);
        const line = new THREE.LineSegments(wireframe);
        // Using a LineBasicMaterial with color significantly darker than 0x999999
        // 0x999999 is ~153, 153, 153. Let's try 0x555555 (~85, 85, 85).
        line.material = new THREE.LineBasicMaterial({ color: 0x222222, opacity: 0.75, transparent: true });
        // Start slightly higher to reduce z-fighting, though lines usually render over faces well enough
        // Or just adding it as child ensures transforms match (though ground is at 0,0,0)
        groundMesh.add(line);

        /* Grid is less useful on wavy terrain, disabling or keeping it flat at 0?
           Let's remove the flat grid as it will intersect the hills uglily.
        const grid = new THREE.GridHelper(1000, 100);
        grid.rotation.x = Math.PI / 2;
        this.scene.add(grid); 
        */

        // Car Body (Transparent Box)
        const carGeometry = new THREE.BoxGeometry(4.8, 2.0, 1.5);
        const carMaterial = new THREE.MeshPhongMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.3,
            depthWrite: false
        });
        this.carMesh = new THREE.Mesh(carGeometry, carMaterial);
        this.carMesh.castShadow = true;

        // Wireframe
        const carEdges = new THREE.EdgesGeometry(carGeometry);
        const carLines = new THREE.LineSegments(carEdges, new THREE.LineBasicMaterial({ color: 0x000000 }));
        this.carMesh.add(carLines);

        this.scene.add(this.carMesh);

        // Wheels (4 Cylinders)
        const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 32);
        // Base material is reused, we need unique materials for color changes

        for (let i = 0; i < 4; i++) {
            const mat = new THREE.MeshPhongMaterial({ color: 0x333333 });
            const w = new THREE.Mesh(wheelGeo, mat);
            w.castShadow = true;
            this.scene.add(w);
            this.wheelMeshes.push(w);
        }

        // Resize Listener
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    public render(state: ISimulationState) {
        // Update Car Position/Rotation
        this.carMesh.position.set(state.position.x, state.position.y, state.position.z);
        this.carMesh.quaternion.set(state.orientation.x, state.orientation.y, state.orientation.z, state.orientation.w);

        // Update Wheels
        if (state.wheelTransforms) {
            for (let i = 0; i < 4; i++) {
                const t = state.wheelTransforms[i];
                if (t) {
                    this.wheelMeshes[i].position.set(t.position.x, t.position.y, t.position.z);
                    this.wheelMeshes[i].quaternion.set(t.orientation.x, t.orientation.y, t.orientation.z, t.orientation.w);

                    // Skid Visualization
                    // Default Grey: 0.2, 0.2, 0.2
                    // Skid Red: 1.0, 0.0, 0.0
                    if (state.wheelSkids && state.wheelSkids[i] !== undefined) {
                        const skid = state.wheelSkids[i];
                        const mat = this.wheelMeshes[i].material as THREE.MeshPhongMaterial;
                        const r = 0.2 + (0.8 * skid);
                        const gb = 0.2 * (1.0 - skid);
                        mat.color.setRGB(r, gb, gb);
                    }
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
        const cameraOffset = relativeOffset.applyQuaternion(this.carMesh.quaternion);
        const targetPos = this.carMesh.position.clone().add(cameraOffset);
        this.camera.position.lerp(targetPos, 0.1); // Smooth follow
        this.camera.lookAt(this.carMesh.position);

        this.renderer.render(this.scene, this.camera);
    }
}
