# 词对 PK (word-pair-pk)

英语单词配对双人 PK 游戏，三文件源码（HTML 模板 + src/style.css + src/app.js），build.py 内联合并为单 HTML 部署。

## 项目结构

```
src/
  style.css         ← 全部 CSS（64KB+）
  app.js            ← Vue 3 应用代码（82KB+）
  audio/            ← Phigros 打击音效 wav（build.py 内联用；云端构建必需，勿删）
word-pair-pk.html   ← HTML 模板（引入 src/ 中的 CSS/JS）
index.html           ← 构建产物（build.py 生成，CSS/JS/词库/音效全内联，部署用）
build.py             ← 构建脚本：内联 src/* → 注入词库+音效+版本号 → index.html + version.json
version.json         ← 构建产物（build.py 生成，供本地版 fetch 检测更新）
sw.js                ← PWA service worker（network-first，离线可玩；静态文件不经过构建）
manifest.json        ← PWA manifest（安装到桌面）
assets/icons/        ← PWA 图标（icon-192/512.png，puppeteer 截图生成）
words/               ← 词库目录
  必修一/              ← 教材目录
    Welcome Unit.json
    ...
vercel.json          ← Vercel 部署配置（CORS: Access-Control-Allow-Origin: null）
```

**注意**：version.js 已废弃（2026-08-07 移除）——不再有远程脚本，本地版直接 fetch version.json 检测更新。

## 构建

```bash
python3 build.py              # 从 word-pair-pk.html + src/* 生成 index.html + version.json
python3 build.py output.html  # 自定义输出文件名
```

**构建过程：**
1. 读取 `word-pair-pk.html` 模板
2. 读取 `src/style.css` → 内联为 `<style>`
3. 读取 `src/app.js` → 内联为 `<script>`
4. 扫描 `words/` 词库 → 注入 `ALL_WORDS_DATA`
5. **内联打击音效**：src/app.js 中 `@@DRAG_B64@@`/`@@TAP_B64@@`/`@@FLICK_B64@@` 占位符 → 读 `src/audio/phigros_*.wav`（正斜杠路径！Linux 上反斜杠是合法文件名字符会找不到）转 base64 替换；找不到则保留占位符（静音降级）
6. 注入构建版本号 → 输出 `index.html` + `version.json`

**构建产物：**
- `index.html` — 注入词库数据 + 构建版本号（`<meta name="build-revision" content="20260620153454">`）
- `version.json` — `{"revision":"20260620153454"}`（东八区，精确到秒，供线上更新检测）
- 版本号格式：`YYYYMMDDHHMMSS`，build.py 中使用 `datetime.timezone(datetime.timedelta(hours=8))` 强制东八区

词库目录结构要求：
```
words/<教材名>/<单元名>.json
```
JSON 格式：`{ "name": "单元名", "words": [{"en": "...", "zh": "..."}, ...] }`

推送到 GitHub 后 Vercel 自动部署（无 GitHub Actions）。

## 技术栈

- **Vue 3**（CDN，Options API）→ 全局数据、methods、computed
- **纯 CSS** → 暖白底 + 樱花粉 #ffaab2 + 淡蓝 #A5D8FF
  - 2026-06-20 视觉改版：完整设计系统（12色变体、5级阴影、5条定制动画曲线）、毛玻璃卡片、渐变按钮（渐变+阴影+hover上移）、视图过渡（Vue Transition 淡入上移）、动态背景（4层渐变球+噪点纹理+粉蓝双色点阵）、卡片错位入场（40ms间隔）、配对绿色光晕动画、错误闪烁抖动、倒计时弹入（ease-bounce曲线）
- **SVG 图标系统** → 所有 UI 图标改用 inline SVG（书本/奖杯/时钟/笔/刷新/杠铃），排行榜前三名用 CSS 渐变圆形徽章
- **Vue 3 `<Transition>`** → 视图间淡入上移动画
- **Web Speech API** → TTS 朗读
- **LocalStorage** → 排行榜（`wordpair_leaderboard`）、复习系统（`wordpair_review`）、个人最佳（`wordpair_pb`）、单词图鉴（`wordpair_codex`）、打击特效开关（`wordpair_fx`，'0'=关）
- **Vercel** → 自动部署，中国加速

