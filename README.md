<p align="center">
  <img src="src/icon.png" width="128" height="128" alt="LETGO Logo" style="border-radius: 28px; box-shadow: 0 8px 24px rgba(0,0,0,0.15);" />
</p>

<h1 align="center">LETGO · 翻片</h1>

<p align="center">
  <b>放手废片，留下心动瞬间。</b><br>
  专为摄影师与旅行爱好者打造的极简随性照片/视频快速挑选整理桌面应用。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-45.0-47848F?logo=electron&logoColor=white" alt="Electron">
  <img src="https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-informational" alt="Platform">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License">
</p>

---

## 🌟 特色功能

* ⚡️ **纯键盘流极速挑片**：右手鼠标自由缩放看细节，左手 `F`（收录）、`D`（跳过）、`X`（确认删除），如老相机转动过片扳手般行云流水。
* 🎨 **专业色彩与影调罗盘 (Tone & Harmony Compass)**：
  * **冷暖色温双极能量条**：实时计算全图冷暖比例（如 `冷调 64% 🧊 ⸺●⸺ 🔥 暖调 36%`）并动态指示色彩重心；
  * **影调倾向评级**：智能辨识高调空气感（High-Key）、中调均衡（Mid-Tone）与深邃暗光（Low-Key）；
  * **画面 5 色主调提取**：提取占比最大的 5 种主色，标注真实面积占比，点击一键复制 HEX 代码。
* 🌊 **P3 液态玻璃与悬浮水滴工学**：全局精致的毛玻璃折射、跟随光标的流动微光、日产 Fender Lake Placid Blue 复古湖水蓝与 Codex 预设。
* 🔍 **光标中心滚轮缩放与对焦检查**：以鼠标指针所在位置为中心实时平滑缩放，辅以小地图视野框，查焦一目了然。
* 📊 **里程碑成就感进度条**：在 25% / 50% / 75% 处点亮高光刻度，100% 达成时弹跳庆祝，让整理素材不再是枯燥负担。
* 🔒 **100% 纯本地运行与安全非破坏性**：所有扫描、EXIF 提取、色彩计算与文件整理全部在本地进行，零网络外传，删除与归档自动受系统回收站保护。

---

## ⌨️ 常用快捷键

| 按键 | 功能 |
| :--- | :--- |
| <kbd>F</kbd> | **收录** 当前素材（Keep） |
| <kbd>D</kbd> | **跳过** 当前素材（Skip） |
| <kbd>X</kbd> | **标记删除** 当前素材（Reject） |
| <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>Z</kbd> | **撤销** 上一步操作 |
| <kbd>I</kbd> | 展开 / 收起右侧 **素材检查器与影调罗盘** |
| 鼠标滚轮 | 以光标为中心放大 / 缩小图片 |
| <kbd>←</kbd> / <kbd>→</kbd> | 上一张 / 下一张素材 |
| <kbd>Q</kbd> / <kbd>W</kbd> / <kbd>E</kbd> / <kbd>R</kbd> / <kbd>T</kbd> / <kbd>Y</kbd> | 快速打上对应预设标签 |
| <kbd>Shift</kbd> + <kbd>Q</kbd> | 弹窗新建自定义标签 |
| <kbd>Space</kbd> (空格) | 播放 / 暂停视频预览 |
| <kbd>J</kbd> / <kbd>L</kbd> | 视频快退 5 秒 / 快进 5 秒 |

---

## 🚀 快速上手与本地开发

### 环境要求
* [Node.js](https://nodejs.org/) >= 20.0.0
* npm >= 10.0.0

### 安装依赖并启动
```bash
# 克隆仓库
git clone https://github.com/Akikkan/LETGO.git
cd LETGO

# 安装依赖
npm install

# 本地热编译启动
npm start
```

### 构建与打包

#### Windows 构建
```bash
npm run package:win
```
产物将输出在 `release-v0.2/LETGO-win32-x64/` 目录下。

#### macOS 构建
```bash
npm run package:mac        # Apple Silicon (M1/M2/M3/M4)
npm run package:mac:intel  # Intel x64
```

---

## 📄 开源许可

本项目基于 [MIT 许可证](LICENSE) 开源。欢迎 Star、Fork 与提交 Issue / PR 交流灵感！
