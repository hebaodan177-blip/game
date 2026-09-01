"use strict";

// ---------------- 背景粒子系统 ----------------

  class ParticleSystem {
    constructor() {
      this.bg = document.querySelector("#backdrop");
      this.fx = document.querySelector("#effects");
      this.b = this.bg.getContext("2d");
      this.f = this.fx.getContext("2d");
      this.rain = [];
      this.fog = [];
      this.bits = [];
      this.ash = [];
      this.density = 78;
      addEventListener("resize", () => this.resize());
      this.resize();
      for (let i = 0; i < this.density; i++)
        this.rain.push(this.newRain(Math.random() * innerHeight));
      for (let i = 0; i < 9; i++)
        this.fog.push({
          x: Math.random() * innerWidth,
          y: Math.random() * innerHeight,
          w: 180 + Math.random() * 270,
          s: .05 + Math.random() * .1,
          a: .02 + Math.random() * .025
        });
      for (let i = 0; i < 24; i++) this.ash.push(this.newAsh(Math.random() * innerHeight));
      requestAnimationFrame(t => this.loop(t));
    }

    resize() {
      [this.bg, this.fx].forEach(c => {
        c.width = innerWidth * devicePixelRatio;
        c.height = innerHeight * devicePixelRatio;
        c.style.width = innerWidth + "px";
        c.style.height = innerHeight + "px";
      });
      [this.b, this.f].forEach(c => c.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0));
    }

    newRain(y = -30) {
      return { x: Math.random() * innerWidth, y, len: 8 + Math.random() * 19, v: .8 + Math.random() * 1.8, a: .06 + Math.random() * .15 };
    }

    newAsh(y = -20) {
      return { x: Math.random() * innerWidth, y, size: 1 + Math.random() * 2.5, v: .08 + Math.random() * .24, drift: Math.random() * 6.28, a: .08 + Math.random() * .13, spin: Math.random() * 6.28 };
    }

    setStage(stage) {
      this.density = stage >= 3 ? 126 : stage === 2 ? 102 : 78;
      while (this.rain.length < this.density) this.rain.push(this.newRain(Math.random() * innerHeight));
      if (this.rain.length > this.density) this.rain.length = this.density;
    }

    emit(type, x, y, count = 10) {
      const colors = { rain: "#b3d6df", leaf: "#89989b", cloud: "#a7b0b7", moon: "#d2d9d2", mist: "#b3c2c7" };
      for (let i = 0; i < count && this.bits.length < 220; i++)
        this.bits.push({ x, y, vx: (Math.random() - .5) * 1.6, vy: -.5 - Math.random() * 1.8, life: 1, size: 2 + Math.random() * 4, color: colors[type] });
    }

    loop(now = performance.now()) {
      this.b.clearRect(0, 0, innerWidth, innerHeight);
      this.drawSky(now);
      this.rain.forEach((p, i) => {
        p.y += p.v;
        p.x += .15;
        if (p.y > innerHeight + 30 || p.x > innerWidth + 30) this.rain[i] = this.newRain();
        this.b.strokeStyle = `rgba(185,207,218,${p.a})`;
        this.b.lineWidth = .7;
        this.b.beginPath();
        this.b.moveTo(p.x, p.y);
        this.b.lineTo(p.x - p.len * .18, p.y - p.len);
        this.b.stroke();
      });
      this.f.clearRect(0, 0, innerWidth, innerHeight);
      this.bits.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += .018;
        p.life -= .018;
        this.f.globalAlpha = Math.max(0, p.life);
        this.f.fillStyle = p.color;
        this.f.beginPath();
        this.f.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        this.f.fill();
      });
      // 最前景的灰烬缓慢飘落，速度远低于雨丝，增加纵深感。
      this.ash.forEach((p, i) => {
        p.y += p.v;
        p.x += Math.sin(now / 1800 + p.drift) * .18;
        p.spin += .01;
        if (p.y > innerHeight + 20) this.ash[i] = this.newAsh(-10);
        this.f.save();
        this.f.translate(p.x, p.y);
        this.f.rotate(p.spin);
        this.f.globalAlpha = p.a;
        this.f.fillStyle = "#aebdc1";
        this.f.fillRect(-p.size, -p.size * .35, p.size * 2, p.size * .7);
        this.f.restore();
      });
      this.f.globalAlpha = 1;
      this.bits = this.bits.filter(p => p.life > 0);
      requestAnimationFrame(t => this.loop(t));
    }

    drawSky(now = performance.now()) {
      const g = this.b.createLinearGradient(0, 0, 0, innerHeight);
      g.addColorStop(0, "#111e2d");
      g.addColorStop(1, "#0a1320");
      this.b.fillStyle = g;
      this.b.fillRect(0, 0, innerWidth, innerHeight);
      this.b.fillStyle = "rgba(20,34,48,.62)";
      for (let i = 0; i < 13; i++) {
        const x = i * 170 - 40, h = 80 + (i % 4) * 56;
        this.b.fillRect(x, innerHeight * .54 - h, 100, h);
      }
      // 远景灯影随时间缓慢呼吸，不抢夺棋盘注意力。
      for (let i = 0; i < 7; i++) {
        const x = innerWidth * (.08 + i * .145);
        const y = innerHeight * (.54 - (i % 3) * .045);
        const glow = .025 + (Math.sin(now / 2600 + i * 1.7) + 1) * .012;
        const light = this.b.createRadialGradient(x, y, 1, x, y, 38);
        light.addColorStop(0, `rgba(174,193,193,${glow})`);
        light.addColorStop(1, "rgba(174,193,193,0)");
        this.b.fillStyle = light;
        this.b.fillRect(x - 40, y - 40, 80, 80);
        this.b.fillStyle = `rgba(183,204,202,${glow * 1.8})`;
        this.b.fillRect(x - 1, y - 1, 2, 2);
      }
      this.fog.forEach(o => {
        o.x += o.s;
        if (o.x - o.w > innerWidth) o.x = -o.w;
        const g = this.b.createRadialGradient(o.x, o.y, 2, o.x, o.y, o.w);
        g.addColorStop(0, `rgba(176,194,201,${o.a})`);
        g.addColorStop(1, "rgba(176,194,201,0)");
        this.b.fillStyle = g;
        this.b.fillRect(o.x - o.w, o.y - o.w, o.w * 2, o.w * 2);
      });
    }
  }

  // ---------------- 棋盘渲染 ----------------

  class BoardRenderer {
    constructor(board, particles, images = null) {
      this.board = board;
      this.particles = particles;
      this.images = images;   // { type: Image | null }，null 表示全部程序化绘制
      this.canvas = document.querySelector("#board");
      this.ctx = this.canvas.getContext("2d");
      this.fx = document.querySelector("#boardFx");
      this.fctx = this.fx.getContext("2d");
      this.selected = null;
      this.clearing = [];
      this.swapAnim = null;
      this.dropAnim = null;
      this.size = 0;
      addEventListener("resize", () => this.resize());
      this.resize();
      requestAnimationFrame(t => this.frame(t));
    }

    resize() {
      const d = devicePixelRatio;
      [this.canvas, this.fx].forEach(c => {
        const r = c.getBoundingClientRect();
        c.width = r.width * d;
        c.height = r.height * d;
        c.getContext("2d").setTransform(d, 0, 0, d, 0, 0);
        this.size = r.width;
      });
    }

    cell() { return this.size / 8; }

    point(pos) {
      const s = this.cell();
      return { x: (pos.c + .5) * s, y: (pos.r + .5) * s };
    }

    hit(e) {
      const r = this.canvas.getBoundingClientRect(), s = r.width / 8;
      return { r: clamp(Math.floor((e.clientY - r.top) / s), 0, 7), c: clamp(Math.floor((e.clientX - r.left) / s), 0, 7) };
    }

    mark(list) {
      this.clearing = list.map(p => ({ ...p, t: performance.now() }));
      list.forEach(p => {
        const q = this.point(p), rect = this.canvas.getBoundingClientRect();
        this.particles.emit(p.type, q.x + rect.left, q.y + rect.top, p.type === "mist" ? 16 : 11);
      });
    }

    // 清除旧坐标标记，避免补位后的新方块被错误地继续淡出。
    clearMarks() {
      this.clearing = [];
    }

    // 所有列共享同一个动画起点，每个目标格保留自己的下落距离。
    setDrop(plan) {
      this.dropAnim = plan.length ? {
        start: performance.now(),
        items: new Map(plan.map(p => [p.r + "," + p.c, p]))
      } : null;
    }

    setSwap(a, b) {
      this.swapAnim = { a: { ...a }, b: { ...b }, t: performance.now() };
    }

    frame(now) {
      const c = this.ctx, s = this.cell();
      c.clearRect(0, 0, this.size, this.size);
      const bg = c.createLinearGradient(0, 0, this.size, this.size);
      bg.addColorStop(0, "rgba(17,31,44,.9)");
      bg.addColorStop(1, "rgba(7,15,25,.9)");
      c.fillStyle = bg;
      c.fillRect(0, 0, this.size, this.size);

      // 交换动画进度（两块互移位置）
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
          c.strokeStyle = "rgba(181,207,218,.09)";
          c.strokeRect(x + 1, y + 1, s - 2, s - 2);
          if (!type) continue;

          const clearing = this.clearing.find(p => p.r === r && p.c === col);
          const dissolve = clearing ? clamp((now - clearing.t) / DISSOLVE_MS, 0, 1) : 0;
          const dropItem = drop?.items.get(r + "," + col);

          // 交换位移：动画期间当前块渲染在"原格 → 目标格"的插值位置
          let dx = 0, dy = 0;
          if (this.swapAnim && swapK < 1) {
            const a = this.swapAnim.a, b = this.swapAnim.b;
            const hereA = r === a.r && col === a.c, hereB = r === b.r && col === b.c;
            if (hereA || hereB) {
              const from = hereA ? b : a;   // 该块原本所在格
              const to = hereA ? a : b;     // 该块要去往的格
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
            fallOffset = (1 - ease(progress)) * s * dropItem.distance;
            if (progress < 1) dropFinished = false;
          }
          c.translate(x + s / 2 + dx, y + s / 2 + dy - fallOffset + dissolve * s * .22);
          c.scale(1 - dissolve * .34, 1 - dissolve * .34);
          this.drawPiece(type, s * .31, now);
          const special = this.board.specialAt({ r, c: col });
          if (special) this.drawSpecial(special, s * .31, now);
          c.restore();
        }
      }

      if (this.selected) {
        const x = this.selected.c * s, y = this.selected.r * s;
        c.strokeStyle = "rgba(205,225,231,.7)";
        c.lineWidth = 2;
        c.strokeRect(x + 3, y + 3, s - 6, s - 6);
      }
      if (drop && dropFinished) this.dropAnim = null;
      this.drawFx(now);
      requestAnimationFrame(t => this.frame(t));
    }

    drawPiece(type, z, now) {
      const c = this.ctx;
      const img = this.images && this.images[type];
      if (img) {
        // 外部棋子图片：等比缩放铺满棋子区域
        const s = z * 2.6;
        c.save();
        c.globalAlpha *= .97;
        c.drawImage(img, -s / 2, -s / 2, s, s);
        c.restore();
        return;
      }
      c.lineJoin = "round";
      if (type === "rain") {
        const g = c.createLinearGradient(-z, -z, z, z);
        g.addColorStop(0, "rgba(211,232,235,.88)");
        g.addColorStop(1, "rgba(86,128,147,.65)");
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(0, -z);
        c.bezierCurveTo(z * .8, -z * .15, z * .66, z * .7, 0, z * .9);
        c.bezierCurveTo(-z * .66, z * .7, -z * .8, -z * .15, 0, -z);
        c.fill();
        c.fillStyle = "rgba(240,248,247,.35)";
        c.beginPath();
        c.ellipse(-z * .18, -z * .16, z * .12, z * .25, -.5, 0, 7);
        c.fill();
      } else if (type === "leaf") {
        c.strokeStyle = "#95a6a4";
        c.fillStyle = "#65787c";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(-z * .75, z * .32);
        c.bezierCurveTo(-z * .68, -z * .8, z * .6, -z * .85, z * .72, -z * .26);
        c.bezierCurveTo(z * .74, z * .35, z * .12, z * .8, -z * .75, z * .32);
        c.fill();
        c.beginPath();
        c.moveTo(-z * .63, z * .24);
        c.lineTo(z * .58, -z * .28);
        c.moveTo(-z * .1, z * .05);
        c.lineTo(-z * .1, -z * .36);
        c.moveTo(z * .1, -z * .05);
        c.lineTo(z * .3, -z * .35);
        c.stroke();
      } else if (type === "cloud") {
        c.fillStyle = "rgba(105,122,137,.86)";
        c.shadowColor = "rgba(190,204,210,.16)";
        c.shadowBlur = 10;
        c.beginPath();
        c.arc(-z * .42, z * .08, z * .34, 0, 7);
        c.arc(0, -z * .1, z * .44, 0, 7);
        c.arc(z * .42, z * .12, z * .31, 0, 7);
        c.fill();
        c.shadowBlur = 0;
        c.fillStyle = "rgba(186,198,202,.13)";
        c.fillRect(-z * .58, z * .27, z * 1.18, z * .18);
        if (Math.sin(now / 1200) > .88) {
          c.strokeStyle = "rgba(183,205,212,.25)";
          c.beginPath();
          c.moveTo(0, z * .28);
          c.lineTo(-z * .08, z * .56);
          c.lineTo(z * .1, z * .55);
          c.stroke();
        }
      } else if (type === "moon") {
        c.fillStyle = "#b4c0c1";
        c.beginPath();
        c.arc(0, 0, z * .72, 0, 7);
        c.fill();
        c.globalCompositeOperation = "destination-out";
        c.beginPath();
        c.arc(z * .32, -z * .16, z * .69, 0, 7);
        c.fill();
        c.globalCompositeOperation = "source-over";
        c.strokeStyle = "rgba(65,82,96,.55)";
        c.lineWidth = 1;
        c.beginPath();
        c.arc(-z * .28, z * .12, z * .11, 0, 7);
        c.arc(-z * .02, z * .43, z * .08, 0, 7);
        c.stroke();
      } else {
        for (let i = 0; i < 4; i++) {
          c.fillStyle = `rgba(176,193,198,${.19 + i * .09})`;
          c.beginPath();
          c.ellipse((i - 1.5) * z * .28, Math.sin(now / 900 + i) * z * .12, z * .5, z * .2, 0, 0, 7);
          c.fill();
        }
      }
    }

    drawSpecial(special, z, now) {
      const c = this.ctx;
      c.save();
      c.rotate(now / 900);
      c.strokeStyle = special.bonus === "color" ? "rgba(242,210,137,.9)" : "rgba(190,224,231,.86)";
      c.lineWidth = Math.max(1.5, z * .08);
      c.shadowColor = c.strokeStyle;
      c.shadowBlur = 8;
      c.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4, radius = i % 2 ? z * .78 : z * 1.02;
        const x = Math.cos(a) * radius, y = Math.sin(a) * radius;
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.closePath();
      c.stroke();
      c.restore();
    }

    drawFx(now) {
      this.fctx.clearRect(0, 0, this.size, this.size);
      this.clearing = this.clearing.filter(p => now - p.t < MARK_LIFE_MS);
      this.clearing.forEach(p => {
        const q = this.point(p), t = (now - p.t) / MARK_LIFE_MS;
        this.fctx.strokeStyle = "rgba(192,215,224," + (1 - t) * .22 + ")";
        this.fctx.lineWidth = 1;
        this.fctx.beginPath();
        this.fctx.arc(q.x, q.y, this.cell() * (.16 + t * .34), 0, 7);
        this.fctx.stroke();
      });
    }
  }

  // ---------------- 角色姿态 ----------------

  const POSES = {
    A: { x: 0, y: 0, scale: 0, turn: 0, lean: 0, headX: 0, headDrop: 0, armL: 1.75, armR: 1.38, legL: 1.82, legR: 1.32, sit: 0, window: 0 },
    B: { x: 0, y: 0, scale: 0, turn: 0, lean: 1.1, headX: 2, headDrop: 9, armL: 1.7, armR: 1.44, legL: 1.82, legR: 1.32, sit: 0, window: 0 },
    C: { x: 0, y: 2, scale: 0, turn: 0, lean: 2.4, headX: 4, headDrop: 19, armL: 1.13, armR: 2.02, legL: 1.82, legR: 1.32, sit: 0, window: 0 },
    D: { x: -1, y: 6, scale: -.1, turn: 0, lean: 3, headX: 1, headDrop: 35, armL: 1.28, armR: 1.86, legL: 2.35, legR: .78, sit: 1, window: 0 },
    E: { x: -5, y: 10, scale: -.2, turn: 82, lean: 4, headX: 7, headDrop: 43, armL: 1.5, armR: 1.8, legL: 2.4, legR: .72, sit: 1.4, window: 0 },
    F: { x: 2, y: 0, scale: 0, turn: 180, lean: 1.5, headX: 2, headDrop: 12, armL: 1.7, armR: 1.4, legL: 1.82, legR: 1.32, sit: 0, window: 0 },
    G: { x: 12, y: 0, scale: 0, turn: 8, lean: -.7, headX: 7, headDrop: -4, armL: .1, armR: 1.4, legL: 1.82, legR: 1.32, sit: 0, window: 1 },
    H: { x: 11, y: 7, scale: -.06, turn: 5, lean: 1, headX: 9, headDrop: 5, armL: .25, armR: 1.48, legL: 2.35, legR: 1.02, sit: .78, window: 1 },
    I: { x: 5, y: -1, scale: .02, turn: 2, lean: -.35, headX: 10, headDrop: -7, armL: .72, armR: 1.2, legL: 1.82, legR: 1.32, sit: 0, window: 0 }
  };

  class CharacterRenderer {
    constructor() {
      this.canvas = document.querySelector("#character");
      this.ctx = this.canvas.getContext("2d");
      this.from = POSES.A;
      this.to = POSES.A;
      this.start = performance.now();
      this.duration = 2600;
      addEventListener("resize", () => this.resize());
      this.resize();
      requestAnimationFrame(t => this.frame(t));
    }

    resize() {
      const r = this.canvas.getBoundingClientRect(), d = devicePixelRatio;
      this.canvas.width = r.width * d;
      this.canvas.height = r.height * d;
      this.ctx.setTransform(d, 0, 0, d, 0, 0);
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
      const w = this.canvas.width / devicePixelRatio;
      const h = this.canvas.height / devicePixelRatio;
      const p = this.poseNow(now);
      const breath = Math.sin(now / 560) * 2;
      const tremor = Math.sin(now / 93) * .55;
      c.clearRect(0, 0, w, h);
      const bx = w * (.31 + p.x * .09);
      const by = h * (.81 + p.y * .07);
      const sc = Math.min(w, h) / 205 * (1 + p.scale * .08);
      c.save();
      c.translate(bx, by);
      c.scale(sc, sc);
      c.rotate(p.turn * .01745);
      c.fillStyle = "rgba(3,10,17,.88)";
      c.beginPath();
      c.ellipse(4, 8, 53 + p.sit * 25, 8, 0, 0, 7);
      c.fill();
      const hip = { x: 0, y: -20 - p.sit * 41 };
      const sh = { x: p.lean * 8, y: -103 + p.sit * 22 + breath };
      const head = { x: sh.x + p.headX, y: sh.y - 27 + p.headDrop };
      const arm = (side, a) => ({ x: sh.x + side * Math.cos(a) * 32, y: sh.y + Math.sin(a) * 34 });
      const knee = (side, a) => ({ x: hip.x + side * Math.cos(a) * 31, y: hip.y + Math.sin(a) * 35 });
      const foot = (j, s) => ({ x: j.x + s * 10, y: j.y + 39 + p.sit * 15 });
      const la = arm(-1, p.armL), ra = arm(1, p.armR);
      const lk = knee(-1, p.legL), rk = knee(1, p.legR);
      c.strokeStyle = "rgba(4,12,19,.95)";
      c.lineCap = "round";
      c.lineWidth = 16;
      c.beginPath();
      c.moveTo(hip.x, hip.y);
      c.quadraticCurveTo(sh.x + p.lean * 2, (hip.y + sh.y) / 2, sh.x, sh.y);
      c.stroke();
      c.lineWidth = 12;
      c.beginPath();
      c.moveTo(sh.x, sh.y);
      c.lineTo(la.x, la.y);
      c.lineTo(la.x - 6, la.y + 27);
      c.moveTo(sh.x, sh.y);
      c.lineTo(ra.x, ra.y);
      c.lineTo(ra.x + 6, ra.y + 27);
      c.moveTo(hip.x, hip.y);
      c.lineTo(lk.x, lk.y);
      const lf = foot(lk, -1);
      c.lineTo(lf.x, lf.y);
      c.moveTo(hip.x, hip.y);
      c.lineTo(rk.x, rk.y);
      const rf = foot(rk, 1);
      c.lineTo(rf.x, rf.y);
      c.stroke();
      c.fillStyle = "#07111b";
      c.beginPath();
      c.arc(head.x + tremor, head.y, 17, 0, 7);
      c.fill();
      c.strokeStyle = "rgba(167,197,207,.18)";
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(head.x - 12, head.y - 10);
      c.quadraticCurveTo(head.x - 25, head.y - 4, head.x - 20, head.y + 9);
      c.stroke();
      if (p.window) {
        c.strokeStyle = "rgba(171,205,215,.23)";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(w / sc * .64, -160);
        c.lineTo(w / sc * .64, 10);
        c.moveTo(w / sc * .36, -160);
        c.lineTo(w / sc * .36, 10);
        c.stroke();
      }
      c.restore();
      requestAnimationFrame(t => this.frame(t));
    }
  }
