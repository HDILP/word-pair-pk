    const { createApp, ref, computed, watch, onMounted, onUnmounted, nextTick } = Vue;

    // 模块级 TTS 预热标志：整个页面生命周期只 speak 一次 'ready'
    let ttsWarmedUp = false;

    // ===== Phigros 打击特效（WAVE1）=====
    // 三个真实 wav 转 base64 内联（构建时由脚本替换占位符），零网络请求
    const PHIGROS_SFX = {
      drag: 'data:audio/wav;base64,@@DRAG_B64@@',
      tap: 'data:audio/wav;base64,@@TAP_B64@@',
      flick: 'data:audio/wav;base64,@@FLICK_B64@@',
    };
    // 三色常量（无白色，全局默认黄）
    const FX_COLORS = { yellow: '#FFD84D', blue: '#4D9DFF', red: '#FF5A5A' };
    // 特效实例队列（并发上限 6，超出丢最旧）
    const fxQueue = [];
    // 全局 reduced-motion 偏好（模块级惰性求值）
    let fxReducedMotion = false;
    try {
      fxReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch(e) {}
    // EaseOutCubic 缓动曲线（规格硬参数）
    const FX_EASE = 'cubic-bezier(0.215, 0.61, 0.355, 1)';

    createApp({
      data() {
        return {
          // 视图状态
          currentView: 'home',
          gameMode: 'dual', // 'dual' | 'single' | 'rush' | 'listen'
          singlePlayerPb: null,

          // 词表
          books: [],

          // 游戏状态
          countdownState: 3, // 3 | 2 | 1 | 'go' | 'playing'
          p1Cards: [],
          p2Cards: [],
          p1Selected: null,
          p2Selected: null,
          // 抢答（WAVE2）：全局唯一"悬空选中" + 选中者
          rushSelected: null,
          rushOwner: null,
          // 心形生命值（WAVE2）：单人挑战 + 听力挑战，开局 5 颗，配对/答错 -1
          hearts: 5,
          maxHearts: 5,
          // 听力挑战（WAVE2）
          listenWords: [], // 本局 8 个词 {en, zh, ...}
          listenIndex: 0, // 当前轮次 0-7
          listenScore: 0,
          listenOptions: [], // 当前轮 4 个中文选项 {text, pairId, correct}
          listenWrong: [], // 错词 [{en, zh}]
          listenFinished: false,
          listenPopup: null,
          // 例句配对（D5）：8 对 = 英文例句卡（example 目标词高亮）+ 中文释义卡
          sentenceWords: [], // 本局 8 词 {en, zh, example}
          sentenceCards: [], // 16 卡：8 例句(en) + 8 释义(zh)，id 格式 s-en-N / s-zh-N
          sentenceSelected: null,
          sentenceMatchSet: new Set(),
          sentenceProcessing: false,
          sentenceCombo: 0,
          comboBreakSentence: false,
          sentenceErrors: {}, // { en: 次数 }（按词 key，复习盒子/复盘用）
          sentenceCardPairCount: 8,
          sentenceTime: 0,
          sentencePopup: null,
          sentenceFinished: false,
          sentenceTouchProcessed: false, // 防止 touchend+click 重复触发
          // 选词视图模式选择（D5）
          selectModes: [
            { key: 'dual', label: '双人 PK' },
            { key: 'single', label: '单人挑战' },
            { key: 'rush', label: '抢答 PK' },
            { key: 'sentence', label: '例句配对' },
            { key: 'listen', label: '听力挑战' },
          ],
          // 单词图鉴（WAVE2）：wordpair_codex，配对成功自动收集
          codexSearch: '',
          codexStoreVersion: 0, // 触发 codex computed 重新计算
          codexExpanded: {}, // { bookName: true } 教材分组折叠
          p1Matched: 0,
          p2Matched: 0,
          p1Time: 0,
          p2Time: 0,
          p1Timer: null,
          p2Timer: null,
          p1Counted: false,
          p2Counted: false,
          gameResult: null,
          gameOverInternal: false,
          // 弱点雷达（WAVE1）：双人结算弹层数据，关闭后走原 saveResult
          gameResultPopup: null,
          // 双人 PK 各自错词（WAVE1）：{ enText: 次数 }
          p1Errors: {},
          p2Errors: {},

          // 连击（WAVE1）：PK 双人独立 / 单人 / 复习各自一个
          p1Combo: 0,
          p2Combo: 0,
          singleCombo: 0,
          reviewCombo: 0,
          comboBreakP1: false,
          comboBreakP2: false,
          comboBreakReview: false,

          // 结算
          winnerName: '',

          // 排行榜
          leaderboard: [],

          // token 防止重复触发
          _processingClick: { p1: false, p2: false },
          _p1MatchSet: new Set(),
          _p2MatchSet: new Set(),
          _touchMap: {}, // 多点触控：{ [identifier]: { cardId, side } }

          // ===== 复习系统 =====
          pendingReview: false, // 是否从复习页进入选词视图
          reviewStoreVersion: 0, // 用于触发 review 相关的 computed 重新计算
          reviewMode: null, // 'free' | 'due' | 'hard'
          reviewCards: [],
          reviewSelected: null,
          reviewMatchSet: new Set(),
          reviewProcessing: false,
          reviewPopup: null,
          reviewGameWords: [], // 本局 8 个原始词对象 {en, zh, errors}
          reviewGameErrors: {}, // { cardId: count } — 每张卡片的失误次数
          reviewCardPairCount: 8, // 本局实际配对数量（错题特训可能 < 8）
          reviewTouchProcessed: false, // 防止 touchend+click 重复触发
          singleGameWords: [], // 单人模式下抽到的 8 个词
          // 版本戳
          buildVersion: '',
          remoteVersion: null,
          updateAvailable: false,
          versionJsLoaded: false,
          // 首屏入场动画
          homeReady: false,
          // 玩法说明弹层
          helpVisible: false,
          // 打击特效开关（localStorage wordpair_fx 持久化，默认开）
          fxEnabled: true,
          // 每日挑战（WAVE1）
          dailyMode: false,
          dailyPick: null,
          dailyChallengeDone: false,
          dailyChallengeBest: null,
          dailyStreak: 0,
          // 随机事件卡（WAVE1）：fog / reshuffle；banner 独立显示 2s
          currentEvent: null, // 当前生效的事件效果（fog 推迟到 playing 才生效）
          eventBannerName: null, // banner 显示的事件名（fog/reshuffle），不受效果推迟影响
          eventBannerVisible: false,
          // 边缘滑动手势检测
          _edgeSwipeX: null,
          _edgeSwipeY: null,
        };
      },

      computed: {
        selectedWordCount() {
          let count = 0;
          for (const b of this.books) {
            for (const u of (b.units || [])) {
              if (u._checked) count += (u.words || []).length;
            }
          }
          return count;
        },
        maxRounds() {
          return Math.floor(this.selectedWordCount / 8);
        },
        p1MatchedCount() { return this._p1MatchSet.size; },
        p2MatchedCount() { return this._p2MatchSet.size; },

        // ===== 复习系统 computed =====
        reviewMatchedCount() { return this.reviewMatchSet.size; },
        sentenceMatchedCount() { return this.sentenceMatchSet.size; },
        reviewModeLabel() {
          const labels = { free: '自由练习', due: '今日复习', hard: '错题特训' };
          return labels[this.reviewMode] || '复习';
        },
        reviewData() {
          // 用 reviewStoreVersion 触发重新计算（localStorage 非响应式）
          void this.reviewStoreVersion;
          try {
            return JSON.parse(localStorage.getItem('wordpair_review') || '{}');
          } catch(e) { return {}; }
        },
        reviewTotalWords() {
          return Object.keys(this.reviewData).length;
        },
        reviewDueToday() {
          const data = this.reviewData;
          const today = new Date().toISOString().slice(0, 10);
          const intervals = [0, 1, 2, 4, 8, 16];
          let count = 0;
          for (const key in data) {
            const entry = data[key];
            const box = entry.box || 1;
            const last = entry.lastReview || '2000-01-01';
            const daysSince = Math.floor((new Date(today) - new Date(last)) / 86400000);
            if (daysSince >= intervals[box]) count++;
          }
          return count;
        },
        reviewBox1Count() {
          const data = this.reviewData;
          let count = 0;
          for (const key in data) {
            if ((data[key].box || 1) === 1) count++;
          }
          return count;
        },

        // ===== 单词图鉴（WAVE2）computed =====
        codexData() {
          // 用 codexStoreVersion 触发重新计算（localStorage 非响应式）
          void this.codexStoreVersion;
          try {
            return JSON.parse(localStorage.getItem('wordpair_codex') || '{}');
          } catch(e) { return {}; }
        },
        codexCount() {
          return Object.keys(this.codexData).length;
        },
        codexTotal() {
          // 统计总数 = ALL_WORDS_DATA 全部词数（构建注入，约 5254）
          let n = 0;
          for (const b of ALL_WORDS_DATA.books) {
            for (const u of (b.units || [])) n += (u.words || []).length;
          }
          return n;
        },
        // 按教材分组（全部词，已收集带标记；未收集灰色占位不显示释义防剧透）；支持搜索过滤
        codexGroups() {
          const data = this.codexData;
          const q = (this.codexSearch || '').trim().toLowerCase();
          const groups = [];
          for (const b of ALL_WORDS_DATA.books) {
            const words = [];
            let collected = 0;
            let total = 0;
            for (const u of (b.units || [])) {
              for (const w of (u.words || [])) {
                total++;
                const key = this.getWordKey(w);
                const entry = data[key];
                if (entry) collected++;
                if (!q || key.indexOf(q) !== -1 || (w.zh || '').toLowerCase().indexOf(q) !== -1) {
                  words.push({ key, en: w.en, zh: w.zh || '', collected: !!entry, date: entry ? entry.date : null });
                }
              }
            }
            if (!words.length) continue;
            groups.push({ name: b.name, total, collected, words });
          }
          return groups;
        },
      },

      methods: {
        // ===== Phigros 打击特效（WAVE1）=====
        // 触发条件（死规矩）：仅游戏对局内；游戏外一律不创建不发声
        canSpawnFx() {
          if (this.currentView === 'game') {
            return this.countdownState === 'playing' && !this.gameResult && !this.gameResultPopup;
          }
          if (this.currentView === 'reviewGame') {
            return !this.reviewPopup && !this.reviewProcessing;
          }
          if (this.currentView === 'sentenceGame') {
            return !this.sentencePopup && !this.sentenceProcessing;
          }
          return false;
        },
        // 打击特效开关：持久化到 localStorage（'0'=关，其余=开）
        toggleFx() {
          this.fxEnabled = !this.fxEnabled;
          try { localStorage.setItem('wordpair_fx', this.fxEnabled ? '1' : '0'); } catch(e) {}
        },
        // 颜色判定：Off 模式（复习）恒黄 > 右键蓝/其他键红（保留按键规格）> 左键/触摸/笔按连击变色
        // 连击变色：0-2 黄 / 3-5 蓝 / 6+ 红（Phigros 连击升温感）
        fxColorFromEvent(event) {
          if (this.currentView === 'reviewGame' || this.currentView === 'sentenceGame') return 'yellow';
          if (event.button === 2) return 'blue';
          if (event.button !== 0) return 'red';
          const combo = this.comboAtPoint(event.clientX, event.clientY);
          if (combo >= 6) return 'red';
          if (combo >= 3) return 'blue';
          return 'yellow';
        },
        // 点击位置所属玩家的当前连击数（双人分边，单人取 singleCombo）
        comboAtPoint(x, y) {
          if (this.currentView === 'reviewGame') return this.reviewCombo || 0;
          if (this.currentView === 'sentenceGame') return this.sentenceCombo || 0;
          const el = document.elementFromPoint(x, y);
          if (!el) return 0;
          const sideEl = el.closest('.game-side');
          const side = sideEl && sideEl.classList.contains('game-side--p2') ? 'p2' : 'p1';
          if (side === 'p2') return this.p2Combo || 0;
          return this.gameMode === 'single' ? (this.singleCombo || 0) : (this.p1Combo || 0);
        },
        // 音效：drag(黄) / tap(蓝) / flick(红)；独立 Audio 实例可重叠；失败静音降级
        playSfx(key, volume) {
          try {
            const a = new Audio(PHIGROS_SFX[key]);
            a.volume = volume || 1;
            a.play().catch(() => {});
          } catch(e) {}
        },
        // 生成 6 元素打击特效 + 粒子（声先到：调用方先 playSfx 再进这里）
        spawnHitFx(x, y, colorKey) {
          // 并发上限 6：超出丢最旧
          while (fxQueue.length >= 6) {
            const old = fxQueue.shift();
            clearTimeout(old.timer);
            if (old.el.parentNode) old.el.parentNode.removeChild(old.el);
          }
          let layer = document.querySelector('.fx-layer');
          if (!layer) {
            layer = document.createElement('div');
            layer.className = 'fx-layer';
            document.body.appendChild(layer);
          }
          const hit = document.createElement('div');
          hit.className = 'fx-hit fx-hit--' + colorKey;
          hit.style.left = x + 'px';
          hit.style.top = y + 'px';

          // 1 主方框（border 单元素，四边严密闭合，线宽不变）
          const sq = document.createElement('div');
          sq.className = 'fx-sq';
          // 2 旋转 45° 方框
          const sqRot = document.createElement('div');
          sqRot.className = 'fx-sq-rot';
          // 3 收缩实心圆
          const cShrink = document.createElement('div');
          cShrink.className = 'fx-circle-shrink';
          // 4 扩张半透明圆
          const cGrow = document.createElement('div');
          cGrow.className = 'fx-circle-grow';
          // 5 双 90° 圆弧（SVG circle dasharray，单元素闭合弧）
          const ns = 'http://www.w3.org/2000/svg';
          const mkArc = (cls, anim) => {
            const wrap = document.createElement('div');
            wrap.className = 'fx-arc-wrap ' + cls;
            const svg = document.createElementNS(ns, 'svg');
            svg.setAttribute('class', 'fx-arc');
            svg.setAttribute('viewBox', '0 0 105 105');
            svg.setAttribute('width', '105');
            svg.setAttribute('height', '105');
            const c = document.createElementNS(ns, 'circle');
            c.setAttribute('cx', '52.5');
            c.setAttribute('cy', '52.5');
            c.setAttribute('r', '48');
            c.setAttribute('fill', 'none');
            c.setAttribute('stroke-dasharray', '75.4 226.2');
            svg.appendChild(c);
            wrap.appendChild(svg);
            return wrap;
          };
          hit.appendChild(sq);
          hit.appendChild(sqRot);
          hit.appendChild(cShrink);
          hit.appendChild(cGrow);
          hit.appendChild(mkArc('fx-arc-wrap--1'));
          hit.appendChild(mkArc('fx-arc-wrap--2'));
          // 6 方形粒子 8-12 个：大小/透明度各异，EaseOutCubic 飞散，到位淡出
          const n = 8 + Math.floor(Math.random() * 5);
          for (let i = 0; i < n; i++) {
            const p = document.createElement('div');
            p.className = 'fx-particle';
            const angle = Math.random() * Math.PI * 2;
            const dist = 40 + Math.random() * 47;
            p.style.setProperty('--px', (Math.cos(angle) * dist).toFixed(1) + 'px');
            p.style.setProperty('--py', (Math.sin(angle) * dist).toFixed(1) + 'px');
            p.style.setProperty('--p-size', (3 + Math.random() * 6).toFixed(1) + 'px');
            p.style.setProperty('--p-o', (0.35 + Math.random() * 0.65).toFixed(2));
            hit.appendChild(p);
          }
          layer.appendChild(hit);
          // 主动画 260ms 完成后统一 300ms 淡出（280ms 开始淡 → 580ms 完成 → 600ms 移除 DOM 无残留）
          setTimeout(() => {
            hit.classList.add('fx-hit--fade');
          }, 280);
          const timer2 = setTimeout(() => {
            if (hit.parentNode) hit.parentNode.removeChild(hit);
          }, 600);
          fxQueue.push({ el: hit, timer: timer2 });
        },
        // window pointerdown 入口：游戏内才触发；不 preventDefault / 不 stopPropagation
        handleFxPointerDown(event) {
          if (fxReducedMotion) return;
          if (!this.fxEnabled) return;
          if (!this.canSpawnFx()) return;
          const colorKey = this.fxColorFromEvent(event);
          // 先出声再出视觉（打击感"声先到"）
          const sfxKey = colorKey === 'yellow' ? 'drag' : colorKey === 'blue' ? 'tap' : 'flick';
          this.playSfx(sfxKey, 1);
          this.spawnHitFx(event.clientX, event.clientY, colorKey);
        },

        // ===== TTS =====
        // 统一单词发音：空闲直说 / 忙时 150ms 延时打断 / token 防排队 / 看门狗自愈
        speakWord(text) {
          if (!text) return;
          try {
            // token：每次调用递增，延时/看门狗回调里对比，过期请求一律作废
            const token = (this._speakToken = (this._speakToken || 0) + 1);
            const doSpeak = () => {
              if (token !== this._speakToken) return; // 已被更新的词顶掉
              const utter = new SpeechSynthesisUtterance(text);
              utter.lang = 'en-US';
              utter.rate = 1.5;
              let fired = false;
              const myGen = (this._ttsWatchdogGen = (this._ttsWatchdogGen || 0) + 1);
              // 事件后清看门狗；仅当仍是本轮 generation 时才清，避免被 cancel 的旧 utterance 迟到事件误清新词看门狗
              const clearWatchdog = () => {
                if (fired) return;
                fired = true;
                if (myGen === this._ttsWatchdogGen && this._ttsWatchdog) {
                  clearTimeout(this._ttsWatchdog);
                  this._ttsWatchdog = null;
                }
              };
              utter.addEventListener('start', clearWatchdog);
              utter.addEventListener('end', clearWatchdog);
              utter.addEventListener('error', clearWatchdog);
              // 看门狗：2.5s 无任何事件 → 引擎疑似死锁 → cancel+resume 同 token 重试一次
              this._ttsWatchdog = setTimeout(() => {
                if (token !== this._speakToken) return; // 已过期
                if (fired) return; // 事件其实来过
                if (this._ttsStuckToken === token) {
                  // 第二次也卡死，不再折腾（避免无限重试）
                  this._ttsStuckToken = null;
                  this._ttsWatchdog = null;
                  console.warn('[TTS] watchdog gave up:', text);
                  return;
                }
                this._ttsStuckToken = token;
                this._ttsWatchdog = null;
                this._ttsWatchdogGen = (this._ttsWatchdogGen || 0) + 1; // 作废旧 generation，防迟到事件误清新看门狗
                try { speechSynthesis.cancel(); } catch(e) {}
                try { speechSynthesis.resume(); } catch(e) {}
                doSpeak(); // 同一个 token 重试
              }, 2500);
              try {
                speechSynthesis.speak(utter);
              } catch(e) {
                clearWatchdog();
              }
            };
            // 空闲直说：speaking/pending 均 false → 不 cancel 直接 speak
            if (speechSynthesis.speaking === false && speechSynthesis.pending === false) {
              doSpeak();
            } else {
              // 忙时打断：cancel + 150ms 延时（给引擎恢复时间，Chromium 吞音/死锁规避）
              try { speechSynthesis.cancel(); } catch(e) {}
              setTimeout(doSpeak, 150);
            }
          } catch(e) {}
        },
        // ===== TTS 预热 =====
        warmupTTS() {
          if (ttsWarmedUp) return;
          ttsWarmedUp = true;
          try {
            // 触发语音列表加载
            const voices = speechSynthesis.getVoices();
            // 非零音量 + 明确语言 + 真实语速预热英文语音数据
            const w = new SpeechSynthesisUtterance('ready');
            w.volume = 0.01;
            w.lang = 'en-US';
            w.rate = 1.5;
            // 选择一个英文语音（如果有的话）
            const enVoice = voices.find(v => v.lang && v.lang.startsWith('en'));
            if (enVoice) w.voice = enVoice;
            speechSynthesis.speak(w);
          } catch(e) {}
        },
        // ===== 视图导航 =====
        goHome() {
          this.currentView = 'home';
          this.gameResult = null;
          this.gameResultPopup = null;
          this.gameOverInternal = false;
          this.winnerName = '';
        },
        goSelect(mode) {
          if (mode) this.gameMode = mode;
          this.gameResult = null;
          this.gameResultPopup = null;
          this.gameOverInternal = false;
          this.winnerName = '';
          this.currentView = 'select';
        },
        // 选词视图开始按钮文案（D5：模式选择后按钮随模式变化）
        startGameLabel() {
          const labels = { dual: '开始 PK', single: '开始单人', rush: '开始抢答', sentence: '开始例句配对', listen: '开始听力' };
          return labels[this.gameMode] || '开始';
        },
        // 选词视图模式选择（D5）：切换即清掉复习入口标记（选了模式 = 走常规游戏）
        pickSelectMode(mode) {
          this.pendingReview = false;
          this.gameMode = mode;
        },

        // ===== 每日挑战（WAVE1）=====
        // 日期种子 = 字符码求和；同一天全设备同一批词
        dailySeedHash(dateStr) {
          let sum = 0;
          for (const ch of dateStr) sum += ch.charCodeAt(0);
          return sum;
        },
        // 可复现伪随机（LCG，种子来自日期）
        seededRandom(seed) {
          let s = seed >>> 0;
          return function() {
            s = (s * 1664525 + 1013904223) >>> 0;
            return s / 4294967296;
          };
        },
        todayStr() {
          return new Date().toISOString().slice(0, 10);
        },
        loadDailyChallenge() {
          try { return JSON.parse(localStorage.getItem('wordpair_daily_challenge') || 'null'); } catch(e) { return null; }
        },
        loadDailyLog() {
          try { return JSON.parse(localStorage.getItem('wordpair_daily_log') || '[]'); } catch(e) { return []; }
        },
        // 全局词库按日期种子抽：种子 % 单元总数 → 单元；单元内种子洗牌取 8（与勾选词表无关）
        pickDailyWords() {
          const date = this.todayStr();
          const hash = this.dailySeedHash(date);
          const units = [];
          for (const b of ALL_WORDS_DATA.books) {
            for (const u of (b.units || [])) units.push(u);
          }
          if (!units.length) return null;
          const unit = units[hash % units.length];
          const rng = this.seededRandom(hash + 1);
          const arr = [...(unit.words || [])];
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
          }
          return { unit: unit.name, words: arr.slice(0, Math.min(8, arr.length)) };
        },
        // 连续天数：从今天往前数连续存在于 log 的天数
        computeDailyStreak() {
          const set = new Set(this.loadDailyLog());
          let streak = 0;
          const d = new Date();
          while (true) {
            const key = d.toISOString().slice(0, 10);
            if (set.has(key)) { streak++; d.setDate(d.getDate() - 1); }
            else break;
          }
          return streak;
        },
        refreshDailyChallenge() {
          const saved = this.loadDailyChallenge();
          const today = this.todayStr();
          this.dailyChallengeDone = !!(saved && saved.date === today && saved.done);
          this.dailyChallengeBest = (saved && saved.date === today) ? saved.bestTime : null;
          this.dailyStreak = this.computeDailyStreak();
        },
        // 今日挑战入口：已完成 → 提示最快时间不重置；未完成 → 复用单人骨架开局
        startDailyChallenge() {
          const today = this.todayStr();
          const saved = this.loadDailyChallenge();
          if (saved && saved.date === today && saved.done) {
            alert('今日已完成，最快 ' + this.formatTime(saved.bestTime));
            return;
          }
          const pick = this.pickDailyWords();
          if (!pick || pick.words.length < 8) {
            alert('今日词库不足 8 词');
            return;
          }
          this.dailyMode = true;
          this.dailyPick = pick;
          this.gameMode = 'single';
          const chosen = pick.words;
          this.dualGameWords = chosen;
          this.singleGameWords = chosen; // endGame single 分支沿用（错词同步复习）
          // 生成卡片（与 startGame 相同逻辑）
          let allCards = [];
          chosen.forEach((word, idx) => {
            allCards.push({ id: 'en-' + idx, text: word.en, pairId: idx, type: 'en', matched: false, selected: false, wrong: false });
            allCards.push({ id: 'zh-' + idx, text: word.zh, pairId: idx, type: 'zh', matched: false, selected: false, wrong: false });
          });
          const p1En = allCards.filter(c => c.type === 'en').map(c => ({...c, id: 'p1-' + c.id}));
          const p1Zh = allCards.filter(c => c.type === 'zh').map(c => ({...c, id: 'p1-' + c.id}));
          this.p1Cards = [...p1En, ...p1Zh].sort(() => Math.random() - 0.5);
          this.p2Cards = [];
          this.reviewGameErrors = {};
          this.gameBookName = '今日挑战 · ' + pick.unit;
          this._p1MatchSet = new Set();
          this._p2MatchSet = new Set();
          this._processingClick = { p1: false, p2: false };
          this.p1Selected = null;
          this.p2Selected = null;
          this.p1Matched = 0;
          this.p2Matched = 0;
          this.p1Time = 0;
          this.p2Time = 0;
          this.gameResult = null;
          this.gameResultPopup = null;
          this.gameOverInternal = false;
          this.p1Counted = false;
          this.p2Counted = false;
          this.p1Combo = 0;
          this.p2Combo = 0;
          this.singleCombo = 0;
          this.comboBreakP1 = false;
          this.comboBreakP2 = false;
          this.p1Errors = {};
          this.p2Errors = {};
          this.pickEvent(); // 每日挑战同样抽公平事件（单人）
          this.currentView = 'game';
          this.startCountdown();
        },
        // 完成今日挑战：写存储 + log 去重追加；重复完成不重置 done 不重复写 log
        completeDailyChallenge(time) {
          const today = this.todayStr();
          const saved = this.loadDailyChallenge();
          const entry = {
            date: today,
            unit: this.dailyPick ? this.dailyPick.unit : (saved ? saved.unit : ''),
            words: this.dailyPick ? this.dailyPick.words.map(w => w.en) : [],
            done: true,
            bestTime: time,
          };
          if (saved && saved.date === today && saved.done) {
            entry.bestTime = Math.min(saved.bestTime, time);
          }
          localStorage.setItem('wordpair_daily_challenge', JSON.stringify(entry));
          const log = this.loadDailyLog();
          if (!log.includes(today)) {
            log.push(today);
            localStorage.setItem('wordpair_daily_log', JSON.stringify(log));
          }
          this.dailyMode = false;
          this.refreshDailyChallenge();
        },

        // ===== 随机事件卡（WAVE1）=====
        // 开局必抽 1 个公平事件（fog 迷雾 2.5s / reshuffle 5s 后洗牌；mirror 已移除——汉字倒置体验差）
        pickEvent() {
          const events = ['fog', 'reshuffle'];
          const ev = events[Math.floor(Math.random() * events.length)];
          // 清理上一局残留定时器（无残留）
          clearTimeout(this._fogFadeTimer);
          clearTimeout(this._reshuffleTimer);
          clearTimeout(this._eventBannerTimer);
          this._fogPending = false;
          this.eventBannerName = ev;
          this.eventBannerVisible = true;
          this._eventBannerTimer = setTimeout(() => { this.eventBannerVisible = false; }, 2000);
          if (ev === 'fog') {
            // 迷雾效果推迟到 playing 才生效（倒计时 overlay 会遮住，且不能让玩家从倒计时就开始半透明）
            this.currentEvent = null;
            this._fogPending = true;
          } else if (ev === 'reshuffle') {
            this.currentEvent = ev;
            // 开局 5s 后未匹配卡片重排一次（已匹配不动）
            this._reshuffleTimer = setTimeout(() => {
              this.doReshuffle();
              this.currentEvent = null;
              this._reshuffleTimer = null;
            }, 5000);
          }
        },
        // reshuffle：双方未匹配卡各自洗牌重排（matched 保持原顺序不动）
        doReshuffle() {
          const sides = [['p1Cards', this._p1MatchSet], ['p2Cards', this._p2MatchSet]];
          for (const [cardsRef, matchSet] of sides) {
            const cards = this[cardsRef];
            if (!cards || !cards.length) continue;
            const matched = cards.filter(c => c.matched);
            const unmatched = cards.filter(c => !c.matched);
            for (let i = unmatched.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              const tmp = unmatched[i]; unmatched[i] = unmatched[j]; unmatched[j] = tmp;
            }
            this[cardsRef] = [...matched, ...unmatched];
          }
        },

        // ===== 复习系统 =====
        goReviewHome() {
          this.currentView = 'review';
          this.reviewPopup = null;
        },
        goReviewSelect() {
          this.pendingReview = true;
          this.gameResult = null;
          this.gameOverInternal = false;
          this.winnerName = '';
          this.currentView = 'select';
          // 如果当前没有选中的词表，默认全选
          let anyChecked = false;
          for (const b of this.books) {
            for (const u of (b.units || [])) {
              if (u._checked) { anyChecked = true; break; }
            }
            if (anyChecked) break;
          }
          if (!anyChecked) this.selectAll();
        },
        cancelReviewSelect() {
          if (this.pendingReview) {
            this.pendingReview = false;
            this.currentView = 'review';
          } else {
            this.currentView = 'home';
          }
        },
        getWordKey(word) {
          return (word.en || '').trim().toLowerCase().replace(/\s+/g, '_').slice(0, 60);
        },
        // ===== 单词图鉴（WAVE2）=====
        // 配对成功自动收集；wordpair_codex 结构 { [enKey]: { en, zh, book, unit, date } }
        // 重复收集不覆盖原日期（已存在直接跳过）
        collectWord(word) {
          if (!word || !word.en) return;
          const key = this.getWordKey(word);
          const data = this.loadCodex();
          if (!data[key]) {
            let book = '';
            let unit = '';
            for (const b of ALL_WORDS_DATA.books) {
              for (const u of (b.units || [])) {
                if ((u.words || []).some(w => this.getWordKey(w) === key)) {
                  book = b.name;
                  unit = u.name;
                  break;
                }
              }
              if (book) break;
            }
            data[key] = {
              en: word.en,
              zh: word.zh || '',
              book: book,
              unit: unit,
              date: new Date().toISOString().slice(0, 10),
            };
            this.saveCodex(data);
          }
          this.codexStoreVersion++;
        },
        loadCodex() {
          try { return JSON.parse(localStorage.getItem('wordpair_codex') || '{}'); } catch(e) { return {}; }
        },
        saveCodex(data) {
          localStorage.setItem('wordpair_codex', JSON.stringify(data));
        },
        toggleCodexBook(name) {
          this.codexExpanded = { ...this.codexExpanded, [name]: !this.codexExpanded[name] };
        },
        goCodexHome() {
          this.currentView = 'review';
        },
        loadReviewStore() {
          try {
            return JSON.parse(localStorage.getItem('wordpair_review') || '{}');
          } catch(e) { return {}; }
        },
        saveReviewStore(data) {
          localStorage.setItem('wordpair_review', JSON.stringify(data));
          this.reviewStoreVersion++;
        },
        // 复习结束后更新利特纳盒子
        updateReviewBoxes(gameWords, errorMap) {
          const intervals = [0, 1, 2, 4, 8, 16];
          const store = this.loadReviewStore();
          const today = new Date().toISOString().slice(0, 10);
          for (const word of gameWords) {
            const key = this.getWordKey(word);
            const entry = store[key] || { box: 1, correctStreak: 0, totalErrors: 0, lastReview: null };
            const errCount = errorMap[word.en] || 0;
            if (errCount > 0) {
              // 有失误 — 重置
              entry.box = 1;
              entry.correctStreak = 0;
              entry.totalErrors = (entry.totalErrors || 0) + errCount;
            } else {
              // 全对 — 升盒子
              entry.correctStreak = (entry.correctStreak || 0) + 1;
              entry.box = Math.min(entry.correctStreak + 1, 5);
            }
            entry.lastReview = today;
            store[key] = entry;
          }
          this.saveReviewStore(store);
        },
        // 单人/自由练习完成后记录错误
        recordReviewErrors(words, errorMap) {
          this.updateReviewBoxes(words, errorMap);
        },

        // ===== 开始复习游戏 =====
        startReviewGame(mode) {
          this.reviewMode = mode;
          let selectedWords = [];

          if (mode === 'free') {
            // 自由练习：从已选的词表里随机抽 8 个
            const allWords = [];
            for (const b of this.books) {
              for (const u of (b.units || [])) {
                if (u._checked) allWords.push(...(u.words || []));
              }
            }
            if (allWords.length < 8) {
              alert('请先在首页选择词表后再进入复习！（至少 8 个词）');
              this.currentView = 'review';
              return;
            }
            const shuffled = [...allWords].sort(() => Math.random() - 0.5);
            selectedWords = shuffled.slice(0, Math.min(8, shuffled.length));
          } else if (mode === 'due') {
            // 今日复习：从盒子里捞今天该复习的词
            const store = this.loadReviewStore();
            const today = new Date().toISOString().slice(0, 10);
            const intervals = [0, 1, 2, 4, 8, 16];
            const dueWords = [];
            // 找词 — 在 books 里匹配
            for (const b of this.books) {
              for (const u of (b.units || [])) {
                for (const w of (u.words || [])) {
                  const key = this.getWordKey(w);
                  const entry = store[key];
                  if (!entry) continue;
                  const box = entry.box || 1;
                  const last = entry.lastReview || '2000-01-01';
                  const daysSince = Math.floor((new Date(today) - new Date(last)) / 86400000);
                  if (daysSince >= intervals[box]) {
                    dueWords.push(w);
                  }
                }
              }
            }
            if (dueWords.length === 0) {
              alert('今天暂无需要复习的词！去做自由练习吧～');
              this.currentView = 'review';
              return;
            }
            const shuffled = [...dueWords].sort(() => Math.random() - 0.5);
            selectedWords = shuffled.slice(0, Math.min(8, shuffled.length));
          } else if (mode === 'hard') {
            // 错题特训：盒子 1 里的词
            const store = this.loadReviewStore();
            const hardWords = [];
            for (const b of this.books) {
              for (const u of (b.units || [])) {
                for (const w of (u.words || [])) {
                  const key = this.getWordKey(w);
                  const entry = store[key];
                  if (entry && (entry.box || 1) === 1) {
                    hardWords.push(w);
                  }
                }
              }
            }
            if (hardWords.length === 0) {
              alert('没有待攻克的错词！继续保持～');
              this.currentView = 'review';
              return;
            }
            const shuffled = [...hardWords].sort(() => Math.random() - 0.5);
            selectedWords = shuffled.slice(0, Math.min(8, shuffled.length));
          }

          // 设配对数量 — 去重前先记一下原始数量，去重后更新

          // 去重：同一单词在不同单元可能出现多次，保留首次出现的
          const seenKeys = new Set();
          selectedWords = selectedWords.filter(w => {
            const key = this.getWordKey(w);
            if (seenKeys.has(key)) return false;
            seenKeys.add(key);
            return true;
          });
          this.reviewCardPairCount = selectedWords.length;

          // 生成卡片
          let allCards = [];
          selectedWords.forEach((word, idx) => {
            allCards.push({
              id: 'en-' + idx,
              text: word.en,
              pairId: idx,
              type: 'en',
              matched: false,
              selected: false,
              wrong: false,
              _word: word,
            });
            allCards.push({
              id: 'zh-' + idx,
              text: word.zh,
              pairId: idx,
              type: 'zh',
              matched: false,
              selected: false,
              wrong: false,
              _word: word,
            });
          });
          const enCards = allCards.filter(c => c.type === 'en').map(c => ({...c, id: 'c-' + c.id}));
          const zhCards = allCards.filter(c => c.type === 'zh').map(c => ({...c, id: 'c-' + c.id}));
          this.reviewCards = [...enCards, ...zhCards].sort(() => Math.random() - 0.5);
          this.reviewMatchSet = new Set();
          this.reviewSelected = null;
          this.reviewProcessing = false;
          this.reviewPopup = null;
          this.reviewGameWords = selectedWords;
          this.reviewGameErrors = {};
          // 连击归零（新开一局）
          this.reviewCombo = 0;
          this.comboBreakReview = false;
          this.currentView = 'reviewGame';
        },

        // ===== 复习卡片点击 =====
        handleReviewClick(event) {
          const cardEl = event.target.closest('.game-card');
          if (!cardEl) return;
          const cardId = cardEl.dataset.cardId;
          if (!cardId) return;
          this.processReviewCardClick(cardId);
        },
        handleReviewTouchStart(event) {
          if (event.cancelable) event.preventDefault();
          const touch = event.changedTouches[0];
          if (!touch) return;
          const el = document.elementFromPoint(touch.clientX, touch.clientY);
          if (!el) return;
          const cardEl = el.closest('.game-card');
          if (!cardEl) return;
          this._reviewTouchId = cardEl.dataset.cardId;
        },
        handleReviewTouchEnd(event) {
          if (!this._reviewTouchId) return;
          this.reviewTouchProcessed = true;
          this.processReviewCardClick(this._reviewTouchId);
          this._reviewTouchId = null;
        },
        handleReviewClick(event) {
          // 触摸设备上 click 会在 touchend 后触发，防重复处理
          if (this.reviewTouchProcessed) {
            this.reviewTouchProcessed = false;
            return;
          }
          const cardEl = event.target.closest('.game-card');
          if (!cardEl) return;
          const cardId = cardEl.dataset.cardId;
          if (!cardId) return;
          this.processReviewCardClick(cardId);
        },
        processReviewCardClick(cardId) {
          if (this.reviewProcessing) return;
          if (!this.reviewCards) return;
          const card = this.reviewCards.find(c => c.id === cardId);
          if (!card || card.matched) return;

          this.reviewProcessing = true;

          if (this.reviewSelected) {
            const firstCard = this.reviewSelected;

            if (firstCard.id === cardId) {
              card.selected = false;
              this.reviewSelected = null;
              this.reviewProcessing = false;
              return;
            }

            const isMatch = firstCard.pairId === card.pairId && firstCard.type !== card.type;

            if (isMatch) {
              // 配对成功：连击 +1（Phigros 音效仅点击打击特效使用，配对不放音）
              this.reviewCombo++;
              this.comboBreakReview = false;
              // TTS 先触发 — 在动画之前出声，消除听觉延迟
              const enText = firstCard.type === 'en' ? firstCard.text : card.text;
              this.speakWord(enText);

              firstCard.selected = false;
              firstCard.matched = true;
              card.matched = true;
              this.reviewMatchSet.add(firstCard.pairId);
              // 单词图鉴（WAVE2）：复习配对成功同样收集
              this.collectWord(firstCard._word || card._word);

              this.reviewSelected = null;

              if (this.reviewMatchSet.size >= this.reviewCardPairCount) {
                this.endReviewGame();
                this.reviewProcessing = false;
                return;
              }
            } else {
              // 配对失败 — 连击清零 + 断连显示 + 记录错误
              this.reviewCombo = 0;
              this.comboBreakReview = true;
              clearTimeout(this._comboBreakReviewTimer);
              this._comboBreakReviewTimer = setTimeout(() => { this.comboBreakReview = false; }, 900);
              firstCard.selected = false;
              firstCard.wrong = true;
              card.wrong = true;
              // 记录每个词的错误次数
              const enText = firstCard.type === 'en' ? firstCard.text : card.text;
              this.reviewGameErrors[enText] = (this.reviewGameErrors[enText] || 0) + 1;
              this.reviewSelected = null;
              setTimeout(() => {
                firstCard.wrong = false;
                card.wrong = false;
              }, 300);
            }
          } else {
            card.selected = true;
            this.reviewSelected = card;
          }

          this.reviewProcessing = false;
        },

        // ===== 复习结束 =====
        endReviewGame() {
          // 更新利特纳盒子
          this.updateReviewBoxes(this.reviewGameWords, this.reviewGameErrors);

          // 构建复盘数据
          const wrongWords = [];
          for (const word of this.reviewGameWords) {
            const errCount = this.reviewGameErrors[word.en] || 0;
            if (errCount > 0) {
              const store = this.loadReviewStore();
              const key = this.getWordKey(word);
              wrongWords.push({
                en: word.en,
                zh: word.zh,
                totalErrors: (store[key]?.totalErrors || errCount),
              });
            }
          }

          const totalCorrect = this.reviewCardPairCount - wrongWords.length;
          const totalErrors = Object.values(this.reviewGameErrors).reduce((s, v) => s + v, 0);

          this.reviewPopup = {
            correct: totalCorrect,
            totalErrors: totalErrors,
            wrongWords: wrongWords,
          };
        },

        rerunReviewGame() {
          if (this.reviewMode) {
            this.startReviewGame(this.reviewMode);
          }
        },
        closeReviewPopup() {
          this.reviewPopup = null;
          this.reviewCards = [];
          this.reviewGameWords = [];
          this.reviewGameErrors = {};
          this.currentView = 'review';
        },
        goToReviewFromSingle() {
          this.currentView = 'review';
          this.gameResult = null;
          this.reviewPopup = null;
        },
        // 判断是否为本地打开（file:// 或 Android content://）
        _isLocal() {
          const p = window.location.protocol;
          return p === 'file:' || p === 'content:';
        },
        // 点击版本号弹窗
        footerDotTitle() {
          return this.versionJsLoaded
            ? (this._isLocal() ? '远程检测 ✓' : '在线版')
            : '远程检测未连接';
        },
        showBuildToast() {
          const d = this.buildVersion;
          const y = d.slice(0,4), mo = d.slice(4,6), day = d.slice(6,8);
          const h = d.slice(8,10), mi = d.slice(10,12), s = d.slice(12,14);
          const verSrc = this._isLocal()
            ? (this.versionJsLoaded ? '本地版 · 远程检测 ✓' : '本地版 · 远程检测 ⏳')
            : '在线版';
          const loaded = this.versionJsLoaded ? '✓ 已连接' : '✗ 未加载';
          const line = '─'.repeat(16);
          alert(
            `词对 PK · r${d}\n` +
            `构建于 ${y}年${mo}月${day}日 ${h}:${mi}:${s}\n` +
            `${line}\n` +
            `Powered by 晗菌 💕\n` +
            `${line}\n` +
            `${verSrc}\n` +
            `远程检测：${loaded}`
          );
        },
        // 下载最新版 / 离线版 — 本地版拉远程首页，在线版拉自身（CORS: Access-Control-Allow-Origin: null 匹配 file:// 的 Origin）
        downloadUpdate() {
          this.updateAvailable = false;
          const remoteUrl = this._isLocal()
            ? 'https://word-pair-pk.hdilp.top/?t=' + Date.now()
            : '/?t=' + Date.now();
          fetch(remoteUrl, { cache: 'no-store' })
            .then(r => r.blob())
            .then(blob => {
              const blobUrl = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = blobUrl;
              a.download = '词对 PK.html';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
            })
            .catch(() => {
              alert('下载失败，请手动访问 https://word-pair-pk.hdilp.top 保存页面');
            });
        },

        // ===== 词表数据辅助方法 =====
        // 支持旧格式(words) 和新格式(units)
        // 当你把词按 unit 整理好后，直接替换对应 book 的 words 为 units 即可
        getWordCount(book) {
          let n = 0;
          for (const u of (book.units || [])) n += (u.words || []).length;
          return n;
        },
        getBookWords(book) {
          const arr = [];
          for (const u of (book.units || [])) arr.push(...(u.words || []));
          return arr;
        },

        // ===== 词表选择 =====
        initBooks() {
          this.books = ALL_WORDS_DATA.books.map(b => {
            if (!b.units) {
              b.units = [{ name: "全部", words: b.words || [] }];
            }
            b._expanded = true;
            for (const u of b.units) u._checked = true;
            return { ...b };
          });
        },
        toggleExpand(idx) {
          this.books[idx]._expanded = !this.books[idx]._expanded;
        },
        toggleBook(idx) {
          const book = this.books[idx];
          const allChecked = (book.units || []).every(u => u._checked);
          for (const u of (book.units || [])) u._checked = !allChecked;
        },
        toggleUnit(bookIdx, unitIdx) {
          const unit = this.books[bookIdx].units[unitIdx];
          unit._checked = !unit._checked;
        },
        allUnitsChecked(book) {
          return (book.units || []).length > 0 && (book.units || []).every(u => u._checked);
        },
        someUnitsChecked(book) {
          return (book.units || []).some(u => u._checked);
        },
        selectAll() {
          for (const b of this.books) {
            for (const u of (b.units || [])) u._checked = true;
          }
        },
        deselectAll() {
          for (const b of this.books) {
            for (const u of (b.units || [])) u._checked = false;
          }
        },

        // ===== 听力挑战（WAVE2）=====
        // 每轮 TTS 读英文 → 4 张中文卡（1 正确 + 3 全局词库随机干扰）→ 点对 +1 分进下一轮 / 点错 -1 心也进下一轮
        startListenGame() {
          const selectedWords = [];
          let bookName = '';
          for (const b of this.books) {
            for (const u of (b.units || [])) {
              if (u._checked) {
                selectedWords.push(...(u.words || []));
                if (!bookName) bookName = b.name + ' - ' + u.name;
              }
            }
          }
          if (selectedWords.length < 8) return;

          const shuffled = [...selectedWords].sort(() => Math.random() - 0.5);
          const chosen = shuffled.slice(0, 8);
          this.listenWords = chosen;
          this.listenGameWords = chosen;
          this.listenIndex = 0;
          this.listenScore = 0;
          this.listenWrong = [];
          this.listenFinished = false;
          this.listenPopup = null;
          this.hearts = this.maxHearts; // 听力挑战带心形生命值
          this.reviewCombo = 0;
          this.comboBreakReview = false;
          this.gameBookName = bookName;
          this.dualGameWords = chosen;
          this.currentView = 'listenGame';
          this.prepareListenRound();
        },
        // 组装当前轮 4 个选项：正确项 pairId=当前轮次；干扰项从全局词库随机抽（去重，不得与正确项同 key）
        prepareListenRound() {
          const word = this.listenWords[this.listenIndex];
          const key = this.getWordKey(word);
          const pool = [];
          for (const b of ALL_WORDS_DATA.books) {
            for (const u of (b.units || [])) {
              for (const w of (u.words || [])) {
                const k = this.getWordKey(w);
                if (k === key) continue;
                if (!w.zh || w.zh === word.zh) continue;
                if (pool.some(p => this.getWordKey(p) === k)) continue;
                pool.push(w);
              }
            }
          }
          const dist = [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
          const options = [{ text: word.zh, pairId: this.listenIndex, correct: true }];
          for (const w of dist) {
            options.push({ text: w.zh, pairId: -1, correct: false });
          }
          this.listenOptions = options.sort(() => Math.random() - 0.5);
          // 自动读当前词
          this.speakWord(word.en);
        },
        listenPick(option) {
          if (this.listenFinished || !option) return;
          const word = this.listenWords[this.listenIndex];
          if (option.correct) {
            // 答对：+1 分 + combo + 下一轮自动读
            this.listenScore++;
            this.reviewCombo++;
            this.comboBreakReview = false;
            // 单词图鉴（WAVE2）：听力答对同样收集
            this.collectWord(word);
            this.advanceListen();
          } else {
            // 答错：-1 心 + 记错（进复习盒子 box 重置 1）+ 下一轮
            this.hearts--;
            this.reviewCombo = 0;
            this.comboBreakReview = true;
            clearTimeout(this._comboBreakTimer);
            this._comboBreakTimer = setTimeout(() => { this.comboBreakReview = false; }, 900);
            this.listenWrong.push({ en: word.en, zh: word.zh });
            if (this.hearts <= 0) {
              this.finishListenGame();
              return;
            }
            this.advanceListen();
          }
        },
        advanceListen() {
          if (this.listenIndex + 1 >= this.listenWords.length) {
            this.finishListenGame();
            return;
          }
          this.listenIndex++;
          this.prepareListenRound();
        },
        // 8 轮结束或 0 心 → 结算；错词进复习盒子（学习闭环与单人一致）
        finishListenGame() {
          if (this.listenFinished) return;
          this.listenFinished = true;
          if (this.listenWrong.length > 0) {
            const errMap = {};
            for (const w of this.listenWrong) errMap[w.en] = (errMap[w.en] || 0) + 1;
            this.updateReviewBoxes(this.listenGameWords || this.listenWords, errMap);
          }
          this.listenPopup = {
            score: this.listenScore,
            total: this.listenWords.length,
            wrong: this.listenWrong,
          };
        },
        rerunListenGame() {
          this.listenPopup = null;
          this.startListenGame();
        },
        closeListenPopup() {
          this.listenPopup = null;
          this.goHome();
        },

        // ===== 例句配对（D5 试点版）=====
        // 玩法：8 对卡片 = 英文例句卡（词的 example，目标词加粗高亮/下划线）+ 中文释义卡；
        // 例句 ↔ 释义配对，成功高亮 + TTS 朗读整句例句，失败红闪（复用 .game-card matched/wrong 视觉）；
        // 容错：example 缺失/为空的词不报错——优先抽带例句的词，不足 8 个用普通 en 卡面回退补齐
        startSentenceGame() {
          const selectedWords = [];
          for (const b of this.books) {
            for (const u of (b.units || [])) {
              if (u._checked) selectedWords.push(...(u.words || []));
            }
          }
          if (selectedWords.length < 8) return;
          const hasEx = w => !!(w && w.example && String(w.example).trim());
          const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);
          const exPool = selectedWords.filter(hasEx);
          const plainPool = selectedWords.filter(w => !hasEx(w));
          const chosen = [...shuffle(exPool), ...shuffle(plainPool)].slice(0, 8);
          this.sentenceWords = chosen;

          // 生成 16 卡：例句卡（type 'en'，目标词拆分三 span 高亮）+ 释义卡（type 'zh'）
          const cards = [];
          chosen.forEach((word, idx) => {
            const sent = hasEx(word) ? String(word.example).trim() : String(word.en || '');
            const split = this.splitExampleSentence(sent, word.en);
            cards.push({
              id: 's-en-' + idx,
              text: sent,
              pairId: idx,
              type: 'en',
              matched: false,
              selected: false,
              wrong: false,
              _word: word,
              _sBefore: split.before,
              _sWord: split.word,
              _sAfter: split.after,
            });
            cards.push({
              id: 's-zh-' + idx,
              text: word.zh || '',
              pairId: idx,
              type: 'zh',
              matched: false,
              selected: false,
              wrong: false,
              _word: word,
            });
          });
          this.sentenceCards = cards.sort(() => Math.random() - 0.5);
          this.sentenceMatchSet = new Set();
          this.sentenceSelected = null;
          this.sentenceProcessing = false;
          this.sentenceCombo = 0;
          this.comboBreakSentence = false;
          this.sentenceErrors = {};
          this.sentenceCardPairCount = chosen.length;
          this.sentenceTime = 0;
          this.sentencePopup = null;
          this.sentenceFinished = false;
          this.sentenceTouchProcessed = false;
          clearInterval(this.p1Timer);
          this.p1Timer = setInterval(() => { this.sentenceTime += 0.1; }, 100);
          this.currentView = 'sentenceGame';
        },
        // 目标词在例句中定位：大小写不敏感；找不到 → 整句放 before（不报错，仅不高亮）
        // 词边界校验：命中位置前后字符必须是字母/数字以外的字符，否则是跨词子串（如 'sweep' 嵌在 'swept' 里）
        // → 走无高亮回退（同 scripts/example-highlight-scan.py split_sim 规则；短词 'go'/'to' 同理）
        splitExampleSentence(sentence, en) {
          const s = String(sentence || '');
          const w = String(en || '').trim();
          if (!w) return { before: s, word: '', after: '' };
          const idx = s.toLowerCase().indexOf(w.toLowerCase());
          if (idx < 0) return { before: s, word: '', after: '' };
          const end = idx + w.length;
          const beforeOk = idx === 0 || !/[\p{L}\p{N}]/u.test(s[idx - 1]);
          const afterOk = end >= s.length || !/[\p{L}\p{N}]/u.test(s[end]);
          if (!beforeOk || !afterOk) return { before: s, word: '', after: '' };
          return { before: s.slice(0, idx), word: s.slice(idx, end), after: s.slice(end) };
        },
        handleSentenceClick(event) {
          // 触摸设备上 click 会在 touchend 后触发，防重复处理（同 handleReviewClick 守卫）
          if (this.sentenceTouchProcessed) {
            this.sentenceTouchProcessed = false;
            return;
          }
          const cardEl = event.target.closest('.game-card');
          if (!cardEl) return;
          const cardId = cardEl.dataset.cardId;
          if (!cardId) return;
          this.processSentenceCardClick(cardId);
        },
        handleSentenceTouchStart(event) {
          if (event.cancelable) event.preventDefault();
          const touch = event.changedTouches[0];
          if (!touch) return;
          const el = document.elementFromPoint(touch.clientX, touch.clientY);
          if (!el) return;
          const cardEl = el.closest('.game-card');
          if (!cardEl) return;
          this._sentenceTouchId = cardEl.dataset.cardId;
        },
        handleSentenceTouchEnd(event) {
          if (!this._sentenceTouchId) return;
          this.sentenceTouchProcessed = true;
          this.processSentenceCardClick(this._sentenceTouchId);
          this._sentenceTouchId = null;
        },
        // 配对判定落点（与 processReviewCardClick 同构）：pairId 相同 + type 不同 = 配对成功
        processSentenceCardClick(cardId) {
          if (this.sentenceProcessing) return;
          if (this.sentencePopup) return;
          const card = this.sentenceCards.find(c => c.id === cardId);
          if (!card || card.matched) return;

          this.sentenceProcessing = true;

          if (this.sentenceSelected) {
            const firstCard = this.sentenceSelected;

            if (firstCard.id === cardId) {
              card.selected = false;
              this.sentenceSelected = null;
              this.sentenceProcessing = false;
              return;
            }

            const isMatch = firstCard.pairId === card.pairId && firstCard.type !== card.type;

            if (isMatch) {
              // 配对成功：连击 +1（Phigros 音效仅点击打击特效使用，配对不放音）
              this.sentenceCombo++;
              this.comboBreakSentence = false;
              // TTS 先触发 — 朗读英文例句（动画之前出声）
              const enText = firstCard.type === 'en' ? firstCard.text : card.text;
              this.speakWord(enText);

              firstCard.selected = false;
              firstCard.matched = true;
              card.matched = true;
              this.sentenceMatchSet.add(firstCard.pairId);
              // 单词图鉴（D5）：配对成功同样收集（与既有四处收集点一致）
              const pairWord = firstCard._word || card._word;
              if (pairWord) this.collectWord(pairWord);

              this.sentenceSelected = null;

              if (this.sentenceMatchSet.size >= this.sentenceCardPairCount) {
                this.finishSentenceGame();
                this.sentenceProcessing = false;
                return;
              }
            } else {
              // 配对失败：连击清零 + 断连 + 红闪（wrong class 300ms 自动复位）
              this.sentenceCombo = 0;
              this.comboBreakSentence = true;
              clearTimeout(this._comboBreakSentenceTimer);
              this._comboBreakSentenceTimer = setTimeout(() => { this.comboBreakSentence = false; }, 900);
              const errWord = firstCard._word || card._word;
              if (errWord && errWord.en) this.sentenceErrors[errWord.en] = (this.sentenceErrors[errWord.en] || 0) + 1;
              firstCard.selected = false;
              firstCard.wrong = true;
              card.wrong = true;
              this.sentenceSelected = null;
              setTimeout(() => {
                firstCard.wrong = false;
                card.wrong = false;
              }, 300);
            }
          } else {
            card.selected = true;
            this.sentenceSelected = card;
          }

          this.sentenceProcessing = false;
        },
        // 8 对全消 → 结算：错词进复习盒子（学习闭环与其它模式一致）
        finishSentenceGame() {
          if (this.sentenceFinished) return;
          this.sentenceFinished = true;
          clearInterval(this.p1Timer);
          this.updateReviewBoxes(this.sentenceWords, this.sentenceErrors);
          const wrongWords = [];
          for (const w of this.sentenceWords) {
            const c = this.sentenceErrors[w.en] || 0;
            if (c > 0) wrongWords.push({ en: w.en, zh: w.zh, count: c });
          }
          this.sentencePopup = {
            time: this.sentenceTime,
            total: this.sentenceCardPairCount,
            wrong: wrongWords,
          };
        },
        rerunSentenceGame() {
          this.sentencePopup = null;
          this.startSentenceGame();
        },
        closeSentencePopup() {
          this.sentencePopup = null;
          this.goHome();
        },

        // ===== 开始游戏 =====
        startGame() {
          // 如果是从复习页来的，走自由练习
          if (this.pendingReview) {
            this.pendingReview = false;
            this.startReviewGame('free');
            return;
          }
          // 听力挑战：选词完成后进入听力流程（不走配对 startGame）
          if (this.gameMode === 'listen') {
            this.startListenGame();
            return;
          }
          // 例句配对（D5）：选词完成后进入例句游戏（不走配对 startGame）
          if (this.gameMode === 'sentence') {
            this.startSentenceGame();
            return;
          }
          const selectedWords = [];
          let bookName = '';
          for (const b of this.books) {
            for (const u of (b.units || [])) {
              if (u._checked) {
                selectedWords.push(...(u.words || []));
                if (!bookName) bookName = b.name + ' - ' + u.name;
              }
            }
          }
          if (selectedWords.length < 8) return;

          // 随机选 8 个不重复词
          const shuffled = [...selectedWords].sort(() => Math.random() - 0.5);
          const chosen = shuffled.slice(0, 8);

          // WAVE1：本局 8 词（双人错词入库用，单独存不影响 single 流程）
          this.dualGameWords = chosen;

          // 生成卡片
          // 每张卡片：{id, text, pairId, type: 'en'|'zh', matched, selected, wrong}
          let allCards = [];
          chosen.forEach((word, idx) => {
            allCards.push({
              id: 'en-' + idx,
              text: word.en,
              pairId: idx,
              type: 'en',
              matched: false,
              selected: false,
              wrong: false,
            });
            allCards.push({
              id: 'zh-' + idx,
              text: word.zh,
              pairId: idx,
              type: 'zh',
              matched: false,
              selected: false,
              wrong: false,
            });
          });

          // P1: 8 en + 8 zh 随机排列
          const p1En = allCards.filter(c => c.type === 'en').map(c => ({...c, id: 'p1-' + c.id}));
          const p1Zh = allCards.filter(c => c.type === 'zh').map(c => ({...c, id: 'p1-' + c.id}));
          this.p1Cards = [...p1En, ...p1Zh].sort(() => Math.random() - 0.5);

          if (this.gameMode === 'dual') {
            // P2: 同样 8 en + 8 zh 随机排列
            const p2En = allCards.filter(c => c.type === 'en').map(c => ({...c, id: 'p2-' + c.id}));
            const p2Zh = allCards.filter(c => c.type === 'zh').map(c => ({...c, id: 'p2-' + c.id}));
            this.p2Cards = [...p2En, ...p2Zh].sort(() => Math.random() - 0.5);
          } else {
            this.p2Cards = [];
            this.reviewGameErrors = {};
            this.singleGameWords = chosen;
          }

          this.gameBookName = bookName;
          this._p1MatchSet = new Set();
          this._p2MatchSet = new Set();
          this._processingClick = { p1: false, p2: false };
          this.p1Selected = null;
          this.p2Selected = null;
          this.rushSelected = null; // 抢答全局悬空选中（WAVE2）
          this.rushOwner = null;
          this.hearts = this.maxHearts; // 心形生命值重置（WAVE2）
          this.p1Matched = 0;
          this.p2Matched = 0;
          this.p1Time = 0;
          this.p2Time = 0;
          this.gameResult = null;
          this.gameOverInternal = false;
          this.p1Counted = false;
          this.p2Counted = false;
          // 连击归零（新开一局）
          this.p1Combo = 0;
          this.p2Combo = 0;
          this.singleCombo = 0;
          this.comboBreakP1 = false;
          this.comboBreakP2 = false;
          // 双人错词表重置（新开一局）
          this.p1Errors = {};
          this.p2Errors = {};
          this.gameResultPopup = null;
          // 随机事件卡：PK/单人开局必抽 1 个公平事件（复习模式走 startReviewGame 不触发）
          this.pickEvent();

          this.currentView = 'game';
          this.startCountdown();
        },

        // ===== 倒计时（WAVE1 升级：ready 0.8s → 3/2/1 各 600ms → GO 450ms → playing）=====
        startCountdown() {
          this.countdownState = 'ready';
          setTimeout(() => {
            this.countdownState = '3';
            setTimeout(() => {
              this.countdownState = '2';
              setTimeout(() => {
                this.countdownState = '1';
                setTimeout(() => {
                  this.countdownState = 'go';
                  setTimeout(() => {
                    this.countdownState = 'playing';
                    this.startTimers();
                    // fog 迷雾在 playing 才开始：2.5s 半透明 → 渐显 1.5s → 移除事件类
                    if (this._fogPending) {
                      this._fogPending = false;
                      this.currentEvent = 'fog';
                      this._fogFadeTimer = setTimeout(() => {
                        this.currentEvent = 'fog-fade';
                        clearTimeout(this._fogFadeTimer);
                        this._fogFadeTimer = setTimeout(() => {
                          this.currentEvent = null;
                          this._fogFadeTimer = null;
                        }, 1500);
                      }, 2500);
                    }
                  }, 450);
                }, 600);
              }, 600);
            }, 600);
          }, 800);
        },

        startTimers() {
          clearInterval(this.p1Timer);
          clearInterval(this.p2Timer);
          this.p1Time = 0;
          this.p2Time = 0;
          this.p1Timer = setInterval(() => { this.p1Time += 0.1; }, 100);
          if (this.gameMode === 'dual' || this.gameMode === 'rush') {
            this.p2Timer = setInterval(() => { this.p2Time += 0.1; }, 100);
          }
        },

        // ===== 卡片点击 =====
        handleClick(event, side) {
          // 倒计时未结束不处理
          if (this.countdownState !== 'playing') return;
          if (this.gameResult) return;

          const cardEl = event.target.closest('.game-card');
          if (!cardEl) return;
          const cardId = cardEl.dataset.cardId;
          if (!cardId) return;

          if (this.gameMode === 'rush') {
            this.processRushClick(cardId, side);
          } else {
            this.processCardClick(cardId, side);
          }
        },

        // 多点触控：在 .game-board 级别处理，支持 P1+P2 同时点击
        handleBoardTouch(event) {
          if (this.countdownState !== 'playing' || this.gameResult) return;
          for (const touch of event.changedTouches) {
            const el = document.elementFromPoint(touch.clientX, touch.clientY);
            if (!el) continue;
            const cardEl = el.closest('.game-card');
            if (!cardEl) continue;
            const sideEl = cardEl.closest('.game-side');
            if (!sideEl) continue;
            const cardId = cardEl.dataset.cardId;
            if (!cardId) continue;
            const side = sideEl.classList.contains('game-side--p2') ? 'p2' : 'p1';
            this._touchMap[touch.identifier] = { cardId, side };
          }
        },
        handleBoardTouchEnd(event) {
          if (this.countdownState !== 'playing' || this.gameResult) return;
          for (const touch of event.changedTouches) {
            const entry = this._touchMap[touch.identifier];
            if (!entry) continue;
            delete this._touchMap[touch.identifier];
            if (this.gameMode === 'rush') {
              this.processRushClick(entry.cardId, entry.side);
            } else {
              this.processCardClick(entry.cardId, entry.side);
            }
          }
        },

        processCardClick(cardId, side) {
          if (this._processingClick[side]) return;

          const cards = side === 'p1' ? this.p1Cards : this.p2Cards;
          const matchSet = side === 'p1' ? this._p1MatchSet : this._p2MatchSet;
          const selectedRef = side === 'p1' ? 'p1Selected' : 'p2Selected';
          // 连击引用：单人走 singleCombo，双人各走 p1/p2Combo
          const comboRef = side === 'p1' ? (this.gameMode === 'single' ? 'singleCombo' : 'p1Combo') : 'p2Combo';
          const breakRef = side === 'p1' ? 'comboBreakP1' : 'comboBreakP2';

          // 找到卡片
          const card = cards.find(c => c.id === cardId);
          if (!card) return;
          // 点击已匹配卡 → 连击清零（死规矩）
          if (card.matched) {
            this[comboRef] = 0;
            return;
          }

          this._processingClick[side] = true;

          // 如果已有选中卡片
          if (this[selectedRef]) {
            const firstCard = this[selectedRef];

            // 点击了同一张卡
            if (firstCard.id === cardId) {
              card.selected = false;
              this[selectedRef] = null;
              this._processingClick[side] = false;
              return;
            }

            // 配对检测
            const isMatch = firstCard.pairId === card.pairId && firstCard.type !== card.type;

            if (isMatch) {
              // 配对成功：连击 +1（Phigros 音效仅点击打击特效使用，配对不放音）
              this[comboRef]++;
              this[breakRef] = false;
              // 单词图鉴（WAVE2）：配对成功自动收集
              const pairWord = this.dualGameWords[firstCard.pairId];
              if (pairWord) this.collectWord(pairWord);
              // TTS 先触发 — 在动画之前出声
              const enText = firstCard.type === 'en' ? firstCard.text : card.text;
              this.speakWord(enText);

              // 配对成功
              firstCard.selected = false;
              firstCard.matched = true;
              card.matched = true;
              matchSet.add(firstCard.pairId);

              this[selectedRef] = null;

              // 检查胜利
              if (matchSet.size >= 8 && !this.gameOverInternal) {
                this.endGame(side);
                this._processingClick[side] = false;
                return;
              }
            } else {
              // 配对失败：连击清零 + 断连显示（Phigros 音效仅点击打击特效使用）
              this[comboRef] = 0;
              this[breakRef] = true;
              clearTimeout(this._comboBreakTimer);
              this._comboBreakTimer = setTimeout(() => { this[breakRef] = false; }, 900);
              firstCard.selected = false;
              firstCard.wrong = true;
              card.wrong = true;
              // 记录错词：单人走 reviewGameErrors（原逻辑），双人各走 p1/p2Errors（WAVE1）
              const enText = firstCard.type === 'en' ? firstCard.text : card.text;
              if (this.gameMode === 'single') {
                this.reviewGameErrors[enText] = (this.reviewGameErrors[enText] || 0) + 1;
              } else {
                const errs = side === 'p1' ? this.p1Errors : this.p2Errors;
                errs[enText] = (errs[enText] || 0) + 1;
              }
              // 心形生命值（WAVE2）：单人挑战扣心（每日挑战除外）；0 心提前结束走现有 endGame（错词已入库）
              if (this.gameMode === 'single' && !this.dailyMode) {
                this.hearts--;
                if (this.hearts <= 0) {
                  this[selectedRef] = null;
                  this.endGame('p1');
                  this._processingClick[side] = false;
                  return;
                }
              }
              this[selectedRef] = null;
              setTimeout(() => {
                firstCard.wrong = false;
                card.wrong = false;
              }, 300);
            }
          } else {
            // 选中卡片
            card.selected = true;
            this[selectedRef] = card;
          }

          this._processingClick[side] = false;
        },

        // ===== 抢答 PK（WAVE2）=====
        // 公共牌池 = p1Cards 单份（16 张），双方在各自的 game-side 网格上操作同一数组；
        // 全局唯一"悬空选中" rushSelected + 选中者 rushOwner（不按 side 分选中）
        // 状态机（拍板第 1 条 a/b/c）：
        //   a) 无选中 → 点击卡 C 被选中，owner=点击者
        //   b) 有选中且 owner=自己：C 与选中卡配对 → 归自己（得分+1）；C==选中卡 → 取消；否则无效（不惩罚不顶替）
        //   c) 有选中且 owner=对方：C 与选中卡配对 → 归自己（抢！）；否则无效点击（不许顶掉对方选中）
        // 配对归属永远属于"完成配对的那次点击"
        processRushClick(cardId, side) {
          if (this._processingClick[side]) return;

          const card = this.p1Cards.find(c => c.id === cardId);
          if (!card) return;
          // 已匹配卡不可再点（无效点击不惩罚）
          if (card.matched) return;

          this._processingClick[side] = true;

          if (this.rushSelected) {
            const firstCard = this.rushSelected;

            // 点同一张卡：仅 owner 自己能取消；对方点它 = 无效（不许顶掉）
            if (firstCard.id === cardId) {
              if (side === this.rushOwner) {
                firstCard.selected = false;
                this.rushSelected = null;
                this.rushOwner = null;
              }
              this._processingClick[side] = false;
              return;
            }

            const isMatch = firstCard.pairId === card.pairId && firstCard.type !== card.type;

            if (isMatch) {
              // 配对成功：归属 = 完成配对的那次点击（side）；对方完成 = 抢！
              const matchSet = side === 'p1' ? this._p1MatchSet : this._p2MatchSet;
              if (side === 'p1') { this.p1Combo++; this.comboBreakP1 = false; }
              else { this.p2Combo++; this.comboBreakP2 = false; }
              // TTS 先触发 — 在动画之前出声
              const enText = firstCard.type === 'en' ? firstCard.text : card.text;
              this.speakWord(enText);
              firstCard.selected = false;
              firstCard.matched = true;
              card.matched = true;
              matchSet.add(firstCard.pairId);
              // 单词图鉴（WAVE2）：抢答配对成功同样收集
              const pairWord = this.dualGameWords[firstCard.pairId];
              if (pairWord) this.collectWord(pairWord);
              this.rushSelected = null;
              this.rushOwner = null;
              // 公共池 8 对全消 → 结束（得分多者胜，平分比用时，endGame 内判定）
              if (this._p1MatchSet.size + this._p2MatchSet.size >= 8 && !this.gameOverInternal) {
                this.endGame('rush');
                this._processingClick[side] = false;
                return;
              }
            } else {
              // 无效点击：不扣分不惩罚、不顶掉对方选中；错词记录（谁点错记谁的，与 dual 一致）
              const enText = firstCard.type === 'en' ? firstCard.text : card.text;
              const errs = side === 'p1' ? this.p1Errors : this.p2Errors;
              errs[enText] = (errs[enText] || 0) + 1;
              firstCard.wrong = true;
              card.wrong = true;
              setTimeout(() => {
                firstCard.wrong = false;
                card.wrong = false;
              }, 300);
              // 选中保持（owner 不变）
            }
          } else {
            // 无悬空选中 → 选中，owner=点击者
            card.selected = true;
            this.rushSelected = card;
            this.rushOwner = side;
          }

          this._processingClick[side] = false;
        },

        endGame(side) {
          this.gameOverInternal = true;
          clearInterval(this.p1Timer);
          clearInterval(this.p2Timer);

          if (this.gameMode === 'single') {
            // 单人模式：记录完成时间和个人最佳
            const t = this.p1Time;
            this.gameResult = { winner: 'single', time: t };
            // 保存个人最快记录
            try {
              const pb = localStorage.getItem('wordpair_pb');
              const prev = pb ? parseFloat(pb) : null;
              if (prev === null || t < prev) {
                localStorage.setItem('wordpair_pb', String(t));
                this.singlePlayerPb = t;
              } else {
                this.singlePlayerPb = prev;
              }
            } catch(e) {}
            // 单人模式：同步到复习系统
            if (this.singleGameWords && this.singleGameWords.length > 0) {
              this.updateReviewBoxes(this.singleGameWords, this.reviewGameErrors);
              this.reviewGameWords = this.singleGameWords; // 给复盘弹窗用
            }
            // 每日挑战：完成写入存储（WAVE1）
            if (this.dailyMode) {
              this.completeDailyChallenge(t);
            }
            return;
          }

          if (this.gameMode === 'rush') {
            // 抢答结算（WAVE2）：得分多者胜；平分 → 用时少者胜
            const p1Score = this._p1MatchSet.size;
            const p2Score = this._p2MatchSet.size;
            let winner = 'p1';
            if (p2Score > p1Score) winner = 'p2';
            else if (p1Score === p2Score) winner = (this.p1Time <= this.p2Time) ? 'p1' : 'p2';
            const winnerTime = winner === 'p1' ? this.p1Time : this.p2Time;
            this.gameResult = {
              winner: winner,
              time: winnerTime,
            };
            // 双方错词合并 → 复习盒子 + 弱点雷达（与 dual 一致）
            const rMerged = {};
            for (const en in this.p1Errors) rMerged[en] = (rMerged[en] || 0) + this.p1Errors[en];
            for (const en in this.p2Errors) rMerged[en] = (rMerged[en] || 0) + this.p2Errors[en];
            if (this.dualGameWords && this.dualGameWords.length > 0) {
              this.updateReviewBoxes(this.dualGameWords, rMerged);
            }
            const rWordMap = {};
            for (const w of (this.dualGameWords || [])) rWordMap[w.en] = w;
            const rRadar = [];
            for (const en in rMerged) {
              rRadar.push({ en: en, zh: (rWordMap[en] || {}).zh || '', count: rMerged[en] });
            }
            rRadar.sort((a, b) => (b.count - a.count) || a.en.localeCompare(b.en));
            this.gameResultPopup = {
              winner: winner,
              time: winnerTime,
              top3: rRadar.slice(0, 3),
            };
            return;
          }

          const winnerTime = side === 'p1' ? this.p1Time : this.p2Time;
          this.gameResult = {
            winner: side,
            time: winnerTime,
          };

          // WAVE1：双人 PK 双方错词合并 → 复习盒子（有错→box 重置 1）；单人流程零改动
          const mergedErrors = {};
          for (const en in this.p1Errors) mergedErrors[en] = (mergedErrors[en] || 0) + this.p1Errors[en];
          for (const en in this.p2Errors) mergedErrors[en] = (mergedErrors[en] || 0) + this.p2Errors[en];
          if (this.dualGameWords && this.dualGameWords.length > 0) {
            this.updateReviewBoxes(this.dualGameWords, mergedErrors);
          }
          // 弱点雷达：合并错词 Top3（次数降序，并列按字母序）
          const wordMap = {};
          for (const w of (this.dualGameWords || [])) wordMap[w.en] = w;
          const radar = [];
          for (const en in mergedErrors) {
            radar.push({ en: en, zh: (wordMap[en] || {}).zh || '', count: mergedErrors[en] });
          }
          radar.sort((a, b) => (b.count - a.count) || a.en.localeCompare(b.en));
          this.gameResultPopup = {
            winner: side,
            time: winnerTime,
            top3: radar.slice(0, 3),
          };
        },
        // 弱点雷达弹层关闭 → 露出原 result-overlay（姓名输入 → saveResult 排行榜照旧）
        closeRadarPopup() {
          this.gameResultPopup = null;
        },

        // ===== 结算 =====
        saveResult() {
          if (!this.winnerName.trim()) {
            this.winnerName = this.gameResult.winner === 'p1' ? 'P1玩家' : 'P2玩家';
          }

          const entry = {
            name: this.winnerName.trim(),
            time: this.gameResult.time,
            book: this.gameBookName || '未知词表',
            date: new Date().toLocaleDateString('zh-CN'),
          };

          const lb = this.loadLeaderboard();
          lb.push(entry);
          lb.sort((a, b) => a.time - b.time);
          this.saveLeaderboard(lb);

          this.currentView = 'leaderboard';
          this.loadLeaderboardFromStorage();
          this.gameResult = null;
          this.winnerName = '';
        },

        // ===== 计时格式化 =====
        formatTime(t) {
          if (t == null) return '0.0s';
          const secs = Math.floor(t);
          const tenths = Math.floor((t - secs) * 10);
          return `${secs}.${tenths}s`;
        },

        // ===== 排行榜 =====
        loadLeaderboard() {
          try {
            const data = localStorage.getItem('wordpair_leaderboard');
            return data ? JSON.parse(data) : [];
          } catch(e) { return []; }
        },
        saveLeaderboard(data) {
          localStorage.setItem('wordpair_leaderboard', JSON.stringify(data));
        },
        loadLeaderboardFromStorage() {
          this.leaderboard = this.loadLeaderboard();
        },

        exportLeaderboard() {
          const data = this.loadLeaderboard();
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'wordpair_leaderboard.json';
          a.click();
          URL.revokeObjectURL(url);
        },

        importLeaderboard(e) {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            try {
              const imported = JSON.parse(ev.target.result);
              if (!Array.isArray(imported)) {
                alert('无效的排行榜文件');
                return;
              }
              const current = this.loadLeaderboard();
              const merged = [...current, ...imported];
              merged.sort((a, b) => a.time - b.time);
              this.saveLeaderboard(merged);
              this.loadLeaderboardFromStorage();
              alert('导入成功！');
            } catch(e) {
              alert('导入失败：文件格式错误');
            }
          };
          reader.readAsText(file);
          // reset input
          e.target.value = '';
        },
        // 手机侧滑返回——边缘滑动触发应用内导航
        handleEdgeTouch(e) {
          if (e.touches.length === 1) {
            const x = e.touches[0].clientX;
            const y = e.touches[0].clientY;
            if (x < 40) {
              this._edgeSwipeX = x;
              this._edgeSwipeY = y;
            }
          }
        },
        handleEdgeMove(e) {
          if (this._edgeSwipeX !== null && e.touches.length === 1) {
            const dy = Math.abs(e.touches[0].clientY - this._edgeSwipeY);
            const dx = Math.abs(e.touches[0].clientX - this._edgeSwipeX);
            // 竖直滑动占比大 → 取消边缘检测（允许滚动）
            if (dy > dx * 1.5 && dy > 10) {
              this._edgeSwipeX = null;
            }
          }
        },
        handleEdgeEnd(e) {
          if (this._edgeSwipeX !== null) {
            const touch = e.changedTouches[0];
            if (touch) {
              const dx = touch.clientX - this._edgeSwipeX;
              if (dx > 60) {
                this.navigateBack();
              }
            }
          }
          this._edgeSwipeX = null;
          this._edgeSwipeY = null;
        },
        navigateBack() {
          switch (this.currentView) {
            case 'select':
              this.cancelReviewSelect();
              break;
            case 'reviewGame':
              this.currentView = 'review';
              break;
            case 'codex':
              this.goCodexHome();
              break;
            case 'game':
            case 'review':
            case 'leaderboard':
            case 'listenGame':
            case 'sentenceGame':
              clearInterval(this.p1Timer);
              this.goHome();
              break;
            // home: 最顶层，不处理
          }
        },
        // Android 系统返回手势拦截 → 应用内导航 + 阻止离开页面
        handleSystemBack() {
          history.pushState(null, '', location.href);
          this.navigateBack();
        },
        // 星尘粒子 — tiny 银白颗粒从底部缓缓上升消散
        _spawnStardust() {
          const homeView = document.querySelector('.home-view');
          if (!homeView || !homeView.classList.contains('home-ready')) return;
          const count = 22;
          const container = document.createElement('div');
          container.className = 'home-stardust-container';
          const frag = document.createDocumentFragment();
          for (let i = 0; i < count; i++) {
            const p = document.createElement('div');
            p.className = 'home-stardust';
            const size = 1.5 + Math.random() * 2.5;
            const x = 10 + Math.random() * 80;
            const drift = (Math.random() - 0.5) * 40;
            const rise = 120 + Math.random() * 200;
            const dur = (2 + Math.random() * 2).toFixed(1);
            const delay = (Math.random() * 1.2).toFixed(2);
            p.style.cssText =
              `left:${x}%;--ty:-${rise}px;--tx:${drift}px;--dur:${dur}s;--size:${size}px;animation-delay:${delay}s;`;
            frag.appendChild(p);
          }
          container.appendChild(frag);
          homeView.appendChild(container);
          setTimeout(() => {
            if (container.parentNode) container.parentNode.removeChild(container);
          }, 5000);
        },
      },

      mounted() {
        this.initBooks();
        this.loadLeaderboardFromStorage();
        // 每日挑战状态（WAVE1）
        this.refreshDailyChallenge();
        // WAVE1：全局 pointerdown 打击特效监听（零 preventDefault/stopPropagation，不干扰现有触摸链）
        window.addEventListener('pointerdown', this.handleFxPointerDown);
        // 全局预热 TTS — 首次用户交互时加载语音引擎+英文语音数据（整个生命周期只 speak 一次）
        document.addEventListener('pointerdown', () => this.warmupTTS(), { once: true });
        // 加载单人模式个人最快记录
        try {
          const v = localStorage.getItem('wordpair_pb');
          if (v) this.singlePlayerPb = parseFloat(v);
        } catch(e) {}
        // 读取构建版本号
        try {
          const el = document.querySelector('meta[name="build-revision"]');
          if (el) this.buildVersion = el.content;
        } catch(e) {}
        // 读取打击特效开关（默认开）
        try {
          if (localStorage.getItem('wordpair_fx') === '0') this.fxEnabled = false;
        } catch(e) {}
        // WAVE2：PWA 离线安装 — 在线版注册 service worker（file:// 不注册，本地版本来就是单文件离线）；失败静默
        if ('serviceWorker' in navigator && !this._isLocal()) {
          navigator.serviceWorker.register('sw.js').catch(() => {});
        }
        // 本地 file:// 版 fetch 远程 version.json 检查更新（只拉数据，不加载远程 JS）
        if (this.buildVersion && this._isLocal()) {
          fetch('https://word-pair-pk.hdilp.top/version.json?t=' + Date.now(), { cache: 'no-store' })
            .then(r => { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
            .then(data => {
              this.versionJsLoaded = true;
              if (data.revision && data.revision !== this.buildVersion) {
                this.remoteVersion = data.revision;
                this.updateAvailable = true;
              }
            })
            .catch(() => {});
        } else if (this.buildVersion) {
          this.versionJsLoaded = true; // 在线版无需远程检测
        }
        // 防 Android 系统返回手势（会触发 popstate）
        history.pushState(null, '', location.href);
        window.addEventListener('popstate', this.handleSystemBack);
        // 首屏入场动画 — 双 rAF：第一帧 paint 初始隐藏状态，第二帧再切 class
        this.$nextTick(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              this.homeReady = true;

              // 星尘升腾 ✦
              this._spawnStardust();
            });
          });
        });

        // 加载完成后隐藏进度条
        this.$nextTick(() => {
          // 等待字体也加载完成（Google Fonts 可能晚于 Vue）
          Promise.allSettled([
            document.fonts ? document.fonts.ready : Promise.resolve(),
          ]).then(() => {
            const loader = document.getElementById('pageLoader');
            if (loader) loader.classList.add('page-loader--done');
            const app = document.getElementById('app');
            if (app) app.classList.add('app--ready');
          });
        });
      },
      beforeUnmount() {
        clearInterval(this.p1Timer);
        clearInterval(this.p2Timer);
        window.removeEventListener('popstate', this.handleSystemBack);
        window.removeEventListener('pointerdown', this.handleFxPointerDown);
      },
    }).mount('#app');
  