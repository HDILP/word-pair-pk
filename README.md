# 词对 PK (word-pair-pk)

英语单词配对双人 PK 游戏，教室一体机/手机浏览器均可运行。

## 快速开始

直接打开 **index.html**（双击即玩）或访问在线版：

- **Vercel**: https://word-pair-pk.vercel.app
- **自定义域名 (中国加速)**: https://word-pair-pk.hdilp.top

## 开发

```
📁 项目结构
├── src/                    ← 源码
│   ├── style.css           ← 全部样式（44KB）
│   └── app.js              ← Vue 3 应用代码（35KB）
├── word-pair-pk.html       ← HTML 模板（引入 src/）
├── words/                   ← 词库目录（每个单元独立 JSON）
│   ├── 必修一/             ← 子目录 = 教材
│   │   ├── Welcome Unit.json
│   │   ├── Unit 1 Teenage Life.json
│   │   └── ...
│   ├── 必修二/
│   └── ...
├── build.py                 ← 构建脚本：内联 src/* + 词库 → index.html + version.json
├── index.html               ← 构建产物（双击即玩）
├── version.json             ← 构建产物（供线上更新检测）
├── vercel.json              ← Vercel 部署配置
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

## 游戏模式

- **双人 PK**：同屏分边，各自计时竞速配对
- **单人挑战**：计时配对，完成后自动录入复习系统
- **单词复习**：基于利特纳盒子的间隔重复系统
  - 自由练习：选词范围后不计时配对，错词自动进复习系统
  - 今日复习：自动捞取今天该复习的词
  - 错题特训：只练盒子 1 里的顽固错词
- **排行榜**：LocalStorage 持久化，支持 JSON 导入/导出迁移

## 技术栈

- **Vue 3**（CDN）—— 响应式 UI
- **纯 CSS** —— 暖白底 + 樱花粉 #ffaab2 + 淡蓝 #A5D8FF，含完整设计系统（12色变体、5级阴影、5条定制动画曲线、毛玻璃卡片、动态渐变球背景、噪点纹理、点阵图案）
- **Web Speech API** —— 英语 TTS 朗读
- **LocalStorage** —— 排行榜持久化（支持 JSON 导入/导出迁移）
- **Vercel** —— 自动部署，中国加速（vercel-cname.xingpingcn.top）

## 数据来源

人教版高中英语 7 册课本词汇 + 课外词汇 2 单元，共 **5254 词**，按教材→Unit 细分：

| 册 | 词数 | Units |
|:---|:---:|:---|
| 必修一 | 333 | 6 |
| 必修二 | 357 | 5 |
| 必修三 | 403 | 5 |
| 选必一 | 340 | 5 |
| 选必二 | 348 | 5 |
| 选必三 | 309 | 5 |
| 选必四 | 283 | 5 |
| 课外词汇 | 2881 | 2 |
