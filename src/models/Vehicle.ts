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
    private lastInput: IControlInput = { throttle: 0, brake: 0, steering: 0 };
    private currentSteer: number = 0; // -1 to 1 current steering value
    private maxImpactThisFrame: number = 0;

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
        // Auto-brake if idle and moving slowly to prevent drift
        const speed = V3U.magnitude(this.body.velocity);
        if (inputs.throttle === 0 && inputs.brake === 0 && speed < 2.0) {
            inputs.brake = 0.5; // Medium braking
        }

        // --- SMOOTH STEERING LOGIC ---
        const STEER_SPEED = 1.0;   // Rate of steering increase (0 to 1 in 1.0s)
        const RETURN_SPEED = 2.0;  // Rate of returning to center (slower)

        let target = inputs.steering;
        let delta = target - this.currentSteer;

        // Determine which speed to use
        // If moving away from center (magnitude increasing) use STEER_SPEED
        // If returning to center (magnitude decreasing or crossing 0) use RETURN_SPEED
        let rate = STEER_SPEED;
        if (Math.abs(target) < Math.abs(this.currentSteer) || Math.sign(target) !== Math.sign(this.currentSteer)) {
            rate = RETURN_SPEED;
        }

        // Apply interpolation
        if (Math.abs(delta) < rate * dt) {
            this.currentSteer = target;
        } else {
            this.currentSteer += Math.sign(delta) * rate * dt;
        }

        this.lastInput = inputs;
        this.maxImpactThisFrame = 0;
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

            // Distance if touching ground
            let distToGround = currentHeight - tire.radius;

            // Clamp to max droop (physical limit of shock)
            const maxSpringLength = susp.restLength + 0.2;
            const springLen = Math.min(distToGround, maxSpringLength);

            const compression = springUncompressed - springLen;

            // --- SUSPENSION FORCE ---
            // Check for Impact (Landing)
            if (susp.prevCompression <= 0 && compression > 0) {
                // Just landed
                const impactVel = compression / dt;
                if (impactVel > this.maxImpactThisFrame) {
                    this.maxImpactThisFrame = impactVel;
                }
            }

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
            if (i < 2) steerAngle = this.currentSteer * 0.5; // Use smoothed steering

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

                const contactPos = V3U.add(wheelCenter, V3U.scale(V3U.rotate(wUpBody, bodyQ), -tire.radius));
                const frictionScale = env.getFriction(contactPos.x, contactPos.y);

                const pacejkaRes = this.pacejka.calculate(Fz, alpha, 0, frictionScale);
                let Fy = pacejkaRes.fy;

                const maxF = Fz * 1.5 * frictionScale;
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

                // Contact patch (already calculated above)
                this.body.addForceAtPoint(totalTire, contactPos);

                tire.wheelSpeed = vLong / tire.radius;
            } else {
                this.wheelSkids[i] = 0;
            }
        }

        // Body Forces
        this.body.addForce(V3U.scale(GRAVITY, this.body.mass));

        const dragMag = 0.5 * 1.2 * 0.3 * 2.2 * speed * speed;
        const dragDir = V3U.scale(V3U.normalize(this.body.velocity), -1);
        this.body.addForce(V3U.scale(dragDir, dragMag));

        // --- CHASSIS COLLISION ---
        // Simple bounding box approximation using 8 corners or just 4 bumper corners + roof
        // Let's use 6 points: Front/Rear bumpers at bottom level, and 4 roof corners? 
        // Or just 4 corners at appropriate height.
        // A standard sedan is roughly 4.5m long, 1.8m wide. 
        // Origin is usually center of rear axle or CG. Let's assume CG is roughly center.

        // Define points in Vehicle Frame (x-forward, y-left, z-up)
        // Adjust these based on the visual model later if needed.
        const chassisPoints = [
            { x: 2.2, y: 0.8, z: 0.0 },   // Front Left Bumper
            { x: 2.2, y: -0.8, z: 0.0 },  // Front Right Bumper
            { x: -2.2, y: 0.8, z: 0.0 },  // Rear Left Bumper
            { x: -2.2, y: -0.8, z: 0.0 }, // Rear Right Bumper
            { x: 0.0, y: 0.8, z: 1.2 },   // Roof Left
            { x: 0.0, y: -0.8, z: 1.2 }   // Roof Right
        ];
        // Note: z=0.0 is relative to determining the "bottom" of the chassis. 
        // If CG is at z=0.0 relative to body center, then bottom is -0.something.
        // But usually CG is above the bottom. Let's assume CG is at z=0.4m above ground.
        // So bottom points should be z=-0.3 or so relative to CG.
        // Let's refine based on typical CG height.
        // If wheel radius is 0.33m, center is at 0.33m. CG likely at 0.5m.
        // So bottom of chassis is around 0.2m off ground? 
        // Let's say bottom points are at z = -0.2 (relative to CG)
        // Roof points at z = 0.8 (relative to CG)

        const relativePoints = [
            { x: 2.1, y: 0.8, z: -0.2 },
            { x: 2.1, y: -0.8, z: -0.2 },
            { x: -2.1, y: 0.8, z: -0.2 },
            { x: -2.1, y: -0.8, z: -0.2 },
            { x: 0.5, y: 0.8, z: 0.8 },
            { x: 0.5, y: -0.8, z: 0.8 },
            { x: -1.0, y: 0.8, z: 0.8 },
            { x: -1.0, y: -0.8, z: 0.8 }
        ];

        for (const pt of relativePoints) {
            const worldPos = V3U.add(this.body.position, V3U.rotate(pt, this.body.orientation));
            const groundZ = env.getGroundHeight(worldPos.x, worldPos.y);

            if (worldPos.z < groundZ) {
                // Penetration!
                const depth = groundZ - worldPos.z;

                // Velocity at this point
                const r = V3U.rotate(pt, this.body.orientation);
                const pointVel = V3U.add(this.body.velocity, V3U.cross(this.body.angularVelocity, r));

                // 1. Penalty Force (Spring)
                const STIFFNESS = 30000; // Hard collision
                const DAMPING = 2000;

                // Normal is roughly Up for terrain map, strictly should use getGroundNormal(x,y)
                // Let's assume terrain is mostly flat-ish or access normal
                const normal = env.getGroundNormal(worldPos.x, worldPos.y);
                const vNormal = V3U.dot(pointVel, normal);

                // F_spring = k * depth
                // F_damp = -c * v_normal
                let normalForceMag = STIFFNESS * depth - DAMPING * vNormal;
                normalForceMag = Math.max(0, normalForceMag);

                const F_normal = V3U.scale(normal, normalForceMag);

                // 2. Friction
                // Oppose tangential velocity
                const vTangential = V3U.sub(pointVel, V3U.scale(normal, vNormal));
                const vTanMag = V3U.magnitude(vTangential);

                let F_friction = { x: 0, y: 0, z: 0 };
                if (vTanMag > 0.01) {
                    const FRICTION_COEFF = 0.6; // Body scraping on ground
                    const frictionMag = normalForceMag * FRICTION_COEFF;
                    const frictionDir = V3U.scale(vTangential, -1 / vTanMag);
                    F_friction = V3U.scale(frictionDir, frictionMag);
                }

                // Apply
                this.body.addForceAtPoint(V3U.add(F_normal, F_friction), worldPos);

                // Also add extra drag/damping to stop spinning if multiple points trigger?
                // Friction should handle it naturally.
            }
        }

        this.body.integrate(dt);
    }

    getState(): ISimulationState {
        const s = this.body.getState();
        s.engineRPM = this.engine.rpm;
        s.gear = this.trans.currentGear;
        s.engineTorque = this.engine.getTorqueCurve(this.engine.rpm);
        s.wheelTransforms = this.wheelTransforms;
        s.wheelTransforms = this.wheelTransforms;
        s.wheelSkids = this.wheelSkids;
        s.throttle = this.lastInput.throttle;
        s.groundImpactVelocity = this.maxImpactThisFrame;
        return s;
    }

    getTelemetryFromLastStep(): any {
        return {
            speed: V3U.magnitude(this.body.velocity),
            rpm: this.engine.rpm
        };
    }
}