## 应用架构

### 视图切换

所有视图通过 `currentView` 控制，`v-if`/`v-else-if` 切换：

- `home` — 首页（双人 PK / 抢答 PK / 单人挑战 / 听力挑战 / 单词复习 / 排行榜 / 玩法说明 / 每日挑战卡 / 打击特效开关）
- `select` — 选词视图（树形选择教材→单元）
- `game` — 双人/单人/抢答游戏（含倒计时、配对逻辑）
- `listenGame` — 听力挑战视图（TTS 读词 4 选 1）
- `sentenceGame` — 例句配对视图（例句卡 ↔ 释义卡 8 对，目标词高亮）
- `review` — 复习首页（自由练习 / 今日复习 / 错题特训 / 单词图鉴入口）
- `reviewGame` — 复习配对游戏
- `codex` — 单词图鉴（搜索/分组/发音）
- `leaderboard` — 排行榜

### 游戏模式

1. **双人 PK（dual）**：同屏分边，P1/P2 各自计时，竞速，先配完 8 对者胜
2. **单人挑战（single）**：计时 + 个人最佳，**5 颗心**（配错 -1，0 心提前结束，走 endGame 流程）
3. **抢答 PK（rush）**：公共牌池 16 张双方共抢，悬空选中唯一，**配对归完成者**（可抢对方选中），无效点击不惩罚不顶替；8 对全消后得分多者胜，平分比用时
5. **听力挑战（listen）**：TTS 读英文 → 4 张中文卡选 1，8 轮，答对 +1 分、答错 -1 心；错词进复习盒子
6. **例句配对（sentence）**：卡面换成英文例句（目标词加粗高亮）↔ 中文释义 8 对配对，配对成功 TTS 朗读整句；错词进复习盒子；**全量 5254 词带 example 字段**（短语动词例句词形变化时高亮自动回退）；新收集点第 5 处（collectWord 复用）
7. **每日挑战（daily）**：日期种子选词（同天同设备同词），完成记最快时间 + 连续天数，同样抽随机事件；**不扣心**（0 心走 endGame 会把未完成的挑战标记 done，属回归）
6. **自由练习（free）**：选词范围后不计时配对
7. **今日复习（due）**：利特纳盒子复习算法
8. **错题特训（hard）**：只练盒子 1 的顽固错词

### 配对逻辑

- 每局固定 8 对（16 张卡片：8 en + 8 zh），但复习游戏根据可用词数动态调整（`reviewCardPairCount`）
- 点击/触摸先选一张，再选另一张，类型不同且 ID 相同 → 配对成功
- 配对成功：高亮 + TTS 朗读英文
- 配对失败：闪红 300ms
- 双人模式各自独立匹配集
- 消除动画：`matchFlash` 280ms spring曲线 `cubic-bezier(0.34,1.56,0.64,1)`，`animation-delay:0ms !important` 确保 EN/ZH 卡同步消除。消除后保留 DOM（`animation-fill-mode: forwards` 停在 `opacity:0`）不移位。

### 打击特效 + 连击（WAVE1）

