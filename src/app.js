    const { createApp, ref, computed, watch, onMounted, onUnmounted, nextTick } = Vue;

    createApp({
      data() {
        return {
          // 视图状态
          currentView: 'home',
          gameMode: 'dual', // 'dual' | 'single'
          singlePlayerPb: null,

          // 词表
          books: [],

          // 游戏状态
          countdownState: 3, // 3 | 2 | 1 | 'go' | 'playing'
          p1Cards: [],
          p2Cards: [],
          p1Selected: null,
          p2Selected: null,
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
      },

      methods: {
        // ===== TTS 预热 =====
        warmupTTS() {
          try {
            // 触发语音列表加载
            const voices = speechSynthesis.getVoices();
            // 非零音量 + 明确语言 + 真实语速预热英文语音数据
            const w = new SpeechSynthesisUtterance('ready');
            w.volume = 0.01;
            w.lang = 'en-US';
            w.rate = 0.9;
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
          this.gameOverInternal = false;
          this.winnerName = '';
        },
        goSelect(mode) {
          if (mode) this.gameMode = mode;
          this.gameResult = null;
          this.gameOverInternal = false;
          this.winnerName = '';
          this.currentView = 'select';
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
          this.warmupTTS();
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
              // TTS 先触发 — 在动画之前出声，消除听觉延迟
              const enText = firstCard.type === 'en' ? firstCard.text : card.text;
              try {
                const utter = new SpeechSynthesisUtterance(enText);
                utter.lang = 'en-US';
                utter.rate = 0.9;
                speechSynthesis.speak(utter);
              } catch(e) {}

              firstCard.selected = false;
              firstCard.matched = true;
              card.matched = true;
              this.reviewMatchSet.add(firstCard.pairId);

              this.reviewSelected = null;

              if (this.reviewMatchSet.size >= this.reviewCardPairCount) {
                this.endReviewGame();
                this.reviewProcessing = false;
                return;
              }
            } else {
              // 配对失败 — 记录错误
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
            `version.js：${loaded}`
          );
        },
        // 下载最新版 / 离线版 — 本地调远程 version.js，在线拉自身
        downloadUpdate() {
          if (this._isLocal()) {
            this.updateAvailable = false;
            if (typeof window.__downloadLatest === 'function') {
              window.__downloadLatest();
              return;
            }
            // version.js 尚未加载（异常情况）→ 即时加载
            const s = document.createElement('script');
            s.src = 'https://word-pair-pk.hdilp.top/version.js?t=' + Date.now();
            s.onerror = () => {
              alert('下载失败，请手动访问 https://word-pair-pk.hdilp.top');
            };
            s.onload = () => { if (s.parentNode) s.parentNode.removeChild(s); };
            document.head.appendChild(s);
            return;
          }
          fetch('/?t=' + Date.now(), { cache: 'no-store' })
            .then(r => r.blob())
            .then(blob => {
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = '词对 PK.html';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              setTimeout(() => URL.revokeObjectURL(url), 5000);
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

        // ===== 开始游戏 =====
        startGame() {
          // 如果是从复习页来的，走自由练习
          if (this.pendingReview) {
            this.pendingReview = false;
            this.startReviewGame('free');
            return;
          }
          this.warmupTTS();
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
          this.p1Matched = 0;
          this.p2Matched = 0;
          this.p1Time = 0;
          this.p2Time = 0;
          this.gameResult = null;
          this.gameOverInternal = false;
          this.p1Counted = false;
          this.p2Counted = false;

          this.currentView = 'game';
          this.startCountdown();
        },

        // ===== 倒计时 =====
        startCountdown() {
          this.countdownState = 'ready';
          setTimeout(() => {
            this.countdownState = 'go';
            setTimeout(() => {
              this.countdownState = 'playing';
              this.startTimers();
            }, 450);
          }, 1200);
        },

        startTimers() {
          clearInterval(this.p1Timer);
          clearInterval(this.p2Timer);
          this.p1Time = 0;
          this.p2Time = 0;
          this.p1Timer = setInterval(() => { this.p1Time += 0.1; }, 100);
          if (this.gameMode === 'dual') {
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

          this.processCardClick(cardId, side);
        },

        // 多点触控：在 .game-board 级别处理，支持 P1+P2 同时点击
        handleBoardTouch(event) {
          if (this.countdownState !== 'playing' || this.gameResult) return;
          // 阻止浏览器默认触控行为（长按菜单、双击缩放等）
          if (event.cancelable) event.preventDefault();
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
            this.processCardClick(entry.cardId, entry.side);
          }
        },

        processCardClick(cardId, side) {
          if (this._processingClick[side]) return;

          const cards = side === 'p1' ? this.p1Cards : this.p2Cards;
          const matchSet = side === 'p1' ? this._p1MatchSet : this._p2MatchSet;
          const selectedRef = side === 'p1' ? 'p1Selected' : 'p2Selected';

          // 找到卡片
          const card = cards.find(c => c.id === cardId);
          if (!card || card.matched) return;

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
              // TTS 先触发 — 在动画之前出声
              const enText = firstCard.type === 'en' ? firstCard.text : card.text;
              try {
                const utter = new SpeechSynthesisUtterance(enText);
                utter.lang = 'en-US';
                utter.rate = 0.9;
                speechSynthesis.speak(utter);
              } catch(e) {}

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
              // 配对失败
              firstCard.selected = false;
              firstCard.wrong = true;
              card.wrong = true;
              // 单人模式：记录错词
              if (side === 'p1' && this.gameMode === 'single') {
                const enText = firstCard.type === 'en' ? firstCard.text : card.text;
                this.reviewGameErrors[enText] = (this.reviewGameErrors[enText] || 0) + 1;
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
            return;
          }

          const winnerTime = side === 'p1' ? this.p1Time : this.p2Time;
          this.gameResult = {
            winner: side,
            time: winnerTime,
          };
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
            case 'game':
            case 'review':
            case 'leaderboard':
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
        // 全局预热 TTS — 首次用户交互时加载语音引擎+英文语音数据
        document.addEventListener('pointerdown', () => this.warmupTTS(), { once: true });
        // mounted 时也试试（兼容 autoplay 宽松的浏览器）
        this.warmupTTS();
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
        // 本地 file:// 版加载远程 version.js 检查更新
        if (this.buildVersion && this._isLocal()) {
          const s = document.createElement('script');
          s.src = 'https://word-pair-pk.hdilp.top/version.js?t=' + Date.now();
          s.onload = () => {
            this.versionJsLoaded = true;
            if (window.__remoteRevision && window.__remoteRevision !== this.buildVersion) {
              this.remoteVersion = window.__remoteRevision;
              this.updateAvailable = true;
            }
            if (s.parentNode) s.parentNode.removeChild(s);
          };
          s.onerror = () => {};
          document.head.appendChild(s);
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
      },
    }).mount('#app');
  