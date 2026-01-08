import { Vector3, Quaternion } from '../core/interfaces';

export class Vector3Utils {
    static zero(): Vector3 {
        return { x: 0, y: 0, z: 0 };
    }

    static add(a: Vector3, b: Vector3): Vector3 {
        return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
    }

    static scale(v: Vector3, s: number): Vector3 {
        return { x: v.x * s, y: v.y * s, z: v.z * s };
    }

    static clone(v: Vector3): Vector3 {
        return { ...v };
    }

    static sub(a: Vector3, b: Vector3): Vector3 {
        return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
    }

    static dot(a: Vector3, b: Vector3): number {
        return a.x * b.x + a.y * b.y + a.z * b.z;
    }

    static cross(a: Vector3, b: Vector3): Vector3 {
        return {
            x: a.y * b.z - a.z * b.y,
            y: a.z * b.x - a.x * b.z,
            z: a.x * b.y - a.y * b.x
        };
    }

    static magnitude(v: Vector3): number {
        return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    }

    static normalize(v: Vector3): Vector3 {
        const l = this.magnitude(v);
        if (l === 0) return { x: 0, y: 0, z: 0 };
        return this.scale(v, 1.0 / l);
    }

    // Rotate vector v by quaternion q
    static rotate(v: Vector3, q: Quaternion): Vector3 {
        // v' = q * v * q_conjugate
        // Optimized implementation
        const ix = q.w * v.x + q.y * v.z - q.z * v.y;
        const iy = q.w * v.y + q.z * v.x - q.x * v.z;
        const iz = q.w * v.z + q.x * v.y - q.y * v.x;
        const iw = -q.x * v.x - q.y * v.y - q.z * v.z;

        return {
            x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,
            y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,
            z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x
        };
    }
}

export class QuaternionUtils {
    static identity(): Quaternion {
        return { x: 0, y: 0, z: 0, w: 1 };
    }

    static multiply(a: Quaternion, b: Quaternion): Quaternion {
        return {
            x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
            y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
            z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
            w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z
        };
    }

    static normalize(q: Quaternion): Quaternion {
        const l = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
        if (l === 0) return { x: 0, y: 0, z: 0, w: 1 };
        return { x: q.x / l, y: q.y / l, z: q.z / l, w: q.w / l };
    }

    // Integrate quaternion by angular velocity (w) over dt
    // q_new = q + 0.5 * w * q * dt
    static integrate(q: Quaternion, w: Vector3, dt: number): Quaternion {
        const hdt = dt * 0.5;
        const qx = q.x, qy = q.y, qz = q.z, qw = q.w;
        const wx = w.x, wy = w.y, wz = w.z;

        const newQ = {
            x: qx + (wx * qw + wy * qz - wz * qy) * hdt,
            y: qy + (wy * qw + wz * qx - wx * qz) * hdt,
            z: qz + (wz * qw + wx * qy - wy * qx) * hdt,
            w: qw + (-wx * qx - wy * qy - wz * qz) * hdt
        };
        return this.normalize(newQ);
    }
}
