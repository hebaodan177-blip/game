"use strict";

/* =========================================================
   渲染层升级核心
   ---------------------------------------------------------
   1. 背景氛围：分层远景山影 / 城市剪影 / 窗户灯光 / 多层雨丝 /
      地面涟漪 / 前景玻璃水滴 / 漂浮灰烬。
   2. 棋盘材质：玻璃质感棋盘格、内嵌阴影、精致程序化棋子（预渲染
      精灵），雨滴/枯叶/乌云/残月/灰雾各具材质细节。
   3. 动效增强：下落回弹、消除光晕/碎片/星尘、选中脉动发光、
      特殊棋环绕星光。
   4. 角色重绘：带体积感的窗边人物，配合窗框、雨痕与洒入的冷光。
   5. 性能适配：DPR 上限、动态粒子预算、prefers-reduced-motion。
   ========================================================= */

const TWO_PI = Math.PI * 2;
const { PI, sin, cos, min, max, floor, random } = Math;

// 情绪阶段色调：top/mid/bottom 天空、主光色、雾色
const SKY = [
  { top: "#0e1620", mid: "#13202e", bottom: "#0a1118", glow: [195, 215, 225], fog: [160, 185, 195] },
  { top: "#111c29", mid: "#162333", bottom: "#0b121a", glow: [180, 200, 210], fog: [145, 165, 175] },
  { top: "#141d27", mid: "#1b2531", bottom: "#0d131a", glow: [165, 185, 195], fog: [130, 150, 160] },
  { top: "#0f141b", mid: "#161c24", bottom: "#080b0f", glow: [150, 165, 175], fog: [110, 125, 135] },
  { top: "#0a0c0f", mid: "#101318", bottom: "#050508", glow: [125, 140, 150], fog: [85,  98, 105] }
];

// 五元素配色：色相拉开、克制低沉。青蓝(雨) / 赭褐(叶) / 靛紫(云) /
// 暖米(月，唯一亮色) / 无彩冷灰(雾)。饱和度均控制在低-中档，契合忧郁基调。
const PIECE_PALETTE = {
  rain:  { base: [96, 150, 168],  dark: [38, 72, 88],    light: [202, 232, 240], rim: [142, 192, 206] },
  leaf:  { base: [150, 116, 82],  dark: [76, 56, 36],    light: [202, 176, 140], rim: [172, 144, 104] },
  cloud: { base: [88, 96, 126],   dark: [42, 47, 70],    light: [156, 164, 196], rim: [126, 136, 172] },
  moon:  { base: [198, 184, 156], dark: [128, 118, 94],  light: [240, 232, 212], rim: [226, 210, 172] },
  mist:  { base: [108, 116, 122], dark: [60, 66, 72],    light: [170, 178, 184], rim: [142, 150, 158] }
};

function rgb(arr, a = 1) { return `rgba(${arr[0]},${arr[1]},${arr[2]},${a})`; }
function rgba(r, g, b, a) { return `rgba(${r},${g},${b},${a})`; }

// 用于下落的弹性缓动（保留 data.js 的 ease 供其他动画使用）
function easeBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return t >= 1 ? 1 : 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// ---------------- 背景粒子系统 ----------------

class ParticleSystem {
  constructor() {
    this.bg = document.querySelector("#backdrop");
    this.fx = document.querySelector("#effects");
    this.b = this.bg.getContext("2d");
    this.f = this.fx.getContext("2d");

    this.rawDpr = window.devicePixelRatio || 1;
    this.dpr = min(this.rawDpr, 2);
    this.stage = 0;
    this.reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.quality = this.reduceMotion ? "low" : this.detectQuality();

    this.rainFar = [];
    this.rainMid = [];
    this.rainNear = [];
    this.fog = [];
    this.bits = [];
    this.ash = [];
    this.glass = [];
    this.splash = [];
    this.stars = [];
    this.city = [];
    this.hills = [];

    addEventListener("resize", () => this.resize());
    this.resize();
    this.rebuildHills();
    this.rebuildCity();
    this.rebuildRain();
    this.rebuildFog();
    this.rebuildStars();
    this.rebuildGlass();

    requestAnimationFrame(t => this.loop(t));
  }

