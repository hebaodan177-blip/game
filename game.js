"use strict";

// ---------------- 游戏主控制器 ----------------

class Game {
  constructor(pieceImages = null) {
    this.board = new Board();
    this.particles = new ParticleSystem();
    this.renderer = new BoardRenderer(this.board, this.particles, pieceImages);
    this.character = new CharacterRenderer();
    this.audio = new AudioManager();
    this.ui = new UIManager();
    this.music = new MusicManager();
    this.text = new TextManager();
    this.story = new StoryManager(() => this.save());
    this.emotion = new EmotionSystem((n, o) => this.stageChange(n, o), () => this.save());
    this.level = 0;
    this.moves = 0;
    this.score = 0;
    this.displayScore = 0;
    this.clears = 0;
    this.collected = 0;
    this.combo = 0;
    this.warmth = 0;
    this.warmthMax = 30;
    this.itemCounts = { hammer: 1, swap: 1, shuffle: 1 };
    this.itemMode = null;
    this.itemSelection = null;
    this.lastComfort = 0;
    this.healingStats = { rain: 0, leaf: 0, cloud: 0, moon: 0, mist: 0 };
    this.busy = false;
    this.started = false;
    this.won = false;
    this.selected = null;
    this.lastAction = Date.now();
    this.lastEnv = Date.now();
    this.loadProgress();
    this.bind();
    this.map();
    this.ui.show("#homeScreen");
    this.update();
  }

  loadProgress() {
    const s = loadSave();
    if (s) {
      if (Number.isInteger(s.unlocked)) this.story.unlocked = clamp(s.unlocked, 1, 5);
      if (Array.isArray(s.memories)) {
        this.story.memories = s.memories.filter(m =>
          m && Number.isInteger(m.i) && m.i >= 0 && m.i < LEVELS.length && typeof m.text === "string"
        );
      }
      if (typeof s.emotion === "number") {
        this.emotion.value = clamp(s.emotion, 0, 100);
        this.emotion.stage = this.emotion.getStage();
      }
    }
    this.applyStage(this.emotion.stage);
  }

