"use strict";

// ---------------- 情绪 / 文本 / 剧情 / UI ----------------

class EmotionSystem {
  constructor(onChange, onSave) {
    this.value = 100;
    this.stage = 0;
    this.onChange = onChange || (() => {});
    this.onSave = onSave || (() => {});
  }

  getStage(v = this.value) { return v >= 80 ? 0 : v >= 60 ? 1 : v >= 40 ? 2 : v >= 20 ? 3 : 4; }

  change(n) {
    const old = this.stage;
    this.value = clamp(this.value + n, 0, 100);
    this.stage = this.getStage();
    if (old !== this.stage) this.onChange(this.stage, old);
    this.onSave();
    return this.value;
  }
}

class TextManager {
  constructor() {
    this.char = document.querySelector("#characterText");
    this.env = document.querySelector("#environmentText");
    this.timer = null;
  }

  type(el, text) {
    clearInterval(this.timer);
    el.textContent = "";
    let i = 0;
    this.timer = setInterval(() => {
      el.textContent += text[i++] || "";
      if (i >= text.length) clearInterval(this.timer);
    }, 54);
  }

  monologue(text) { this.type(this.char, text); }
  environment() { this.env.textContent = choice(TEXT.environment); }

  randomMonologue() {
    return choice([...TEXT.rain, ...TEXT.loss, ...TEXT.alone, ...TEXT.memory, ...TEXT.night, ...TEXT.leaf, ...TEXT.mist]);
  }
}

class StoryManager {
  constructor(onSave) {
    this.unlocked = 1;
    this.memories = [];
    this.onSave = onSave || (() => {});
  }

  complete(i) {
    if (!this.memories.find(m => m.i === i)) this.memories.push({ i, text: LEVELS[i].memory });
    this.unlocked = Math.max(this.unlocked, Math.min(5, i + 2));
    this.onSave();
  }
}

class UIManager {
  constructor() {
    this.$ = s => document.querySelector(s);
    this.screens = ["#homeScreen", "#mapScreen", "#introScreen", "#resultScreen", "#memoryScreen", "#musicScreen"];
  }

  show(id) { this.screens.forEach(s => this.$(s).classList.toggle("hidden", s !== id)); }
  hide(id) { this.$(id).classList.add("hidden"); }
  allHide() { this.screens.forEach(s => this.$(s).classList.add("hidden")); }

  toast(t) {
    const e = this.$("#toast");
    e.textContent = t;
    e.classList.add("show");
    setTimeout(() => e.classList.remove("show"), 1900);
  }
}
