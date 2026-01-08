export class Suspension {
    // Tuning
    stiffness: number = 25000;
    damping: number = 2500;
    restLength: number = 0.5;

    // State
    compression: number = 0;
    prevCompression: number = 0;

    constructor(config: { stiffness: number, damping: number, restLength: number }) {
        this.stiffness = config.stiffness;
        this.damping = config.damping;
        this.restLength = config.restLength;
    }

    /**
     * Calculate vertical force at this corner
     * @param compressionDepth Amount compressed beyond rest length (Current < Rest)
     * @param dt Timestep for damping calc
     */
    update(compressionDepth: number, dt: number): number {
        this.prevCompression = this.compression;
        this.compression = compressionDepth;

        if (this.compression <= 0) return 0; // Air born

        // F = k * x
        const springForce = this.compression * this.stiffness;

        // F_damp = -c * velocity
        // Velocity = (current - prev) / dt ? No, this is noisy.
        // Ideally pass in vertical velocity from physics body. 
        // But for component isolation, finite difference is okay for Step 3 if dt is fixed.
        // Actually, let's accept velocity as input for better stability if caller has it.
        // For now, finite difference:
        const velocity = (this.compression - this.prevCompression) / dt;
        const dampingForce = velocity * this.damping;

        return springForce + dampingForce;
    }
}
