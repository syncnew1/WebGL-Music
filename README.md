# WebGL Music

基于 WebGL 的沉浸式音乐播放器，集成了实时音频可视化、3D 画廊漫游和 AI 音乐助手。

## 功能特性

- **音乐播放** -- 完整的音频播放器，支持播放/暂停、上一首/下一首、进度拖拽、音量控制、单曲循环/列表循环/随机播放
- **WebGL 可视化** -- 实时音频响应式可视化效果（频谱、波形、径向、封面脉冲），支持多种配色主题，基于自定义 GLSL 着色器
- **3D 画廊** -- 基于 Three.js 的第一人称虚拟画廊漫游，墙面展示专辑封面，点击即可播放
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
  main.tsx              # 入口文件，Provider 嵌套
  App.tsx               # 路由与布局
  pages/                # 页面组件（首页、曲库、搜索、3D 画廊等）
  components/           # UI 组件（播放控制、歌词面板、侧边栏等）
    insight/            # 音频分析面板与 WebGL 画布
    ui/                 # 通用基础组件（Button, Card, Input 等）
  providers/            # 上下文 Provider（认证、数据、播放器、可视化、布局）
  visualizer/           # 音频分析引擎
    gl/                 # WebGL2 着色器渲染器（封面、点阵、粒子、模糊）
  lib/                  # 工具库（Supabase 客户端、GLM 客户端、音轨工具）
  styles/               # 主题样式
```

## 部署

项目已配置 Vercel 部署，包含 SPA 重写规则。推送到 main 分支即可触发自动部署。

## 开源协议

MIT
