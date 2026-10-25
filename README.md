<p align="center">
  <img src="src/icon.png" width="96" height="96" alt="LETGO" style="border-radius: 20px;" />
</p>

<h1 align="center">LETGO</h1>

<p align="center">
  本地照片与视频初筛桌面工具。<br>
  Fast, keyboard-first media culling with tactile feedback.
</p>

---

## 概述

LETGO 是一款面向摄影师与视觉创作者的轻量初筛工具。通过全键盘流决策与非破坏性工作流，帮助创作者在拍摄归来后迅速完成素材取舍，剔除废片，收录核心资产。

应用全程离线运行，不调用外部网络接口，所有文件处理受系统回收站机制保护。

## 设计特性

- **键盘流决策**：采用 `F`（收录）、`D`（跳过）、`X`（标记删除）三键流，支持单步与多步连续撤销。
- **色彩与影调罗盘**：
  - 实时分析画面冷暖色温倾向（Cold vs Warm %）与重心指针；
  - 自动归类影调特征（高调 High-Key、中调均衡 Mid-Tone、低调深沉 Low-Key）；
  - 提取画面 5 组主导色系与实际覆盖率，支持一键复制 HEX 色值。
- **光标中心无级缩放**：以鼠标光标所在像素为中心进行无级放大和平移，内嵌微型导航视口，方便迅速确认对焦点锐度。
- **克制美学与液态质感**：基于 P3 广色域设计的低饱和色彩预设（Codex 翠绿、Fender 湖水蓝等），配合全局微透界面与对称工具栏。
- **非破坏性归档**：原始素材保留在原位，执行时按旅程与地点结构导出，删除项目送入系统回收站。

## 快捷键映射

| 按键 | 说明 |
| :--- | :--- |
| `F` | 收录素材（Keep） |
| `D` | 跳过素材（Skip） |
| `X` | 标记删除（Reject） |
| `Ctrl` / `Cmd` + `Z` | 撤销上一步决策 |
| `I` | 显示 / 隐藏素材检查器与影调罗盘 |
| 滚轮 | 以当前光标为中心缩放图像 |
| `←` / `→` | 前往上一项 / 下一项 |
| `Q` `W` `E` `R` `T` `Y` | 标记对应槽位预设标签 |
| `Shift` + `Q` | 创建新标签 |
| `Space` | 播放 / 暂停视频 |
| `J` / `L` | 视频后退 / 前进 5 秒 |

## 构建与运行

### 环境依赖

- Node.js >= 20.0.0
- npm >= 10.0.0

### 本地开发

```sh
# 克隆仓库
git clone https://github.com/Akikkan/LETGO.git
cd LETGO

# 安装依赖
npm install

# 启动开发实例
npm start
```

### 打包发布

```sh
# Windows (x64)
npm run package:win

# macOS (Apple Silicon)
npm run package:mac

# macOS (Intel)
npm run package:mac:intel
```

构建结果将输出至 `release-v0.2/` 目录下。

## 许可证

[MIT](LICENSE)
