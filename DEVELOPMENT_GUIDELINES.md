# 开发规范 · 雨停以前（xiaoxiaole）

> 本文件是项目的开发规范与设计备忘，随项目一起纳入版本控制，任何玩法扩展、功能迭代、Bug 修复都必须先阅读本章，遵循其中的架构约定与注意事项。

---

## 1. 项目定位与硬性约束

### 1.1 项目定位

「雨停以前」是一个以情绪、回忆与雨为主轴的治愈系消除游戏。玩法上以「收集/得分/生存」三类目标驱动，叙事上以「情绪值 → 阶段 → 雨声/粒子/台词」联动营造氛围。

### 1.2 硬性约束（不可破坏）

| 约束 | 说明 |
|---|---|
| **纯静态网页** | 只允许 HTML + CSS + 原生 JavaScript。零后端、零构建工具、零外部运行时依赖。禁止引入任何 npm 包、CDN 库或需要编译的框架。 |
| **离线可用** | 所有资源（含 `assets/`、`music/`）本地存放，双击 `index.html` 即可运行。 |
| **无新素材依赖** | 新增视觉效果优先用 Canvas 绘制或现有 SVG 图标，不强制新增图片/音频文件。 |
| **Web Audio 合成音效** | 音效一律用 `AudioManager.tone()` 合成，不新增外部音频文件（音乐除外，走 `music/` 目录）。 |

### 1.3 适用场景

- 新成员接手开发时，先读本文档第 2～7 节了解架构。
- 设计新玩法时，参照第 8 节提案与第 9 节注意事项。
- 提交任何改动前，对照第 9.4 节回归清单自查。

---

## 2. 架构总览（模块职责）

项目为多文件原生 JS 结构（每个文件顶部 `"use strict"`，全局作用域共享，通过 `<script>` 按序加载，无 import/export）。

| 文件 | 职责 | 对外关键符号 |
|---|---|---|
| `index.html` | 页面骨架、屏幕切换、主界面布局 | `#homeScreen / #mapScreen / #introScreen / #resultScreen / #memoryScreen`；游戏区 `#board`、`#boardFx`、`#character` |
| `styles.css` | 全部样式；CSS 变量集中定义；`@media (max-width: 600px)` 移动端适配 | `--line / --accent / --ink / --r-sm / --dur-med` 等变量 |
| `data.js` | 常量与静态数据：棋子类型、动画时长、关卡表、台词池、工具函数 | `TYPES`、`NAMES`、`SAVE_KEY`、`LEVELS`、`TEXT`、`wait()`、`choice()`、`clamp()` |
| `board.js` | 棋盘逻辑（纯数据，不含渲染） | `Board`：`grid`、`falls`、`dropPlan`；`reset/wouldMatch/swap/matches/clear/drop` |
| `renderers.js` | 背景粒子 `ParticleSystem`、棋盘渲染 `BoardRenderer`、角色渲染 `CharacterRenderer` | 构造入参 `(board, particles, pieceImages)` |
| `game.js` | 游戏主控制器，编排全部系统 | `Game`：`board/particles/renderer/character/audio/ui/music/text/story/emotion` |
| `ui.js` | 情绪、文本、剧情、界面管理 | `EmotionSystem`、`TextManager`、`StoryManager`、`UIManager` |
| `audio.js` | 音效合成与环境声 | `AudioManager`：`tone(f,d,type,v)`、`select/fail/swap/clear/complete/setStage` |
| `music.js` | 背景音乐管理 | `MusicManager` |
| `assets.js` | 资源加载（棋子图片等） | — |
| `assets/`、`music/` | SVG 图标/棋子素材、音乐文件 | — |

### 2.1 核心依赖方向

`game.js`（控制器）→ 依赖其他所有模块；`board.js`（纯逻辑）不依赖渲染与 UI。**新增玩法时，规则逻辑放 `board.js`，表现放 `renderers.js`/`ui.js`，编排放 `game.js`，数据放 `data.js`**，禁止跨层直接写死。

