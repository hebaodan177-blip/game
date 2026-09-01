"use strict";

// ---------------- 音乐曲库与播放器 ----------------
// 受版权保护的预设曲目只保存官方搜索入口；项目音乐通过静态 manifest 加载。
const MUSIC_LIBRARY = [
  {
    title: "一路向北",
    artist: "周杰伦",
    mood: "雨夜公路",
    netease: "https://music.163.com/#/search/m/?s=%E4%B8%80%E8%B7%AF%E5%90%91%E5%8C%97&type=1",
    qq: "https://y.qq.com/n/ryqq/search?w=%E4%B8%80%E8%B7%AF%E5%90%91%E5%8C%97"
  },
  {
    title: "爱错",
    artist: "王力宏",
    mood: "旧日回声",
    netease: "https://music.163.com/#/search/m/?s=%E7%88%B1%E9%94%99&type=1",
    qq: "https://y.qq.com/n/ryqq/search?w=%E7%88%B1%E9%94%99"
  },
  {
    title: "后来",
    artist: "刘若英",
    mood: "迟来的话",
    netease: "https://music.163.com/#/search/m/?s=%E5%90%8E%E6%9D%A5&type=1",
    qq: "https://y.qq.com/n/ryqq/search?w=%E5%90%8E%E6%9D%A5"
  },
  {
    title: "我怀念的",
    artist: "孙燕姿",
    mood: "没有寄出的信",
    netease: "https://music.163.com/#/search/m/?s=%E6%88%91%E6%80%80%E5%BF%B5%E7%9A%84&type=1",
    qq: "https://y.qq.com/n/ryqq/search?w=%E6%88%91%E6%80%80%E5%BF%B5%E7%9A%84"
  }
];

const LOCAL_AUDIO_EXTENSIONS = new Set(["mp3", "wav", "flac", "ogg", "m4a", "aac", "opus", "webm"]);

// manifest 无法通过 file:// 读取时，仍使用这份静态内置清单。
function openProjectMusic() {
  ["#homeScreen", "#mapScreen", "#introScreen", "#resultScreen", "#memoryScreen", "#musicScreen"].forEach(selector => {
    const screen = document.querySelector(selector);
    if (screen) screen.classList.toggle("hidden", selector !== "#musicScreen");
  });
  const audio = document.querySelector("#musicAudio");
  if (!audio?.src) return;
  const result = audio.play();
  if (result?.catch) result.catch(() => {
    const status = document.querySelector("#musicStatus");
    if (status) status.textContent = "浏览器阻止了自动播放，请点击播放按钮";
  });
}

const PROJECT_MUSIC_FALLBACK = [
  {
    "name": "王力宏-爱错.mp3",
    "path": "王力宏-爱错.mp3",
    "size": 9555788,
    "url": "https://raw.githubusercontent.com/hebaodan177-blip/game/main/music/%E7%8E%8B%E5%8A%9B%E5%AE%8F-%E7%88%B1%E9%94%99.mp3"
  },
  {
    "name": "周杰伦-晴天.mp3",
    "path": "周杰伦-晴天.mp3",
    "size": 10792943,
    "url": "https://raw.githubusercontent.com/hebaodan177-blip/game/main/music/%E5%91%A8%E6%9D%B0%E4%BC%A6-%E6%99%B4%E5%A4%A9.mp3"
  },
  {
    "name": "街道办GDC、欧阳耀莹-春娇与志明.mp3",
    "path": "街道办GDC、欧阳耀莹-春娇与志明.mp3",
    "size": 8202131,
    "url": "https://raw.githubusercontent.com/hebaodan177-blip/game/main/music/%E8%A1%97%E9%81%93%E5%8A%9EGDC%E3%80%81%E6%AC%A7%E9%98%B3%E8%80%80%E8%8E%B9-%E6%98%A5%E5%A8%87%E4%B8%8E%E5%BF%97%E6%98%8E.mp3"
  },
  {
    "name": "梨冻紧、Wiz_H张子豪-罗生门（Follow）.mp3",
    "path": "梨冻紧、Wiz_H张子豪-罗生门（Follow）.mp3",
    "size": 9752735,
    "url": "https://raw.githubusercontent.com/hebaodan177-blip/game/main/music/%E6%A2%A8%E5%86%BB%E7%B4%A7%E3%80%81Wiz_H%E5%BC%A0%E5%AD%90%E8%B1%AA-%E7%BD%97%E7%94%9F%E9%97%A8%EF%BC%88Follow%EF%BC%89.mp3"
  }
];

