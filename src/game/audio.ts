// Professional Zero-Dependency Procedural Web Audio Synthesizer for MELAVERSE
// Synthesizes multi-layered Indian festival percussion (Braj Dholak Ghe/Na),
// pressurized Pichkari water-stream noise, Temple Brass Ghanta bells, Water-Shield parry chimes,
// and subtle Raag Yaman courtyard harmonic ambiance.

class MelaverseAudioEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private hasUserGesture = false;
  private ambientAccum = 0;
  private beatStep = 0;
  public muted = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const unlock = () => {
        this.hasUserGesture = true;
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
      };
      window.addEventListener('pointerdown', unlock, { passive: true });
      window.addEventListener('keydown', unlock, { passive: true });
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.muted || !this.hasUserGesture) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.ctx && !this.noiseBuffer) {
      // Pre-allocate 0.5s white noise buffer for water-jet spray & dholak skin slap
      const sampleRate = this.ctx.sampleRate;
      const length = Math.floor(sampleRate * 0.5);
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buffer;
    }
    return this.ctx;
  }

  private pitchJitter(baseFreq: number, pct = 0.07): number {
    const variance = 1 + (Math.random() * (pct * 2) - pct);
    return baseFreq * variance;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  // Subtle rhythmic courtyard Tala & Tanpura harmonic pulse during active gameplay
  public stepAmbientCourtyardMusic(dt: number) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    this.ambientAccum += dt;
    // Gently pulse a soft Dholak Tala & Tanpura Sa-Pa note every 0.55s (~109 BPM)
    if (this.ambientAccum >= 0.55) {
      this.ambientAccum = 0;
      const now = ctx.currentTime;
      const step = this.beatStep % 8;
      this.beatStep++;

      // Soft Dholak rhythm pulse on beats 0, 2, 3, 5, 6 (Keherwa Taal: Dha Ge Na Ti Na Ka Dhin Na)
      if (step === 0 || step === 3 || step === 6) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const baseFreq = step === 0 ? 110 : 146.83;
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(55, now + 0.11);
        gain.gain.setValueAtTime(0.032, now);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.13);
      }

      // Soft Tanpura / Bansuri harmonic shimmer on beat 0 & 4
      if (step === 0 || step === 4) {
        const droneOsc = ctx.createOscillator();
        const droneGain = ctx.createGain();
        droneOsc.type = 'sine';
        droneOsc.frequency.setValueAtTime(step === 0 ? 293.66 : 440.0, now); // D4 (Sa) & A4 (Pa)
        droneGain.gain.setValueAtTime(0.018, now);
        droneGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.48);
        droneOsc.connect(droneGain);
        droneGain.connect(ctx.destination);
        droneOsc.start(now);
        droneOsc.stop(now + 0.5);
      }
    }
  }

  // Light event: soft sandstone footstep + subtle brass ghungroo ankle bell
  public playFootstep() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(this.pitchJitter(140), now);
    osc.frequency.exponentialRampToValueAtTime(62, now + 0.045);

    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.048);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);

    // Subtle high ghungroo shimmer
    const bell = ctx.createOscillator();
    const bellGain = ctx.createGain();
    bell.type = 'sine';
    bell.frequency.setValueAtTime(this.pitchJitter(2450, 0.04), now);
    bellGain.gain.setValueAtTime(0.012, now);
    bellGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.035);
    bell.connect(bellGain);
    bellGain.connect(ctx.destination);
    bell.start(now);
    bell.stop(now + 0.04);
  }

  // Pressurized Brass Pichkari Water-Stream + Gulal Pop
  public playGulalThrow(colorType: 'gulabi' | 'haldi' | 'neel') {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const base =
      colorType === 'gulabi' ? 390 : colorType === 'haldi' ? 330 : 480;

    // 1. Harmonic nozzle pop
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(this.pitchJitter(base), now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.55, now + 0.09);

    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.105);

    // 2. Filtered water-jet spray noise
    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(950, now);
      filter.frequency.exponentialRampToValueAtTime(2400, now + 0.11);
      filter.Q.value = 2.2;

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.075, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.115);
    }
  }

  // Jump / Dash whoosh
  public playDashOrJump() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(this.pitchJitter(240), now);
    osc.frequency.exponentialRampToValueAtTime(560, now + 0.13);

    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.145);
  }

  // Water-Lotus Shield activation or Parry deflect chime
  public playShieldParry(isDeflect = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const freqs = isDeflect ? [587.33, 880, 1174.66] : [440, 659.25];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(this.pitchJitter(f, 0.03), now + idx * 0.035);
      gain.gain.setValueAtTime(isDeflect ? 0.14 : 0.09, now + idx * 0.035);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.035 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.035);
      osc.stop(now + idx * 0.035 + 0.26);
    });
  }

  // Martial Kushti Punch & 360 Spin Kick SFX (sharp air whoosh + heavy sub-thud)
  public playMeleePunchKick(isSpinKick = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(
      this.pitchJitter(isSpinKick ? 240 : 185),
      now
    );
    osc.frequency.exponentialRampToValueAtTime(
      42,
      now + (isSpinKick ? 0.22 : 0.14)
    );
    gain.gain.setValueAtTime(isSpinKick ? 0.22 : 0.16, now);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      now + (isSpinKick ? 0.23 : 0.15)
    );
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (isSpinKick ? 0.24 : 0.16));

    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(isSpinKick ? 1100 : 850, now);
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.11, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.15);
    }
  }

  // Gubbara Water Balloon Throw SFX
  public playBalloonThrow() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(this.pitchJitter(310), now);
    osc.frequency.exponentialRampToValueAtTime(590, now + 0.12);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  // Hawai Diwali Rocket Whistle + Propulsion Hiss
  public playRocketLaunch() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(this.pitchJitter(460, 0.04), now);
    osc.frequency.exponentialRampToValueAtTime(1480, now + 0.24);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);

    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(2200, now);
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.09, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.23);
    }
  }

  // Sutli / Firework Bomb Detonation Boom + Sparkle Crackle
  public playBombExplosion() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(135, now);
    subOsc.frequency.exponentialRampToValueAtTime(28, now + 0.34);
    subGain.gain.setValueAtTime(0.28, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.37);

    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2400, now);
      filter.frequency.exponentialRampToValueAtTime(280, now + 0.3);
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.18, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.33);
    }
  }

  // Heavy event: festive Braj Dhol thump + wet splash + temple bell chord on KO
  public playHeavySplash(isKO = false, isWeaknessCrit = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Dhol bass drum thump (Ghe)
    const dholOsc = ctx.createOscillator();
    const dholGain = ctx.createGain();
    dholOsc.type = 'triangle';
    dholOsc.frequency.setValueAtTime(
      this.pitchJitter(isKO ? 175 : 140),
      now
    );
    dholOsc.frequency.exponentialRampToValueAtTime(
      48,
      now + (isKO ? 0.24 : 0.15)
    );

    dholGain.gain.setValueAtTime(isKO ? 0.24 : 0.16, now);
    dholGain.gain.exponentialRampToValueAtTime(
      0.001,
      now + (isKO ? 0.25 : 0.16)
    );

    dholOsc.connect(dholGain);
    dholGain.connect(ctx.destination);
    dholOsc.start(now);
    dholOsc.stop(now + (isKO ? 0.26 : 0.17));

    // 2. Wet Gulal Splash Burst
    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1600, now);
      filter.frequency.exponentialRampToValueAtTime(380, now + 0.14);

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(isKO ? 0.12 : 0.07, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.16);
    }

    // 3. Temple bell / sitar harmonic overtone on KO or Weakness Crit
    if (isKO || isWeaknessCrit) {
      const bellNotes = isKO ? [587.33, 739.99, 880, 1174.66] : [659.25, 880];
      bellNotes.forEach((freq, idx) => {
        const bellOsc = ctx.createOscillator();
        const bellGain = ctx.createGain();
        bellOsc.type = 'sine';
        bellOsc.frequency.setValueAtTime(
          this.pitchJitter(freq, 0.02),
          now + idx * 0.045
        );
        bellGain.gain.setValueAtTime(0.11, now + idx * 0.045);
        bellGain.gain.exponentialRampToValueAtTime(
          0.001,
          now + idx * 0.045 + 0.3
        );
        bellOsc.connect(bellGain);
        bellGain.connect(ctx.destination);
        bellOsc.start(now + idx * 0.045);
        bellOsc.stop(now + idx * 0.045 + 0.31);
      });
    }
  }

  // Sacred Diya lighting or Passport stamp unlocked
  public playSacredChime() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [587.33, 739.99, 880, 1174.66]; // D5, F#5, A5, D6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.055);
      gain.gain.setValueAtTime(0.11, now + idx * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.055 + 0.36);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.055);
      osc.stop(now + idx * 0.055 + 0.38);
    });
  }

  // Auspicious Wave Advance Fanfare
  public playWaveAdvance() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [440, 587.33, 739.99, 880];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.075);
      gain.gain.setValueAtTime(0.12, now + idx * 0.075);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.075 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.075);
      osc.stop(now + idx * 0.075 + 0.36);
    });
  }

  // Enemy windup telegraph rising pitch cue
  public playTelegraphCue() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.linearRampToValueAtTime(440, now + 0.24);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  // Player splashed / spirit lost
  public playPlayerHurt() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(195, now);
    osc.frequency.exponentialRampToValueAtTime(72, now + 0.22);

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.23);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  // Victory fanfare
  public playVictoryFanfare() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const melody = [440, 554.37, 659.25, 880, 1108.73];
    melody.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.1);
      gain.gain.setValueAtTime(0.15, now + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.46);
    });
  }

  // Defeat sting
  public playDefeatSting() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [330, 293.66, 246.94, 196];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + i * 0.14);
      gain.gain.setValueAtTime(0.11, now + i * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.14 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.14);
      osc.stop(now + i * 0.14 + 0.36);
    });
  }
}

export const melaverseAudio = new MelaverseAudioEngine();
