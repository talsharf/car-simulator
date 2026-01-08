import { PhysicsEngine } from '../src/core/PhysicsEngine';
import { IVehicleModel, IEnvironment, ISimulationState, IControlInput, Vector3 } from '../src/core/interfaces';
import { GRAVITY } from '../src/utils/constants';

// Deterministic Mock Components
class DeterministicMockVehicle implements IVehicleModel {
    private state: ISimulationState = {
        timestamp: 0,
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        wheelSpeeds: [0, 0, 0, 0],
        engineRPM: 0,
        gear: 0,
        engineTorque: 0
    };

    update(dt: number, inputs: IControlInput, env: IEnvironment): void {
        // Simple deterministic logic: pos += vel * dt; vel += input * dt
        // Floating point math is deterministic in JS node environment usually
        this.state.timestamp += dt;
        this.state.velocity.x += inputs.throttle * dt;
        this.state.position.x += this.state.velocity.x * dt;
    }

    getState(): ISimulationState {
        // Return a DEEP COPY to ensure no reference tampering
        return JSON.parse(JSON.stringify(this.state));
    }

    getTelemetryFromLastStep(): any { return {}; }
}

class MockEnvironment implements IEnvironment {
    getGravity(): Vector3 { return { x: 0, y: 0, z: -9.81 }; }
    getGroundHeight(x: number, y: number): number { return 0; }
    getGroundNormal(x: number, y: number): Vector3 { return { x: 0, y: 0, z: 1 }; }
}

describe('PhysicsEngine Determinism', () => {

    // Procedure: Run simulation twice with same inputs, assert exact state match
    test('should produce bit-exact output for identical inputs', () => {
        const runSimulation = () => {
            const vehicle = new DeterministicMockVehicle();
            const env = new MockEnvironment();
            const engine = new PhysicsEngine(vehicle, env);

            // Run for 100 steps
            const dt = 0.016; // 60hz frame time
            for (let i = 0; i < 100; i++) {
                // Vary input deterministically
                const throttle = i < 50 ? 1.0 : 0.0;
                engine.applyInput({ throttle, brake: 0, steering: 0 });
                engine.step(dt);
            }
            return engine.getState();
        };

        const resultA = runSimulation();
        const resultB = runSimulation();

        expect(resultA).toEqual(resultB);
        expect(resultA.position.x).toBeGreaterThan(0); // Ensure it actually moved
    });

    test('should handle variable frame times deterministically via accumulator', () => {
        // This test ensures that if we arrive at the same total time via different dt chunks, 
        // IF the accumulator logic is working, it should produce roughly same result?
        // Actually, classic accumulator logic produces exact same result ONLY if the fixed steps line up exactly.
        // If we sim 1.0s via 0.016 steps vs 1.0s via 0.032 steps (assuming fixed step is 0.016),
        // passing 0.032 to step() should trigger exactly 2 fixedUpdate(0.016).
        // passing 0.016 twice should trigger 1 fixedUpdate(0.016) each time.
        // Total fixedUpdates = 2. Result should be identical.

        const fixedStepConfigged = 1.0 / 60.0; // The constant in constants.ts

        const runWithDt = (dtToFeed: number) => {
            const vehicle = new DeterministicMockVehicle();
            const env = new MockEnvironment();
            const engine = new PhysicsEngine(vehicle, env);

            // We want to simulate exactly 0.1 seconds of physics time
            // If dtToFeed is 0.01666..., we call step 6 times? 
            // 6 * 1/60 = 0.1

            const totalTime = fixedStepConfigged * 10; // 10 ticks
            let accumulatedTime = 0;

            while (accumulatedTime < totalTime - 0.0001) {
                engine.applyInput({ throttle: 1.0, brake: 0, steering: 0 });
                engine.step(dtToFeed);
                accumulatedTime += dtToFeed;
            }
            return engine.getState();
        };

        // Scenario 1: Feed exact fixed timestep
        const resultA = runWithDt(fixedStepConfigged);

        // Scenario 2: Feed double the timestep (should trigger 2 updates per step)
        const resultB = runWithDt(fixedStepConfigged * 2);

        // Scenario 3: Feed half timestep (should trigger update every other step)
        const resultC = runWithDt(fixedStepConfigged * 0.5);

        expect(resultA.position.x).toBeCloseTo(resultB.position.x, 5);
        expect(resultA.position.x).toBeCloseTo(resultC.position.x, 5);

        // In a perfectly integer math world it would be equal, but floating point accumulation of 'dt' might drift slightly.
        // But the NUMBER OF STEPS should be identical if we are careful.
    });
});
