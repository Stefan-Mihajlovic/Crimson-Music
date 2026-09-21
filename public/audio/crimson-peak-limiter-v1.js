// Keep the linked envelope identical to Crimson's native EQ processors.
class CrimsonPeakLimiter extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'enabled', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'a-rate' }];
  }

  constructor() {
    super();
    this.gain = 1;
    this.hold = 0;
    this.holdFrames = Math.ceil(sampleRate * 0.030);
    this.release = Math.exp(-1 / (sampleRate * 0.150));
    this.bypassFrames = Math.max(1, Math.round(sampleRate * 0.025));
    this.bypassRemaining = 0;
    this.wasEnabled = false;
    this.running = true;
    this.port.onmessage = ({ data }) => { if (data?.type === 'dispose') this.running = false; };
  }

  process(inputs, outputs, parameters) {
    if (!this.running) return false;
    const input = inputs[0];
    const output = outputs[0];
    if (!output?.length) return true;
    const enabled = parameters.enabled;
    for (let frame = 0; frame < output[0].length; frame++) {
      const active = enabled[enabled.length === 1 ? 0 : frame] >= 0.5;
      if (active) {
        this.wasEnabled = true;
        this.bypassRemaining = 0;
      } else if (this.wasEnabled) {
        this.wasEnabled = false;
        this.bypassRemaining = this.bypassFrames;
      }
      if (!active && this.bypassRemaining === 0) {
        this.gain = 1;
        this.hold = 0;
        for (let channel = 0; channel < output.length; channel++) output[channel][frame] = input?.[channel]?.[frame] ?? 0;
        continue;
      }
      if (this.bypassRemaining > 0) this.bypassRemaining--;
      let peak = 0;
      for (let channel = 0; channel < output.length; channel++) {
        const value = input?.[channel]?.[frame] ?? 0;
        peak = Math.max(peak, Number.isFinite(value) ? Math.abs(value) : 0);
      }
      const required = peak > 0.98 ? 0.98 / peak : 1;
      if (!active) {
        // Recover with the filters' 25ms transition, so Flat never jumps from
        // an older limited level directly to unity when bypass takes over.
        this.gain = Math.min(required, this.gain + (1 - this.gain) / (this.bypassRemaining + 1));
        this.hold = 0;
      } else if (required <= this.gain + 1e-6) {
        // Treat Float32 rounding at repeated bass peaks as the same peak.
        this.gain = Math.min(this.gain, required);
        this.hold = this.holdFrames;
      } else if (this.hold > 0) {
        this.hold--;
      } else {
        this.gain = Math.min(required, 1 + (this.gain - 1) * this.release);
      }
      for (let channel = 0; channel < output.length; channel++) {
        const value = input?.[channel]?.[frame] ?? 0;
        output[channel][frame] = Number.isFinite(value) ? value * this.gain : 0;
      }
    }
    return true;
  }
}

registerProcessor('crimson-peak-limiter-v1', CrimsonPeakLimiter);