### 2.2 主循环与游戏状态

棋盘动画走 `requestAnimationFrame`（`renderers.js`）；回合推进用异步等待链（`wait()` + `SWAP_WAIT_MS / CLEAR_WAIT_MS / DROP_WAIT_MS`）。`Game` 上有一组回合状态：`busy / selected / won / started / moves / score / clears / combo / collected`。

---

## 3. 数据与常量约定

### 3.1 棋子类型

```js
const TYPES = ["rain", "leaf", "cloud", "moon", "mist"];
const NAMES = { rain: "雨滴", leaf: "枯叶", cloud: "乌云", moon: "残月", mist: "灰雾" };
```

- 新增棋子类型：必须同时更新 `TYPES` 与 `NAMES`，并提供对应绘制分支（`BoardRenderer`）或 `assets/pieces/*.svg`。
- 所有棋子字段一律用类型字符串，禁止用数字/枚举混用。

### 3.2 动画时长

`data.js` 统一集中定义（`SWAP_MS=180 / DISSOLVE_MS=520 / MARK_LIFE_MS=560 / DROP_MS=430 / *WAIT_MS` 派生值）。**新增动画必须在此处声明时长，不得在 `game.js`/`renderers.js` 里写魔法数字。**

### 3.3 关卡表结构

```js
{ name, title, type: "rain"|"leaf"|"score"|"moon"|"survive", target, moves, pose, start, end, memory }
```

- `type` 决定目标判定：`收集指定类型` / `score 达到分数` / `survive 生存 N 步`。
- 新增目标类型时，在 `data.js` 的 `LEVELS` 增加字段，并在 `game.js` 结算处增加对应判定分支。

### 3.4 台词池

`TEXT` 下按情绪主题分组（`rain / loss / alone / memory / night / leaf / mist / environment`）。新增台词只往已有分组追加，保持句式简短、第一人称、克制。

---

## 4. 棋盘逻辑约定（board.js）

当前 `Board` 提供以下方法，**任何玩法扩展都必须保持这些方法语义稳定**：

| 方法 | 语义 |
|---|---|
| `reset()` | 生成无预匹配的初始局面 |
| `wouldMatch(r,c,t)` | 预判放置是否成三连 |
| `swap(a,b)` | 交换两格（用于玩家操作与试探） |
| `matches()` | 扫描并返回全部三连及以上 |
| `clear(list)` | 将格子置空 |
| `drop()` | 重力下落 + 顶部补新，返回下落计划 |

示例：探测某次交换是否有效（防死局/合法步判断的标准写法）：

```js
this.swap(a, b);
const ok = this.matches().length > 0;
this.swap(a, b);   // 立刻换回，保证探测无副作用
```

---

## 5. 情绪系统与叙事约定（ui.js / game.js）

### 5.1 情绪值 → 阶段映射

```js
getStage(v) { return v >= 80 ? 0 : v >= 60 ? 1 : v >= 40 ? 2 : v >= 20 ? 3 : 4; }
```

- `value` 范围 `0~100`，初始 `100`；越界一律经 `clamp()` 收口。
- 阶段变化统一走 `Game.applyStage(stage)`（唯一入口），它同时切换粒子密度、环境音与页面滤镜 class（`stage-sad / stage-melancholy / stage-abyss`）。**禁止在别处单独改滤镜或音效。**

### 5.2 叙事联动

- `TextManager.monologue()` 打字机输出角色台词；`randomMonologue()` 从各主题池随机抽取。
- 新增互动（如点击角色安抚）产生的情绪变更必须调用 `EmotionSystem.change(n)`，由其统一触发存档与阶段回调。

---

## 6. 视觉与音效约定

### 6.1 视觉

- 背景/特效 Canvas：`#backdrop`（粒子）、`#effects`（消除涟漪等）、`#boardFx`（棋盘特效）；均按 `devicePixelRatio` 缩放（见 `ParticleSystem.resize()`）。
- 新状态样式（激活、禁用、选中）优先沿用现有 CSS 变量，不新增色值常量。

