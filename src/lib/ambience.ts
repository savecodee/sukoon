import { sharedAudio, unlockAudio } from "@/lib/chime";

export type Ambience = "off" | "rain" | "room";

let stopCurrent: (() => void) | null = null;

function audioContext(): AudioContext | null {
  return sharedAudio();
}

function noiseBuffer(ctx: AudioContext, brown: boolean) {
  const length = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    last = brown ? last * 0.98 + white * 0.02 : white;
    data[i] = last;
  }
  return buffer;
}

function drip(ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const now = ctx.currentTime;
  osc.type = "sine";
  osc.frequency.value = 880 + Math.random() * 700;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.025, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.15);
}

export function stopAmbience() {
  stopCurrent?.();
  stopCurrent = null;
}

export function startAmbience(kind: Exclude<Ambience, "off">) {
  stopAmbience();
  unlockAudio();
  const ctx = audioContext();
  if (!ctx) return;
  void ctx.resume();
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, kind === "room");
  source.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = kind === "rain" ? "bandpass" : "lowpass";
  filter.frequency.value = kind === "rain" ? 1200 : 320;
  filter.Q.value = kind === "rain" ? 0.7 : 0.5;
  const gain = ctx.createGain();
  gain.gain.value = kind === "rain" ? 0.012 : 0.018;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start();
  const drips =
    kind === "rain"
      ? window.setInterval(() => drip(ctx), 900)
      : 0;
  stopCurrent = () => {
    if (drips) window.clearInterval(drips);
    try {
      source.stop();
    } catch {
      // already stopped
    }
    source.disconnect();
    filter.disconnect();
    gain.disconnect();
  };
}