  detectQuality() {
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) return "medium";
    if (this.rawDpr > 2 || matchMedia("(pointer: coarse)").matches) return "low";
    return "high";
  }

  resize() {
    this.rawDpr = window.devicePixelRatio || 1;
    this.dpr = min(this.rawDpr, 2);
    [this.bg, this.fx].forEach(c => {
      c.width = innerWidth * this.dpr;
      c.height = innerHeight * this.dpr;
      c.style.width = innerWidth + "px";
      c.style.height = innerHeight + "px";
    });
    [this.b, this.f].forEach(ctx => ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0));
    this.rebuildHills();
    this.rebuildCity();
    this.rebuildRain();
    this.rebuildFog();
  }

  setStage(stage) {
    this.stage = clamp(stage, 0, 4);
    this.rebuildRain();
  }

  /* ---- 世界生成 ---- */
  rebuildHills() {
    this.hills = [];
    const layers = 3;
    for (let i = 0; i < layers; i++) {
      const points = [];
      const step = innerWidth / (12 + i * 4);
      for (let x = -step; x <= innerWidth + step; x += step) {
        points.push({ x, y: innerHeight * (0.46 + i * 0.06) + (random() - 0.5) * innerHeight * 0.08 * (i + 1) });
      }
      this.hills.push({ points, alpha: 0.18 - i * 0.04 });
    }
  }

  rebuildCity() {
    this.city = [];
    const max = innerWidth;
    let x = -40;
    while (x < max + 40) {
      const w = 38 + random() * 90;
      const h = 70 + random() * innerHeight * 0.34;
      const windows = [];
      if (w > 50 && h > 100) {
        const cols = floor((w - 12) / 14);
        const rows = floor((h - 18) / 18);
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          if (random() > 0.55) continue; // 部分窗户不亮
          windows.push({
            x: 8 + c * 14 + random() * 2,
            y: 12 + r * 18 + random() * 2,
            on: random() > 0.15,
            flicker: random() * 1000
          });
        }
      }
      this.city.push({ x, w, h, windows, color: `rgba(12,19,26,${0.55 + random() * 0.25})` });
      x += w - 4 + random() * 12;
    }
  }

  rebuildRain() {
    const q = this.quality;
    const sets = [
      { arr: "rainFar",  count: q === "high" ? 160 : q === "medium" ? 110 : 70,  len: [6, 11], v: [3.0, 5.2], a: [0.04, 0.10], w: 0.45 },
      { arr: "rainMid",  count: q === "high" ? 90  : q === "medium" ? 60  : 36,  len: [11, 18], v: [1.8, 3.0], a: [0.10, 0.20], w: 0.75 },
      { arr: "rainNear", count: q === "high" ? 34  : q === "medium" ? 22  : 12, len: [16, 26], v: [0.9, 1.6], a: [0.18, 0.34], w: 1.2 }
    ];
    sets.forEach(s => {
      this[s.arr] = [];
      for (let i = 0; i < s.count; i++) {
        this[s.arr].push(this.newRain(random() * innerHeight, s));
      }
    });
  }

  rebuildFog() {
    this.fog = [];
    const count = this.quality === "high" ? 14 : this.quality === "medium" ? 10 : 7;
    for (let i = 0; i < count; i++) {
      this.fog.push({
        x: random() * innerWidth, y: innerHeight * (0.35 + random() * 0.55),
        w: 160 + random() * 340, s: 0.04 + random() * 0.12,
        a: 0.02 + random() * 0.03
      });
    }
  }

  rebuildStars() {
    this.stars = [];
    const count = this.quality === "high" ? 42 : 24;
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: random() * innerWidth, y: random() * innerHeight * 0.45,
        size: 0.5 + random() * 1.2, phase: random() * TWO_PI, speed: 0.8 + random() * 2
      });
    }
  }

  rebuildGlass() {
    this.glass = [];
    const count = this.quality === "high" ? 38 : this.quality === "medium" ? 26 : 16;
    for (let i = 0; i < count; i++) this.glass.push(this.newGlass());
  }

  newRain(y, set) {
    return {
      x: random() * (innerWidth + 80) - 40,
      y,
      len: set.len[0] + random() * (set.len[1] - set.len[0]),
      v: set.v[0] + random() * (set.v[1] - set.v[0]),
      a: set.a[0] + random() * (set.a[1] - set.a[0]),
      w: set.w,
      angle: 0.12 + random() * 0.08
    };
  }

  newAsh(y = -20) {
    return {
      x: random() * innerWidth, y,
      size: 0.8 + random() * 2.2,
      v: 0.06 + random() * 0.18,
      drift: random() * TWO_PI,
      a: 0.06 + random() * 0.11,
      spin: random() * TWO_PI
    };
  }

  newGlass() {
    return {
      x: random() * innerWidth,
      y: random() * innerHeight,
      size: 0.8 + random() * 2.4,
      trail: 10 + random() * 50,
      v: 0.15 + random() * 0.35,
      phase: random() * TWO_PI
    };
  }

  newSplash(x, y) {
    return { x, y, r: 0, life: 1, max: 4 + random() * 8 };
  }

  emit(type, x, y, count = 10) {
    const colors = { rain: [192, 225, 235], leaf: [165, 185, 155], cloud: [150, 170, 185], moon: [245, 235, 195], mist: [185, 200, 205] };
    const base = colors[type] || colors.rain;
    for (let i = 0; i < count && this.bits.length < 220; i++) {
      const a = random() * TWO_PI;
      const speed = 0.6 + random() * 2.2;
      this.bits.push({
        x, y,
        vx: cos(a) * speed,
        vy: -0.8 - random() * 2.2,
        life: 1,
        size: 1.4 + random() * 3.2,
        color: base.map(v => min(255, v + floor(random() * 40 - 20))),
        sparkle: random() > 0.6
      });
    }
  }

  /* ---- 主循环 ---- */
  loop(now = performance.now()) {
    const b = this.b, f = this.f;
    b.clearRect(0, 0, innerWidth, innerHeight);

    this.drawSky(b, now);
    this.drawHills(b, now);
    this.drawCity(b, now);
    this.drawRainLayer(b, this.rainFar, now, false);
    this.drawFog(b, now);
    this.drawGround(b, now);

    f.clearRect(0, 0, innerWidth, innerHeight);
    this.drawRainLayer(f, this.rainMid, now, false);
    this.drawRainLayer(f, this.rainNear, now, true);
    this.drawSplash(f, now);
    this.drawBits(f, now);
    this.drawAsh(f, now);
    this.drawGlass(f, now);

    requestAnimationFrame(t => this.loop(t));
  }

  /* ---- 天空与远景 ---- */
  drawSky(c, now) {
    const pal = SKY[this.stage];
    const g = c.createLinearGradient(0, 0, 0, innerHeight);
    g.addColorStop(0, pal.top);
    g.addColorStop(0.42, pal.mid);
    g.addColorStop(1, pal.bottom);
    c.fillStyle = g;
    c.fillRect(0, 0, innerWidth, innerHeight);

    // 大气辉光：左上角街灯 / 月光
    const glow = c.createRadialGradient(innerWidth * 0.22, innerHeight * 0.28, 2, innerWidth * 0.22, innerHeight * 0.28, innerWidth * 0.55);
    const [lr, lg, lb] = pal.glow;
    glow.addColorStop(0, rgba(lr, lg, lb, 0.06));
    glow.addColorStop(0.35, rgba(lr, lg, lb, 0.018));
    glow.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = glow;
    c.fillRect(0, 0, innerWidth, innerHeight);

    // 星光
    this.stars.forEach(s => {
      const a = (sin(now / (1400 / s.speed) + s.phase) + 1) * 0.5 * 0.55 + 0.05;
      c.fillStyle = rgba(lr, lg, lb, a);
      c.beginPath();
      c.arc(s.x, s.y, s.size, 0, TWO_PI);
      c.fill();
    });
  }

  drawHills(c, now) {
    this.hills.forEach((layer, idx) => {
      const speed = (idx + 1) * 0.02;
      const shift = this.reduceMotion ? 0 : (now / 1000) * speed * 8;
      c.fillStyle = `rgba(8,14,20,${layer.alpha})`;
      c.beginPath();
      c.moveTo(-50, innerHeight);
      layer.points.forEach((pt, i) => {
        const x = pt.x - shift;
        const wrap = (x + 60) % (innerWidth + 120) - 60;
        if (i === 0) c.lineTo(wrap, pt.y);
        else c.lineTo(wrap, pt.y);
      });
      c.lineTo(innerWidth + 50, innerHeight);
      c.closePath();
      c.fill();
    });
  }

  drawCity(c, now) {
    const groundY = innerHeight * 0.72;
    this.city.forEach(b => {
      // 楼体
      c.fillStyle = b.color;
      c.fillRect(b.x, groundY - b.h, b.w, b.h);
      // 屋顶微光
      c.fillStyle = "rgba(30,45,58,0.5)";
      c.fillRect(b.x, groundY - b.h, b.w, 3);
      // 窗户
      b.windows.forEach(win => {
        if (!win.on) return;
        const flick = (sin((now + win.flicker) / 900) + 1) * 0.5;
        const alpha = 0.25 + flick * 0.35;
        c.fillStyle = rgba(240, 210, 160, alpha);
        c.fillRect(b.x + win.x, groundY - b.h + win.y, 5, 7);
      });
    });
  }

  drawGround(c, now) {
    const y = innerHeight * 0.72;
    const g = c.createLinearGradient(0, y, 0, innerHeight);
    g.addColorStop(0, "rgba(8,13,18,0.92)");
    g.addColorStop(0.25, "rgba(6,10,14,0.95)");
    g.addColorStop(1, "rgba(3,5,7,1)");
    c.fillStyle = g;
    c.fillRect(0, y, innerWidth, innerHeight - y);

    // 湿润反光
    const gl = c.createLinearGradient(0, y, 0, innerHeight);
    const [fr, fg, fb] = SKY[this.stage].glow;
    gl.addColorStop(0, rgba(fr, fg, fb, 0.04));
    gl.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = gl;
    c.fillRect(0, y, innerWidth, innerHeight - y);

    // 街灯光晕
    for (let i = 0; i < 5; i++) {
      const x = innerWidth * (0.12 + i * 0.19);
      const pulse = (sin(now / 2400 + i * 1.3) + 1) * 0.5;
      const rg = c.createRadialGradient(x, y, 1, x, y, 90 + pulse * 30);
      rg.addColorStop(0, rgba(fr, fg, fb, 0.035 + pulse * 0.025));
      rg.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = rg;
      c.fillRect(x - 100, y - 40, 200, 120);
    }
  }

  drawRainLayer(c, drops, now, near) {
    c.lineCap = "round";
    drops.forEach((p, i) => {
      if (!this.reduceMotion) {
        p.y += p.v;
        p.x += p.angle;
      }
      if (p.y > innerHeight + 30 || p.x > innerWidth + 40) {
        drops[i] = this.newRain(-30, { len: [p.len - 3, p.len + 3], v: [p.v - 0.5, p.v + 0.5], a: [p.a - 0.03, p.a + 0.03], w: p.w });
        if (near && random() > 0.8) {
          this.splash.push(this.newSplash(p.x, innerHeight * (0.72 + random() * 0.28)));
        }
      }
      c.strokeStyle = rgba(185, 205, 215, p.a);
      c.lineWidth = p.w;
      c.beginPath();
      c.moveTo(p.x, p.y);
      c.lineTo(p.x - p.len * p.angle, p.y - p.len);
      c.stroke();
    });
  }

  drawFog(c, now) {
    const [fr, fg, fb] = SKY[this.stage].fog;
    this.fog.forEach(o => {
      if (!this.reduceMotion) {
        o.x += o.s;
        if (o.x - o.w > innerWidth) o.x = -o.w;
      }
      const g = c.createRadialGradient(o.x, o.y, 4, o.x, o.y, o.w);
      g.addColorStop(0, rgba(fr, fg, fb, o.a));
      g.addColorStop(1, rgba(fr, fg, fb, 0));
      c.fillStyle = g;
      c.fillRect(o.x - o.w, o.y - o.w, o.w * 2, o.w * 2);
    });
  }

  drawBits(c, now) {
    c.globalCompositeOperation = "lighter";
    this.bits.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.018;
      p.life -= 0.018;
      const a = max(0, p.life);
      const r = p.size * a;
      if (p.sparkle && a > 0.5) {
        c.strokeStyle = rgb(p.color, a);
        c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(p.x - r, p.y);
        c.lineTo(p.x + r, p.y);
        c.moveTo(p.x, p.y - r);
        c.lineTo(p.x, p.y + r);
        c.stroke();
      }
      c.fillStyle = rgb(p.color, a * 0.75);
      c.beginPath();
      c.arc(p.x, p.y, r, 0, TWO_PI);
      c.fill();
    });
    c.globalCompositeOperation = "source-over";
    this.bits = this.bits.filter(p => p.life > 0);
  }

  drawAsh(c, now) {
    this.ash.forEach((p, i) => {
      if (!this.reduceMotion) {
        p.y += p.v;
        p.x += sin(now / 1800 + p.drift) * 0.18;
        p.spin += 0.01;
      }
      if (p.y > innerHeight + 20) this.ash[i] = this.newAsh(-10);
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.spin);
      c.globalAlpha = p.a;
      c.fillStyle = "rgba(170,185,192,0.55)";
      c.fillRect(-p.size, -p.size * 0.35, p.size * 2, p.size * 0.7);
      c.restore();
    });
    c.globalAlpha = 1;
  }

  drawSplash(c, now) {
    this.splash.forEach((p, i) => {
      if (!this.reduceMotion) {
        p.r += 0.25;
        p.life -= 0.045;
      }
      const a = max(0, p.life);
      const rg = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2);
      rg.addColorStop(0, rgba(180, 205, 215, a * 0.15));
      rg.addColorStop(1, "rgba(180,205,215,0)");
      c.fillStyle = rg;
      c.beginPath();
      c.arc(p.x, p.y, p.r * 2, 0, TWO_PI);
      c.fill();
      c.strokeStyle = rgba(185, 205, 215, a * 0.35);
      c.lineWidth = 1;
      c.beginPath();
      c.arc(p.x, p.y, p.r, 0, TWO_PI);
      c.stroke();
    });
    this.splash = this.splash.filter(p => p.life > 0);
  }

  drawGlass(c, now) {
    this.glass.forEach((p, i) => {
      if (!this.reduceMotion) {
        p.y += p.v;
        p.x += sin(now / 2200 + p.phase) * 0.08;
      }
      if (p.y > innerHeight + p.trail) this.glass[i] = this.newGlass();
      const head = p.size;
      const tail = p.trail * (0.6 + 0.4 * sin(now / 600 + p.phase));
      const a = 0.12 + 0.08 * sin(now / 800 + p.phase);
      const g = c.createLinearGradient(p.x, p.y - tail, p.x, p.y);
      g.addColorStop(0, "rgba(210,230,240,0)");
      g.addColorStop(1, rgba(210, 230, 240, a));
      c.strokeStyle = g;
      c.lineWidth = head;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(p.x, p.y - tail);
      c.lineTo(p.x, p.y);
      c.stroke();
      // 水滴高光
      c.fillStyle = rgba(245, 250, 255, a + 0.12);
      c.beginPath();
      c.arc(p.x - head * 0.25, p.y - head * 0.35, head * 0.22, 0, TWO_PI);
      c.fill();
    });
  }
}