### 6.2 音效

`AudioManager` 音效方法一览：

```js
select() { this.tone(285, .08, "sine", .012); }          // 选中
fail()   { this.tone(72,  .11, "sine", .012); }          // 无效交换
swap()   { this.tone(94,  .18, "triangle", .028); }      // 交换
clear(n, combo) { /* 消除，combo>1 叠加低音 */ }
complete() { this.tone(392, .9, "sine", .025); }         // 过关
```

新增音效用 `tone(f, d, type, v)` 合成即可，参考现有风格（短促、衰减、音量保守 ≤ .05）。

---

## 7. 存档兼容性约定

- 存档键：`SAVE_KEY = "yutingyiqian-save-v1"`，格式 `{ unlocked, memories, emotion }`。
- 读取时对每个字段做**类型校验 + 边界钳制**（见 `Game.loadProgress()`），旧存档缺字段不报错。
- **任何新增可持久化字段必须带默认值**，且不得改变既有字段名；结构变更需升版本号（`v1 → v2`）并保留旧键迁移。
- 新玩法若无需跨章持久化（如每章重置的道具数量），**不要写入存档**，避免存档膨胀与兼容风险。

---

## 8. 玩法多元化建议（设计提案）

> 以下均为已评审过的可行方案，按「纯静态前提」设计，未落地。实施时按第 10 节优先级逐项推进。

### 8.1 特殊棋（四连 / 五连奖励）—— 优先实施

| 连法 | 生成物 | 效果 |
|---|---|---|
| 四连 | **银星**（行向→清整行；列向→清整列） | 被消除时横扫所在行/列 |
| 五连 | **金星**（彩虹棋） | 与任意棋子交换即触发，清除全屏同色；被普通消除时同样生效 |

**适用场景**：解决「连四连五和连三没区别」的单调感，是单次投入产出比最高的改造。

**实现要点（示意）**：
- `Board` 增加 `specials` 映射（`"r,c" → {bonus, type}`），并在 `swap / drop / clear` 三个流程中同步移动标记，避免「棋子动了标记没动」的错位。
- `matches()` 顺带记录连续段（`len ≥ 4`），在消除落定前于段尾落子位置升级为特殊棋（`placeSpecials`）。
- 消除顺序：先收集本次 `matches()` 结果 → 对其中特殊棋展开波及（行/列/同色）→ 级联 → 统一 `clear`。展开过程必须去重（`visited`），防止链式死循环。
- 表现：棋子叠光环 + 星形标记，Canvas 绘制，无需新素材；音效复用 `tone()` 编一段上扬音阶。
- 叙事钩子：银星台词「雨被吹开了一道缝」，金星台词「那一瞬，整个天空都亮了」。

**示例（展开去重骨架）**：

```js
const out = [...matches], seen = new Set(matches.map(p => p.r + "," + p.c));
const push = (r, c) => {
  const k = r + "," + c;
  if (seen.has(k) || !this.grid[r]?.[c]) return;
  seen.add(k);
  out.push({ r, c, type: this.grid[r][c] });
};
// 遍历 out：遇到特殊棋则 push 整行 / 整列 / 同色
```

### 8.2 道具系统（每章固定配给，不消耗步数）

侧栏新增「雨具」面板，三个道具各每章 1 个，与现有 `.side` 面板视觉风格统一：

| 道具 | 交互 | 说明 |
|---|---|---|
| 铁锤 | 点击后进入选子模式，点击棋子直接敲掉 | 计入收集物、不计步数 |
| 换位 | 先点 A 再点 B，任意两格强制交换 | 无需相邻 |
| 洗牌 | 一键重排全棋盘 | 保证重排后至少存在一步可走 |

