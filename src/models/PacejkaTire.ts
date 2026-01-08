export interface ITireForces {
    fx: number; // Longitudinal
    fy: number; // Lateral
    mz: number; // Aligning Torque
}

export class PacejkaTire {
    // Coefficients (Simplified Magic Formula for typical road tire)
    // Lateral
    private latB = 10.0;
    private latC = 1.30; // Shape factor (1.3 typical)
    private latD = 1.0;  // Peak (Friction coef approx)
    private latE = 0.97; // Curvature

    // Longitudinal
    private longB = 10.0;
    private longC = 1.65;
    private longD = 1.1; // Slightly higher grip longitudinally
    private longE = 0.97;

    /**
     * Calculate tire forces using Magic Formula
     * @param fz Vertical load (Newtons) - must be > 0
     * @param slipAngle Lateral slip (Radians)
     * @param slipRatio Longitudinal slip (ratio, -1 to 1 usually)
     */
    calculate(fz: number, slipAngle: number, slipRatio: number): ITireForces {
        // Valid load check
        if (fz <= 0) return { fx: 0, fy: 0, mz: 0 };

        // 1. Lateral Force (Fy)
        // y = D * sin(C * atan(B*x - E*(B*x - atan(B*x))))
        // F = y * Fz * lambda

        // Input x is slip angle
        const alpha = slipAngle;
        const Fy_norm = this.magicFormula(alpha, this.latB, this.latC, this.latD, this.latE);
        const Fy = -Fy_norm * fz; // Resists slip. Negative sign convention?
        // If slip is positive (turning left implies slip vector right?), force should be left.
        // Standard: Alpha positive -> Force negative.

        // 2. Longitudinal Force (Fx)
        // Input x is slip ratio
        const kappa = slipRatio;
        const Fx_norm = this.magicFormula(kappa, this.longB, this.longC, this.longD, this.longE);
        const Fx = Fx_norm * fz; // Drives/Brakes. Scaling sign matches slip.

        // Combined Slip (simplified friction circle limit)
        // If we just add them, we might exceed Fz * mu_total.
        // Simple scaling:
        // max F = Fz * D
        // F_total = sqrt(Fx^2 + Fy^2)
        // if F_total > max F, scale down.

        // This is "poor man's combined slip" but works for Step 3.
        /*
        const totalForce = Math.sqrt(Fx*Fx + Fy*Fy);
        const maxForce = fz * Math.max(this.latD, this.longD); // Approximate peak mu
        
        if (totalForce > maxForce) {
            const scale = maxForce / totalForce;
            return { fx: Fx * scale, fy: Fy * scale, mz: 0 };
        }
        */

        // For Step 3 verify, separate is clearer to debug. Let's start separate.

        // Aligning Moment (Mz) - Simplified
        // Pneumatic trail
        const trail = 0.02; // 2cm roughly
        const Mz = Fy * trail;

        return { fx: Fx, fy: Fy, mz: Mz };
    }

    private magicFormula(x: number, B: number, C: number, D: number, E: number): number {
        return D * Math.sin(C * Math.atan(B * x - E * (B * x - Math.atan(B * x))));
    }
}
