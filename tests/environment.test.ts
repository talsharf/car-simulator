import { Environment } from '../src/models/Environment';
import { Vector3 } from '../src/core/interfaces';

describe('Environment Model', () => {
    let env: Environment;

    beforeEach(() => {
        env = new Environment();
    });

    test('getGroundHeight should be deterministic', () => {
        const h1 = env.getGroundHeight(10, 20);
        const h2 = env.getGroundHeight(10, 20);
        expect(h1).toBe(h2);
    });

    test('getGroundHeight should vary with position (complex terrain)', () => {
        const h1 = env.getGroundHeight(0, 0);
        const h2 = env.getGroundHeight(50, 50);

        // Assert that we have some non-zero terrain or at least variation
        // Since my formula is sum of sines, it's unlikely to be 0 everywhere.
        // Also h1 might be 0 if sin(0)=0.
        expect(h1).toBeDefined();

        // Check multiple points to ensure hills exists
        const heights = [
            env.getGroundHeight(10, 10),
            env.getGroundHeight(20, 20),
            env.getGroundHeight(30, 30)
        ];

        // Check if there is variance
        const allSame = heights.every(h => h === heights[0]);
        expect(allSame).toBe(false);
    });

    test('getGroundNormal should return normalized vectors', () => {
        const n = env.getGroundNormal(15, 15);
        const len = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z);
        expect(len).toBeCloseTo(1, 5);
    });

    test('getGroundNormal should reflect slope', () => {
        // At (0,0), sin(0)=0. H = 0.
        // Calculated derivatives in Environment.ts were:
        // dh/dx = A*f*cos(0)*cos(0) = A*f
        // So slopes should be non-zero at origin.
        const n = env.getGroundNormal(0, 0);

        // If slope is positive in X, normal X should be negative (-dz/dx)
        // Check that normal is not just pure Z up (0,0,1)
        expect(n.x).not.toBe(0);
        expect(n.z).toBeGreaterThan(0); // Still pointing up somewhat
        expect(n.z).toBeLessThan(1); // Tilted
    });
});