// ---------------- 棋盘渲染 ----------------

class BoardRenderer {
  constructor(board, particles, images = null) {
    this.board = board;
    this.particles = particles;
    this.images = null; // 统一采用程序化材质，忽略外部棋子图片
    this.canvas = document.querySelector("#board");
    this.ctx = this.canvas.getContext("2d");
    this.fx = document.querySelector("#boardFx");
    this.fctx = this.fx.getContext("2d");
    this.selected = null;
    this.clearing = [];
    this.swapAnim = null;
    this.dropAnim = null;
    this.size = 0;
    this.sprites = {};
    this.spriteCell = 0;

    addEventListener("resize", () => this.resize());
    this.resize();
    requestAnimationFrame(t => this.frame(t));
  }

  resize() {
    const d = min(devicePixelRatio, 2);
    [this.canvas, this.fx].forEach(c => {
      const r = c.getBoundingClientRect();
      c.width = r.width * d;
      c.height = r.height * d;
      c.getContext("2d").setTransform(d, 0, 0, d, 0, 0);
      this.size = r.width;
    });
    this.spriteCell = this.cell();
    this.buildSprites();
  }

  cell() { return this.size / 8; }

  point(pos) {
    const s = this.cell();
    return { x: (pos.c + 0.5) * s, y: (pos.r + 0.5) * s };
  }

