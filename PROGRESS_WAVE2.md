# PROGRESS_WAVE2 — 词对PK 第二波执行日志

## 理解的目标 / 顺序 / 最大风险（2026-08-07 动工前）

- 目标：五特性（抢答PK / 心形生命值 / 听力挑战 / 单词图鉴 / PWA），全按拍板执行，探针 G-K 全绿，零回归
- 顺序：任务1 抢答 → 任务2 心形 → 任务3 听力 → 任务4 图鉴 → 任务5 PWA → 收尾全量复跑
- 最大风险：① rush 状态机归属语义（谁完成配对归谁，抢牌场景）——反向验证兜底；② 探针必须测构建产物，改 src 忘 rebuild 会假绿；③ 心形 0 心提前结束与 8 对配完互斥；④ PWA 离线测试污染 SW 状态，K 最后跑且测完清理

## 任务 0：现状核对（2026-08-07）

- git status 干净，HEAD=2982086 ✅
- 行数：src/app.js=1616、src/style.css=2583、word-pair-pk.html=671 ✅
- `python3 build.py` 成功：5254 词内联，index.html 1257KB，version.json revision=20260807194005 ✅
- 探针环境：NODE_PATH=C:/Users/Dong/tts-probe/node_modules（puppeteer-core 在）✅
- `python3 -m http.server 8000` 正常，http://127.0.0.1:8000/index.html 200 ✅
- 探针参考：probe_f.js 模式（openRound 进局、_vnode.component.proxy 读状态、el.click + mouse.click 区分）

## 任务 1：抢答 PK（gameMode='rush'）

- 2026-08-07 完成：data 加 rushSelected/rushOwner；handleClick/handleBoardTouchEnd 分流到新 processRushClick；startTimers rush 也起 p2Timer；endGame 加 rush 结算（得分多者胜，平分比用时）；模板 dual 布局条件放宽到 rush，P2 网格渲染同一公共池 p1Cards，侧栏标签"抢答 P1/P2"，再来一局回 rush
- 布局决策（为什么）：双 .game-side 各渲染同一公共池数组（不是物理单网格）——side='p2' 必须从 P2 侧 DOM 产生（触摸 closest('.game-side') + 桌面点击），否则 P2 玩家没有操作入口；牌面/状态仍全局唯一（同一数组 + 全局 rushSelected），状态机语义一字不差
- 探针 G 全绿 14 项；反向验证（归属=先选者）场景 2b FAIL（p1=1,p2=1）→ 还原全绿
- 已 build（index.html 1263KB）

## 任务 2：心形生命值（single + listen）

- 2026-08-07 单人侧完成：data 加 hearts/maxHearts=5；startGame 开局重置；processCardClick 失败分支（single 且非每日挑战）hearts--，0 心复位 selected 后走现有 endGame('p1')（错词先入库再判定，最后一次错词不丢）；模板单人 header 加 ♥×5（灭心灰色），CSS .hearts/.heart/.heart--lost
- 决策（为什么）：每日挑战（gameMode='single' + dailyMode）不扣心不显示——0 心走 endGame 会把未完成的每日挑战 completeDailyChallenge 标记 done，属回归
- 探针 H 全绿 6 项；反向验证（注释 hearts--）"0 心游戏结束" FAIL（hearts=5 未结束）→ 还原全绿
- listen 侧心形在任务 3 接入

## 任务 3：听力挑战（gameMode='listen'）

- 2026-08-07 完成：data 加 listen 状态组；startListenGame/prepareListenRound/listenPick/advanceListen/finishListenGame/rerunListenGame/closeListenPopup；startGame 分流 listen → startListenGame；navigateBack 加 listenGame；模板新增 listenGameView（header 得分/♥/轮次/重听 + 2x2 选项卡 + review-popup 视觉结算弹窗放视图内部）；CSS listen-*；首页加"听力挑战"按钮
- 踩坑：listenGameView 初次插入在 review-game-view 闭合标签之前 → Vue 编译错误 30（v-else-if 非兄弟节点）→ 补闭合 + 删多余闭合修复
- 探针 I 全绿 13 项；反向验证（错误也得分）"得分=7" FAIL（score=8）→ 还原全绿
- 错词进复习盒子 box=1 断言通过（updateReviewBoxes 复用）

## 任务 4：单词图鉴（codex）

