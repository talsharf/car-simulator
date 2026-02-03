import * as THREE from 'three';
import { ISimulationState, IEnvironment, Vector3 } from '../core/interfaces';

export class SceneRenderer {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private carMesh: THREE.Mesh;
    private wheelMeshes: THREE.Mesh[] = [];

    // Terrain Chunking
    private chunks: Map<string, THREE.Mesh> = new Map();
    private env: IEnvironment;
    private chunkSize = 50; // Size of each chunk in meters
    private drawDistance = 3; // Number of chunks in each direction (radius)

    constructor(env: IEnvironment) {
        this.env = env;
        // --- THREE.JS SETUP ---
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xa0a0a0);
        this.scene.fog = new THREE.Fog(0xa0a0a0, 20, 300); // adjusted fog for infinite feel

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
        dirLight.shadow.camera.top = 50;
        dirLight.shadow.camera.bottom = -50;
        dirLight.shadow.camera.left = -50;
        dirLight.shadow.camera.right = 50;
        this.scene.add(dirLight);

        // Ground - initialized in render loop dynamically

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

    private updateTerrain(position: Vector3) {
        // 1. Identify current chunk coordinates
        const curChunkX = Math.floor(position.x / this.chunkSize);
        const curChunkY = Math.floor(position.y / this.chunkSize);

        const activeKeys = new Set<string>();

        // 2. Iterate around draw distance
        for (let i = -this.drawDistance; i <= this.drawDistance; i++) {
            for (let j = -this.drawDistance; j <= this.drawDistance; j++) {
                const cx = curChunkX + i;
                const cy = curChunkY + j;
                const key = `${cx}_${cy}`;
                activeKeys.add(key);

                if (!this.chunks.has(key)) {
                    this.createChunk(cx, cy);
                }
            }
        }

        // 3. Remove old chunks
        for (const [key, mesh] of this.chunks.entries()) {
            if (!activeKeys.has(key)) {
                this.scene.remove(mesh);
                mesh.geometry.dispose();
                (mesh.material as THREE.Material).dispose();
                this.chunks.delete(key);
            }
        }
    }

    private createChunk(ix: number, iy: number) {
        const segs = 20; // vertex resolution
        const geometry = new THREE.PlaneGeometry(this.chunkSize, this.chunkSize, segs, segs);

        const positions = geometry.attributes.position;
        const colors = new Float32Array(positions.count * 3);

        const startX = ix * this.chunkSize;
        const startY = iy * this.chunkSize;

        for (let i = 0; i < positions.count; i++) {
            const lx = positions.getX(i); // Local coords relative to center
            const ly = positions.getY(i);

            // PlaneGeometry creates centered at 0,0
            // We need to translate to world space to query env
            // Plane geometry centers at (0,0), so it spans [-size/2, size/2]
            // We want the chunk to be placed at center (startX + size/2, startY + size/2) technically?
            // Easier: Translate geometry to be corner-based or handle offsets.
            // Let's assume we position the MESH at the center of the chunk.

            const wx = startX + (lx + this.chunkSize / 2); // lx is from -half to +half. Wait.
            // PlaneGeometry vertices: x goes from -width/2 to +width/2.
            // So if mesh is at world (cx * size, cy * size), then absolute pos is meshPos + lx.
            const meshWorldX = (ix * this.chunkSize); // Center? No, let's say ix,iy is index. 
            // If chunks form a grid, center of chunk ix,iy is at (ix+0.5)*size, (iy+0.5)*size.

            const centerX = (ix + 0.5) * this.chunkSize;
            const centerY = (iy + 0.5) * this.chunkSize;

            const absX = centerX + lx;
            const absY = centerY + ly;

            const z = this.env.getGroundHeight(absX, absY);
            positions.setZ(i, z);

            const c = this.env.getColor(absX, absY);
            colors[i * 3] = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;
        }

        geometry.computeVertexNormals();
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.MeshPhongMaterial({
            vertexColors: true,
            shininess: 0,
            specular: 0x000000
            // wireframe: true // Debug
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set((ix + 0.5) * this.chunkSize, (iy + 0.5) * this.chunkSize, 0);
        mesh.receiveShadow = true;

        this.scene.add(mesh);
        this.chunks.set(`${ix}_${iy}`, mesh);
    }

    public render(state: ISimulationState) {
        // Update Terrain
        this.updateTerrain(state.position);

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
