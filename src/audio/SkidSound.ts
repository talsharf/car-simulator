export class SkidSound {
    private ctx: AudioContext;
    private filter: BiquadFilterNode;
    private gain: GainNode;
    private source: AudioBufferSourceNode | null = null;
    private noiseBuffer: AudioBuffer | null = null;
    private shaper: WaveShaperNode | null = null;
    private isStarted: boolean = false;

    constructor(ctx: AudioContext, destination: AudioNode) {
        this.ctx = ctx;

        // Create Pink Noise Buffer
        const bufferSize = ctx.sampleRate * 2.0; // 2 seconds loop
        this.noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);

        // Simple white noise for now, or approx pink
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1);
        }

        // Bandpass Filter to shape it into a "screech"
        // Bandpass Filter
        // Q=8.0 is resonant but wider/messier than a pure whistle (Q=15)
        this.filter = ctx.createBiquadFilter();
        this.filter.type = 'bandpass';
        this.filter.frequency.value = 2000;
        this.filter.Q.value = 8.0;

        // Distortion (WaveShaper)
        this.shaper = ctx.createWaveShaper();
        this.shaper.curve = this.makeDistortionCurve(1000); // Increased from 400
        this.shaper.oversample = '4x';

        // Volume
        this.gain = ctx.createGain();
        this.gain.gain.value = 0.0;

        // Chain: Source -> Filter -> Shaper -> Gain -> Dest
        this.filter.connect(this.shaper);
        this.shaper.connect(this.gain);
        this.gain.connect(destination);
    }

    private makeDistortionCurve(amount: number) {
        const k = typeof amount === 'number' ? amount : 50;
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        const deg = Math.PI / 180;

        for (let i = 0; i < n_samples; ++i) {
            const x = (i * 2) / n_samples - 1;
            curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
        }
        return curve;
    }

    start() {
        if (!this.isStarted && this.noiseBuffer) {
            this.source = this.ctx.createBufferSource();
            this.source.buffer = this.noiseBuffer;
            this.source.loop = true;
            this.source.connect(this.filter);
            this.source.start();
            this.isStarted = true;
        }
    }

    update(maxSkid: number) {
        if (!this.isStarted) return;

        const now = this.ctx.currentTime;

        // Modulation
        // Higher skid -> Higher volume, higher pitch

        // Volume: Threshold at 0.2, ramp to 1.0
        let targetVol = 0;
        if (maxSkid > 0.2) {
            // Sharper ramp
            targetVol = Math.min(0.6, (maxSkid - 0.2) * 3.0); // Lower max gain because distortion boosts loudness
        }
        this.gain.gain.setTargetAtTime(targetVol, now, 0.05);

        // Pitch shift
        // 1500Hz -> 3000Hz (Higher pitch)
        const targetFreq = 1500 + (maxSkid * 1500);
        this.filter.frequency.setTargetAtTime(targetFreq, now, 0.1);
    }
}
