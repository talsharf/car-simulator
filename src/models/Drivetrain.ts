import { IControlInput } from '../core/interfaces';

export interface IDrivetrainState {
    rpm: number;
    gear: number;
    torqueToWheels: number; // Avg torque per driven wheel approximately
}

export class Engine {
    rpm: number = 1000;
    maxRPM: number = 7000;
    idleRPM: number = 1000;
    inertia: number = 0.2;

    // Config for curve
    peakTorque: number = 300;
    peakRPM: number = 4000;

    constructor(config: { maxRPM: number, idleRPM: number, peakTorque: number, peakRPM: number, inertia: number }) {
        this.maxRPM = config.maxRPM;
        this.idleRPM = config.idleRPM;
        this.peakTorque = config.peakTorque;
        this.peakRPM = config.peakRPM;
        this.inertia = config.inertia;
        this.rpm = this.idleRPM; // Start at idle
    }

    // Torque Curve (Nm)
    getTorqueCurve(rpm: number): number {
        if (rpm < 0) return 0;
        if (rpm > this.maxRPM) return 0; // Cutoff

        // Basic Parabola approximation
        // T = T_peak - k * (rpm - rpm_peak)^2
        const k = 0.000015; // Tuning factor, maybe config?

        let torque = this.peakTorque - k * Math.pow(rpm - this.peakRPM, 2);
        return Math.max(50, torque);
    }

    update(dt: number, throttle: number, loadTorque: number): number {
        // ... (Logic same, but constructor handled init)
        // I need to include the update method here or ensure replace works.
        // I will copy the update method content to be safe or just target up to update.
        // Actually, 'update' is below. I'll include it or let it be.
        // The ReplaceFileContent works by replacing TargetContent.
        // I need to be careful not to delete 'update'.
        // My ReplacementContent ends before 'update'. 

        // Wait, I need to match the TargetContent exactly.
        // Let's rewrite the Class Engine fully.
        const combustionTorque = this.getTorqueCurve(this.rpm) * throttle;
        const frictionTorque = this.rpm * 0.01;

        const netTorque = combustionTorque - frictionTorque - loadTorque;

        const angularAccel = netTorque / this.inertia;
        this.rpm += (angularAccel * dt) * (60 / (2 * Math.PI));

        if (this.rpm < this.idleRPM) this.rpm = this.idleRPM;
        if (this.rpm > this.maxRPM) this.rpm = this.maxRPM;

        return combustionTorque;
    }
}

export class Transmission {
    gears: number[] = [3.5, 2.0, 1.4, 1.0, 0.8];
    currentGear: number = 1;
    finalDrive: number = 3.5;
    shiftTimer: number = 0;

    constructor(config: { gears: number[], finalDrive: number }) {
        this.gears = config.gears;
        this.finalDrive = config.finalDrive;
    }

    getRatio(): number {
        if (this.currentGear === 0) return 0; // Neutral
        if (this.currentGear === -1) return -3.5; // Reverse
        return this.gears[this.currentGear - 1] * this.finalDrive;
    }

    updateAutomatic(rpm: number, throttle: number, dt: number) {
        this.shiftTimer -= dt;
        if (this.shiftTimer > 0) return;

        // Upshift
        if (rpm > 6000 && this.currentGear < 5) {
            this.currentGear++;
            this.shiftTimer = 0.5;
        }
        // Downshift
        if (rpm < 2500 && this.currentGear > 1) {
            this.currentGear--;
            this.shiftTimer = 0.5;
        }
    }
}
