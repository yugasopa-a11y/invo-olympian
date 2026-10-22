/**
 * OLYMPIAN INVO RADAR - Pure Web Audio API Synthesizer
 * Zero-latency classical chimes & alert tones (no external audio files needed).
 */

class SoundAlertSystem {
  constructor() {
    this.ctx = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized && this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.initialized = true;
      }
    } catch (e) {
      console.warn("Web Audio API not supported:", e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  // Play a single oscillator tone with envelope
  playTone(freq, type = "sine", duration = 0.2, gainValue = 0.15, delay = 0) {
    this.init();
    if (!this.ctx) return;
    this.resume();

    const startTime = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(gainValue, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  // 1. Take Profit (TP) Modified or Hit - Majestic ascending Corinthian arpeggio
  playTpChime() {
    this.playTone(523.25, "triangle", 0.25, 0.18, 0.00); // C5
    this.playTone(659.25, "triangle", 0.25, 0.20, 0.08); // E5
    this.playTone(783.99, "triangle", 0.30, 0.22, 0.16); // G5
    this.playTone(1046.5, "sine",     0.50, 0.24, 0.24); // C6
  }

  // 2. Stop Loss (SL) Adjusted or Trailed - Dignified herald alert
  playSlWarning() {
    this.playTone(440.00, "sawtooth", 0.18, 0.14, 0.00); // A4
    this.playTone(554.37, "sawtooth", 0.22, 0.16, 0.10); // C#5
    this.playTone(659.25, "sine",     0.40, 0.18, 0.20); // E5
  }

  // 3. Position Size Increased (Scale In) - Resonant ascending double pulse
  playScaleUp() {
    this.playTone(392.00, "sine", 0.20, 0.18, 0.00); // G4
    this.playTone(587.33, "sine", 0.35, 0.22, 0.12); // D5
  }

  // 4. Position Size Decreased (Trim / Partial TP) - Crisp descending chime
  playScaleDown() {
    this.playTone(659.25, "sine", 0.18, 0.18, 0.00); // E5
    this.playTone(493.88, "sine", 0.30, 0.16, 0.10); // B4
  }

  // 5. Position Closed (Exit) - Triumphant Olympian fanfare
  playCloseTriumph() {
    this.playTone(523.25, "triangle", 0.20, 0.18, 0.00); // C5
    this.playTone(659.25, "triangle", 0.20, 0.20, 0.10); // E5
    this.playTone(783.99, "triangle", 0.25, 0.22, 0.20); // G5
    this.playTone(1046.5, "triangle", 0.60, 0.26, 0.30); // C6
    this.playTone(1318.5, "sine",     0.70, 0.20, 0.40); // E6
  }

  // 6. Generic Ping / Notification
  playPing() {
    this.playTone(880.00, "sine", 0.30, 0.15, 0.00); // A5
  }

  // Dispatch sound by event name
  trigger(soundKey) {
    try {
      this.init();
      switch (soundKey) {
        case "tp_chime":
        case "TP_UPDATE":
        case "tp_set":
          this.playTpChime();
          break;
        case "sl_warning":
        case "SL_UPDATE":
        case "sl_trailed":
          this.playSlWarning();
          break;
        case "scale_up":
        case "POSITION_INCREASE":
          this.playScaleUp();
          break;
        case "scale_down":
        case "POSITION_DECREASE":
          this.playScaleDown();
          break;
        case "close_triumph":
        case "TRADE_CLOSED":
          this.playCloseTriumph();
          break;
        case "NEW_TRADE":
          this.playTpChime();
          break;
        default:
          this.playPing();
          break;
      }
    } catch (e) {
      console.warn("Sound trigger error:", e);
    }
  }
}

// Global instance
window.soundAlerts = new SoundAlertSystem();

// Auto unlock audio context on user's first interaction
document.addEventListener("click", () => {
  window.soundAlerts.init();
  window.soundAlerts.resume();
}, { once: true });
