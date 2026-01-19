import { IEnvironment, Vector3 } from '../core/interfaces';
import { GRAVITY } from '../utils/constants';

export class Environment implements IEnvironment {
    getGravity(): Vector3 {
        return GRAVITY;
    }

    private seed = 12345;

    // Simple deterministic noise-like function (sum of sines)
    // We want some large rolling hills and some smaller bumps.
    getGroundHeight(x: number, y: number): number {
        const freq1 = 0.05;
        const amp1 = 5.0; // Increased from 2.0

        const freq2 = 0.15;
        const amp2 = 1.0; // Increased from 0.5

        const h1 = Math.sin(x * freq1) * Math.cos(y * freq1) * amp1;
        const h2 = Math.sin(x * freq2 + 100) * Math.cos(y * freq2 + 100) * amp2;

        return h1 + h2;
    }

    getGroundNormal(x: number, y: number): Vector3 {
        // Analytical derivative for the normal
        // h = A*sin(fx)*cos(fy) ...
        // dh/dx = A*f*cos(fx)*cos(fy)
        // dh/dy = -A*f*sin(fx)*sin(fy)

        const freq1 = 0.05;
        const amp1 = 5.0;
        const freq2 = 0.15;
        const amp2 = 1.0;

        // Derivative of h1
        const dh1_dx = amp1 * freq1 * Math.cos(x * freq1) * Math.cos(y * freq1);
        const dh1_dy = -amp1 * freq1 * Math.sin(x * freq1) * Math.sin(y * freq1);

        // Derivative of h2
        const dh2_dx = amp2 * freq2 * Math.cos(x * freq2 + 100) * Math.cos(y * freq2 + 100);
        const dh2_dy = -amp2 * freq2 * Math.sin(x * freq2 + 100) * Math.sin(y * freq2 + 100);

        const dz_dx = dh1_dx + dh2_dx;
        const dz_dy = dh1_dy + dh2_dy;

        // Normal vector is {-dz/dx, -dz/dy, 1} normalized
        const nx = -dz_dx;
        const ny = -dz_dy;
        const nz = 1;

        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        return { x: nx / len, y: ny / len, z: nz / len };
    }
}
