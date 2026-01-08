import { Vector3, Quaternion, ISimulationState } from './interfaces';
import { Vector3Utils as V3U, QuaternionUtils as Q4U } from '../utils/coordinates';

export class RigidBody {
    // Mass properties
    mass: number = 1000; // kg
    inverseMass: number = 1 / 1000;
    inertia: Vector3 = { x: 1000, y: 1000, z: 1000 }; // Simplified diagonal inertia tensor
    inverseInertia: Vector3 = { x: 1 / 1000, y: 1 / 1000, z: 1 / 1000 };

    // State (Integration vars)
    position: Vector3 = { x: 0, y: 0, z: 0 };
    velocity: Vector3 = { x: 0, y: 0, z: 0 };
    orientation: Quaternion = { x: 0, y: 0, z: 0, w: 1 };
    angularVelocity: Vector3 = { x: 0, y: 0, z: 0 };

    // Force accumulators
    private forceAccum: Vector3 = { x: 0, y: 0, z: 0 };
    private torqueAccum: Vector3 = { x: 0, y: 0, z: 0 };

    constructor(mass: number, inertia: Vector3) {
        this.mass = mass;
        this.inverseMass = mass > 0 ? 1.0 / mass : 0;
        this.inertia = inertia;
        this.inverseInertia = {
            x: inertia.x > 0 ? 1.0 / inertia.x : 0,
            y: inertia.y > 0 ? 1.0 / inertia.y : 0,
            z: inertia.z > 0 ? 1.0 / inertia.z : 0
        };
    }

    /**
     * Apply a force in world coordinates at a point in world coordinates.
     */
    addForceAtPoint(force: Vector3, point: Vector3): void {
        this.forceAccum = V3U.add(this.forceAccum, force);

        // Torque = r x F
        const r = V3U.sub(point, this.position);
        const torque = V3U.cross(r, force);
        this.torqueAccum = V3U.add(this.torqueAccum, torque);
    }

    /**
     * Apply a force in world coordinates to the Center of Mass.
     */
    addForce(force: Vector3): void {
        this.forceAccum = V3U.add(this.forceAccum, force);
    }

    /**
     * Apply a torque in world coordinates.
     */
    addTorque(torque: Vector3): void {
        this.torqueAccum = V3U.add(this.torqueAccum, torque);
    }

    /**
     * Semi-Implicit Euler Integration
     */
    integrate(dt: number): void {
        // 1. Linear Integration
        // a = F / m
        const acceleration = V3U.scale(this.forceAccum, this.inverseMass);
        // v = v + a * dt
        this.velocity = V3U.add(this.velocity, V3U.scale(acceleration, dt));
        // x = x + v * dt
        this.position = V3U.add(this.position, V3U.scale(this.velocity, dt));

        // 2. Angular Integration
        // alpha = I^-1 * T (Simplified for diagonal inertia in local frame usually, 
        // strictly we should rotate torque to local, apply invInertia, rotate back. 
        // For Step 2 simplified: assume local/world alignment approx or sphere inertia for stability first)

        // Correct way: alpha_local = invI_local * T_local
        // However, for vertical slice, let's treat inertia as world-aligned just to get it moving 
        // OR properly rotate. Let's do it semi-properly.
        // T_local = rot_inv * T_world
        // But Q4U doesn't have inverse rotate yet. 
        // Let's stick to world-space approximation for Step 2 if inertia is roughly isotropic 
        // OR just implement it properly.

        // Let's assume isotropic behavior for step 2 to minimize math bugs before Step 4.
        const angularAccel = {
            x: this.torqueAccum.x * this.inverseInertia.x,
            y: this.torqueAccum.y * this.inverseInertia.y,
            z: this.torqueAccum.z * this.inverseInertia.z
        };

        this.angularVelocity = V3U.add(this.angularVelocity, V3U.scale(angularAccel, dt));

        // q = q + 0.5 * w * q * dt
        this.orientation = Q4U.integrate(this.orientation, this.angularVelocity, dt);

        // Clear accumulators
        this.forceAccum = { x: 0, y: 0, z: 0 };
        this.torqueAccum = { x: 0, y: 0, z: 0 };

        // Damping (simple linear drag) for stability
        // Reduced to near-zero for Step 2 physics validation (gravity check).
        // Real air drag will be added later.
        this.velocity = V3U.scale(this.velocity, 1.0);
        this.angularVelocity = V3U.scale(this.angularVelocity, 0.999);
    }

    getState(): ISimulationState {
        // Need to fill all fields. Wheel speeds not tracked by RigidBody.
        // Returns "Base" state.
        return {
            timestamp: 0, // Assigned by manager
            position: V3U.clone(this.position),
            velocity: V3U.clone(this.velocity),
            orientation: { ...this.orientation },
            angularVelocity: V3U.clone(this.angularVelocity),
            wheelSpeeds: [0, 0, 0, 0],
            engineRPM: 0,
            gear: 0,
            engineTorque: 0
        };
    }
}