- **触发**：`window` 级 `pointerdown` 监听（不 preventDefault/stopPropagation），仅游戏对局内（`currentView==='game'` 且 `countdownState==='playing'` 且无结算弹层；或 reviewGame 且无 reviewPopup）；首页/菜单/倒计时/结算不触发；`fxReducedMotion`（prefers-reduced-motion）或 `fxEnabled===false`（首页开关）时整体跳过
- **六元素**：主方框（50%→100%）+ 旋转 45° 方框（面积恒 144%，线宽粗→细）+ 收缩实心圆 + 扩张半透明圆 + 双 90° 弧（SVG）+ 方形粒子；统一 EaseOutCubic，动画后 300ms 淡出；基准尺寸 64px（2026-08-07 从 88px 缩小）；fx-layer `pointer-events:none` 不挡双人同时点击
- **颜色**（fxColorFromEvent）：复习 Off 恒黄 > 右键蓝/中键红 > 左键/触摸/笔按**连击变色**（0-2 黄/3-5 蓝/6+ 红，comboAtPoint 按点击位置分 side）；连击各自独立（singleCombo/p1Combo/p2Combo/reviewCombo）
- **音效**：playSfx 仅点击路径调用（黄 drag/蓝 tap/红 flick，真实 wav base64 内联，new Audio(dataURI)）；配对成功/失败、倒计时 tick **不**播音效（2026-08-08 回归纯视觉）
- **连击 UI**：combo-banner 渐变金字弹入（弹性缩放），断连显示 + 900ms 隐藏
- 规格：docs/specs/phigros-click-fx-spec.md（已更新为现行实现）

### 随机事件卡（WAVE1）

- 开局必抽 1 个公平事件（`pickEvent`，事件池仅 fog/reshuffle，mirror 已移除——汉字倒置体验差）；每日挑战同样抽
- **fog 迷雾**：**效果整体推迟到 playing 才开始**（banner 用独立 `eventBannerName` 立即显示）——playing 后卡片 opacity 0.3 持续 2.5s → `fog-fade` 1.5s 渐显 → 事件类移除
- **reshuffle 洗牌**：开局 5s 后未匹配卡各自重排（matched 保持原位）
- banner z-index 120（高于倒计时 100 不被遮，低于弹窗 200）；事件类挂 `.game-board`

### 每日挑战（WAVE1）

- `startDailyChallenge()`：日期种子（`dateSeed`）从全局词库抽 8 词，同一天所有设备同一批词；主题=种子选单元
- 完成记 `dailyBest` 最快时间 + `dailyStreak` 连续天数（localStorage）；不扣心（0 心走 endGame 会把未完成的挑战标记 done，属回归）

### 玩法说明弹层（WAVE2.5）

- 入口：首页按钮区"玩法说明"按钮 + header 右上角 ❓（全局可开，游戏内倒计时结束后也可开）
- 弹层 `helpVisible` 控制，z-index 230，粉白渐变头 + 六节内容（怎么玩/七模式/连击特效/随机事件/学习系统/安装离线）；点遮罩或 ✕ 关闭
- 完整说明书：docs/game-guide.md

### 触摸事件处理

```
触摸设备事件链：
touchstart → touchend → (浏览器合成) click
```

为避免 `touchend` 选中后 `click` 又立即取消选中：
- `handleReviewTouchEnd` 设置 `reviewTouchProcessed = true`
- `handleReviewClick` 检查此标记，true 则跳过
- 数据属性以 `pendingReview`、`reviewTouchProcessed` 等命名——**Vue 3 不会代理 `_` 开头的数据到模板**，所以避免用 `_` 前缀

### PK/单人模式多点触控

- 触摸事件在 `.game-board` 父级处理（`@touchstart.prevent` 声明非被动监听），支持双人同时点击
- `touch-action` 层级：`.main { manipulation }` → `.game-board/game-side/game-card { none }`。`html/body` 上不设 `touch-action`，避免 Chrome 优先使用根的 `manipulation` 覆盖游戏区的 `none`
- `handleBoardTouch` 遍历 `event.changedTouches`，用 `touch.identifier` 唯一标识每根手指
- 通过 `document.elementFromPoint(x, y)` + `.closest('.game-side')` 判断触摸点属于 P1 还是 P2
- 触摸信息存入 `_touchMap[identifier] = { cardId, side }`，`handleBoardTouchEnd` 按 identifier 取出处理
- 桌面端保留 `.card-grid` 的 `@click` 事件，通过 `_processingClick[side]` 防止 touch→click 重复

