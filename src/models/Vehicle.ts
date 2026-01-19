import { IVehicleModel, IControlInput, IEnvironment, ISimulationState, Vector3, Quaternion, IVehicleConfig } from '../core/interfaces';
import { RigidBody } from '../core/RigidBody';
import { Tire } from './Tire';
import { PacejkaTire } from './PacejkaTire';
import { Engine, Transmission } from './Drivetrain';
import { Suspension } from './Suspension';
import { Vector3Utils as V3U, QuaternionUtils as Q4U } from '../utils/coordinates';

export class Vehicle implements IVehicleModel {
    body: RigidBody;

    // Components
    tires: Tire[] = [];
    pacejka: PacejkaTire;
    suspensions: Suspension[] = [];

    // Drivetrain
    engine: Engine;
    trans: Transmission;

    // Visualization
    private wheelTransforms: { position: Vector3, orientation: Quaternion }[] = [];
    private wheelSkids: number[] = [0, 0, 0, 0];

    // Constructor now takes Config and uses it
    constructor(config: IVehicleConfig) {
        this.body = new RigidBody(config.mass, config.inertia);
        this.body.position = { x: 0, y: 0, z: 0.6 }; // Hardcoded spawn for now

        this.pacejka = new PacejkaTire(); // Tire model params could be in config too later
        this.engine = new Engine(config.drivetrain.engine);
        this.trans = new Transmission(config.drivetrain.transmission);

        // Setup 4 corners
        const offsets = config.tires.offsets;
        if (offsets.length !== 4) console.warn("Expected 4 tire offsets");

        for (let off of offsets) {
            this.tires.push(new Tire(off, config.tires.radius));
            this.suspensions.push(new Suspension(config.suspension));
            // Init empty transforms
            this.wheelTransforms.push({
                position: { x: 0, y: 0, z: 0 },
                orientation: { x: 0, y: 0, z: 0, w: 1 }
            });
        }
    }