  hit(e) {
    const r = this.canvas.getBoundingClientRect(), s = r.width / 8;
    return { r: clamp(Math.floor((e.clientY - r.top) / s), 0, 7), c: clamp(Math.floor((e.clientX - r.left) / s), 0, 7) };
  }

  mark(list) {
    this.clearing = list.map(p => ({ ...p, t: performance.now() }));
    list.forEach(p => {
      const q = this.point(p), rect = this.canvas.getBoundingClientRect();
      this.particles.emit(p.type, q.x + rect.left, q.y + rect.top, p.type === "mist" ? 18 : 13);
    });
  }

  clearMarks() { this.clearing = []; }

  setDrop(plan) {
    this.dropAnim = plan.length ? {
      start: performance.now(),
      items: new Map(plan.map(p => [p.r + "," + p.c, p]))
    } : null;
  }

  setSwap(a, b) { this.swapAnim = { a: { ...a }, b: { ...b }, t: performance.now() }; }

  buildSprites() {
    // 精灵尺寸略大于一格，内部棋子 z = s * 0.24 ≈ 运行时 z，可直接原尺寸绘制
    const s = Math.max(48, Math.ceil(this.spriteCell * 1.3));
    TYPES.forEach(type => {
      const cvs = document.createElement("canvas");
      cvs.width = cvs.height = s;
      const ctx = cvs.getContext("2d");
      ctx.translate(s / 2, s / 2);
      this.paintPiece(ctx, type, s * 0.24, 0);
      this.sprites[type] = cvs;
    });
  }

  frame(now) {
    const c = this.ctx, s = this.cell();
    c.clearRect(0, 0, this.size, this.size);
    this.drawBoardBackground(c);

    let swapK = 1;
    if (this.swapAnim) {
      swapK = clamp((now - this.swapAnim.t) / SWAP_MS, 0, 1);
      if (swapK >= 1) this.swapAnim = null;
    }
    const drop = this.dropAnim;
    let dropFinished = true;

    for (let r = 0; r < 8; r++) {
      for (let col = 0; col < 8; col++) {
        const x = col * s, y = r * s, type = this.board.grid[r][col];
        this.drawCell(c, x, y, s, r, col, now);
        if (!type) continue;

        const clearing = this.clearing.find(p => p.r === r && p.c === col);
        const dissolve = clearing ? clamp((now - clearing.t) / DISSOLVE_MS, 0, 1) : 0;
        const dropItem = drop?.items.get(r + "," + col);

        let dx = 0, dy = 0;
        if (this.swapAnim && swapK < 1) {
          const a = this.swapAnim.a, b = this.swapAnim.b;
          const hereA = r === a.r && col === a.c, hereB = r === b.r && col === b.c;
          if (hereA || hereB) {
            const from = hereA ? b : a;
            const to = hereA ? a : b;
            const fp = this.point(from), tp = this.point(to), k = ease(swapK);
            dx = (fp.x + (tp.x - fp.x) * k) - (x + s / 2);
            dy = (fp.y + (tp.y - fp.y) * k) - (y + s / 2);
          }
        }

        c.save();
        c.globalAlpha = 1 - dissolve;
        let fallOffset = 0;
        if (dropItem && drop) {
          const progress = clamp((now - drop.start) / DROP_MS, 0, 1);
          fallOffset = (1 - easeBack(progress)) * s * dropItem.distance;
          if (progress < 1) dropFinished = false;
        }

        const float = sin(now / 700 + r * 1.1 + col * 1.7) * s * 0.018;
        c.translate(x + s / 2 + dx, y + s / 2 + dy - fallOffset + dissolve * s * 0.22 + float);
        c.scale(1 - dissolve * 0.34, 1 - dissolve * 0.34);
        const spr = this.sprites[type];
        if (spr) {
          const ds = spr.width;
          c.drawImage(spr, -ds / 2, -ds / 2, ds, ds);
        } else {
          this.drawPiece(type, s * 0.31, now);
        }
        c.restore();

        const special = this.board.specialAt({ r, c: col });
        if (special) {
          c.save();
          c.translate(x + s / 2 + dx, y + s / 2 + dy - fallOffset + float);
          this.drawSpecial(special, s * 0.31, now);
          c.restore();
        }
      }
    }

    if (this.selected) {
      const x = this.selected.c * s, y = this.selected.r * s;
      const pulse = (sin(now / 240) + 1) * 0.5;
      c.strokeStyle = rgba(200, 230, 240, 0.45 + pulse * 0.35);
      c.lineWidth = 2.5;
      c.shadowColor = rgba(185, 220, 235, 0.6);
      c.shadowBlur = 10 + pulse * 8;
      c.strokeRect(x + 4, y + 4, s - 8, s - 8);
      c.shadowBlur = 0;
    }

    if (drop && dropFinished) this.dropAnim = null;
    this.drawFx(now);
    requestAnimationFrame(t => this.frame(t));
  }

