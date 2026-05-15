# WebGL Music

基于 WebGL 的沉浸式音乐播放器，集成了实时音频可视化、3D 画廊漫游和 AI 音乐助手。

## 功能特性

- **WebGL 可视化（核心）** -- 自定义 GLSL ES 3.0 着色器实现的多模式音频可视化
  - 中心脉冲（Cover Pulse）：domain-warped fbm 星云 + 多层共振环 + 节拍冲击波
  - 径向频谱环（Spectrum Ring）：96 段 instanced 渲染、log 频段映射
  - 频谱柱状图（Spectrum Bars）：128 路 instanced + 峰值衰减
  - 后处理流水线：bright-pass + ping-pong 高斯模糊 bloom + ACES tonemap + 暗角
  - 主界面背景层（Ambient）：低 DPR 全屏 fbm 流动背景，跟随节拍呼吸
  - 底部播放栏微缩频谱（Mini Spectrum）：64 路 instanced 频谱条
  - 多配色主题：琥珀、霓虹、深空、彩虹
- **音频特征提取** -- 10 频段能量、节拍检测、谱质心、谱通量、和声识别、乐器识别（人声/钢琴/吉他/小提琴/镲等）
- **音乐播放** -- 完整的音频播放器，支持播放/暂停、上一首/下一首、进度拖拽、音量控制、单曲循环/列表循环/随机播放
- **3D 画廊** -- 基于 Three.js 的第一人称虚拟画廊漫游
- **网易云音乐** -- 扫码登录、浏览排行榜/歌单、搜索、在线播放、获取歌词
- **云端曲库** -- 上传和管理歌曲至 Supabase，自动提取 ID3 标签
- **歌词** -- LRC 格式同步歌词显示，点击跳转、内联编辑、繁简中文转换
- **歌单** -- 创建和管理歌单，收藏/取消收藏，从网易云导入歌单
- **AI 助手** -- 基于智谱 GLM 的悬浮聊天窗口，智能推荐相似歌曲
- **批量工具** -- 批量上传、批量补全元数据（封面 + 歌词）、文件名处理

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 18, TypeScript, React Router v6 |
| 3D / WebGL | Three.js, 自定义 WebGL2 GLSL ES 3.0 着色器 |
| 样式 | Tailwind CSS v3.4, CSS 自定义属性 |
| 后端 | Supabase (PostgreSQL, Auth, Storage) |
| AI | 智谱 GLM (glm-4-flash / glm-4.6v) |
| 构建工具 | Vite v5, Vitest v2 |

## 快速开始

### 环境要求

- Node.js (ES2020+)
- yarn

### 环境变量

在项目根目录创建 `.env` 文件：

```env
VITE_SUPABASE_URL=你的 Supabase 项目 URL
VITE_SUPABASE_ANON_KEY=你的 Supabase 匿名密钥
VITE_GLM_API_KEY=你的智谱 AI API 密钥
VITE_NETEASE_API_BASE=https://api-enhanced-seven-kappa.vercel.app
```

> 应用在没有 Supabase 配置时会降级为 localStorage 模式，没有网易云 API 时仅使用云端曲库。

### 安装与运行

```bash
# 安装依赖
yarn

# 启动开发服务器
yarn dev

# 构建生产版本
yarn build

# 预览生产构建
yarn preview

# 运行测试
yarn test
```

## 项目结构

```
src/
  main.tsx                     # 入口文件，Provider 嵌套
  App.tsx                      # 路由与布局，挂载全局背景可视化
  pages/                       # 页面组件（首页、曲库、搜索、3D 画廊等）
  components/
    BackgroundVisualizer.tsx   # 全局环境背景 WebGL 画布
    MiniSpectrum.tsx           # 底部播放栏微缩频谱
    PlayerControls.tsx         # 底部播放栏（嵌入 MiniSpectrum）
    insight/
      InsightDashboard.tsx     # 可视化主面板
      WebGLModeCanvas.tsx      # WebGL 多模式渲染容器（接入后处理流水线）
      VisComponents.tsx        # 信息面板（声场分布 / 和声轮 / 频段 / 乐器）
    ui/                        # 通用基础组件
  providers/
    PlayerProvider.tsx         # 播放器 + 全局 AnalyserNode
    VisualizerProvider.tsx     # 可视化偏好（模式/主题/敏感度/泛光/背景开关）
    ...
  visualizer/
    AudioAnalyzer.ts           # 音频特征提取（频段/节拍/和声/乐器/质心/通量）
    gl/
      util.ts                  # WebGL2 工具：着色器编译、FBO、全屏四边形
      pipeline.ts              # 后处理流水线：bright-pass + ping-pong blur + composite
      cover.ts                 # 中心脉冲（fbm 星云 + 多层环 + 冲击波）
      ring.ts                  # 径向频谱环（instanced）
      spectrum.ts              # 频谱柱状图（instanced + 峰值）
      ambient.ts               # 全局背景着色器
      miniSpectrum.ts          # 播放栏微缩频谱着色器
  lib/                         # Supabase 客户端、GLM 客户端、音轨工具
  styles/                      # 主题样式
```

## 音频特征到视觉参数映射

| 音频特征 | 视觉响应 |
|---------|---------|
| `smoothBass` | 中心脉冲半径、星云亮度、背景下方色带漂移 |
| `smoothMid` | 星云密度、背景中部色带 |
| `smoothTreble` | 环宽抖动、火花密度、高频角度细节 |
| `beat / beatStrength` | 节拍冲击波、bloom 强度峰值 |
| `spectralCentroid` | shader 色温混合（暗→亮三色渐变） |
| `spectralFlux` | 顶点抖动、瞬态环厚度 |
| `rms` | 整体响度、背景饱和度 |

## 部署

项目已配置 Vercel 部署，包含 SPA 重写规则。推送到 main 分支即可触发自动部署。

## 开源协议

MIT