### 手机侧滑返回（三层防护）

1. **CSS 层** — `overscroll-behavior-x: none` 阻止浏览器原生 overscroll 导航
2. **触摸手势层** — `touchstart` 在左边缘（x<40px）启动检测，`touchend` 右滑 >60px 触发 `navigateBack()`
   - 竖直滑动占比大自动取消，不影响正常滚动
   - 游戏卡片居中，与边缘检测不冲突
3. **系统返回层** — `history.pushState` + `popstate` 监听器拦截 Android 系统级返回手势
   - `popstate` 触发时：`pushState` 防止离开页面 + `navigateBack()` 执行应用内导航
   - `beforeUnmount` 时清理事件监听

`navigateBack()` 根据 `currentView` 决定返回目标：
- `select` → `cancelReviewSelect()`（返回复习/主页）
- `reviewGame` → 返回复习首页
- `game` / `review` / `leaderboard` → `goHome()`
- `home` → 不处理

### 卡片视觉与响应式布局

- 每张 `.game-card` 使用 `display: flex; align-items: center; justify-content: center` 居中文字
- 文字包裹于 `<span class="card-text">` 内，该 span 使用 `-webkit-line-clamp: 2` 实现多行截断
- `font-size` 响应式：默认 `clamp(11px, 1.6vw, 15px)`，平板 `clamp(10px, 3vw, 14px)`，手机 `clamp(9px, 3vw, 12px)`，大屏(≥1400px) `clamp(12px, 1vw, 18px)`
- 卡片网格 `max-width`：默认/平板 380px（gap 6px），手机 320px（gap 4px），大屏 560px（gap 10px，仅放大宽+间距，字号不动）
- `.card-grid` 使用 `aspect-ratio: 1` 保持正方形

### 页面布局与滚动

- `#app`：`height: 100vh; display: flex; flex-direction: column` — 固定视口高度
- `.header`：固定 48px，`flex-shrink: 0`
- `.main`：`flex: 1; overflow-y: auto` — 主内容区可纵向滚动
  - 所有视图容器 (`word-select-view`, `leaderboard-view`, `review-view`)：
    - `max-height: 100%; min-height: 0; overflow-y: auto` — 内容超出时内部可滚
    - `min-height: 0` 是关键——flex 子项默认 `min-height: auto`（等于内容高度），会阻止 `max-height` 缩容
  - 首页 (`.home-view`)：通过 `.main > .home-view { margin: auto 0 }` 垂直居中
  - 游戏视图 (`.game-view`, `.review-game-view`)：`height: 100%` 撑满，无需滚动
- 原 `.main { justify-content: center }` 因与 `overflow-y: auto` 在 flexbox 中存在浏览器兼容冲突，已移除
- `html, body { overflow: hidden }` 防止 body 弹跳

### 加载进度条

- 页面 `<body>` 顶部有 `.page-loader`（3px 固定条），粉蓝渐变滑块无限左右滑动
- 初始 `#app { opacity: 0 }` 隐藏所有 v-if 残留内容
- `mounted()` 结束后等待 `document.fonts.ready`，完成后同时淡出进度条 + 淡入 `#app`

### 倒计时

- `Ready?`（800ms）→ `3`/`2`/`1` 各 600ms（弹入动画）→ `GO!`（450ms）→ `playing` 开始计时
- WAVE1 从 Ready→GO 改回 3-2-1 擂台倒计时；倒计时无 tick 音（2026-08-08 起 Phigros 音效只给点击用）

### TTS 朗读

- **预热策略（现行）**：仅 `mounted()` 注册 `document` 的 `pointerdown` 监听（`once`）预热一次——首次点击触发 `speak('ready', volume 0.01)` 加载英文语音；**特效监听在 `window` 上，冒泡顺序 document 先于 window，预热不受影响**
- 预热参数：`utterance('ready', volume=0.01, lang='en-US', rate=0.9)` + 选择英文语音
- 匹配发音时：**不调用 `speechSynthesis.cancel()`**（cancel 会重置引擎状态导致首次延迟）
- 使用极低音量（0.01）而非 0，volume=0 的 utterance 在部分浏览器中引擎跳过不加载