  drawBoardBackground(c) {
    const size = this.size;
    // 玻璃底板
    const g = c.createRadialGradient(size / 2, size / 2, size * 0.15, size / 2, size / 2, size * 0.75);
    g.addColorStop(0, "rgba(24, 40, 56, 0.86)");
    g.addColorStop(0.7, "rgba(13, 25, 38, 0.92)");
    g.addColorStop(1, "rgba(7, 14, 23, 0.96)");
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);

    // 边缘高光
    const eg = c.createLinearGradient(0, 0, size, size);
    eg.addColorStop(0, "rgba(185, 210, 225, 0.14)");
    eg.addColorStop(0.08, "rgba(185, 210, 225, 0.04)");
    eg.addColorStop(0.92, "rgba(185, 210, 225, 0.04)");
    eg.addColorStop(1, "rgba(185, 210, 225, 0.14)");
    c.strokeStyle = eg;
    c.lineWidth = 1.5;
    c.strokeRect(1, 1, size - 2, size - 2);

    // 顶部内高光
    const tg = c.createLinearGradient(0, 0, 0, size * 0.55);
    tg.addColorStop(0, "rgba(230, 245, 255, 0.06)");
    tg.addColorStop(1, "rgba(230, 245, 255, 0)");
    c.fillStyle = tg;
    c.fillRect(2, 2, size - 4, size - 4);
  }

  drawCell(c, x, y, s, r, col, now) {
    const innerPad = 1.5;
    // 内嵌阴影
    const shade = c.createLinearGradient(x, y, x + s, y + s);
    shade.addColorStop(0, "rgba(0,0,0,0.22)");
    shade.addColorStop(0.5, "rgba(0,0,0,0)");
    shade.addColorStop(1, "rgba(255,255,255,0.03)");
    c.fillStyle = shade;
    c.fillRect(x + innerPad, y + innerPad, s - innerPad * 2, s - innerPad * 2);

    // 浅网格线
    c.strokeStyle = "rgba(185, 210, 225,0.05)";
    c.lineWidth = 0.8;
    c.strokeRect(x + 2, y + 2, s - 4, s - 4);
  }

  drawPiece(type, z, now) {
    // 接口保留：供外部（章节地图小图标）直接绘制
    this.paintPiece(this.ctx, type, z, now);
  }

  paintPiece(ctx, type, z, now) {
    const p = PIECE_PALETTE[type];
    if (!p) return;

    // 底部光晕
    const glow = ctx.createRadialGradient(0, 0, z * 0.4, 0, 0, z * 1.4);
    glow.addColorStop(0, rgba(p.rim[0], p.rim[1], p.rim[2], 0.18));
    glow.addColorStop(1, rgba(p.rim[0], p.rim[1], p.rim[2], 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, z * 1.5, 0, TWO_PI);
    ctx.fill();

    switch (type) {
      case "rain": this.paintRain(ctx, z, now); break;
      case "leaf": this.paintLeaf(ctx, z, now); break;
      case "cloud": this.paintCloud(ctx, z, now); break;
      case "moon": this.paintMoon(ctx, z, now); break;
      case "mist": this.paintMist(ctx, z, now); break;
    }
  }

  paintRain(c, z, now) {
    const p = PIECE_PALETTE.rain;
    c.save();
    c.rotate(0.12);
    // 主体（渐变取自 palette，保证整体配色统一可调）
    const g = c.createLinearGradient(-z, -z, z, z);
    g.addColorStop(0, rgba(p.light[0], p.light[1], p.light[2], 0.92));
    g.addColorStop(0.45, rgba(p.base[0], p.base[1], p.base[2], 0.8));
    g.addColorStop(1, rgba(p.dark[0], p.dark[1], p.dark[2], 0.75));
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, -z);
    c.bezierCurveTo(z * 0.78, -z * 0.18, z * 0.64, z * 0.7, 0, z * 0.92);
    c.bezierCurveTo(-z * 0.64, z * 0.7, -z * 0.78, -z * 0.18, 0, -z);
    c.fill();
    // 高光
    c.fillStyle = "rgba(255,255,255,0.55)";
    c.beginPath();
    c.ellipse(-z * 0.18, -z * 0.18, z * 0.12, z * 0.28, -0.45, 0, TWO_PI);
    c.fill();
    c.fillStyle = "rgba(255,255,255,0.22)";
    c.beginPath();
    c.arc(z * 0.12, z * 0.38, z * 0.08, 0, TWO_PI);
    c.fill();
    // 边缘
    c.strokeStyle = rgba(p.rim[0], p.rim[1], p.rim[2], 0.35);
    c.lineWidth = 1;
    c.stroke();
    c.restore();
  }

  paintLeaf(c, z, now) {
    const p = PIECE_PALETTE.leaf;
    c.save();
    c.rotate(-0.25);
    // 叶片
    const g = c.createLinearGradient(-z, -z * 0.5, z, z * 0.6);
    g.addColorStop(0, rgb(p.light, 0.95));
    g.addColorStop(0.5, rgb(p.base, 0.95));
    g.addColorStop(1, rgb(p.dark, 0.95));
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-z * 0.72, z * 0.3);
    c.bezierCurveTo(-z * 0.66, -z * 0.82, z * 0.58, -z * 0.86, z * 0.7, -z * 0.25);
    c.bezierCurveTo(z * 0.74, z * 0.36, z * 0.12, z * 0.82, -z * 0.72, z * 0.3);
    c.fill();
    // 叶脉
    c.strokeStyle = rgba(p.dark[0] - 20, p.dark[1] - 20, p.dark[2] - 20, 0.6);
    c.lineWidth = 1.4;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(-z * 0.62, z * 0.22);
    c.lineTo(z * 0.56, -z * 0.26);
    c.moveTo(-z * 0.1, z * 0.04);
    c.lineTo(-z * 0.1, -z * 0.34);
    c.moveTo(z * 0.08, -z * 0.06);
    c.lineTo(z * 0.28, -z * 0.34);
    c.stroke();
    // 边缘高光
    c.strokeStyle = rgba(p.light[0], p.light[1], p.light[2], 0.45);
    c.lineWidth = 0.8;
    c.stroke();
    c.restore();
  }

  paintCloud(c, z, now) {
    const p = PIECE_PALETTE.cloud;
    // 多层蓬松圆弧
    const blobs = [
      { x: -z * 0.42, y: z * 0.08, r: z * 0.34, dark: 0.18 },
      { x: 0, y: -z * 0.08, r: z * 0.44, dark: 0.12 },
      { x: z * 0.42, y: z * 0.12, r: z * 0.31, dark: 0.2 },
      { x: -z * 0.12, y: z * 0.22, r: z * 0.26, dark: 0.22 },
      { x: z * 0.18, y: z * 0.28, r: z * 0.22, dark: 0.24 }
    ];
    c.save();
    blobs.forEach(b => {
      const g = c.createRadialGradient(b.x - b.r * 0.25, b.y - b.r * 0.25, 1, b.x, b.y, b.r);
      g.addColorStop(0, rgb(p.light, 0.85 - b.dark));
      g.addColorStop(1, rgb(p.dark, 0.9));
      c.fillStyle = g;
      c.beginPath();
      c.arc(b.x, b.y, b.r, 0, TWO_PI);
      c.fill();
    });
    // 底部阴影带
    c.fillStyle = rgba(p.dark[0], p.dark[1], p.dark[2], 0.35);
    c.fillRect(-z * 0.6, z * 0.26, z * 1.2, z * 0.18);
    c.restore();
  }

  paintMoon(c, z, now) {
    const p = PIECE_PALETTE.moon;
    c.save();
    // 光晕
    const g = c.createRadialGradient(0, 0, z * 0.5, 0, 0, z * 1.25);
    g.addColorStop(0, rgba(p.rim[0], p.rim[1], p.rim[2], 0.22));
    g.addColorStop(1, rgba(p.rim[0], p.rim[1], p.rim[2], 0));
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, z * 1.25, 0, TWO_PI);
    c.fill();
    // 月面
    const mg = c.createRadialGradient(-z * 0.2, -z * 0.2, 1, 0, 0, z * 0.72);
    mg.addColorStop(0, rgb(p.light, 0.95));
    mg.addColorStop(1, rgb(p.base, 0.95));
    c.fillStyle = mg;
    c.beginPath();
    c.arc(0, 0, z * 0.72, 0, TWO_PI);
    c.fill();
    // 挖去形成残月
    c.globalCompositeOperation = "destination-out";
    c.beginPath();
    c.arc(z * 0.34, -z * 0.18, z * 0.69, 0, TWO_PI);
    c.fill();
    c.globalCompositeOperation = "source-over";
    // 陨石坑（取 palette 暗色，随配色方案联动）
    c.fillStyle = rgba(p.dark[0], p.dark[1], p.dark[2], 0.35);
    [[-z * 0.22, z * 0.12, z * 0.1], [z * 0.05, z * 0.42, z * 0.07], [-z * 0.35, -z * 0.15, z * 0.05]].forEach(cr => {
      c.beginPath();
      c.arc(cr[0], cr[1], cr[2], 0, TWO_PI);
      c.fill();
    });
    // 边缘亮线
    c.strokeStyle = rgba(p.light[0], p.light[1], p.light[2], 0.5);
    c.lineWidth = 0.8;
    c.beginPath();
    c.arc(0, 0, z * 0.72, 1.4 * PI, 1.85 * PI);
    c.stroke();
    c.restore();
  }

  paintMist(c, z, now) {
    const p = PIECE_PALETTE.mist;
    c.save();
    const blobs = [
      { x: -z * 0.35, y: z * 0.05, rx: z * 0.55, ry: z * 0.26, a: 0.28 },
      { x: z * 0.3, y: -z * 0.08, rx: z * 0.48, ry: z * 0.22, a: 0.22 },
      { x: 0, y: z * 0.18, rx: z * 0.45, ry: z * 0.18, a: 0.24 },
      { x: -z * 0.12, y: -z * 0.22, rx: z * 0.32, ry: z * 0.14, a: 0.16 }
    ];
    blobs.forEach(b => {
      const g = c.createRadialGradient(b.x, b.y, 1, b.x, b.y, b.rx);
      g.addColorStop(0, rgb(p.light, b.a));
      g.addColorStop(1, rgba(p.dark[0], p.dark[1], p.dark[2], 0));
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(b.x, b.y, b.rx, b.ry, 0, 0, TWO_PI);
      c.fill();
    });
    // 微光尘
    c.fillStyle = rgba(255, 255, 255, 0.35);
    for (let i = 0; i < 5; i++) {
      const a = i * 1.25;
      const rr = z * 0.35;
      c.beginPath();
      c.arc(cos(a) * rr, sin(a) * rr * 0.45, z * 0.04, 0, TWO_PI);
      c.fill();
    }
    c.restore();
  }

  drawSpecial(special, z, now) {
    const c = this.ctx;
    c.save();
    const isColor = special.bonus === "color";
    c.rotate(now / (isColor ? 700 : 900));
    const stroke = isColor ? "rgba(250,215,130,0.92)" : "rgba(200,235,245,0.9)";
    c.strokeStyle = stroke;
    c.lineWidth = max(1.5, z * 0.09);
    c.shadowColor = stroke;
    c.shadowBlur = 12;
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * PI / 4, radius = i % 2 ? z * 0.82 : z * 1.08;
      const x = cos(a) * radius, y = sin(a) * radius;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.closePath();
    c.stroke();
    // 环绕微粒
    c.shadowBlur = 0;
    c.fillStyle = stroke;
    const orbit = now / 1200;
    for (let i = 0; i < 4; i++) {
      const a = orbit + i * PI / 2;
      const r = z * (1.2 + 0.1 * sin(now / 400 + i));
      c.beginPath();
      c.arc(cos(a) * r, sin(a) * r, z * 0.08, 0, TWO_PI);
      c.fill();
    }
    c.restore();
  }

  drawFx(now) {
    this.fctx.clearRect(0, 0, this.size, this.size);
    this.clearing = this.clearing.filter(p => now - p.t < MARK_LIFE_MS);
    this.clearing.forEach(p => {
      const q = this.point(p), t = (now - p.t) / MARK_LIFE_MS;
      const a = 1 - t;
      // 外层涟漪
      this.fctx.strokeStyle = rgba(195, 220, 235, a * 0.25);
      this.fctx.lineWidth = 1.2;
      this.fctx.beginPath();
      this.fctx.arc(q.x, q.y, this.cell() * (0.18 + t * 0.42), 0, TWO_PI);
      this.fctx.stroke();
      // 内层闪光
      this.fctx.strokeStyle = rgba(255, 250, 230, a * 0.35);
      this.fctx.lineWidth = 1.5;
      this.fctx.beginPath();
      this.fctx.arc(q.x, q.y, this.cell() * (0.08 + t * 0.22), 0, TWO_PI);
      this.fctx.stroke();
      // 十字星光
      if (a > 0.6) {
        const r = this.cell() * 0.2 * a;
        this.fctx.strokeStyle = rgba(255, 255, 255, a * 0.4);
        this.fctx.lineWidth = 1;
        this.fctx.beginPath();
        this.fctx.moveTo(q.x - r, q.y); this.fctx.lineTo(q.x + r, q.y);
        this.fctx.moveTo(q.x, q.y - r); this.fctx.lineTo(q.x, q.y + r);
        this.fctx.stroke();
      }
    });
  }
}

