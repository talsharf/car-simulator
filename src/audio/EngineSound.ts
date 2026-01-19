export class EngineSound {
    private ctx: AudioContext;
    private osc: OscillatorNode;
    private gain: GainNode;
    private lfo: OscillatorNode;
    private lfoGain: GainNode;
    private isStarted: boolean = false;

    constructor(ctx: AudioContext, destination: AudioNode) {
        this.ctx = ctx;

        // Main oscillator (Sawtooth for "buzz")
        this.osc = ctx.createOscillator();
        this.osc.type = 'sawtooth';

        // Low Frequency Oscillator for "rumble"
        this.lfo = ctx.createOscillator();
        this.lfo.type = 'sine';
        this.lfo.frequency.value = 40; // Higher base rumble

        this.lfoGain = ctx.createGain();
        this.lfoGain.gain.value = 400; // MASSIVE gain for deep FM modulation (growl)

        // Chain: LFO -> LFO_Gain -> Main_Osc.frequency
        this.lfo.connect(this.lfoGain);
        this.lfoGain.connect(this.osc.frequency);

        // Volume control
        this.gain = ctx.createGain();
        this.gain.gain.value = 0.1; // Base volume

        // Chain: Main_Osc -> Gain -> Dest
        this.osc.connect(this.gain);
        this.gain.connect(destination);
    }

    start() {
        if (!this.isStarted) {
            this.osc.start();
            this.lfo.start();
            this.isStarted = true;
        }
    }

    update(rpm: number, load: number) {
        // Base frequency calculation
        // Lower multiplier = Deeper tone (Big block V8 feel)
        const freq = Math.max(0, (rpm / 60) * 4.0);

        const now = this.ctx.currentTime;
        this.osc.frequency.setTargetAtTime(freq, now, 0.1);

        // LFO rate scales with RPM too
        this.lfo.frequency.setTargetAtTime(freq * 0.75, now, 0.1);

        // VOLUME LOGIC
        // Base idle volume: 0.1
        // Load volume: up to +0.2
        // RPM volume: up to +0.2

        // If load is 0 (coasting), it's quieter.
        const loadFactor = load * 0.3;
        const rpmFactor = (rpm / 7000) * 0.2;

        const targetVol = 0.1 + loadFactor + rpmFactor;

        this.gain.gain.setTargetAtTime(Math.min(0.6, targetVol), now, 0.1);
    }
}
