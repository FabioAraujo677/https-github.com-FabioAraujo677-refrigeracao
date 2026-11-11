/**
 * Utility functions for sound notifications in NEO FIX / ICE REFRIGERAÇÃO
 */

/**
 * Plays a medium-volume success audio chime when confirming an appointment (+1 Concluído).
 * Uses Web Audio API for reliable cross-platform playback without external asset dependencies.
 * @param volume Target volume (0.0 to 1.0). Default is 0.38 for "som médio".
 */
export const playScheduleConfirmedSound = (volume: number = 0.38) => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;

    const playTone = (freq: number, startOffset: number, duration: number, type: OscillatorType = 'sine') => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + startOffset);

      // Smooth attack ramp & exponential decay ramp
      gain.gain.setValueAtTime(0, now + startOffset);
      gain.gain.linearRampToValueAtTime(volume, now + startOffset + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration);
    };

    // Uplifting "+1 Concluído" 4-note ascending chord arpeggio (C5 -> E5 -> G5 -> C6)
    playTone(523.25, 0.0, 0.3, 'sine');       // C5
    playTone(659.25, 0.07, 0.3, 'sine');      // E5
    playTone(783.99, 0.14, 0.4, 'sine');      // G5
    playTone(1046.50, 0.22, 0.55, 'triangle'); // C6 (crisp completion note)
  } catch (err) {
    console.warn('[Audio] Web Audio sound failed:', err);
  }
};

/**
 * Plays a quick "+1" pop chime at medium volume.
 */
export const playPlusOnePopSound = (volume: number = 0.35) => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.12);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  } catch (err) {
    console.warn('[Audio] Pop sound failed:', err);
  }
};