### 复习系统（利特纳盒子）

- 存储键：`wordpair_review`
- 盒子 1~5，间隔天数 `[0, 1, 2, 4, 8, 16]`
- 配对正确 → box 递增，配对错误 → 回盒子 1
- **错词来源（WAVE1/2 扩展）**：单人、双人 PK（双方）、抢答 PK（双方）、听力挑战（答错词）全部自动同步进复习盒子
- `reviewStoreVersion` 计数器确保 `localStorage` 变化能触发 Vue computed 重新计算（`void this.reviewStoreVersion`）
- 低时渲染的 `reviewData` / `reviewBox1Count` / `reviewDueToday` 为 computed 属性
- 选词时按 `getWordKey()`（`word.en` 转小写下划线）去重，避免同一单词跨单元重复生成卡片

### 弱点雷达（WAVE1）

- 双人 PK / 抢答 PK 结算弹层：显示胜负与用时 + 双方错词 Top 3（`p1Errors`/`p2Errors` 按错误次数排序）+ 提示已自动加入今日复习
- 弹层关闭后走原 `saveResult` 流程（排行榜/PB 照常）

### 单词图鉴（WAVE2）

- 存储键：`wordpair_codex` = `{ [enKey]: { en, zh, book, unit, date } }`，重复收集不覆盖原日期
- 收集点（四处，漏一处=bug）：processCardClick 成功、processReviewCardClick 成功、processRushClick 成功、听力答对
- 图鉴页（codex 视图）：统计栏（已收集/5254 + 进度条）+ 搜索框（en/zh 前缀）+ 教材分组折叠 + 发音按钮；未收集的词灰显占位（不显示释义防剧透）

### 复盘弹窗（复习模式结束）

- 弹窗使用 `v-if="reviewPopup"` 渲染，**必须放在 `reviewGameView` 视图 div 内部**（不在 `<Transition>` 的直接子级）
- 历史 bug：弹窗原在 `<Transition>` 内作为独立 `v-if` → 当 `currentView === 'reviewGame'` 且 `reviewPopup` 为 true 时，Vue `<Transition>` 同时有两个子元素，弹窗不渲染
- 修复：将弹窗移入 `reviewGameView` 内部 ✅

### 页脚与构建版本号

- 页面底部 `.app-footer` 显示构建版本号（`position: fixed; bottom: 0`）
- 正常状态：淡灰等宽字体显示版本号（`20260620153454`），点击弹详情
- 有更新时：粉色更新条「📦 新版本 xxx 可用 · 点击更新」
- `↓` 按钮：下载最新版（详见下方）

### 更新检测 + 离线版下载（2026-08-07 重构）

**version.js 已废弃移除**——不再动态加载远程脚本（消除远程代码在本地上下文执行的风险面），改为纯数据链路：

**检查流程：**
1. `mounted()` 中读取本地 `<meta name="build-revision">` 得到 `buildVersion`
2. 本地版（`_isLocal()` 判断，覆盖 `file://` 和 Android `content://`）：`fetch('https://word-pair-pk.hdilp.top/version.json?t=...')` → 对比 `revision`，不一致则显示粉色更新条（成功置 `versionJsLoaded=true`）
3. 在线 Vercel 版：页面永远最新，跳过更新检测
4. 点击更新条 / `↓` 按钮：`downloadUpdate()` 统一走 blob 下载——本地版 fetch 绝对 URL `https://word-pair-pk.hdilp.top/?t=...`，在线版 fetch `/?t=...`（同一条代码路径）

**版本号弹窗（点击版本号触发）：**
- 显示构建时间 + "Powered by 晗菌 💕" + 版本来源（在线版/本地版） + 远程检测状态
- 页脚版本号旁有小点指示：粉色=已连接，灰色=未连接

