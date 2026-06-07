# 词对 PK 🎯

英语单词配对双人 PK 游戏，教室一体机/手机浏览器均可运行。

## 快速开始

直接打开 **index.html**（双击即玩）或访问在线版：

- **Vercel**: https://word-pair-pk.vercel.app
- **自定义域名 (中国加速)**: https://word-pair-pk.hdilp.top

## 开发

```
📁 项目结构
├── word-pair-pk.html      ← Vue 3 模板（入口文件）
├── words/                  ← 词库目录（每个 unit 独立 JSON）
│   ├── 必修一/             ← 子目录 = 教材
│   │   ├── Welcome Unit.json
│   │   ├── Unit 1 Teenage Life.json
│   │   └── ...
│   ├── 必修二/
│   └── ...
├── build.py                ← 构建脚本：合并词库 → index.html
├── index.html              ← 构建产物（由 build.py 生成，双击即玩）
├── vercel.json             ← Vercel 部署配置
└── README.md
```

### 修改词库

编辑 `words/<教材名>/<Unit名>.json`，格式如下：

```json
{
  "name": "Unit 1 Teenage Life",
  "words": [
    {"en": "exchange", "zh": "v. 交流；交换", "unit": "Unit 1 Teenage Life"},
    {"en": "teenage", "zh": "adj. 青少年的", "unit": "Unit 1 Teenage Life"}
  ]
}
```

改完后运行：

```bash
python3 build.py
```

生成新的 `index.html`，双击就能用 ✅

### 部署

推送到 GitHub 后，Vercel 会自动：

1. 运行 `python3 build.py` 生成最新 `index.html`
2. 部署到生产环境

## 技术栈

- **Vue 3**（CDN）—— 响应式 UI
- **纯 CSS** —— 教室笔记风格配色（暖白底 + 樱花粉 #ffaab2 + 淡蓝 #A5D8FF）
- **Web Speech API** —— 英语 TTS 朗读
- **LocalStorage** —— 排行榜持久化（支持 JSON 导入/导出迁移）
- **Vercel** —— 自动部署，中国加速（vercel-cname.xingpingcn.top）

## 数据来源

人教版高中英语 7 册课本词汇，共 **2373 词**，按教材→Unit 细分：

| 册 | 词数 | Units |
|:---|:---:|:---|
| 必修一 | 333 | 6 |
| 必修二 | 357 | 5 |
| 必修三 | 403 | 5 |
| 选必一 | 340 | 5 |
| 选必二 | 348 | 5 |
| 选必三 | 309 | 5 |
| 选必四 | 283 | 5 |