    update(dt: number, inputs: IControlInput, env: IEnvironment): void {
        const GRAVITY = env.getGravity();

        // 1. Drivetrain Update
        const avgRearWheelSpeed = (this.tires[2].wheelSpeed + this.tires[3].wheelSpeed) / 2;
        const ratio = this.trans.getRatio();
        if (ratio !== 0) {
            const wheelRPM = avgRearWheelSpeed * (60 / (2 * Math.PI));
            let targetEngineRPM = wheelRPM * ratio;
            targetEngineRPM = Math.max(targetEngineRPM, this.engine.idleRPM);
            this.engine.rpm = targetEngineRPM;
        }

        this.trans.updateAutomatic(this.engine.rpm, inputs.throttle, dt);
        const engineTorque = this.engine.update(dt, inputs.throttle, 0);
        const wheelTorque = (engineTorque * ratio) / 2;

        // 2. Wheel Update
        for (let i = 0; i < 4; i++) {
            const tire = this.tires[i];
            const susp = this.suspensions[i];

            // --- KINEMATICS ---
            const offsetWorld = V3U.rotate(tire.offset, this.body.orientation);
            const mountPos = V3U.add(this.body.position, offsetWorld);

            const rotVel = V3U.cross(this.body.angularVelocity, offsetWorld);
            const hubVel = V3U.add(this.body.velocity, rotVel);

            const groundZ = env.getGroundHeight(mountPos.x, mountPos.y);
            const currentHeight = mountPos.z - groundZ;
            const springUncompressed = susp.restLength;

            let springLen = currentHeight - tire.radius;
            const compression = springUncompressed - springLen;

            // --- SUSPENSION FORCE ---
            const compressionForce = susp.update(compression, dt);
            const Fz = Math.max(0, compressionForce);

            const bodyUp = V3U.rotate({ x: 0, y: 0, z: 1 }, this.body.orientation);

            if (Fz > 0) {
                this.body.addForceAtPoint(V3U.scale(bodyUp, Fz), mountPos);
            }

            // --- VISUALIZATION: Calc Wheel Center ---
            const suspOffset = V3U.scale(bodyUp, -Math.max(0.1, springLen));
            const wheelCenter = V3U.add(mountPos, suspOffset);

            // --- STEERING / ORIENTATION ---
            let steerAngle = 0;
            if (i < 2) steerAngle = inputs.steering * 0.5;

            const bodyQ = this.body.orientation;
            const steerQ = { x: 0, y: 0, z: Math.sin(steerAngle / 2), w: Math.cos(steerAngle / 2) };
            const wheelQ = Q4U.normalize(Q4U.multiply(bodyQ, steerQ));

            // Store for Render
            this.wheelTransforms[i] = {
                position: wheelCenter,
                orientation: wheelQ
            };

            // --- TIRE FORCE (Pacejka) ---
            let skidIntensity = 0;
            if (Fz > 0) {
                const wFwdBody = { x: Math.cos(steerAngle), y: Math.sin(steerAngle), z: 0 };
                const wLeftBody = { x: -Math.sin(steerAngle), y: Math.cos(steerAngle), z: 0 };
                const wUpBody = { x: 0, y: 0, z: 1 };

                const wFwd = V3U.rotate(wFwdBody, bodyQ);
                const wLeft = V3U.rotate(wLeftBody, bodyQ);

                const vLong = V3U.dot(hubVel, wFwd);
                const vLat = V3U.dot(hubVel, wLeft);

                let alpha = 0;
                if (Math.abs(vLong) > 0.1) {
                    alpha = Math.atan2(vLat, Math.abs(vLong));
                }

                let F_tract = 0;
                if (i >= 2) F_tract = wheelTorque / tire.radius;
                if (inputs.brake > 0) {
                    F_tract -= inputs.brake * 4000 * Math.sign(vLong);
                }

                const pacejkaRes = this.pacejka.calculate(Fz, alpha, 0);
                let Fy = pacejkaRes.fy;

                const maxF = Fz * 1.5;
                const totalF = Math.sqrt(F_tract * F_tract + Fy * Fy);
                if (totalF > maxF) {
                    const scale = maxF / totalF;
                    F_tract *= scale;
                    Fy *= scale;
                    skidIntensity = (totalF - maxF) / maxF; // Rough estimates
                }

                // Add alpha contribution to skid
                skidIntensity = Math.max(skidIntensity, Math.min(1.0, (Math.abs(alpha) - 0.15) * 2));
                this.wheelSkids[i] = Math.min(1.0, Math.max(0, skidIntensity));

                const forceLat = V3U.scale(wLeft, Fy);
                const forceLong = V3U.scale(wFwd, F_tract);
                const totalTire = V3U.add(forceLat, forceLong);

                // Contact patch 
                const contactPos = V3U.add(wheelCenter, V3U.scale(V3U.rotate(wUpBody, bodyQ), -tire.radius));

                this.body.addForceAtPoint(totalTire, contactPos);

                tire.wheelSpeed = vLong / tire.radius;
            } else {
                this.wheelSkids[i] = 0;
            }
        }

        // Body Forces
        this.body.addForce(V3U.scale(GRAVITY, this.body.mass));
        const speed = V3U.magnitude(this.body.velocity);
        const dragMag = 0.5 * 1.2 * 0.3 * 2.2 * speed * speed;
        const dragDir = V3U.scale(V3U.normalize(this.body.velocity), -1);
        this.body.addForce(V3U.scale(dragDir, dragMag));

        this.body.integrate(dt);
    }

    getState(): ISimulationState {
        const s = this.body.getState();
        s.engineRPM = this.engine.rpm;
        s.gear = this.trans.currentGear;
        s.engineTorque = this.engine.getTorqueCurve(this.engine.rpm);
        s.wheelTransforms = this.wheelTransforms;
        s.wheelSkids = this.wheelSkids;
        return s;
    }

    getTelemetryFromLastStep(): any {
        return {
            speed: V3U.magnitude(this.body.velocity),
            rpm: this.engine.rpm
        };
    }
}
