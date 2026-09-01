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
      const C = window.AudioContext || window.webkitAudioContext;
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
  // 消除音效：五种元素各配专属音色（与视觉配色统一，整体克制低沉）
  clear(n, combo, type = "rain") {
    const taps = {
      rain:  () => this.tapRain(),
      leaf:  () => this.tapLeaf(),
      cloud: () => this.tapCloud(),
      moon:  () => this.tapMoon(),
      mist:  () => this.tapMist()
    };
    (taps[type] || taps.rain)();
    if (combo > 1) this.tone(98, .6, "sine", .02);
  }

  // 雨滴：清脆短促的高音钟声 + 轻微水珠泛音，颗粒感强
  tapRain() {
    this.tone(660 + Math.random() * 18, .32, "triangle", .018);
    setTimeout(() => this.tone(880, .18, "sine", .009), 12);
  }

  // 枯叶：木质中音敲击，双音轻微失谐，像干燥叶片断裂
  tapLeaf() {
    this.tone(176, .45, "triangle", .02);
    this.tone(221, .3, "triangle", .012);
  }

  // 乌云：低频闷响长衰减，如远处滚雷，低沉压抑
  tapCloud() {
    this.tone(82, .75, "sine", .02);
    setTimeout(() => this.tone(58, .55, "sine", .012), 40);
  }

  // 残月：明亮悠长的风铃泛音，余音不散
  tapMoon() {
    this.tone(660, .85, "sine", .018);
    setTimeout(() => this.tone(990, .7, "sine", .009), 25);
  }

  // 灰雾：气声般的软噪声垫，弥散、无明确音高
  tapMist() {
    this.breath();
  }

  breath() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuffer();
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 800;
    f.Q.value = .8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(.014, t + .12);
    g.gain.linearRampToValueAtTime(.0001, t + .5);
    s.connect(f).connect(g).connect(this.ctx.destination);
    s.start(t);
    s.stop(t + .55);
  }

  noiseBuffer() {
    if (!this._noise) {
      const c = this.ctx;
      const b = c.createBuffer(1, c.sampleRate * .5, c.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this._noise = b;
    }
    return this._noise;
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

// ---------------- 开场音乐 ----------------
// 使用本地 MP3 播放，避免程序化合成与用户自选背景音乐叠加。
// 页面加载即"模拟点击"唤醒：直接播放 + 派发合成点击/触摸事件；
// 被浏览器自动播放策略拒绝时，等真实首次交互兜底。

const OPENING = {
  src: "music/opening.mp3", // 相对路径，兼容直接打开与 GitHub Pages 子路径
  volume: .22,   // 渐入完成后的主音量
  fadeIn: 5,     // 渐进起音时长（秒），避免突兀
  fadeOut: 1200  // 平滑淡出时长（毫秒）
};

class OpeningMusic {
  constructor(src = OPENING.src) {
    this.audio = new Audio(new URL(src, document.baseURI).href);
    this.audio.preload = "auto";
    this.audio.loop = true;
    this.audio.volume = 0;
    this.active = false;
    this.boundWake = null;
    this.fadeTimer = null;
    // 只有音频真正开始出声后，才做 5 秒渐进起音
    this.audio.addEventListener("play", () => this.rampVolume(OPENING.volume, OPENING.fadeIn));
  }

  play() {
    if (this.active) return;
    this.active = true;
    this.audio.currentTime = 0;
    // 先"模拟点击"：派发合成点击 / 触摸事件，尽可能像真实用户操作一样唤醒音频
    this.simulateActivation();
    this.attemptPlay();
  }

  // 模拟一次页面点击行为（部分浏览器 / 环境会因此放行自动播放）
  simulateActivation() {
    const root = document.documentElement || document.body;
    const pointer = { bubbles: true, cancelable: true, composed: true, pointerType: "mouse" };
    const mouse = { bubbles: true, cancelable: true, composed: true };
    try {
      root.dispatchEvent(new PointerEvent("pointerdown", pointer));
      root.dispatchEvent(new PointerEvent("pointerup", pointer));
      root.dispatchEvent(new MouseEvent("click", mouse));
      root.dispatchEvent(new TouchEvent("touchstart", mouse));
    } catch (e) { /* 合成事件不受支持时忽略 */ }
  }

  attemptPlay() {
    try {
      const result = this.audio.play();
      if (result?.catch) result.catch(() => this.watchAutoplay());
      else if (this.audio.paused) this.watchAutoplay();
    } catch (e) {
      this.watchAutoplay();
    }
  }

  watchAutoplay() {
    if (this.boundWake) return;
    this.boundWake = () => {
      this.unwatchAutoplay();
      if (this.active) this.attemptPlay();
    };
    ["pointerdown", "keydown", "touchstart"].forEach(type => {
      addEventListener(type, this.boundWake, { once: true, capture: true });
    });
  }

  unwatchAutoplay() {
    if (!this.boundWake) return;
    ["pointerdown", "keydown", "touchstart"].forEach(type => {
      removeEventListener(type, this.boundWake, { capture: true });
    });
    this.boundWake = null;
  }

  // 音量渐入 / 渐出（ease-out），避免声音突兀
  rampVolume(target, seconds) {
    clearTimeout(this.fadeTimer);
    const from = this.audio.volume;
    const start = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - start) / (seconds * 1000));
      this.audio.volume = from + (target - from) * (k * (2 - k));
      this.fadeTimer = k < 1 ? setTimeout(step, 50) : null;
    };
    step();
  }

  stop() {
    if (this.active) {
      this.active = false;
      this.rampVolume(0, OPENING.fadeOut / 1000);
      setTimeout(() => {
        if (!this.active) { this.audio.pause(); this.audio.currentTime = 0; }
      }, OPENING.fadeOut + 60);
    }
    this.unwatchAutoplay();
  }
}
