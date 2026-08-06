# BLOCKED_WAVE1 — 待裁决清单

## 1. build.py 白名单外修改（需领导确认保留）
任务书「界限」规定 build.py 只读。执行中途用户（领导）直接指示：「先别内联 wav，到 build.py 再说」——
据此修改了 build.py：新增「WAVE1 音效内联」步骤（读 D:\Downloads 三个 wav → base64 注入 js_content 后再进 index.html）。
效果：src/app.js 保持 61KB（占位符 @@DRAG/TAP/FLICK_B64@@），构建产物 index.html 仍全内联（1254KB，含音效）。
若 wav 不存在 → 保留占位符 → 播放静音降级（不报错）。**若领导不想改 build.py，可回退为 src/app.js 直接内联（占位符替换脚本在 probe 目录）**。

## 2. 每日挑战也抽随机事件卡（推断）
任务书任务 6 说「PK/单人开局必抽 1 个公平事件（复习模式不触发）」。每日挑战是单人变体，
我选择让它同样抽事件（startDailyChallenge 内调 pickEvent）。若领导认为每日挑战应保持纯净，删除该行即可。

## 3. 每日挑战错词也进复习盒子（推断）
每日挑战复用 startGame 单人骨架 → endGame single 分支的 updateReviewBoxes 照常执行。
任务书任务 5 未提及复习同步；我认为合理（错词自动进复习是学习闭环），若领导想排除，加 dailyMode 判断。

## 4. 探针 F 的「事件池集齐」断言
任务书反向验证描述「把事件三选一改成只出 fog → FAIL」。由于随机三局全同概率 1/9，
直接断言「3 局事件不同」会假红，改为「最多 20 局集齐 3 种事件」断言（正常 ≈99.97% 通过，只出 fog 必然 FAIL）。

## 5. 双 90° 弧扫动路径的几何近似
规格「顺时针旋转 30° 后停止 + 整体逆时针偏 30°」存在歧义，采用自洽近似（详见 PROGRESS_WAVE1.md 决策记录）。