class MusicManager {
  constructor() {
    this.audio = document.querySelector("#musicAudio") || document.createElement("audio");
    this.audio.preload = "metadata";
    this.audio.volume = .35;
    this.audio.controls = false;
    this.audio.setAttribute("aria-label", "项目背景音乐");
    if (!this.audio.isConnected) document.body.appendChild(this.audio);
    this.current = null;
    this.localTracks = PROJECT_MUSIC_FALLBACK.map((entry, index) => ({
      id: "music-fallback-" + index,
      name: entry.name,
      size: entry.size,
      lastModified: 0,
      url: new URL("music/" + entry.path, document.baseURI).href,
      fallbackUrl: entry.url,
      saved: true,
      directory: true
    }));
    this.currentTrack = null;
    this.musicDirectory = null;
    this.pendingFileNames = new Set();
    this.manifestReady = null;
    this.$ = selector => document.querySelector(selector);
    this.renderLibrary();
    this.bind();
    this.selectTrack(this.localTracks[0]);
    this.update("默认音乐已载入，请点击播放");
    this.loadMusicManifest();
  }

    // 渲染预设曲目和用户导入的本地曲目。
  renderLibrary() {
    const root = this.$("#musicLibrary");
    root.replaceChildren();
    MUSIC_LIBRARY.forEach(track => {
      root.appendChild(this.createPresetItem(track));
    });
    this.localTracks.forEach(track => root.appendChild(this.createLocalItem(track)));
  }

  createPresetItem(track) {
    const item = document.createElement("article");
    item.className = "music-track preset-track";
    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = track.title;
    const meta = document.createElement("span");
    meta.textContent = `${track.artist} · ${track.mood}`;
    info.append(title, meta);
    const links = document.createElement("div");
    links.className = "music-links";
    [["网易云", track.netease], ["QQ 音乐", track.qq]].forEach(([label, href]) => {
      const link = document.createElement("a");
      link.textContent = label;
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      links.appendChild(link);
    });
    item.append(info, links);
    return item;
  }

  createLocalItem(track) {
    const item = document.createElement("article");
    item.className = "music-track local-track";
    item.dataset.trackId = track.id;
    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = track.name;
    const meta = document.createElement("span");
    meta.textContent = `本地音乐 · ${this.formatBytes(track.size)} · ${track.saved ? "已保存到 music" : "临时导入"}`;
    info.append(title, meta);
    const actions = document.createElement("div");
    actions.className = "music-links local-actions";
    const play = document.createElement("button");
    play.className = "track-play";
    play.type = "button";
    play.textContent = "播放";
    play.dataset.action = "play";
    const remove = document.createElement("button");
    remove.className = "track-remove";
    remove.type = "button";
    remove.textContent = "移除";
    remove.dataset.action = "remove";
    actions.append(play, remove);
    item.append(info, actions);
    return item;
  }

