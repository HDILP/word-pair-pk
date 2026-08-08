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
│   ├── style.css           ← 全部样式（64KB+）
│   ├── app.js              ← Vue 3 应用代码（82KB+）
│   └── audio/              ← Phigros 打击音效 wav（build.py 内联用，云端构建必需）
├── word-pair-pk.html       ← HTML 模板（引入 src/）
├── words/                   ← 词库目录（每个单元独立 JSON）
│   ├── 必修一/             ← 子目录 = 教材
│   │   ├── Welcome Unit.json
│   │   ├── Unit 1 Teenage Life.json
│   │   └── ...
│   ├── 必修二/
│   └── ...
├── build.py                 ← 构建脚本：内联 src/* + 词库 + 音效 → index.html + version.json
├── index.html               ← 构建产物（双击即玩）
├── version.json             ← 构建产物（供线上更新检测）
├── sw.js                    ← PWA service worker（network-first，离线可玩）
├── manifest.json            ← PWA manifest（安装到桌面）
├── assets/icons/            ← PWA 图标（192/512 PNG）
├── docs/game-guide.md       ← 游戏说明书（用户向）
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

- **双人 PK**：同屏分边，各自计时竞速配对，先配完 8 对者胜
- **抢答 PK**：公共牌池双方共抢，谁先完成配对这对归谁（可抢对方选中的卡），得分多者胜
- **单人挑战**：计时配对 + 个人最佳，5 颗心（错 5 次提前结束）
- **听力挑战**：TTS 读英文 4 选 1 中文，8 轮，错词自动进复习系统
- **例句配对**：读英文例句配对中文释义，句中目标词加粗高亮；配对成功朗读整句，错词进复习系统（全量 5254 词带例句）
- **每日挑战**：每天固定一批词（同天同设备同词），连续打卡
- **单词复习**：基于利特纳盒子的间隔重复系统
  - 自由练习：选词范围后不计时配对
  - 今日复习：自动捞取今天该复习的词
  - 错题特训：只练盒子 1 里的顽固错词
- **单词图鉴**：配对成功的词自动收集，支持搜索/分组/发音
- **排行榜**：LocalStorage 持久化，支持 JSON 导入/导出迁移
- **随机事件**：每局开局迷雾（半透明抢开局）/ 中途洗牌二选一
- **打击特效**：Phigros 风格点击特效（三色随连击渐变），可关闭

完整玩法说明见 **docs/game-guide.md**（游戏内 header ❓ 也有简版）。

## 技术栈

- **Vue 3**（CDN）—— 响应式 UI
- **纯 CSS** —— 暖白底 + 樱花粉 #ffaab2 + 淡蓝 #A5D8FF，含完整设计系统（12色变体、5级阴影、5条定制动画曲线、毛玻璃卡片、动态渐变球背景、噪点纹理、点阵图案）
- **Web Speech API** —— 英语 TTS 朗读（配对发音 + 听力挑战 + 例句整句）
- **Web Audio** —— Phigros 打击音效（wav base64 内联，单文件离线）
- **Service Worker** —— PWA 离线安装（network-first，file:// 版不注册）
- **LocalStorage** —— 排行榜 / 复习系统 / 个人最佳 / 图鉴（wordpair_codex）/ 特效开关
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
