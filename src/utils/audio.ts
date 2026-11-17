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

export interface MelodyNoteStep {
  freq: number;
  startOffset: number;
  duration: number;
  type: OscillatorType;
  volume?: number;
}

export interface TechAlertMelody {
  id: number;
  name: string;
  notes: MelodyNoteStep[];
}

/**
 * 4 melodias distintas geradas 100% via Web Audio API (sem links externos)
 * para diferenciar cada novo agendamento recebido pelo técnico.
 */
export const TECH_ALERT_MELODIES: TechAlertMelody[] = [
  {
    id: 0,
    name: 'Radar Neon',
    notes: [
      { freq: 659.25, startOffset: 0.0, duration: 0.16, type: 'triangle', volume: 0.28 },   // E5
      { freq: 830.61, startOffset: 0.14, duration: 0.16, type: 'triangle', volume: 0.28 },  // G#5
      { freq: 987.77, startOffset: 0.28, duration: 0.18, type: 'sine', volume: 0.32 },      // B5
      { freq: 1318.51, startOffset: 0.44, duration: 0.36, type: 'triangle', volume: 0.34 }, // E6
    ],
  },
  {
    id: 1,
    name: 'Sino Técnico',
    notes: [
      { freq: 523.25, startOffset: 0.0, duration: 0.22, type: 'sine', volume: 0.32 },       // C5
      { freq: 783.99, startOffset: 0.16, duration: 0.24, type: 'sine', volume: 0.32 },      // G5
      { freq: 659.25, startOffset: 0.36, duration: 0.22, type: 'triangle', volume: 0.28 },  // E5
      { freq: 1046.5, startOffset: 0.54, duration: 0.42, type: 'sine', volume: 0.35 },      // C6
    ],
  },
  {
    id: 2,
    name: 'Chamada Urgente',
    notes: [
      { freq: 880.0, startOffset: 0.0, duration: 0.12, type: 'sawtooth', volume: 0.16 },    // A5
      { freq: 1046.5, startOffset: 0.13, duration: 0.12, type: 'triangle', volume: 0.28 },  // C6
      { freq: 880.0, startOffset: 0.28, duration: 0.12, type: 'sawtooth', volume: 0.16 },   // A5
      { freq: 1318.51, startOffset: 0.41, duration: 0.32, type: 'triangle', volume: 0.32 }, // E6
    ],
  },
  {
    id: 3,
    name: 'Acorde Crystal',
    notes: [
      { freq: 587.33, startOffset: 0.0, duration: 0.18, type: 'sine', volume: 0.3 },        // D5
      { freq: 739.99, startOffset: 0.13, duration: 0.18, type: 'sine', volume: 0.3 },       // F#5
      { freq: 880.0, startOffset: 0.26, duration: 0.18, type: 'triangle', volume: 0.3 },   // A5
      { freq: 1174.66, startOffset: 0.39, duration: 0.28, type: 'sine', volume: 0.34 },     // D6
      { freq: 880.0, startOffset: 0.62, duration: 0.28, type: 'triangle', volume: 0.26 },   // A5
    ],
  },
];

export const unlockAudioContext = (existingCtx?: AudioContext | null): AudioContext | null => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    const ctx = existingCtx && existingCtx.state !== 'closed' ? existingCtx : new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  } catch (err) {
    console.warn('[Audio] Could not unlock AudioContext:', err);
    return null;
  }
};

export const playTechAlertMelody = (
  melodyIndex: number,
  existingCtx?: AudioContext | null
): { melodyName: string; ctx: AudioContext | null } => {
  const safeIndex = Math.abs(Math.floor(melodyIndex)) % TECH_ALERT_MELODIES.length;
  const melody = TECH_ALERT_MELODIES[safeIndex];

  try {
    const ctx = unlockAudioContext(existingCtx);
    if (!ctx) return { melodyName: melody.name, ctx: null };

    const now = ctx.currentTime;
    for (const step of melody.notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const vol = step.volume ?? 0.28;

      osc.type = step.type;
      osc.frequency.setValueAtTime(step.freq, now + step.startOffset);

      gain.gain.setValueAtTime(0.0001, now + step.startOffset);
      gain.gain.linearRampToValueAtTime(vol, now + step.startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + step.startOffset + step.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + step.startOffset);
      osc.stop(now + step.startOffset + step.duration + 0.02);
    }

    return { melodyName: melody.name, ctx };
  } catch (err) {
    console.warn('[Audio] Failed to play technician alert melody:', err);
    return { melodyName: melody.name, ctx: existingCtx || null };
  }
};

const activeSirenOscillators = new Set<OscillatorNode>();

export const stopUrgentSiren = (): void => {
  activeSirenOscillators.forEach((osc) => {
    try {
      osc.stop();
      osc.disconnect();
    } catch {}
  });
  activeSirenOscillators.clear();
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(0);
    }
  } catch {}
};

export const playUrgentSirenPulse = (
  existingCtx?: AudioContext | null
): AudioContext | null => {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([320, 140, 320]);
    }
  } catch {}

  try {
    const ctx = unlockAudioContext(existingCtx);
    if (!ctx) return null;

    const now = ctx.currentTime;
    const steps: Array<{ freq: number; offset: number; duration: number; vol: number }> = [
      { freq: 880, offset: 0.0, duration: 0.22, vol: 0.34 },
      { freq: 1174.66, offset: 0.24, duration: 0.24, vol: 0.38 },
      { freq: 880, offset: 0.52, duration: 0.22, vol: 0.34 },
      { freq: 1318.51, offset: 0.76, duration: 0.32, vol: 0.4 },
    ];

    for (const step of steps) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(step.freq, now + step.offset);

      gain.gain.setValueAtTime(0.0001, now + step.offset);
      gain.gain.linearRampToValueAtTime(step.vol, now + step.offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + step.offset + step.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      activeSirenOscillators.add(osc);
      osc.onended = () => {
        activeSirenOscillators.delete(osc);
      };

      osc.start(now + step.offset);
      osc.stop(now + step.offset + step.duration + 0.02);
    }

    return ctx;
  } catch (err) {
    console.warn('[Audio] Urgent siren pulse failed:', err);
    return existingCtx || null;
  }
};
