import { Vector3, IControlInput } from '../core/interfaces';
import { Vector3Utils as V3U } from '../utils/coordinates';

export class Tire {
    // Configuration
    offset: Vector3; // Position relative to Vehicle Center (Top mounting point)
    stiffness: number = 25000; // Suspension Spring N/m
    damping: number = 2500;    // Suspension Damper N/(m/s)
    restLength: number = 0.5;  // m
    radius: number = 0.3;      // m

    // State
    suspensionLength: number = 0.5;
    wheelSpeed: number = 0; // rad/s (Simplification: Angular velocity about axle Y)

    constructor(offset: Vector3, radius: number) {
        this.offset = offset;
        this.radius = radius;
    }

    /**
     * Calculate suspension and tire forces
     * @param groundHeight Height of ground at this wheel's XY position
     * @param groundNormal Normal of ground (usually Z-up)
     * @param velocityAtHub Velocity vector of the wheel hub in WORLD frame
     * @param input Controls
     */
    calculateForce(
        groundHeight: number,
        groundNormal: Vector3,
        velocityAtHub: Vector3,
        input: IControlInput
    ): Vector3 {
        // 1. Suspension Force (Vertical)
        // Hub Z vs Ground Z
        // World Position of hub is done in Vehicle update usually, but we need it here.
        // Let's assume the Vehicle passes us strict constraints or we compute derived values.

        // Simplified Step 2:
        // We need the compression.
        // Let's assume the caller passes us the *current* world position of the MOUNTING POINT?
        // Or the Hub? RigidBody gives us the mounting point position + orientation rotation.
        // Let's refine the API in Vehicle.ts.
        // For now, let's just make a generic force calculator that Vehicle calls with calculated slips/compressions.

        return { x: 0, y: 0, z: 0 }; // Placeholder, logic moved to Vehicle.ts internal loop or refined here after Vehicle design
    }
}
