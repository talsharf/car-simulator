import { PhysicsEngine } from './core/PhysicsEngine';
import { Environment } from './models/Environment';
import { Vehicle } from './models/Vehicle';
import { VisServer } from './renderer/VisServer';
import { FIXED_TIMESTEP } from './utils/constants';
import { VehicleLoader } from './io/VehicleLoader';
import path from 'path';

export function runSimulation() {
    const env = new Environment();

    // Load Config
    const configName = process.argv[2] || 'vehicle_config.json';
    console.log(`Loading config: ${configName}`);
    const configPath = path.join(__dirname, `../assets/${configName}`);
    const config = VehicleLoader.load(configPath);

    const vehicle = new Vehicle(config);
    const engine = new PhysicsEngine(vehicle, env);
    const renderer = new VisServer();

    console.log("Starting Interactive Simulation...");
    console.log("Open browser to drive. Ctrl+C to stop.");

    // Loop Config
    const loopInterval = 1000 / 60; // 60Hz target
    let lastTime = 0; // Steps counter

    // Use setInterval for the game loop to allow IO events (Socket/Http) to process
    setInterval(() => {
        // 1. Get Input
        const input = renderer.getInput();

        // 2. Step Physics
        engine.applyInput(input);

        // Use fixed timestep for physics stability
        // Note: In a real game loop we'd measure delta time and accumulate.
        // For simple Node implementation, we trust setInterval is roughly 16ms.
        // PhysicsEngine has an accumulator protection anyway.
        engine.step(FIXED_TIMESTEP);

        // 3. Render / Telemetry
        const state = engine.getState();
        renderer.render(state);

        // Optional log periodically
        if (Math.random() < 0.01) { // Occasional log
            // console.log(`Speed: ${state.velocity.x.toFixed(1)} m/s`);
        }

    }, loopInterval);
}

if (require.main === module) {
    runSimulation();
}
