import { IEnvironment, Vector3 } from '../core/interfaces';
import { GRAVITY } from '../utils/constants';

export class Environment implements IEnvironment {
    getGravity(): Vector3 {
        return GRAVITY;
    }

    private seed = 12345;

    // Road Parameters
    private roadWidth = 12.0; // Increased width (was 8.0)
    private roadBlend = 1.5;  // Sharper transition (was 4.0)

    // Gets the Y center of the road for a given X
    private getRoadY(x: number): number {
        // More complex winding road - 3 layers of noise
        const base = Math.sin(x * 0.004) * 60.0;
        const mide = Math.sin(x * 0.015) * 20.0;
        const tight = Math.sin(x * 0.05) * 5.0;
        return base + mide + tight;
    }

    getGroundHeight(x: number, y: number): number {
        const roadCenterY = this.getRoadY(x);
        const dist = Math.abs(y - roadCenterY);

        // 1. Road Height Profile (Very Flat/Gentle)
        // Only very low frequency changes so it doesn't go up/down much
        const roadProfileH = Math.sin(x * 0.01) * 2.0;

        // 2. Terrain / Hills (Valley Effect)
        // We want hills to rise as we get further from the road.

        // Base noise for hills
        const freq1 = 0.05;
        const freq2 = 0.15;
        let hills = Math.sin(x * freq1) * Math.cos(y * freq1) * 6.0;
        hills += Math.sin(x * freq2 + 100) * Math.cos(y * freq2 + 100) * 1.5;

        // Canyon/Valley Slope: Terrain rises linearly with distance from road
        const valleySlope = 0.15; // 1.5m rise per 10m distance
        const valleyRise = dist * valleySlope;

        // Combine: Road Profile + (Hills + ValleyRise) * BlendFactor
        // We want the road area to be exactly roadProfileH.
        // As we move away, we blend in the hills + valley rise.

        let terrainH = roadProfileH + valleyRise + hills;

        // 3. Blending
        if (dist < this.roadWidth / 2) {
            // Strictly on road
            return roadProfileH;
        } else if (dist < (this.roadWidth / 2) + this.roadBlend) {
            // Blending zone
            const alpha = (dist - (this.roadWidth / 2)) / this.roadBlend;
            // Smoothstep
            const smoothObj = alpha * alpha * (3 - 2 * alpha);
            // Blend from RoadProfile to TerrainH
            return roadProfileH * (1 - smoothObj) + terrainH * smoothObj;
        } else {
            return terrainH;
        }
    }

    getGroundNormal(x: number, y: number): Vector3 {
        // Finite difference method is robust for blended terrains
        const eps = 0.1;
        const h = this.getGroundHeight(x, y);
        const hx = this.getGroundHeight(x + eps, y);
        const hy = this.getGroundHeight(x, y + eps);

        const dx = (hx - h) / eps;
        const dy = (hy - h) / eps;

        // Vector is {-dx, -dy, 1} normalized
        const len = Math.sqrt(dx * dx + dy * dy + 1);
        return { x: -dx / len, y: -dy / len, z: 1 / len };
    }

    getFriction(x: number, y: number): number {
        const roadCenterY = this.getRoadY(x);
        const dist = Math.abs(y - roadCenterY);

        if (dist < this.roadWidth / 2) {
            return 1.0; // Tarmac
        } else if (dist < (this.roadWidth / 2) + this.roadBlend) {
            // Gravel/Grass transition
            const alpha = (dist - (this.roadWidth / 2)) / this.roadBlend;
            return 1.0 * (1 - alpha) + 0.6 * alpha;
        } else {
            return 0.6; // Grass/Offroad
        }
    }

    getColor(x: number, y: number): { r: number, g: number, b: number } {
        const roadCenterY = this.getRoadY(x);
        const dist = Math.abs(y - roadCenterY);

        if (dist < this.roadWidth / 2) {
            return { r: 0.2, g: 0.2, b: 0.2 }; // Dark Grey Road
        } else if (dist < (this.roadWidth / 2) + this.roadBlend) {
            const alpha = (dist - (this.roadWidth / 2)) / this.roadBlend;
            // Blend Grey to Green
            return {
                r: 0.2 + (0.3 - 0.2) * alpha,
                g: 0.2 + (0.6 - 0.2) * alpha,
                b: 0.2 + (0.3 - 0.2) * alpha
            };
        } else {
            return { r: 0.3, g: 0.6, b: 0.3 }; // Green Grass
        }
    }
}
