/* global AudioContext, webkitAudioContext */

// Synthesized, not a bundled asset - a two-note chime via the Web Audio API.
let audioContext = null;

function getAudioContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContextClass();
  }
  return audioContext;
}

function playTone(ctx, frequency, startTime, duration) {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  // Ramp from near-zero (exponentialRamp can't target exactly 0) rather than
  // jumping straight to a gain value, which avoids an audible click/pop.
  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.2, startTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

export function playNotificationSound() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    const now = ctx.currentTime;
    playTone(ctx, 880, now, 0.12); // A5
    playTone(ctx, 1318.51, now + 0.1, 0.18); // E6
  } catch (e) {
    // Audio can be unavailable or blocked by autoplay policy in some
    // environments - the visual toast/badge already carry the notification,
    // so a failure here should never break anything.
  }
}
