# PROGRESS_TTS.md — TTS 修复执行进度

## 任务 0.3：理解的目标／顺序／最大风险

- 目标：配对朗读不再 cancel 后永久哑、打断后下个词照常出声、预热只一次
- 顺序：①统一 speakWord()（空闲直说/忙时150ms打断/token防排队/2.5s看门狗自愈）②替换两处内联段 ③warmup 模块级标志+删多余调用 ④build+探针回归 ⑤反向验证×2 ⑥commit
- 最大风险：看门狗与旧 utterance 事件互踩（cancel 后旧 onend 误清新看门狗）→ 用 token+generation 双校验隔离
- 优先级：出声 > 打断即时性 > 代码优雅

## 执行日志

### 2026-08-04 任务 0 核对
- git status --short 干净 ✓
- speechSynthesis.cancel() 2 处 ✓（410 复习配对 / 796 游戏配对）
- warmupTTS() 调用实际 4 处（任务书说 3 处）：
  230 startReviewGame() ← 任务书遗漏，同样删除（死规矩「只保留首次 pointerdown」）
  625 startGame()
  1047 pointerdown { once:true } ← 保留
  1049 mounted()

### 2026-08-04 任务 1 完成
- 新增 speakWord(text) 方法（warmupTTS 同级），四逻辑：
  1. 空闲直说：speaking/pending 均 false → 直接 speak，不 cancel
  2. 忙时打断：cancel() + setTimeout 150ms 后 speak
  3. token 防排队：this._speakToken 递增，延时回调/看门狗回调先校验 token，过期即弃
  4. 看门狗：speak 后 2.5s 无 onstart/onend/onerror → cancel()+resume() 同 token 重试一次；再卡死给 console.warn 放弃（实现位置：speakWord 内 doSpeak，触发条件见下）
- 双保险：utterance 事件（fire）与看门狗按 generation 校验（_ttsWatchdogGen），防止被 cancel 的旧 utterance 的迟到 onend 误清新看门狗
- 替换 410-415 复习配对、796-801 游戏配对两处内联段为 this.speakWord(enText)，位置（配对判定后、动画前）、文本取法、lang/rate 不变
- warmupTTS 加模块级 let ttsWarmedUp = false（createApp 外 line 1 上方）：首次调用 speak 'ready' 并置位，后续直接 return
- 删除调用：230、625、1049；保留 1047 pointerdown { once:true }
- 看门狗触发条件（人工审查）：speak 后 2500ms 内该 utterance 无任何事件 → 判引擎疑似死锁 → cancel()+resume() 同 token 重试；重试 2500ms 仍无事件 → console.warn('[TTS] watchdog gave up') 不再折腾

### 2026-08-04 任务 2
- build 成功，index.html 版本号更新（最终 20260804210003，反向验证期间多次重建），speakWord 已内联（grep -c = 3：定义+2调用）
- 探针全 PASS（A/B/C）+ EXIT 0，时间线符合设计（见下）
- 反向 1：空闲分支临时改坏（空闲也 cancel）→ 断言 B FAIL（配对0前 cancel 1 次，EXIT=1）→ 还原 → 全绿
- 反向 2：去掉 warmup 去重标志 + 恢复 mounted 调用（还原「每次调用都 speak」）→ 断言 A FAIL（实测 2 条 ready，EXIT=1）→ 还原 → 全绿
- 依赖：npm i puppeteer-core（--registry=https://registry.npmmirror.com），装在 ~/tts-probe（仓库外）
- commit：见 git log

### 探针典型时间线（修复后全绿轮）
ready ×1（pointerdown 预热）→ pair0 空闲直说（无 cancel）→ pair1 忙时 cancel+onerror interrupted+150ms 后 speak 正常 onstart → pair2 引擎已空闲又走直说路径。三词全部有 onstart，引擎从未死锁。

## 与任务书有出入的决策
- warmupTTS 第 4 处调用（startReviewGame:230）任务书未列：按死规矩「只保留首次 pointerdown 那次」删除，特此记录
- 看门狗「第二次也卡死不再折腾」：无法 headless 复现死锁，未做反向验证（任务书明示允许），实现位置与触发条件已写上方，供人工审查
