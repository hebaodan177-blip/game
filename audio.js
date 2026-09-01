"use strict";

// ---------------- 音频 ----------------
// 程序化 Web Audio 音效：雨声、风声、心跳、交互音。

class AudioManager {
  constructor() {
    this.ctx = null;
    this.rainGain = null;
    this.windGain = null;
    this.beat = null;
    this.beatStage = null;
  }

  unlock() {
    if (!this.ctx) {
      const C = window.AudioContext || webkitAudioContext;
      if (!C) return;
      this.ctx = new C();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  start() {
    this.unlock();
    if (!this.ctx || this.rainGain) return;
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * .18;
    const s = this.ctx.createBufferSource();
    const f = this.ctx.createBiquadFilter();
    this.rainGain = this.ctx.createGain();
    f.type = "lowpass";
    f.frequency.value = 1500;
    this.rainGain.gain.value = .022;
    s.buffer = b;
    s.loop = true;
    s.connect(f).connect(this.rainGain).connect(this.ctx.destination);
    s.start();
    const o = this.ctx.createOscillator();
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0;
    o.frequency.value = 49;
    o.connect(this.windGain).connect(this.ctx.destination);
    o.start();
  }

  setStage(stage) {
    if (!this.ctx) return;
    this.rainGain.gain.setTargetAtTime(.022 + stage * .011, this.ctx.currentTime, .7);
    this.windGain.gain.setTargetAtTime(stage >= 2 ? .016 : 0, this.ctx.currentTime, .7);
    if (stage >= 3 && this.beatStage !== stage) {
      if (this.beat) clearInterval(this.beat);
      this.beat = setInterval(() => {
        this.tone(45, .16, "sine", .035);
        setTimeout(() => this.tone(39, .12, "sine", .025), 150);
      }, stage === 4 ? 1050 : 1600);
      this.beatStage = stage;
    }
    if (stage < 3 && this.beat) {
      clearInterval(this.beat);
      this.beat = null;
      this.beatStage = null;
    }
  }

  tone(f, d, type = "sine", v = .035) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, f * .76), t + d);
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + .025);
    g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + d + .04);
  }

  select() { this.tone(285, .08, "sine", .012); }
  fail() { this.tone(72, .11, "sine", .012); }
  swap() { this.tone(94, .18, "triangle", .028); }
  clear(n, combo, type = "rain") {
    const tones = { rain: 330, leaf: 176, cloud: 92, moon: 264, mist: 220 };
    const wave = type === "cloud" ? "sine" : type === "leaf" ? "triangle" : "sine";
    this.tone((tones[type] || 220) + Math.random() * 24, .55, wave, .042);
    if (combo > 1) this.tone(98, .6, "sine", .025);
  }
  special() {
    this.tone(392, .16, "triangle", .035);
    setTimeout(() => this.tone(523, .22, "sine", .028), 90);
  }
  comfort() {
    this.tone(262, .28, "sine", .022);
    setTimeout(() => this.tone(330, .42, "sine", .018), 120);
  }
  complete() { this.tone(392, .9, "sine", .025); }
}
