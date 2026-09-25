let audio: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audio) audio = new Ctx();
  return audio;
}

export function unlockAudio() {
  const ctx = context();
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

export function sharedAudio() {
  return context();
}

/** Soft two-note bell. Stays quiet on purpose. */
export function playChime() {
  const ctx = context();
  if (!ctx) return;
  void ctx.resume();
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.06, now + 0.03);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
  master.connect(ctx.destination);

  for (const [freq, amount] of [
    [523.25, 1],
    [783.99, 0.28],
  ] as const) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.value = amount;
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 1.55);
  }
}
