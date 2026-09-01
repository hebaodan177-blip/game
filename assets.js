"use strict";

// ---------------- 外部资源集中配置 ----------------
// 所有外部资源在此登记，修改即可切换 CDN / 本地路径。
// 加载失败时均会自动回退到内置资源，不影响游戏运行。

const Assets = {
  // 字体：cssUrl 指向 @font-face 样式表；加载失败回退到 font-family 中的系统字体
  fonts: [
    { family: "LXGW WenKai", cssUrl: "https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/style.css" }
  ],
  // 图标 sprite（外部 SVG 符号库，可用 CDN 地址替换）
  icons: "assets/icons.svg",
  // 背景图（null 或加载失败时使用程序化雨夜背景）
  background: "assets/backdrop.png",
  // 棋子图片：null 表示该类型使用程序化 Canvas 绘制
  pieces: {
    rain: "assets/pieces/rain.svg",
    leaf: "assets/pieces/leaf.svg",
    cloud: "assets/pieces/cloud.svg",
    moon: "assets/pieces/moon.svg",
    mist: "assets/pieces/mist.svg"
  }
};

// ---------------- 资源加载器 ----------------

const ResourceLoader = {
  // 加载单张图片：成功返回 Image，失败 / 配置为空返回 null
  loadImage(src) {
    return new Promise(resolve => {
      if (!src) return resolve(null);
      const img = new Image();
      const done = ok => {
        img.onload = img.onerror = null;
        resolve(ok ? img : null);
      };
      img.onload = () => done(true);
      img.onerror = () => done(false);
      img.src = src;
    });
  },

  // 注入外部字体样式表（失败自动走字体栈回退）
  loadFonts() {
    (Assets.fonts || []).forEach(f => {
      if (!f.cssUrl) return;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = f.cssUrl;
      link.onerror = () => { /* 回退字体栈，无需处理 */ };
      document.head.appendChild(link);
    });
  },

  // 背景图：仅加载成功后叠加到页面（失败则保留程序化背景）
  async loadBackdrop() {
    const img = await this.loadImage(Assets.background);
    if (!img) return;
    const div = document.createElement("div");
    div.id = "backdropImage";
    div.style.backgroundImage = `url("${Assets.background}")`;
    document.body.insertBefore(div, document.body.firstChild);
  },

  // 棋子图片：逐个加载，失败项为 null（绘制层回退程序化）
  async loadPieces() {
    const out = {};
    for (const key of Object.keys(Assets.pieces || {}))
      out[key] = await this.loadImage(Assets.pieces[key]);
    return out;
  }
};
