import * as Tone from "tone";
import { CHORDS, frequency } from "./music";

export class StudioAudio {
  context!: AudioContext;
  output!: MediaStreamAudioDestinationNode;
  music!: GainNode;
  voice!: GainNode;
  harmony!: GainNode;
  analyser!: AnalyserNode;
  private mic?: MediaStreamAudioSourceNode;
  private shift?: Tone.PitchShift;
  private voices = new Set<OscillatorNode>();
  private started = false;
  async start() {
    await Tone.start();
    if (this.started) return;
    this.context = Tone.getContext().rawContext as AudioContext;
    this.output = this.context.createMediaStreamDestination();
    this.music = this.context.createGain();
    this.music.gain.value = 0.65;
    const limiter = this.context.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.ratio.value = 12;
    this.music.connect(limiter);
    limiter.connect(this.context.destination);
    limiter.connect(this.output);
    this.voice = this.context.createGain();
    this.voice.gain.value = 0.8;
    this.harmony = this.context.createGain();
    this.harmony.gain.value = 0;
    // Voice and harmony go only to the recording bus: no loudspeaker feedback.
    this.voice.connect(this.output);
    this.harmony.connect(this.output);
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 256;
    this.started = true;
  }
  attachMicrophone(stream: MediaStream) {
    this.detachMicrophone();
    this.mic = this.context.createMediaStreamSource(stream);
    this.mic.connect(this.voice);
    this.mic.connect(this.analyser);
    this.shift = new Tone.PitchShift({ pitch: 7, wet: 1, windowSize: 0.1 });
    Tone.connect(this.mic, this.shift);
    Tone.connect(this.shift, this.harmony);
  }
  detachMicrophone() {
    this.mic?.disconnect();
    this.mic = undefined;
    this.shift?.dispose();
    this.shift = undefined;
  }
  setHarmony(enabled: boolean) {
    if (this.started)
      this.harmony.gain.setTargetAtTime(
        enabled ? 0.35 : 0,
        this.context.currentTime,
        0.02,
      );
  }
  setVolume(value: number) {
    if (this.started)
      this.music.gain.setTargetAtTime(value, this.context.currentTime, 0.02);
  }
  play(index: number, sound: OscillatorType, bpm: number) {
    if (!this.started || !CHORDS[index]) return;
    this.silence();
    const now = this.context.currentTime,
      length = 120 / bpm;
    for (const note of CHORDS[index].notes) {
      const osc = this.context.createOscillator(),
        env = this.context.createGain();
      osc.type = sound;
      osc.frequency.value = frequency(note);
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(0.12, now + 0.025);
      env.gain.exponentialRampToValueAtTime(0.001, now + length);
      osc.connect(env);
      env.connect(this.music);
      osc.start();
      osc.stop(now + length + 0.03);
      this.voices.add(osc);
      osc.onended = () => {
        this.voices.delete(osc);
        osc.disconnect();
        env.disconnect();
      };
    }
  }
  silence() {
    for (const osc of this.voices) {
      try {
        osc.stop();
      } catch {
        /* already ended */
      }
    }
    this.voices.clear();
  }
  dispose() {
    this.silence();
    this.detachMicrophone();
    if (this.started) {
      this.music.disconnect();
      this.voice.disconnect();
      this.harmony.disconnect();
      this.output.stream.getTracks().forEach((t) => t.stop());
    }
  }
}
