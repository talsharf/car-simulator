import { ISimulationState } from '../core/interfaces';
import { EngineSound } from './EngineSound';
import { SkidSound } from './SkidSound';
import { BumpSound } from './BumpSound';

export class AudioManager {
    private ctx: AudioContext;
    private masterGain: GainNode;
    private engineSound: EngineSound;
    private skidSound: SkidSound;
    private bumpSound: BumpSound;
    private initialized: boolean = false;
    private isMuted: boolean = false;

    constructor() {
        // Standard Web Audio Context
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioContextClass();

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.5; // Master volume
        this.masterGain.connect(this.ctx.destination);

        this.engineSound = new EngineSound(this.ctx, this.masterGain);
        this.skidSound = new SkidSound(this.ctx, this.masterGain);
        this.bumpSound = new BumpSound(this.ctx, this.masterGain);
    }

    async initialize() {
        if (this.initialized) return;

        // Resume context (browser policy often suspends it until gesture)
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        this.engineSound.start();
        this.skidSound.start();

        this.initialized = true;
        console.log("Audio Initialized");
    }

    update(state: ISimulationState) {
        if (!this.initialized) return;

        // RPM is often 0-8000
        const rpm = state.engineRPM || 800;
        const load = state.throttle || 0;
        this.engineSound.update(rpm, load);

        // Skids
        let maxSkid = 0;
        if (state.wheelSkids) {
            maxSkid = Math.max(...state.wheelSkids);
        }
        this.skidSound.update(maxSkid);

        // Bumps
        if (state.groundImpactVelocity && state.groundImpactVelocity > 1.0) {
            // Trigger threshold 1.0 m/s
            this.bumpSound.trigger(state.groundImpactVelocity);
        }
    }

    toggleMute(): boolean {
        this.isMuted = !this.isMuted;
        const now = this.ctx.currentTime;
        if (this.isMuted) {
            this.masterGain.gain.setTargetAtTime(0, now, 0.1);
        } else {
            this.masterGain.gain.setTargetAtTime(0.5, now, 0.1);
        }
        return this.isMuted;
    }
}