  // Keep visual particles, audio, and the page filter in one stage update path.
  applyStage(stage) {
    this.particles.setStage(stage);
    this.audio.setStage(stage);
    document.body.classList.remove("stage-sad", "stage-melancholy", "stage-abyss");
    if (stage >= 4) document.body.classList.add("stage-abyss");
    else if (stage >= 2) document.body.classList.add("stage-melancholy");
    else if (stage === 1) document.body.classList.add("stage-sad");
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        unlocked: this.story.unlocked,
        memories: this.story.memories,
        emotion: this.emotion.value
      }));
    } catch (e) { /* 忽略隐私模式等写入失败 */ }
  }

  bind() {
    this.ui.$("#homeStart").onclick = () => this.map();
    this.ui.$("#mapButton").onclick = () => this.map();
    this.ui.$("#closeMap").onclick = () => this.started ? this.ui.allHide() : this.ui.show("#homeScreen");
    this.ui.$("#resetSave").onclick = () => this.resetProgress();
    this.ui.$("#introStart").onclick = () => this.start();
    this.ui.$("#resultNext").onclick = () => this.afterResult();
    this.ui.$("#memoryButton").onclick = () => this.memories();
    this.ui.$("#closeMemory").onclick = () => this.ui.hide("#memoryScreen");
    this.ui.$("#musicButton").onclick = () => {
      this.ui.show("#musicScreen");
      if (this.music.currentTrack) this.music.play();
    };
    this.ui.$("#closeMusic").onclick = () => this.ui.hide("#musicScreen");
    ["hammer", "swap", "shuffle"].forEach(item => {
      const button = this.optional(`#item${item[0].toUpperCase()}${item.slice(1)}`);
      if (button) button.onclick = () => this.selectItem(item);
    });
    this.character.canvas.addEventListener("pointerdown", () => this.comfortCharacter());
    this.character.canvas.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.comfortCharacter();
      }
    });
    const c = this.renderer.canvas;
    c.addEventListener("pointerdown", e => {
      if (this.busy) return;
      c.setPointerCapture(e.pointerId);
      this.down = this.renderer.hit(e);
    });
    c.addEventListener("pointerup", e => {
      const p = this.renderer.hit(e);
      if (this.down) this.input(this.down, p);
      this.down = null;
    });
    setInterval(() => this.tick(), 1000);
  }

  optional(selector) {
    try { return this.ui.$(selector); } catch { return null; }
  }

  screenBlocked() {
    return this.ui.screens.some(selector => {
      const screen = this.optional(selector);
      return screen && !screen.classList.contains("hidden");
    });
  }

  updateItemUi() {
    Object.keys(this.itemCounts).forEach(item => {
      const button = this.optional(`#item${item[0].toUpperCase()}${item.slice(1)}`);
      const count = this.optional(`#item${item[0].toUpperCase()}${item.slice(1)}Count`);
      if (button) {
        button.disabled = !this.started || !this.itemCounts[item];
        button.classList.toggle("is-active", this.itemMode === item);
      }
      if (count) count.textContent = this.itemCounts[item];
    });
    const hint = this.optional("#itemHint");
    if (hint) hint.textContent = this.itemMode ? ITEM_DEFINITIONS[this.itemMode].hint : "每章各有一次，不消耗步数";
  }

  selectItem(item) {
    if (!this.started || this.screenBlocked()) return this.ui.toast("先走进一章雨里");
    if (!this.itemCounts[item]) return this.ui.toast("这一件雨具已经用过了");
    if (item === "shuffle") return this.useShuffle();
    this.itemMode = this.itemMode === item ? null : item;
    this.itemSelection = null;
    this.renderer.selected = null;
    this.updateItemUi();
    this.ui.$("#hint").textContent = this.itemMode ? ITEM_DEFINITIONS[item].hint : "棋盘重新安静下来";
  }

  async useHammer(p) {
    this.itemCounts.hammer--;
    this.itemMode = null;
    this.renderer.selected = null;
    this.busy = true;
    this.audio.unlock();
    this.audio.special();
    this.lastAction = Date.now();
    await this.resolve([{ r: p.r, c: p.c, type: this.board.grid[p.r][p.c] }]);
    this.busy = false;
    this.triggerWarmth();
    this.updateItemUi();
    this.update();
    this.check();
  }

  useShuffle() {
    this.itemCounts.shuffle--;
    this.itemMode = null;
    this.itemSelection = null;
    this.renderer.selected = null;
    if (this.board.shuffle()) {
      this.audio.unlock();
      this.audio.special();
      this.lastAction = Date.now();
      this.ui.$("#hint").textContent = "棋子换了位置，新的路出现了";
    }
    this.updateItemUi();
    this.update();
  }

  async handleItemInput(p) {
    if (!this.board.grid[p.r]?.[p.c]) return;
    if (this.itemMode === "hammer") return this.useHammer(p);
    if (this.itemMode !== "swap") return;
    if (!this.itemSelection) {
      this.itemSelection = p;
      this.renderer.selected = p;
      this.ui.$("#hint").textContent = "再选择一个棋子完成换位";
      return this.update();
    }
    if (this.itemSelection.r === p.r && this.itemSelection.c === p.c) return;
    const first = this.itemSelection;
    this.itemSelection = null;
    this.itemCounts.swap--;
    this.renderer.selected = null;
    await this.swap(first, p, { consumeMove: false, force: true });
    this.itemMode = null;
    this.updateItemUi();
  }

  comfortCharacter() {
    if (this.screenBlocked() || this.busy || !this.started) return;
    const now = Date.now();
    if (now - this.lastComfort < 20000) return this.ui.toast("不用急，它会一直在这里");
    this.lastComfort = now;
    this.audio.unlock();
    this.audio.comfort();
    this.character.play("comfort");
    this.text.monologue(choice(COMFORT_LINES));
    this.emotion.change(2);
    this.ui.toast("你们安静地坐了一会儿");
    this.lastAction = now;
    this.update();
  }

  resetProgress() {
    if (!confirm("确定要清空所有回忆与进度吗？")) return;
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    this.story = new StoryManager(() => this.save());
    this.emotion.value = 100;
    this.emotion.stage = 0;
    this.applyStage(0);
    this.renderMap();
    this.update();
  }

  map() {
    this.renderMap();
    this.ui.show("#mapScreen");
  }

  renderMap() {
    const root = this.ui.$("#levelList");
    root.replaceChildren();
    LEVELS.forEach((l, i) => {
      const b = document.createElement("button");
      b.className = "level-btn";
      b.disabled = i >= this.story.unlocked;
      b.innerHTML = `<canvas class="level-icon" data-type="${l.type === "score" ? "cloud" : l.type === "survive" ? "mist" : l.type}"></canvas><span>${l.name.replace("第", "")}</span><small>${i < this.story.unlocked ? "已解锁" : "尚未抵达"}</small>`;
      b.onclick = () => this.intro(i);
      root.appendChild(b);
    });
    root.querySelectorAll("canvas").forEach(c => this.icon(c, c.dataset.type));
  }

  icon(canvas, type) {
    const d = devicePixelRatio;
    canvas.width = 35 * d;
    canvas.height = 35 * d;
    const c = canvas.getContext("2d");
    c.setTransform(d, 0, 0, d, 0, 0);
    c.translate(17, 17);
    c.scale(.65, .65);
    this.renderer.drawPiece.call({ ctx: c, images: this.renderer.images }, type, 17, 0);
  }

  intro(i) {
    this.level = i;
    const l = LEVELS[i];
    this.ui.$("#introKicker").textContent = l.name;
    this.ui.$("#introTitle").textContent = l.title;
    this.ui.$("#introText").textContent = l.start;
    this.ui.show("#introScreen");
    this.character.setPose(l.pose, 3500);
    if (i === 3) this.character.play("window");
    if (i === 4) this.character.setPose("G", 4200);
  }

  start() {
    this.started = true;
    this.audio.start();
    this.applyStage(this.emotion.stage);
      this.ui.allHide();
      this.board.reset();
      this.renderer.setDrop([]);
    const l = LEVELS[this.level];
    this.moves = l.moves;
    this.score = 0;
    this.clears = 0;
    this.collected = 0;
    this.combo = 0;
    this.warmth = 0;
    this.itemCounts = { hammer: 1, swap: 1, shuffle: 1 };
    this.itemMode = null;
    this.itemSelection = null;
    this.healingStats = { rain: 0, leaf: 0, cloud: 0, moon: 0, mist: 0 };
    this.updateItemUi();
    this.selected = null;
    this.renderer.selected = null;
    this.busy = false;
    this.lastAction = Date.now();
    this.text.monologue(l.start);
    this.update();
  }

  input(a, b) {
    if (this.screenBlocked() || this.busy) return;
    this.audio.unlock();
    if (this.itemMode) return this.handleItemInput(a);
    if (a.r === b.r && a.c === b.c) {
      if (this.selected && this.adjacent(this.selected, a)) {
        const x = this.selected;
        this.selected = null;
        this.renderer.selected = null;
        this.swap(x, a);
      } else {
        this.selected = a;
        this.renderer.selected = a;
        this.audio.select();
      }
      this.update();
      return;
    }
    if (this.adjacent(a, b)) this.swap(a, b);
  }

  adjacent(a, b) { return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1; }

  async swap(a, b, options = {}) {
    const consumeMove = options.consumeMove !== false;
    const force = options.force === true;
    if ((consumeMove && this.moves <= 0) || this.busy) return;
    this.busy = true;
    const specialA = this.board.specialAt(a), specialB = this.board.specialAt(b);
    const colorTarget = specialA?.bonus === "color" ? this.board.grid[b.r][b.c] :
      specialB?.bonus === "color" ? this.board.grid[a.r][a.c] : null;
    this.board.swap(a, b);
    this.renderer.setSwap(a, b);
    await wait(SWAP_WAIT_MS);
    let m = this.board.matches();
    if (specialA) m.push({ r: b.r, c: b.c, type: this.board.grid[b.r][b.c], special: this.board.specialAt(b) });
    if (specialB) m.push({ r: a.r, c: a.c, type: this.board.grid[a.r][a.c], special: this.board.specialAt(a) });
    if (!m.length && !force) {
      this.board.swap(a, b);
      this.renderer.setSwap(a, b);
      await wait(SWAP_WAIT_MS);
      this.audio.fail();
      this.text.monologue("有些事情换一个位置，也不会有结果。");
      this.ui.$("#hint").textContent = "它们短暂靠近，又回到了原处";
      this.busy = false;
      return;
    }
    if (consumeMove) this.moves--;
    this.audio.swap();
    this.lastAction = Date.now();
    this.combo = 0;
    await this.resolve(m, { colorTarget, preferred: b });
    this.busy = false;
    this.triggerWarmth();
    this.update();
    this.check();
  }

  async resolve(matches, options = {}) {
    while (matches.length) {
      matches = this.board.expandSpecials(matches, options.colorTarget);
      const hasSpecial = matches.some(p => p.special);
      if (!hasSpecial) matches = this.board.promoteMatches(matches, options.preferred);
      this.combo++;
      this.renderer.mark(matches);
      await wait(CLEAR_WAIT_MS);
      const rain = matches.filter(p => p.type === "rain").length;
      this.collected += this.goalTypeCount(matches);
      this.clears += matches.length;
      const clearType = this.dominantType(matches);
      this.healingStats[clearType] = (this.healingStats[clearType] || 0) + matches.length;
      this.warmth = Math.min(this.warmthMax * 3, this.warmth + rain * 3 + matches.length - rain);
      const mult = this.emotion.stage === 4 ? .5 : this.emotion.stage === 2 ? .8 : 1;
      this.score += Math.round(matches.length * 185 * (1 + (this.combo - 1) * .3) * mult);
      const healingMult = [1, 1, 1, 1.28, 1.57][this.emotion.stage];
      this.emotion.change((rain * 2.8 + (this.combo > 1 ? 4 : 0)) * healingMult);
      this.audio.clear(matches.length, this.combo, clearType);
      if (hasSpecial) this.audio.special();
      if (Math.random() < .45) this.text.monologue(choice(CLEAR_LINES[clearType] || TEXT.rain));
      if (this.combo > 1) {
        this.ui.$("#boardPanel").classList.remove("pulse");
        void this.ui.$("#boardPanel").offsetWidth;
        this.ui.$("#boardPanel").classList.add("pulse");
      }
      this.board.clear(matches);
      this.renderer.clearMarks();
      this.renderer.setDrop(this.board.drop());
      this.update();
      await wait(DROP_WAIT_MS);
      matches = this.board.matches();
    }
    this.ui.$("#hint").textContent = this.combo > 1 ? `连锁 ${this.combo} 次，雨声慢慢远去` : "棋盘重新安静下来";
  }

  dominantType(matches) {
    const counts = {};
    matches.forEach(p => { counts[p.type] = (counts[p.type] || 0) + 1; });
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || "rain";
  }

  triggerWarmth() {
    while (this.warmth >= this.warmthMax) {
      this.warmth -= this.warmthMax;
      this.emotion.change(6);
      this.audio.comfort();
      this.character.play("comfort");
      this.text.monologue("暖意聚成了一点光，你不用独自撑着。");
      this.ui.toast("暖意聚成了一点光");
    }
    this.update();
  }

  goalTypeCount(matches) {
    const l = LEVELS[this.level];
    if (l.type === "score") return 0;
    if (l.type === "survive") return this.combo ? 1 : 0;
    return matches.filter(p => p.type === l.type).length;
  }

  check() {
    const l = LEVELS[this.level];
    const done = l.type === "score" ? this.score >= l.target :
      l.type === "survive" ? this.collected >= l.target && this.emotion.value >= 40 :
      this.collected >= l.target;
    if (done) this.result(true);
    else if (this.moves <= 0) this.result(false);
  }

  result(won) {
    const l = LEVELS[this.level];
    if (won) {
      this.story.complete(this.level);
      this.audio.complete();
      this.text.monologue(l.end);
      if (this.level === 2) this.character.play("turn");
      if (this.level === 4) this.character.play("sky");
      this.ui.$("#resultKicker").textContent = l.name + " 完成";
      this.ui.$("#resultTitle").textContent = "雨没有停";
      this.ui.$("#resultText").textContent = `${l.end} ${this.healingProfile()}`;
      this.ui.$("#resultNext").textContent = this.level < 4 ? "继续向前" : "回到章节";
    } else {
      this.ui.$("#resultKicker").textContent = l.name;
      this.ui.$("#resultTitle").textContent = "有些路需要再走一次";
      this.ui.$("#resultText").textContent = "步数已经用完，雨还没有停。没关系，先把呼吸放慢，下一次再从这里出发。";
      this.ui.$("#resultNext").textContent = "重走这一章";
    }
    this.won = won;
    this.ui.show("#resultScreen");
  }

  afterResult() {
    if (this.won && this.level < 4) this.intro(this.level + 1);
    else if (this.won) this.map();
    else this.intro(this.level);
  }

  stageChange(next, old) {
    const down = next > old;
    const lines = down ?
      ["", "有点累了。", "好像又想起了什么。", "别靠近我。", "就这样吧。"] :
      ["我还在。", "也许还没那么糟。", "雨小了一点。", "再试一次。", ""];
    this.text.monologue(lines[next] || "雨声又靠近了一点。");
    const poses = ["A", "B", "C", "D", "E"];
    if (down && next === 3) this.character.play("sit");
    else if (!down && old === 3) this.character.play("rise");
    else this.character.setPose(poses[next], down ? 2600 : 3800);
    this.applyStage(next);
    this.ui.toast(["平静", "低落", "忧郁", "深渊", "绝望"][next]);
  }

  tick() {
    if (!this.ui.$("#mapScreen").classList.contains("hidden") ||
        !this.ui.$("#introScreen").classList.contains("hidden") ||
        !this.ui.$("#resultScreen").classList.contains("hidden") ||
        !this.ui.$("#homeScreen").classList.contains("hidden") ||
        this.busy) return;
    const idle = (Date.now() - this.lastAction) / 1000;
    if (idle > 5) this.emotion.change(-[.25, .2, .15, .1, .05][this.emotion.stage]);
    if (idle > 15 && Date.now() - this.lastEnv > 15000) {
      this.text.environment();
      this.character.setPose("G", 2600);
      this.lastEnv = Date.now();
    }
    this.update();
  }

  // 分数滚动动画：从旧值缓动到新值
  tweenScore(target) {
    const el = this.ui.$("#score");
    const from = this.displayScore || 0;
    this.displayScore = target;
    if (target === from) {
      el.textContent = String(target).padStart(4, "0");
      return;
    }
    const start = performance.now(), dur = 380;
    const step = now => {
      const k = clamp((now - start) / dur, 0, 1);
      el.textContent = String(Math.round(from + (target - from) * ease(k))).padStart(4, "0");
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  update() {
    const l = LEVELS[this.level];
    const goalKind = l.type === "score" ? "目标得分" : `收集 ${NAMES[l.type]}`;
    const cur = l.type === "score" ? this.score : this.collected;
    this.ui.$("#goalLabel").textContent = goalKind;
    this.ui.$("#goalCount").textContent = `${cur} / ${l.target}`;
    this.ui.$("#goalBar").style.width = (clamp(cur / l.target, 0, 1) * 100) + "%";
    this.ui.$("#moves").textContent = this.moves;
    this.ui.$("#chapter").textContent = l.name;
    this.ui.$("#levelTitle").textContent = l.title;
    this.tweenScore(this.score);
    this.ui.$("#combo").textContent = this.combo > 1 ? this.combo + " ×" : "—";
    this.ui.$("#clears").textContent = this.clears;
    this.ui.$("#moodNum").textContent = Math.round(this.emotion.value) + "%";
    this.ui.$("#moodBar").style.width = this.emotion.value + "%";
    this.ui.$("#moodName").textContent = ["平静", "低落", "忧郁", "深渊", "绝望"][this.emotion.stage];
    this.ui.$("#moodText").textContent = ["雨很轻。还能听见自己的呼吸。", "光线在慢慢退去。", "雾压在窗上，风声开始有了重量。", "雨势变大，心跳藏在低处。", "所有声音都像从很远的地方传来。"][this.emotion.stage];
    this.ui.$("#memorySummary").textContent = this.story.memories.length ? `已拾起 ${this.story.memories.length} 段` : "尚未拾起";
    const warmthCount = this.optional("#warmthCount"), warmthBar = this.optional("#warmthBar");
    if (warmthCount) warmthCount.textContent = `${Math.round(this.warmth)} / ${this.warmthMax}`;
    if (warmthBar) warmthBar.style.width = (clamp(this.warmth / this.warmthMax, 0, 1) * 100) + "%";
    this.updateItemUi();
  }

  healingProfile() {
    const top = Object.keys(this.healingStats).sort((a, b) => this.healingStats[b] - this.healingStats[a])[0];
    return top && this.healingStats[top] ? `这一路，你让${NAMES[top]}陪你走了 ${this.healingStats[top]} 步。` : "这一路，你也一直在陪自己。";
  }

  memories() {
    const root = this.ui.$("#entries");
    root.replaceChildren();
    if (!this.story.memories.length) root.innerHTML = '<p class="empty">还没有什么可以记下。雨会留下痕迹。</p>';
    [...this.story.memories].reverse().forEach(m => {
      const e = document.createElement("article");
      e.className = "entry";
      e.innerHTML = `<h3>${LEVELS[m.i].name}</h3><p>${m.text}</p>`;
      root.appendChild(e);
    });
    this.ui.show("#memoryScreen");
  }
}

// ---------------- 启动 ----------------
// 先加载外部资源（字体 / 背景 / 棋子图片），全部失败也不影响运行。

(async () => {
  ResourceLoader.loadFonts();
  try {
    globalThis.game = new Game();
    // 图片资源在后台增强渲染，加载失败时保留 Canvas 绘制。
    ResourceLoader.loadBackdrop();
    ResourceLoader.loadPieces().then(images => {
      if (globalThis.game?.renderer) globalThis.game.renderer.images = images;
    });
  } catch (error) {
    console.error("游戏初始化失败", error);
    const status = document.querySelector("#musicStatus");
    if (status) status.textContent = "游戏初始化失败，请刷新页面重试";
    const toast = document.querySelector("#toast");
    if (toast) toast.textContent = "游戏初始化失败，请刷新页面重试";
  }
})();
