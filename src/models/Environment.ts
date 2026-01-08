import { IEnvironment, Vector3 } from '../core/interfaces';
import { GRAVITY } from '../utils/constants';

export class Environment implements IEnvironment {
    getGravity(): Vector3 {
        return GRAVITY;
    }

    getGroundHeight(x: number, y: number): number {
        return 0; // Flat ground at Z=0
    }

    getGroundNormal(x: number, y: number): Vector3 {
        return { x: 0, y: 0, z: 1 }; // Always Up
    }
}