// ---------------- 角色姿态 ----------------

const POSES = {
  A: { x: 0, y: 0, scale: 0, turn: 0, lean: 0, headX: 0, headDrop: 0, armL: 1.75, armR: 1.38, legL: 1.82, legR: 1.32, sit: 0, window: 0 },
  B: { x: 0, y: 0, scale: 0, turn: 0, lean: 1.1, headX: 2, headDrop: 9, armL: 1.7, armR: 1.44, legL: 1.82, legR: 1.32, sit: 0, window: 0 },
  C: { x: 0, y: 2, scale: 0, turn: 0, lean: 2.4, headX: 4, headDrop: 19, armL: 1.13, armR: 2.02, legL: 1.82, legR: 1.32, sit: 0, window: 0 },
  D: { x: -1, y: 6, scale: -0.1, turn: 0, lean: 3, headX: 1, headDrop: 35, armL: 1.28, armR: 1.86, legL: 2.35, legR: 0.78, sit: 1, window: 0 },
  E: { x: -5, y: 10, scale: -0.2, turn: 82, lean: 4, headX: 7, headDrop: 43, armL: 1.5, armR: 1.8, legL: 2.4, legR: 0.72, sit: 1.4, window: 0 },
  F: { x: 2, y: 0, scale: 0, turn: 180, lean: 1.5, headX: 2, headDrop: 12, armL: 1.7, armR: 1.4, legL: 1.82, legR: 1.32, sit: 0, window: 0 },
  G: { x: 12, y: 0, scale: 0, turn: 8, lean: -0.7, headX: 7, headDrop: -4, armL: 0.1, armR: 1.4, legL: 1.82, legR: 1.32, sit: 0, window: 1 },
  H: { x: 11, y: 7, scale: -0.06, turn: 5, lean: 1, headX: 9, headDrop: 5, armL: 0.25, armR: 1.48, legL: 2.35, legR: 1.02, sit: 0.78, window: 1 },
  I: { x: 5, y: -1, scale: 0.02, turn: 2, lean: -0.35, headX: 10, headDrop: -7, armL: 0.72, armR: 1.2, legL: 1.82, legR: 1.32, sit: 0, window: 0 }
};

