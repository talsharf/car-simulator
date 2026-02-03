export class SkidSound {
    private ctx: AudioContext;
    private gain: GainNode;
    private buffer: AudioBuffer | null = null;
    private source: AudioBufferSourceNode | null = null;
    private isLoaded: boolean = false;
    private isPlaying: boolean = false;

    constructor(ctx: AudioContext, destination: AudioNode) {
        this.ctx = ctx;
        this.gain = ctx.createGain();
        this.gain.gain.value = 0; // Start silent
        this.gain.connect(destination);
    }

    async load() {
        try {
            const response = await fetch('/assets/skid.m4a');
            const arrayBuffer = await response.arrayBuffer();
            this.buffer = await this.ctx.decodeAudioData(arrayBuffer);

            // Post-processing: Apply fade in/out to smoothing loop points
            this.applyFadeEdges(this.buffer);

            this.isLoaded = true;
            console.log("Skid sound loaded");
        } catch (e) {
            console.error("Failed to load skid sound", e);
        }
    }

    private applyFadeEdges(buffer: AudioBuffer) {
        const fadeDuration = 0.05; // 50ms fade
        const length = buffer.length;
        const rate = buffer.sampleRate;
        const fadeSamples = Math.floor(fadeDuration * rate);

        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const data = buffer.getChannelData(channel);

            // Fade In
            for (let i = 0; i < fadeSamples; i++) {
                data[i] *= (i / fadeSamples);
            }

            // Fade Out
            for (let i = 0; i < fadeSamples; i++) {
                data[length - 1 - i] *= (i / fadeSamples);
            }
        }
    }

    update(wheelSkids: number[]) {
        if (!this.isLoaded || !this.buffer) return;

        // Find max skid intensity across all wheels
        let maxSkid = 0;
        for (const skid of wheelSkids) {
            if (skid > maxSkid) maxSkid = skid;
        }

        // Threshold to start playing
        if (maxSkid > 0.1) {
            if (!this.isPlaying) {
                this.startSound();
            }

            // Volume curve: 0.1 skid -> 0 vol, 1.0 skid -> 6.4 vol (Increased by 8x total)
            const targetVol = Math.min(6.4, (maxSkid - 0.1) * 12.0);

            const now = this.ctx.currentTime;
            this.gain.gain.setTargetAtTime(targetVol, now, 0.1);

            // Optional: Pitch modulation based on intensity (screechier when harder skid)
            if (this.source) {
                // detune is in cents. +200 cents = 1 tone.
                // maxSkid 1.0 -> +400 cents (major third)
                this.source.detune.setTargetAtTime(maxSkid * 400, now, 0.1);
            }

        } else {
            // Fade out
            if (this.isPlaying) {
                const now = this.ctx.currentTime;
                this.gain.gain.setTargetAtTime(0, now, 0.1);

                // Stop if silent for a while? 
                // Alternatively, just keep it looping silent to avoid recreate overhead
                // For now, let's keep it running but silent.
                if (this.gain.gain.value < 0.001) {
                    // Check logic below to actually stop if needed, but keeping it running is smoother for intermittent skids
                }
            }
        }
    }

    private startSound() {
        if (this.source) {
            this.source.stop();
            this.source.disconnect();
        }

        this.source = this.ctx.createBufferSource();
        this.source.buffer = this.buffer;
        this.source.loop = true;
        this.source.connect(this.gain);
        this.source.start();
        this.isPlaying = true;
    }
}