**CORS 支持：**
- `vercel.json` 配置 `Access-Control-Allow-Origin: null`（2026-08-07 从 `*` 收窄）——file:// 页面的 Origin 恰为字面 "null"，精确匹配，本地版 fetch version.json / 下载仍可用；其他网站跨域抓页面被拒
- 兼容性：旧本地版（仍请求 version.js）会 404 静默失败，失去自动更新提示，需手动访问域名下载新版

### PWA（WAVE2，2026-08-08）

- `sw.js`：install 预缓存 `./`、`./index.html`、`./manifest.json`、两个图标；**核心文档 network-first**（在线拿最新，revision 变化自动拉到新版），其余 static cache-first；activate 清旧缓存；`skipWaiting` + `clients.claim`
- `manifest.json`：standalone + theme_color #ffaab2 + 192/512 图标
- 注册：`mounted()` 里 `if ('serviceWorker' in navigator && !this._isLocal()) register('sw.js')`——**file:// 不注册**（file:// 不支持 SW，且本地版本就是单文件离线）；失败静默
- 图标：assets/icons/icon-192.png + icon-512.png（puppeteer 截图生成，真实 PNG）
- 探针坑：Chromium CDP 离线模拟（setOfflineMode）对 127.0.0.1 loopback 无效，真离线测试需 taskkill 杀 http server；离线测试会污染 SW 状态，测完必须 unregister + 清 caches

### 首页史诗入场动画

- **驱动方式**：Vue `mounted()` → `$nextTick()` → **双 `requestAnimationFrame`** → `homeReady = true` → 添加 `.home-ready` class
- **关键修复（2026-06-20）**：单 `rAF` 在首次绘制前就触发了 class 切换，浏览器从没见过初始隐藏状态 → transition 无始值可对比 → 跳过动画。改为双 rAF 后第一帧 paint 初始态，下一帧再切 class
- **动画方式**：CSS `transition`（非 `@keyframes`），由 class 切换触发
- **关键修复（v1）**：之前使用 `@keyframes` + `animation: forwards` + `opacity: 0`，部分浏览器中 `var()` 在 animation 简写里解析失败导致动画不触发，元素永久隐藏 → 改用 Vue `$nextTick` + CSS transition
- **关键修复（标题文字）**：`.home-view__title` 的 `-webkit-text-fill-color: transparent` 继承给子 `.home-char`，但 `background-clip: text` 不继承 → 文字透明不可见。`.home-char` 加 `background: inherit; background-clip: text` 修复
- **入场层次**：
  - 背景层：15 个英文字母从底部浮到顶部（`@keyframes letterFloat`，持续 7-13s）
  - logo：`scale(0) rotate(-20deg)` → `scale(1) rotate(0deg)`，1s 弹跳曲线
  - 标题："词对 PK" 5 个字符逐个 `translateY(60px) scale(0.6)` → 归位，间隔 120ms（`transition-delay` 驱动）
  - 副标题：`translateY(20px)` → 归位，0.6s，delay 1.2s
  - 按钮：4 个按钮 `translateY(24px)` → 归位，0.45s，间隔 140ms
- **`prefers-reduced-motion`**：环境粒子隐藏 + 所有 transition 跳过，元素直接可见

## 数据来源

人教版高中英语 7 册 + 课外词汇 2 单元，共 **5254 词**，从百词斩 app 数据转换。注重数据完整性——缺释义时必须主动告知。
**例句（D5）**：全量 5254 词已带 `example` 字段（AI 生成英文例句，目标词以原形或词形变化出现；短语动词例句可能不含原形——高亮拆分自动回退）。例句配对模式只在 example 存在时显示例句，缺失回退 en 卡面。

## 部署

- 域名：`word-pair-pk.hdilp.top`（Vercel + Cloudflare DNS 中国加速）
- Vercel 项目自动检测 GitHub 变更部署
- 无 GitHub Actions workflow