class CharacterRenderer {
  constructor() {
    this.canvas = document.querySelector("#character");
    this.ctx = this.canvas.getContext("2d");
    this.dpr = min(devicePixelRatio, 2);
    this.from = POSES.A;
    this.to = POSES.A;
    this.start = performance.now();
    this.duration = 2600;
    this.reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    addEventListener("resize", () => this.resize());
    this.resize();
    requestAnimationFrame(t => this.frame(t));
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = min(devicePixelRatio, 2);
    this.canvas.width = r.width * this.dpr;
    this.canvas.height = r.height * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  setPose(name, duration = 2800) {
    if (!POSES[name]) return;
    this.from = this.poseNow(performance.now());
    this.to = POSES[name];
    this.start = performance.now();
    this.duration = duration;
  }

  poseNow(now) {
    const t = clamp((now - this.start) / this.duration, 0, 1);
    const out = {};
    for (const k in this.to)
      out[k] = (this.from[k] ?? this.to[k]) + (this.to[k] - (this.from[k] ?? this.to[k])) * ease(t);
    return out;
  }

  play(name) {
    const actions = {
      turn: [["C", 800], ["F", 3900]],
      sit: [["C", 700], ["D", 3400]],
      rise: [["D", 800], ["C", 3600]],
      window: [["F", 1600], ["G", 3500], ["H", 2200]],
      sky: [["G", 1200], ["A", 4800]],
      comfort: [["I", 1000], ["G", 3600]]
    }[name];
    if (!actions) return;
    const run = () => {
      const n = actions.shift();
      if (!n) return;
      this.setPose(...n);
      setTimeout(run, n[1]);
    };
    run();
  }

  frame(now) {
    const c = this.ctx;
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;
    const p = this.poseNow(now);
    const breath = sin(now / 560) * 2;
    const tremor = sin(now / 93) * 0.55;

    c.clearRect(0, 0, w, h);

    // 场景：墙面、窗户、光
    this.drawScene(c, w, h, now);

    // 人物基点
    const bx = w * (0.31 + p.x * 0.09);
    const by = h * (0.81 + p.y * 0.07);
    const sc = min(w, h) / 205 * (1 + p.scale * 0.08);

    c.save();
    c.translate(bx, by);
    c.scale(sc, sc);
    c.rotate(p.turn * 0.01745);
    this.drawCharacter(c, p, breath, tremor, w);
    c.restore();

    requestAnimationFrame(t => this.frame(t));
  }

  drawScene(c, w, h, now) {
    // 墙面暗调
    const wall = c.createLinearGradient(0, 0, w, h);
    wall.addColorStop(0, "rgba(8,14,22,0.95)");
    wall.addColorStop(1, "rgba(5,9,14,0.98)");
    c.fillStyle = wall;
    c.fillRect(0, 0, w, h);

    // 窗户（右侧）
    const winX = w * 0.54, winY = h * 0.12, winW = w * 0.44, winH = h * 0.62;
    // 窗框
    c.fillStyle = "rgba(18, 28, 38, 0.92)";
    c.fillRect(winX - 6, winY - 6, winW + 12, winH + 12);
    // 窗玻璃
    const glass = c.createLinearGradient(winX, winY, winX, winY + winH);
    glass.addColorStop(0, "rgba(75, 100, 120, 0.18)");
    glass.addColorStop(1, "rgba(25, 40, 55, 0.28)");
    c.fillStyle = glass;
    c.fillRect(winX, winY, winW, winH);
    // 窗外月光/街灯
    const moonGlow = c.createRadialGradient(winX + winW * 0.65, winY + winH * 0.35, 4, winX + winW * 0.65, winY + winH * 0.35, winW * 0.5);
    moonGlow.addColorStop(0, "rgba(220, 210, 175, 0.22)");
    moonGlow.addColorStop(1, "rgba(220, 210, 175, 0)");
    c.fillStyle = moonGlow;
    c.fillRect(winX, winY, winW, winH);
    // 窗格
    c.strokeStyle = "rgba(15, 26, 36, 0.85)";
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(winX + winW / 2, winY); c.lineTo(winX + winW / 2, winY + winH);
    c.moveTo(winX, winY + winH / 2); c.lineTo(winX + winW, winY + winH / 2);
    c.stroke();
    // 窗框高光
    c.strokeStyle = "rgba(185, 210, 225, 0.12)";
    c.lineWidth = 1;
    c.strokeRect(winX, winY, winW, winH);
    // 窗台
    c.fillStyle = "rgba(12, 20, 28, 0.95)";
    c.fillRect(winX - 8, winY + winH - 2, winW + 16, 12);
    // 窗帘（左侧）
    const cur = c.createLinearGradient(0, 0, w * 0.22, 0);
    cur.addColorStop(0, "rgba(8,13,20,0.96)");
    cur.addColorStop(1, "rgba(8,13,20,0)");
    c.fillStyle = cur;
    c.fillRect(0, 0, w * 0.22, h);
    // 雨痕
    c.strokeStyle = "rgba(180, 205, 220, 0.06)";
    c.lineWidth = 1;
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const x = winX + winW * (0.12 + i * 0.15);
      c.moveTo(x, winY + 10);
      c.lineTo(x + 8, winY + winH - 10);
    }
    c.stroke();
    // 窗内洒入地面的光
    const floorLight = c.createLinearGradient(winX + winW * 0.5, winY + winH, winX, h);
    floorLight.addColorStop(0, "rgba(200, 210, 190, 0.07)");
    floorLight.addColorStop(1, "rgba(200, 210, 190, 0)");
    c.fillStyle = floorLight;
    c.beginPath();
    c.moveTo(winX + winW * 0.2, winY + winH);
    c.lineTo(winX + winW * 0.9, winY + winH);
    c.lineTo(winX + winW * 0.5, h);
    c.closePath();
    c.fill();
  }

