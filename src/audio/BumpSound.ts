export class BumpSound {
    private ctx: AudioContext;
    private gain: GainNode;

    constructor(ctx: AudioContext, destination: AudioNode) {
        this.ctx = ctx;
        this.gain = ctx.createGain();
        this.gain.connect(destination);
    }

    trigger(intensity: number) {
        const now = this.ctx.currentTime;
        // Boosted sensitivity: was * 0.2, now * 1.0
        const volume = 6 * Math.min(1.0, intensity * 1.0);

        // 1. "Thud" Oscillator (Kick drum style)
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);

        const oscGain = this.ctx.createGain();
        oscGain.gain.setValueAtTime(volume, now);
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        osc.connect(oscGain);
        oscGain.connect(this.gain);

        osc.start(now);
        osc.stop(now + 0.6);

        // 2. "Crunch" Noise (Filtered noise burst)
        const bufferSize = this.ctx.sampleRate * 0.2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, now);
        filter.Q.value = 1.0;

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(volume * 0.8, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.gain);

        noise.start(now);
    }
}
