# 雨停以前

这是一个纯静态网页游戏，不需要后端服务、数据库或服务端渲染。入口文件是 `index.html`，所有脚本、样式、图片和音乐都从仓库内的相对路径加载。

## GitHub Pages 部署

保持以下目录结构并提交到 GitHub：

```text
xiaoxiaole/
  index.html
  styles.css
  *.js
  assets/
    backdrop.png
    icons.svg
    pieces/*.svg
  music/
    manifest.json
    *.mp3
```

在 GitHub 仓库中打开 `Settings -> Pages`，将 `Deploy from a branch` 设置为目标分支和 `/ (root)`，保存后访问 GitHub Pages 给出的地址即可。无需运行构建命令，也无需上传 `.tmp-server.js`；该文件仅用于本地预览，网页运行不依赖它。

音乐文件需要登记在 `music/manifest.json` 中。例如：

```json
{
  "version": 1,
  "tracks": [
    { "name": "我的音乐.mp3", "path": "我的音乐.mp3", "size": 123456 }
  ]
}
```

`path` 相对于 `music/manifest.json`，不要写成 `/music/...`。页面会使用当前站点的相对地址，因此部署到 `https://用户名.github.io/仓库名/` 这样的项目子路径时，脚本、资源、清单和音频仍能正常加载。新增或更换音乐后同步更新清单并重新提交即可。

浏览器通常禁止网页在没有用户操作时自动播放声音。页面启动时会预加载清单中的第一首音乐并设为默认曲目，打开“音乐”面板后点击“播放”即可开始。请只发布自己拥有使用权的音频文件。