  drawCharacter(c, p, breath, tremor, w) {
    // 脚下阴影
    const sh = c.createRadialGradient(4, 8, 2, 4, 8, 58 + p.sit * 26);
    sh.addColorStop(0, "rgba(3,10,17,0.75)");
    sh.addColorStop(1, "rgba(3,10,17,0)");
    c.fillStyle = sh;
    c.beginPath();
    c.ellipse(4, 8, 55 + p.sit * 26, 9, 0, 0, TWO_PI);
    c.fill();

    const hip = { x: 0, y: -20 - p.sit * 42 };
    const shldr = { x: p.lean * 8, y: -103 + p.sit * 22 + breath };
    const head = { x: shldr.x + p.headX, y: shldr.y - 27 + p.headDrop };
    const arm = (side, a) => ({ x: shldr.x + side * cos(a) * 32, y: shldr.y + sin(a) * 34 });
    const knee = (side, a) => ({ x: hip.x + side * cos(a) * 31, y: hip.y + sin(a) * 35 });
    const foot = (j, s) => ({ x: j.x + s * 10, y: j.y + 39 + p.sit * 15 });
    const la = arm(-1, p.armL), ra = arm(1, p.armR);
    const lk = knee(-1, p.legL), rk = knee(1, p.legR);

    // 外套躯干（填充体积）
    const bodyGrad = c.createLinearGradient(shldr.x - 20, shldr.y, hip.x + 20, hip.y);
    bodyGrad.addColorStop(0, "rgba(35, 52, 68, 0.96)");
    bodyGrad.addColorStop(1, "rgba(18, 29, 40, 0.96)");
    c.fillStyle = bodyGrad;
    c.beginPath();
    c.moveTo(shldr.x - 22, shldr.y);
    c.quadraticCurveTo(shldr.x - 8, (shldr.y + hip.y) / 2, hip.x - 24, hip.y);
    c.lineTo(hip.x + 24, hip.y);
    c.quadraticCurveTo(shldr.x + 8, (shldr.y + hip.y) / 2, shldr.x + 22, shldr.y);
    c.closePath();
    c.fill();

    // 轮廓线（肢体）
    c.strokeStyle = "rgba(30, 45, 58, 0.95)";
    c.lineCap = "round";
    c.lineJoin = "round";
    c.lineWidth = 17;
    c.beginPath();
    c.moveTo(hip.x, hip.y);
    c.quadraticCurveTo(shldr.x + p.lean * 2, (hip.y + shldr.y) / 2, shldr.x, shldr.y);
    c.stroke();

    // 手臂
    c.lineWidth = 13;
    c.strokeStyle = "rgba(35, 50, 64, 0.96)";
    c.beginPath();
    c.moveTo(shldr.x, shldr.y);
    c.lineTo(la.x, la.y);
    c.lineTo(la.x - 6, la.y + 27);
    c.moveTo(shldr.x, shldr.y);
    c.lineTo(ra.x, ra.y);
    c.lineTo(ra.x + 6, ra.y + 27);
    c.stroke();

    // 腿
    c.lineWidth = 14;
    c.strokeStyle = "rgba(28, 42, 54, 0.96)";
    c.beginPath();
    c.moveTo(hip.x, hip.y);
    c.lineTo(lk.x, lk.y);
    const lf = foot(lk, -1);
    c.lineTo(lf.x, lf.y);
    c.moveTo(hip.x, hip.y);
    c.lineTo(rk.x, rk.y);
    const rf = foot(rk, 1);
    c.lineTo(rf.x, rf.y);
    c.stroke();

    // 头部 + 头发
    const headGrad = c.createRadialGradient(head.x - 6, head.y - 8, 2, head.x + tremor, head.y, 20);
    headGrad.addColorStop(0, "rgba(55, 72, 85, 0.98)");
    headGrad.addColorStop(1, "rgba(30, 40, 50, 0.98)");
    c.fillStyle = headGrad;
    c.beginPath();
    c.arc(head.x + tremor, head.y, 18, 0, TWO_PI);
    c.fill();
    // 头发轮廓
    c.fillStyle = "rgba(18, 26, 34, 0.98)";
    c.beginPath();
    c.arc(head.x + tremor, head.y - 2, 19, PI, TWO_PI);
    c.fill();
    // 面向窗户的轮廓光（rim）
    c.strokeStyle = "rgba(190, 210, 215, 0.18)";
    c.lineWidth = 1.3;
    c.beginPath();
    c.arc(head.x + tremor, head.y, 18, -0.4 * PI, 0.6 * PI);
    c.stroke();

    // 发丝
    c.strokeStyle = "rgba(170, 195, 205, 0.14)";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(head.x - 12, head.y - 10);
    c.quadraticCurveTo(head.x - 25, head.y - 4, head.x - 20, head.y + 9);
    c.stroke();
  }
}