  bind() {
    const openMusicScreen = () => {
      ["#homeScreen", "#mapScreen", "#introScreen", "#resultScreen", "#memoryScreen", "#musicScreen"].forEach(selector => {
        const screen = this.$(selector);
        if (screen) screen.classList.toggle("hidden", selector !== "#musicScreen");
      });
      this.play();
    };
    document.addEventListener("click", event => {
      if (event.target.closest("#musicButton")) openMusicScreen();
    });
    this.$("#musicPlay").onclick = () => this.play();
    this.$("#musicPause").onclick = () => this.pause();
    this.$("#musicStop").onclick = () => this.stop();
    this.$("#musicVolume").oninput = e => { this.audio.volume = Number(e.target.value); };
    const folderButton = this.$("#musicFolderButton");
    if (folderButton) folderButton.onclick = () => this.chooseMusicDirectory();
    this.$("#musicFile").onchange = e => {
      this.addFiles(e.target.files);
      // 允许移除后再次选择同一个文件时仍触发 change。
      e.target.value = "";
    };
    this.$("#musicLoadUrl").onclick = () => this.loadUrl(this.$("#musicUrl").value.trim());
    const dropzone = this.$("#musicDropzone");
    ["dragenter", "dragover"].forEach(type => dropzone.addEventListener(type, e => {
      e.preventDefault();
      dropzone.classList.add("is-dragging");
    }));
    ["dragleave", "drop"].forEach(type => dropzone.addEventListener(type, e => {
      e.preventDefault();
      dropzone.classList.remove("is-dragging");
    }));
    dropzone.addEventListener("drop", e => this.addFiles(e.dataTransfer.files));
    dropzone.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.$("#musicFile").click();
      }
    });
    this.$("#musicLibrary").addEventListener("click", e => {
      const action = e.target.closest("[data-action]")?.dataset.action;
      const item = e.target.closest("[data-track-id]");
      if (!action || !item) return;
      const track = this.localTracks.find(t => t.id === item.dataset.trackId);
      if (!track) return;
      if (action === "play") this.selectTrack(track, true);
      if (action === "remove") this.removeTrack(track.id);
    });
    this.audio.addEventListener("play", () => this.update("播放中"));
    this.audio.addEventListener("pause", () => this.update(this.audio.currentTime ? "已暂停" : "已停止"));
    this.audio.addEventListener("ended", () => this.update("播放结束"));
    this.audio.addEventListener("error", () => this.handleAudioError());
  }

  addFiles(fileList) {
    const files = [...(fileList || [])];
    const valid = files.filter(file => this.isAudioFile(file));
    if (!valid.length) return this.update("没有识别到支持的音频文件");
    let first = null;
    valid.forEach(file => {
      const duplicate = this.localTracks.some(track => track.name === file.name && track.size === file.size && track.lastModified === file.lastModified);
      if (duplicate) return;
      const track = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
        url: URL.createObjectURL(file),
        saved: false
      };
      this.localTracks.push(track);
      if (!first) first = track;
      if (this.musicDirectory) this.saveImportedFile(track, file);
    });
    this.renderLibrary();
    if (!first) return this.update("这些音频已经在播放列表中");
    this.selectTrack(first, true);
  }

  // 从仓库内的静态清单加载随项目发布的音乐，适用于 GitHub Pages。
  async loadMusicManifest() {
    if (typeof fetch !== "function") return;
    try {
      const manifestUrl = new URL("music/manifest.json", document.baseURI);
      const response = await fetch(manifestUrl, { cache: "no-cache" });
      if (!response.ok) return;
      const manifest = await response.json();
      const entries = Array.isArray(manifest) ? manifest : manifest?.tracks;
      if (!Array.isArray(entries)) return;
      let added = 0;
      entries.filter(entry => entry && this.isAudioFile(entry)).forEach(entry => {
        const duplicate = this.localTracks.some(track =>
          track.name === entry.name && (!entry.size || track.size === Number(entry.size))
        );
        if (duplicate) return;
        this.localTracks.push({
          id: `music-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: entry.name,
          size: Number(entry.size) || 0,
          lastModified: Number(entry.lastModified) || 0,
          url: new URL(entry.path || entry.name, manifestUrl).href,
          fallbackUrl: typeof entry.url === "string" ? entry.url : null,
          saved: true,
          directory: true
        });
        added++;
      });
      if (added) {
        this.renderLibrary();
        this.updateFolderStatus(`已加载 ${added} 首项目音乐`);
        this.selectTrack(this.localTracks[0]);
        this.update("默认音乐已载入，请点击播放");
      }
    } catch {
      // 清单缺失时保留预设曲目与手动导入功能。
    }
  }

  // 让用户明确授权项目中的 music 文件夹。浏览器不会允许网页静默写入本地目录。
  async chooseMusicDirectory() {
    if (!window.showDirectoryPicker) {
      return this.updateFolderStatus("当前浏览器不支持文件夹写入");
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: "readwrite", id: "xiaoxiaole-music" });
      if (handle.name?.toLowerCase() !== "music") {
        return this.updateFolderStatus("请选择项目中的 music 文件夹");
      }
      if (!(await this.ensureDirectoryPermission(handle, true))) {
        return this.updateFolderStatus("未获得 music 文件夹写入权限");
      }
      this.musicDirectory = handle;
      this.updateFolderStatus(`已连接 ${handle.name || "music"} 文件夹`);
      await this.loadAuthorizedDirectory(handle);
      this.update("音乐将保存到 music 文件夹");
    } catch (error) {
      if (error?.name === "AbortError") return this.updateFolderStatus("未选择 music 文件夹");
      this.updateFolderStatus("连接 music 文件夹失败");
      this.update("无法写入文件夹，请重新授权");
    }
  }

  // 将导入的文件复制到已授权目录，同时保留 Blob URL 供当前页面播放。
  async saveImportedFile(track, file) {
    let name = null;
    try {
      name = await this.uniqueFileName(file.name);
      const target = await this.musicDirectory.getFileHandle(name, { create: true });
      const writable = await target.createWritable();
      await writable.write(file);
      await writable.close();
      track.saved = true;
      track.savedName = name;
      this.renderLibrary();
      this.updateFolderStatus(`已保存 ${this.localTracks.filter(item => item.saved).length} 首到 music`);
    } catch (error) {
      this.updateFolderStatus("已加入播放列表，但保存到 music 失败");
    } finally {
      if (name) this.pendingFileNames.delete(name);
    }
  }

  // 同名文件自动追加序号，避免覆盖用户已有的音频。
  async uniqueFileName(name) {
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    for (let index = 1; index < 10000; index++) {
      const candidate = index === 1 ? name : `${stem} (${index})${ext}`;
      if (this.pendingFileNames.has(candidate)) continue;
      const exists = await this.fileExists(candidate);
      // fileExists 等待期间，另一项导入可能已预留了同一个名称。
      if (!exists && !this.pendingFileNames.has(candidate)) {
        this.pendingFileNames.add(candidate);
        return candidate;
      }
    }
    throw new Error("无法生成唯一文件名");
  }

  async fileExists(name) {
    try {
      await this.musicDirectory.getFileHandle(name);
      return true;
    } catch (error) {
      if (error?.name === "NotFoundError" || error?.code === 8) return false;
      throw error;
    }
  }

  async ensureDirectoryPermission(handle, request = false) {
    if (!handle) return false;
    try {
      const options = { mode: "readwrite" };
      if (await handle.queryPermission(options) === "granted") return true;
      return request && await handle.requestPermission(options) === "granted";
    } catch {
      return false;
    }
  }

  updateFolderStatus(text) {
    const status = this.$("#musicFolderStatus");
    if (status && text) status.textContent = text;
  }

  async loadAuthorizedDirectory(handle) {
    if (!handle?.values) return;
    try {
      const entries = [];
      for await (const entry of handle.values()) {
        if (entry.kind !== "file" || !this.isAudioFile({ name: entry.name })) continue;
        const file = await entry.getFile();
        entries.push({
          name: file.name,
          size: file.size,
          lastModified: file.lastModified,
          url: URL.createObjectURL(file)
        });
      }
      let added = 0;
      entries.forEach(entry => {
        const duplicate = this.localTracks.some(track =>
          track.name === entry.name && track.size === entry.size
        );
        if (duplicate) {
          URL.revokeObjectURL(entry.url);
          return;
        }
        this.localTracks.push({
          id: `directory-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          ...entry,
          saved: true,
          directory: true
        });
        added++;
      });
      if (added) {
        this.renderLibrary();
        this.updateFolderStatus(`已发现 ${added} 首 music 文件夹音乐`);
      }
    } catch {
      this.updateFolderStatus("已连接 music 文件夹，但读取文件失败");
    }
  }

  isAudioFile(file) {
    if (!file) return false;
    if (file.type && file.type.startsWith("audio/")) return true;
    const ext = file.name.toLowerCase().split(".").pop();
    return LOCAL_AUDIO_EXTENSIONS.has(ext);
  }

  selectTrack(track, autoplay = false) {
    if (!track?.url) return this.update("默认音乐地址无效，请检查音乐清单");
    track.fallbackUsed = false;
    this.currentTrack = track;
    this.current = track.name;
    this.audio.src = track.url;
    this.audio.load();
    this.update("项目音乐已载入");
    if (autoplay) this.play();
  }

  handleAudioError() {
    const track = this.currentTrack;
    if (track?.fallbackUrl && !track.fallbackUsed && this.audio.src !== track.fallbackUrl) {
      track.fallbackUsed = true;
      this.audio.src = track.fallbackUrl;
      this.audio.load();
      this.update("正在切换远程音乐地址...");
      return;
    }
    const code = this.audio.error?.code;
    const reason = code === 1 ? "加载被取消" : code === 2 ? "网络加载失败" : code === 3 ? "音频解码失败" : code === 4 ? "格式或地址不受支持" : "音频无法访问";
    this.update(reason + "，请检查音乐地址或选择其他曲目");
  }

  loadUrl(url) {
    if (!url) return this.update("请先粘贴可播放的音频直链");
    this.audio.src = url;
    this.currentTrack = null;
    this.current = "外部音频";
    this.update("音频已载入");
  }

  play() {
    if (!this.audio.src) return this.update("请先选择或加载音频");
    this.update("正在加载音乐...");
    const result = this.audio.play();
    if (result && result.catch) result.catch(error => {
      if (error?.name === "NotAllowedError") this.update("浏览器阻止了自动播放，请点击播放按钮");
      else this.update("默认音乐加载失败，请检查音乐地址或更换曲目");
    });
  }

  pause() { if (this.audio.src) this.audio.pause(); }

  stop() {
    if (!this.audio.src) return;
    this.audio.pause();
    this.audio.currentTime = 0;
    this.update("已停止");
  }

  removeTrack(id) {
    const index = this.localTracks.findIndex(track => track.id === id);
    if (index < 0) return;
    const [track] = this.localTracks.splice(index, 1);
    if (track.url.startsWith("blob:")) URL.revokeObjectURL(track.url);
    if (this.currentTrack?.id === id) {
      this.audio.pause();
      this.audio.removeAttribute("src");
      this.audio.load();
      this.currentTrack = null;
      this.current = null;
    }
    this.renderLibrary();
    this.update("本地音频已移除");
  }

  update(status) {
    this.$("#musicTitle").textContent = this.current || "尚未选择音乐";
    if (status) this.$("#musicStatus").textContent = status;
    const enabled = Boolean(this.audio.src);
    ["#musicPlay", "#musicPause", "#musicStop"].forEach(selector => { this.$(selector).disabled = !enabled; });
    this.$("#musicLibrary").querySelectorAll(".local-track").forEach(item => {
      item.classList.toggle("is-playing", item.dataset.trackId === this.currentTrack?.id && enabled);
    });
  }

  formatBytes(size) {
    if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }
}