**实现要点**：
- 在玩家输入前插「道具模式」状态机（`itemMode` + 两步选择缓存），用完自动退出，不污染常规交换流程。
- 洗牌用 Fisher–Yates 重排 + `hasMove()` 保底循环（`hasMove` 用 4.1 节探测写法实现）。
- 每章 1 个是平衡底线，防止道具架空步数机制；道具对收集物生效需在 UI 上提示规则。
- 数量不写入存档，随关卡初始化重置。

### 8.3 角色安抚互动（点击窗边的人）

- 点击侧栏角色卡片 → 人物回头望向玩家，情绪值 +2，随机播放一条安抚台词。
- 设约 20 秒冷却，防止无限刷情绪。
- 实现成本最低：角色 Canvas 挂 `pointerdown`，并给 `.character-copy` 加 `pointer-events: none` 防止文字层拦截点击。
- 情绪变更必须走 `EmotionSystem.change(+2)`，冷却状态仅存内存。

**适用场景**：用最低成本把「互动」与「情绪/胜利条件」打通，情绪价值高。

### 8.4 目标类型扩展

在现有 `collect / score / survive` 之外增加：

| 目标 | 判定 |
|---|---|
| `combo` | 单次连锁 ≥ 5 |
| `line` | 清除指定行/列 |
| `timed` | 限时步数内消除 N 颗指定色 |

- 关卡表增加 `goal` 字段（或复用 `type + target`），结算判定在 `game.js` 抽成通用函数，避免每个目标各写一套。
- 新目标必须与 UI 的 `goalLabel / goalBar / goalCount` 联动（`ui.js` 需支持渲染新目标描述）。

### 8.5 天气 / 阶段联动

- 现有 4 阶段（雨声 + 粒子 + 滤镜）只影响氛围，可将「阴雨阶段棋盘刷新节奏略降、`rain` 棋子出现概率升高」纳入棋盘生成，让天气成为玩法变量。
- 改动点集中在 `Board.reset/drop` 的补棋函数（可读 `Game.applyStage` 传入的阶段值），不动叙事框架。

---

## 9. 最佳实践与注意事项

### 9.1 玩法开发流程

1. 先在 `board.js` 写纯规则（可单测的函数），确认无副作用；
2. 再在 `renderers.js`/`ui.js` 加表现；
3. 最后在 `game.js` 接编排与结算；
4. 全部完成后再考虑存档字段（能不加就不加）。

### 9.2 性能红线

- 特殊棋级联展开必须用 `visited` 去重，同一次消除一个格子最多入列一次。
- 洗牌保底循环设上限（如 50 次），防极端死循环卡死页面。
- 粒子/涟漪等叠加特效注意数量上限，避免移动端掉帧。

### 9.3 兼容性红线

- 不改既有字段名、不改 `SAVE_KEY`（结构变更才升版本号）。
- 新字段一律带默认值，读取时 `clamp`/校验。
- 不引入新依赖，不新增 script 加载顺序之外的全局变量依赖。

### 9.4 回归自查清单（提交前逐项勾选）

- [ ] 步数正常消耗；无效交换正常回滚，不扣步数
- [ ] 连锁判定正确，连击数字正确累计
- [ ] 三类目标（收集/得分/生存）结算正确
- [ ] 过关/失败跳转与存档读写正常，旧存档可读
- [ ] 音乐开关、章节地图、回忆日志正常
- [ ] 无死局：棋盘始终存在至少一步可走（新机制加入后复测）
- [ ] 移动端（≤600px）布局不破版

---

## 10. 实施优先级

| 优先级 | 项目 | 理由 |
|---|---|---|
| P0 | 特殊棋（银星/金星） | 玩法质感提升最明显，改动集中 |
| P1 | 道具系统 + 防死局 | 提供选择权，顺带修复潜在死局 |
| P2 | 角色安抚互动 | 成本最低的叙事互动 |
| P3 | 目标类型扩展 + 天气联动 | 需配合后续关卡设计 |

> 每个 P 级完成后跑一遍 9.4 回归清单再进入下一项。
