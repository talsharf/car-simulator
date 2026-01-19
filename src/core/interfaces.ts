
/**
 * 3D Vector interface (SI units: meters)
 */
export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

/**
 * Quaternion rotation interface
 */
export interface Quaternion {
    x: number;
    y: number;
    z: number;
    w: number;
}

/**
 * Valid reference frames for the simulator to ensure strict coordinate system usage.
 */
export enum FrameType {
    WORLD = 'WORLD',
    VEHICLE_COM = 'VEHICLE_COM', // Center of Mass
    VEHICLE_REAR_AXLE = 'VEHICLE_REAR_AXLE',
    WHEEL_FL = 'WHEEL_FL',
    WHEEL_FR = 'WHEEL_FR',
    WHEEL_RL = 'WHEEL_RL',
    WHEEL_RR = 'WHEEL_RR'
}

/**
 * Represents the full physical state of the vehicle at a specific timestamp.
 * Used for determinism checks and telemetry.
 */
export interface ISimulationState {
    timestamp: number;
    position: Vector3;       // World frame
    velocity: Vector3;       // World frame, m/s
    orientation: Quaternion; // World frame
    angularVelocity: Vector3;// Vehicle frame, rad/s

    // Wheel states (simplification for now, expandable later)
    wheelSpeeds: [number, number, number, number]; // FL, FR, RL, RR in rad/s

    // Per-wheel rendering info (Position/Rotation in World Frame)
    wheelTransforms?: { position: Vector3, orientation: Quaternion }[];
    wheelSkids?: number[]; // 0.0 to 1.0 intensity of skid

    // Drivetrain state
    engineRPM: number;
    gear: number;
    engineTorque: number;
}

/**
 * Inputs to the system (Control inputs)
 */
export interface IControlInput {
    throttle: number; // 0.0 to 1.0
    brake: number;    // 0.0 to 1.0
    steering: number; // -1.0 (right) to 1.0 (left) - Convention check needed? 
    // Usually + is Left in Z-up right-handed systems (follows right hand rule around Z)
}

/**
 * Core Physics Engine Interface
 */
export interface IPhysicsCore {
    step(dt: number): void;
    getState(): ISimulationState;
    applyInput(input: IControlInput): void;
    reset(position: Vector3, orientation: Quaternion): void;
}

/**
 * Vehicle Model Interface - Defines how the car reacts to forces
 */
export interface IVehicleModel {
    update(dt: number, inputs: IControlInput, env: IEnvironment): void;
    getState(): ISimulationState;
    // Helper to get forces for debugging/telemetry
    getTelemetryFromLastStep(): any;
}

/**
 * Environment Interface - Gravity, Terrain
 */
export interface IEnvironment {
    getGravity(): Vector3;
    getGroundHeight(x: number, y: number): number;
    getGroundNormal(x: number, y: number): Vector3;
}

/**
 * Telemetry Interface - For logging
 */
export interface ITelemetry {
    log(state: ISimulationState, inputs: IControlInput): void;
}

/**
 * Renderer Interface - For optional visualization
 */
export interface IRenderer {
    render(state: ISimulationState): void;
}

/**
 * Configuration schema for data-driven vehicle loading
 */
export interface IVehicleConfig {
    mass: number;
    inertia: Vector3;
    suspension: {
        stiffness: number;
        damping: number;
        restLength: number;
    };
    tires: {
        radius: number;
        offsets: Vector3[];
    };
    drivetrain: {
        engine: {
            maxRPM: number;
            idleRPM: number;
            peakTorque: number;
            peakRPM: number;
            inertia: number;
        };
        transmission: {
            gears: number[];
            finalDrive: number;
        };
    };
}
