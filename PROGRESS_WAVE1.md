# PROGRESS_WAVE1 — 手感+仪式+学习闭环（Phigros 特效/Combo/倒计时/错词雷达/每日挑战/事件卡）

## 理解（任务 0 核对后）
- 目标：6 大特性全部离线内联单文件；核心玩法零回归（配对/双人计时/倒计时/排行榜/复习盒子/TTS/多点触摸/侧滑返回）
- 顺序：任务1 特效+音效器（地基）→ 2 Combo → 3 倒计时+配对音 → 4 双人错词+弱点雷达 → 5 每日挑战 → 6 事件卡 → build + 探针 A-F 全绿
- 基线实测（2026-08-06）：app.js 1159 行 / style.css 2188 行 / html 30650B；git status = M vercel.json + ?? docs/（非我改动）；build.py 正常（5254 词）；node v20.20.0 + puppeteer-core（tts-probe）；三 wav 存在
- z-index 实测：countdown-overlay=100 / result-overlay=200 / review-popup-overlay=200 / app-footer=50 → fx-layer=60、event-banner=90
- 最大风险：① base64 内联方式与构建；② pointerdown 与 touch→click 链互不干扰；③ 双人错词合并兼容旧盒子结构；④ 探针触屏模拟

## 执行日志

### 2026-08-06 任务 0 ✅
- 数字全核对通过；build.py 跑通；wav→base64 完成（drag 128536 / tap 23096 / flick 91724 字符）

### 2026-08-06 任务 1 ✅ Phigros 点击特效
- 6 元素 + 8-12 粒子全实现；三色（黄/蓝/红）；EaseOutCubic；260ms 主动画 + 280ms 起 300ms 淡出 + 600ms 移除 DOM
- 触发条件严格：game+playing+无 result/popup 或 reviewGame+无 popup/processing；reduced-motion 双保险（JS+CSS）
- 音效：drag/tap/flick base64，先声后视，独立 Audio 实例可重叠
- **用户中途指示**：wav 内联从 src/app.js 挪到 build.py（build.py 白名单外修改，用户授权，见 BLOCKED #1）
- 探针 A：全绿；反向（注释 pointerdown 监听）红 7 项 → 还原全绿

### 2026-08-06 任务 2 ✅ 连击 Combo
- p1/p2/single/review 四路独立；成功 +1（tap 音量 1+N*0.05 封顶 1.5，≥5 叠加 flick）；失败/点已匹配卡清零 + 断连显示 900ms + flick 0.6；开新局归零
- combo 大字：渐变金字 + comboPop 弹性缩放；断连红字；位置 game-side__header 下（absolute 不挤压卡片）
- 探针 B：全绿；反向（注释 combo+1）红 2 项 → 还原全绿

### 2026-08-06 任务 3 ✅ 3-2-1 倒计时 + 配对音
- startCountdown：ready 800ms → 3/2/1 各 600ms（渐变金字 + readyBounce 弹入 + drag tick 音量 0.4）→ GO 450ms → playing（总 3050ms）
- 配对音效：成功 tap（连击增益）、失败 flick 0.6（任务 2 实现）；复习模式倒计时不变
- 探针 A/B 等待时间 2400→3400ms 同步更新；探针 C：全绿（序列 3→2→1→GO + playing 后配对正常）

### 2026-08-06 任务 4 ✅ 双人错词入库 + 弱点雷达
- p1Errors/p2Errors 各自记录；endGame dual 合并（同词次数相加）→ updateReviewBoxes（有错 box=1）；全对词正常升盒
- gameResultPopup 弹层：胜负+用时+Top3（次数降序、并列字母序）+「已加入今日复习」；全对显示「零失误，完美局」；关闭后走原 saveResult
- 单人流程零改动（只新增 dailyMode 检测，见任务 5）；goHome/goSelect 清 popup
- 探针 D：全绿；反向（注释 dual 错词记录）红 4 项 → 还原全绿

### 2026-08-06 任务 5 ✅ 每日挑战
- 首页 daily-card 入口（状态：未完成 / ✓ 已完成+最快+连续天数）；dailySeedHash 字符码求和 % 单元总数选单元；LCG 种子洗牌取 8 词
- 完成写 wordpair_daily_challenge + log 去重；重复进入 alert 提示不重置；computeDailyStreak 连续天数
- 探针 E：全绿（种子稳定、done、log 去重、重复进入不重置）

### 2026-08-06 任务 6 ✅ 随机事件卡
- fog（2.5s 半透明 opacity .3 → fog-fade 渐显 1.5s → 移除）/ reshuffle（5s 后未匹配卡洗牌，matched 不动）/ mirror（card-text rotate 180° 整局）
- 开局必抽 1 个（startGame + startDailyChallenge），复习不触发；banner 2s 渐变弹入；定时器自我清理 + 下局 pickEvent 兜底清理
- 探针 F：全绿；反向（事件池只出 fog）「集齐」FAIL → 还原全绿

### 收尾 ✅
- build 最终产物 index.html 1254KB（fx-layer 6 / combo-banner 17 / event-banner 8 / daily 19 / gameResultPopup+radar 15 处）
- 关键函数 grep 断言：speakWord 3 / handleBoardTouch 2 / updateReviewBoxes 5 / processCardClick 3 / startCountdown 3
- 全量探针 A-F 复跑全绿（贴输出）；行数：app.js 1608 ≥1159、style.css 2537 ≥2188
- git status：白名单 3 文件 + build.py（用户授权）+ 构建产物 + PROGRESS/BLOCKED；无 probe 文件入仓库

## 与任务书有出入的决策（都记了理由）
- fx-layer z-index=60（卡片无显式层叠，倒计时 100、弹窗 200）；event-banner=90
- 双 90° 弧：SVG circle+dasharray 单元素闭合；扫动路径按「弧1 -105°→-75°（=东北逆时针30°）、弧2 105°→135°」自洽实现（规格文本有歧义）；r=66 中线半径
- 旋转方框初始线宽 37.3px（=初始边长 52.8/√2 内切正方形边长，符合规格）；终态 3px
- 特效清理时间线：280ms 加 fade → 580ms 淡出完成 → 600ms 移除（满足探针 A「700ms 无残留」）
- 探针 F 集齐断言（20 局）替代「3 局各不相同」（避免 1/9 随机假红，反向仍然必红）
- 每日挑战抽事件卡 + 错词同步复习（见 BLOCKED #2/#3）
- build.py 内联音效（用户指示，见 BLOCKED #1）
