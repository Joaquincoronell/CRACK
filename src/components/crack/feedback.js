const KEY = 'crack.feedback.enabled';

let audioContext = null;

export const feedbackEnabled = () => {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
};

export const setFeedbackEnabled = enabled => {
  try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch {}
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('crack-feedback-change', { detail: enabled }));
};

const vibrate = pattern => {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch {}
};

const tone = (ctx, frequency, start, duration, gain = .035) => {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(frequency, start);
  amp.gain.setValueAtTime(0, start);
  amp.gain.linearRampToValueAtTime(gain, start + .01);
  amp.gain.exponentialRampToValueAtTime(.0001, start + duration);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + .02);
};

export function playFeedback(type = 'tap') {
  if (!feedbackEnabled() || typeof window === 'undefined') return;

  const patterns = {
    bid: { tones: [[420, 0, .08], [560, .07, .09]], vibration: 18 },
    skip: { tones: [[240, 0, .11]], vibration: 24 },
    reveal: { tones: [[330, 0, .08], [495, .08, .1], [660, .17, .13]], vibration: [22, 35, 34] },
    goal: { tones: [[520, 0, .1], [660, .08, .12], [880, .18, .2]], vibration: [25, 25, 60] },
    save: { tones: [[250, 0, .08], [190, .07, .14]], vibration: [45, 25, 28] },
    miss: { tones: [[220, 0, .12]], vibration: 18 },
    champion: { tones: [[440, 0, .1], [554, .1, .1], [659, .2, .12], [880, .31, .24]], vibration: [40, 35, 40, 35, 90] },
    tap: { tones: [[360, 0, .05]], vibration: 10 }
  };
  const pattern = patterns[type] || patterns.tap;
  vibrate(pattern.vibration);

  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioContext ||= new Ctx();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    const now = audioContext.currentTime + .01;
    pattern.tones.forEach(([freq, delay, duration]) => tone(audioContext, freq, now + delay, duration));
  } catch {}
}
