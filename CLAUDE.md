# 词对 PK (word-pair-pk)

英语单词配对双人 PK 游戏，单 HTML 文件，教室一体机 / 手机浏览器均可运行。

## 项目结构

```
word-pair-pk.html   ← Vue 3 单文件应用（入口 + 源码）
index.html           ← 构建产物（build.py 生成，部署用）
build.py             ← 构建脚本：words/ → index.html
words/               ← 词库目录
  人教版高中英语必修一/    ← 教材目录
    Welcome Unit.json
    Unit 1 Teenage Life.json
    ...
vercel.json          ← Vercel 部署配置
```

## 构建

```bash
python3 build.py              # 从 word-pair-pk.html 生成 index.html
python3 build.py output.html  # 自定义输出文件名
```

词库目录结构要求：
```
words/<教材名>/<单元名>.json
```
JSON 格式：`{ "name": "单元名", "words": [{"en": "...", "zh": "..."}, ...] }`

推送到 GitHub 后 Vercel 自动部署（无 GitHub Actions）。

## 技术栈

- **Vue 3**（CDN，Options API）→ 全局数据、methods、computed
- **纯 CSS** → 暖白底 + 樱花粉 #ffaab2 + 淡蓝 #A5D8FF
  - 2026-06-20 视觉改版：完整设计系统（12色变体、5级阴影、5条定制动画曲线）、毛玻璃卡片、渐变按钮、视图过渡、卡片错位入场、配对光晕动画
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

## 数据来源

人教版高中英语 7 册，共 2373 词，从百词斩 app 数据转换。注重数据完整性——缺释义时必须主动告知。

## 部署

- 域名：`word-pair-pk.hdilp.top`（Vercel + Cloudflare DNS 中国加速）
- Vercel 项目自动检测 GitHub 变更部署
- 无 GitHub Actions workflow