- 2026-08-07 完成：data 加 codexSearch/codexStoreVersion/codexExpanded；computed codexData/codexCount/codexTotal/codexGroups（教材分组+搜索过滤+未收集灰显防剧透）；collectWord（wordpair_codex {en,zh,book,unit,date}，已存在不覆盖，book/unit 从 ALL_WORDS_DATA 遍历定位）；四处收集点：processCardClick/rush 成功分支（dualGameWords[pairId]）、processReviewCardClick（卡片 _word 引用）、听力答对分支；模板 codexView（统计栏+进度条+搜索框+分组折叠+发音）+ 复习首页图鉴入口；CSS codex-*；navigateBack 加 codex
- 探针 J 全绿 9 项；反向验证（注释 processCardClick 收集点）"codex 含 2 key" FAIL（codex 空）→ 还原全绿
- 探针细节：局 2 随机抽词命中特定词概率 8/5254≈0.15%——改为开局后替换本局 dualGameWords[0]/卡文本为目标词（仍走真实 processCardClick→collectWord 链路）；"重复不覆盖"用把 date 改成 2020-01-01 再配对验证

## 任务 5：PWA 离线安装

- 2026-08-07/08 完成：manifest.json（name/short_name/start_url/standalone/theme_color #ffaab2/background_color #fff5f6/icons 192+512）；图标用 icon_template.html（粉蓝渐变圆角+白"词"，相对单位 vw 自适应）+ puppeteer viewport 512/192 各截一张 → assets/icons/（真实 PNG，IHDR 尺寸验证过）；sw.js 静态文件（install 预缓存 5 资源 + network-first 核心文档 + cache-first 其余 + activate 清旧缓存 + skipWaiting/clients.claim）；模板 head 加 manifest link + theme-color meta + favicon；app.js mounted 注册（_isLocal 不注册，失败静默）
- 探针 K 全绿 19 项（含反向验证），关键踩坑：
  1. Chromium 的 CDP offline 模拟（setOfflineMode / Network.emulateNetworkConditions）对 127.0.0.1 loopback 完全无效（实测 fetch 新 URL 照样成功）——真离线 = 探针内 netstat 找 8000 PID + taskkill 杀 server，测完 spawn 重启
  2. 反向白屏"假绿"两连坑：① Chrome HTTP 磁盘缓存命中离线导航（clearBrowserCache 可解）；② **清 caches 的时机**——unregister+清 caches 在 reload 之前，而 reload（在线）期间 SW 的 network-first 分支 cache.put 又把 index.html 写回缓存，导致离线时 caches.match 命中不白屏 → 必须在 stopServer 之后再清一次 caches
  3. 探针异常退出会残留 REVERSE 版 sw.js 且下次启动读到的"原始"是坏版 → 探针开头加 recover（含 // REVERSE 则还原）
  4. 离线 reload 白屏后页面停在 chrome-error:// 上下文（navigator.serviceWorker undefined）→ 还原流程先 page.goto 回正常页
- sw.js 还原干净（REVERSE 0 处），测试结束 unregister 全部 SW + caches 清空

## 收尾（2026-08-08）

- `python3 build.py` 成功（index.html 1287KB）；grep 新特性标记：rush 28 / listen 71 / codex 65 / manifest 1 / serviceWorker 2 / listenGame 6 / 抢答 9 / 听力挑战 9 / 单词图鉴 11 ✅
- 全量探针 G→H→I→J→K 复跑：G 全绿 14 / H 全绿 6 / I 全绿 13 / J 全绿 9 / K 全绿 19 ✅（K 最后跑，跑完 SW 已清理）
- 完成条件约束：git status 白名单外无改动（.hermes-tmp 残留已删）；src/app.js 1990 行 ≥1616、src/style.css 2824 行 ≥2583（只增不减）；关键函数 speakWord/handleBoardTouch/updateReviewBoxes/processCardClick/startCountdown/processReviewCardClick/toggleFx grep 全在 ✅
- 反向验证证据（红→绿）全部贴过：G 归属=先选者 FAIL→绿；H 注释扣心 FAIL→绿；I 错误也得分 FAIL→绿；J 注释收集点 FAIL→绿；K 空缓存离线白屏（chrome-error 页）→还原全绿

## BLOCKED_WAVE2.md

- 无（见文件：写"无"）
