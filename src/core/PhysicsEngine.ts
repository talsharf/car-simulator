import { IPhysicsCore, ISimulationState, IControlInput, IVehicleModel, IEnvironment, Vector3, Quaternion } from './interfaces';
import { FIXED_TIMESTEP } from '../utils/constants';
import { Vector3Utils, QuaternionUtils } from '../utils/coordinates';

export class PhysicsEngine implements IPhysicsCore {
    private vehicle: IVehicleModel;
    private env: IEnvironment;
    private accumulator: number = 0;
    private currentTime: number = 0;

    constructor(vehicle: IVehicleModel, env: IEnvironment) {
        this.vehicle = vehicle;
        this.env = env;
    }

    /**
     * Advances the simulation by dt seconds (wall clock time).
     * Uses a fixed timestep accumulator to ensure deterministic physics updates.
     */
    step(dt: number): void {
        // Prevent spiral of death if dt is huge (e.g. debugging pause)
        if (dt > 0.25) dt = 0.25;

        this.accumulator += dt;

        while (this.accumulator >= FIXED_TIMESTEP) {
            this.fixedUpdate(FIXED_TIMESTEP);
            this.accumulator -= FIXED_TIMESTEP;
            this.currentTime += FIXED_TIMESTEP;
        }
    }

    /**
     * The deterministic physics update step.
     */
    private fixedUpdate(dt: number): void {
        // 1. Get Inputs (assumed static for this sub-step or fetched from vehicle/controller)
        // For this architecture, inputs are passed via applyInput roughly, 
        // but real vehicle model might store current input state.

        // 2. Update Vehicle Physics
        // We need to pass the *current* inputs to the vehicle.
        // For now, let's assume the vehicle stores its latest accepted input.
        this.vehicle.update(dt, this.currentInput, this.env);
    }

    private currentInput: IControlInput = { throttle: 0, brake: 0, steering: 0 };

    applyInput(input: IControlInput): void {
        this.currentInput = input;
    }

    getState(): ISimulationState {
        return this.vehicle.getState();
    }

    reset(position: Vector3, orientation: Quaternion): void {
        this.accumulator = 0;
        this.currentTime = 0;
        // Check if vehicle has reset... simplistic for now
        // Ideally VehicleModel has a reset method.
        // For Step 1, we just care about loop structure.
    }
}
