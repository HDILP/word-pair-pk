# 词对 PK (word-pair-pk)

英语单词配对双人 PK 游戏，三文件源码（HTML 模板 + src/style.css + src/app.js），build.py 内联合并为单 HTML 部署。

## 项目结构

```
src/
  style.css         ← 全部 CSS（44KB）
  app.js            ← Vue 3 应用代码（35KB）
word-pair-pk.html   ← HTML 模板（引入 src/ 中的 CSS/JS）
index.html           ← 构建产物（build.py 生成，CSS/JS/词库全内联，部署用）
build.py             ← 构建脚本：内联 src/* → 注入词库数据 + 版本号 → index.html
version.json         ← 构建产物（build.py 生成，更新提醒用）
words/               ← 词库目录
  必修一/              ← 教材目录
    Welcome Unit.json
    ...
vercel.json          ← Vercel 部署配置
```

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
5. 注入构建版本号 → 输出 `index.html` + `version.json`

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
- **LocalStorage** → 排行榜（`wordpair_leaderboard`）、复习系统（`wordpair_review`）、个人最佳（`wordpair_pb`）
- **Vercel** → 自动部署，中国加速

## 应用架构

### 视图切换

所有视图通过 `currentView` 控制，`v-if`/`v-else-if` 切换：

- `home` — 首页（开始 PK / 单人挑战 / 单词复习 / 排行榜）
- `select` — 选词视图（树形选择教材→单元）
- `game` — 双人/单人游戏（含倒计时、配对逻辑）
- `review` — 复习首页（自由练习 / 今日复习 / 错题特训）
- `reviewGame` — 复习配对游戏
- `leaderboard` — 排行榜

### 游戏模式

1. **双人 PK（dual）**：同屏分边，P1/P2 各自计时，竞速
2. **单人挑战（single）**：计时，结束后同步复习系统
3. **自由练习（free）**：选词范围后不计时配对
4. **今日复习（due）**：利特纳盒子复习算法
5. **错题特训（hard）**：只练盒子 1 的顽固错词

### 配对逻辑

- 每局固定 8 对（16 张卡片：8 en + 8 zh），但复习游戏根据可用词数动态调整（`reviewCardPairCount`）
- 点击/触摸先选一张，再选另一张，类型不同且 ID 相同 → 配对成功
- 配对成功：高亮 + TTS 朗读英文
- 配对失败：闪红 300ms
- 双人模式各自独立匹配集

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

- 触摸事件在 `.game-board` 父级处理（而非每个 `.card-grid`），支持双人同时点击
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
- `font-size` 使用 `clamp(13px, 2.5vw, 17px)` 根据屏幕宽度自动调整

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

### 复习系统（利特纳盒子）

- 存储键：`wordpair_review`
- 盒子 1~5，间隔天数 `[0, 1, 2, 4, 8, 16]`
- 配对正确 → box 递增，配对错误 → 回盒子 1
- 单人模式完成后自动同步到复习系统
- `reviewStoreVersion` 计数器确保 `localStorage` 变化能触发 Vue computed 重新计算（`void this.reviewStoreVersion`）
- 低时渲染的 `reviewData` / `reviewBox1Count` / `reviewDueToday` 为 computed 属性

### 复盘弹窗（复习模式结束）

- 弹窗使用 `v-if="reviewPopup"` 渲染，**必须放在 `reviewGameView` 视图 div 内部**（不在 `<Transition>` 的直接子级）
- 历史 bug：弹窗原在 `<Transition>` 内作为独立 `v-if` → 当 `currentView === 'reviewGame'` 且 `reviewPopup` 为 true 时，Vue `<Transition>` 同时有两个子元素，弹窗不渲染
- 修复：将弹窗移入 `reviewGameView` 内部 ✅

### 页脚与构建版本号

- 页面底部 `.app-footer` 显示构建版本号（`position: fixed; bottom: 0`）
- 正常状态：淡灰等宽字体显示版本号（`20260620153454`），点击弹详情
- 有更新时：粉色更新条「📦 新版本 xxx 可用 · 点击更新」
- `↓` 按钮：下载最新版（详见下方）

### 更新检测 + 离线版下载

`build.py` 生成 `version.js`（部署在 Vercel 上）：
- `window.__remoteRevision` — 当前构建版本号
- `window.__downloadLatest()` — fetch `/index.html` 并触发浏览器下载（同源请求，无 CORS）

**检查流程：**
1. `mounted()` 中读取本地 `<meta name="build-revision">` 得到 `buildVersion`
2. `file://` 本地版：动态加载远程 `version.js`，对比 `__remoteRevision`，不一致则显示粉色更新条
3. 在线 Vercel 版：页面永远最新，跳过更新检测
4. 点击更新条 / `↓` 按钮：调用 `__downloadLatest()`（已加载过一次，直接复用）

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

人教版高中英语 7 册，共 2373 词，从百词斩 app 数据转换。注重数据完整性——缺释义时必须主动告知。

## 部署

- 域名：`word-pair-pk.hdilp.top`（Vercel + Cloudflare DNS 中国加速）
- Vercel 项目自动检测 GitHub 变更部署
- 无 GitHub Actions workflow
