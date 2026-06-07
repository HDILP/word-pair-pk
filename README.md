# 词对 PK 🎯

英语单词配对双人 PK 游戏，教室一体机/手机浏览器均可运行。

## 快速开始

直接打开 **index.html**（双击即玩）或访问在线版：

- **Vercel**: https://word-pair-pk.vercel.app
- **自定义域名**: https://word-pair-pk.hdilp.top （DNS 配置中）

## 开发

```
📁 项目结构
├── word-pair-pk.html      ← 模板（不要直接改这里的数据）
├── words/*.json           ← 词库文件（改词、加词、细分 unit 都在这）
├── build.py               ← 构建脚本
├── index.html             ← 构建产物（由 build.py 生成，双击即玩）
└── .github/workflows/
    └── deploy.yml         ← CI/CD：推代码自动构建 + 部署到 Vercel
```

### 修改词库

编辑 `words/` 下的 JSON 文件，支持两种格式：

```json
// 简单格式（全部词在一个列表）
{ "name": "必修一", "words": [{"en": "exchange", "zh": "交换"}, ...] }

// 细分 unit 格式（推荐）
{ "name": "必修一", "units": [
    { "name": "Welcome Unit", "words": [{"en": "exchange", "zh": "交换"}, ...] },
    { "name": "Unit 1",       "words": [{"en": "teenage", "zh": "青少年"}, ...] }
]}
```

改完后运行：

```bash
python3 build.py
```

生成新的 `index.html`，双击就能用 ✅

### 部署

推送到 GitHub 后，GitHub Actions 会自动：

1. 运行 `python3 build.py` 生成最新 `index.html`
2. 部署到 Vercel

## 技术栈

- **Vue 3**（CDN）—— 响应式 UI
- **纯 CSS** —— 教室笔记风格配色
- **Web Speech API** —— 英语 TTS 朗读
- **LocalStorage** —— 排行榜持久化（支持 JSON 导入/导出迁移）
- **Vercel** —— 自动部署

## 数据来源

人教版高中英语 7 册课本词汇，共 2331 词：

- 必修一 ~ 必修三
- 选择性必修一 ~ 选择性必修四
