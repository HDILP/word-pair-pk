// probe_d5.js — D5 例句配对模式验收（构建产物 index.html）
// 测：首页入口 → 选词视图模式 chips → 第 1 局数据感知（词库有 example 断言真实例句 / 无则断言回退）→
//     注入 example 后高亮拆分 + TTS 整句（第 2 局）→ 配对逻辑/红闪/图鉴/结算弹窗
//     + F-001 触摸双击吞噬守卫（逻辑级链路 + CDP 真实触摸） + F-003 词边界单测 + F-004 delay 唯一性
const puppeteer = require('puppeteer-core');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const URL = process.env.PROBE_URL || 'http://127.0.0.1:8000/index.html';
const CHROME = process.env.CHROME_PATH || process.env.CHROME_PATH_64 || '/usr/bin/google-chrome';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') pageErrors.push('console: ' + m.text()); });

  // TTS 拦截：记录 speak 文本
  await page.evaluateOnNewDocument(() => {
    try {
      window.__ttsCalls = [];
      const orig = window.SpeechSynthesis.prototype.speak;
      window.SpeechSynthesis.prototype.speak = function (u) {
        window.__ttsCalls.push({ text: u.text });
        return orig.call(this, u);
      };
    } catch (e) {}
  });

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
  await page.waitForSelector('#app', { timeout: 20000 });
  await sleep(2500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });

  // 注意：不能直接返回 Vue proxy 对象（puppeteer 深序列化得到 {}，currentView 丢失）——必须在页面内取字段
  const proxy = () => page.evaluate(() => {
    const p = document.querySelector('#app')._vnode.component.proxy;
    return { currentView: p.currentView };
  });
  const results = [];
  const check = (name, cond, extra = '') => {
    results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' :: ' + extra : ''}`);
  };

  // ── 1. 首页入口 ──
  // F-004：首页按钮 transition-delay 唯一性——例句配对（2.2s）不再与听力挑战（1.92s）撞车
  const delayInfo = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.home-view__actions .btn')];
    const delays = btns.map(b => ({ t: b.textContent.trim(), d: b.style.transitionDelay }));
    const sent = delays.find(x => x.t === '例句配对');
    return { count: delays.length, sentDelay: sent ? sent.d : null, sentOccur: sent ? delays.filter(x => x.d === sent.d).length : 0 };
  });
  check('F-004 例句配对按钮 transition-delay 唯一（2.2s 不撞车）', delayInfo.sentDelay === '2.2s' && delayInfo.sentOccur === 1, JSON.stringify(delayInfo));
  const homeBtn = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.home-view__actions .btn')];
    const b = btns.find(x => x.textContent.trim() === '例句配对');
    if (b) b.click();
    return !!b;
  });
  check('首页存在「例句配对」按钮且可点', homeBtn);
  await sleep(700);

  // ── 2. 选词视图模式 chips ──
  const chipInfo = await page.evaluate(() => {
    const chips = [...document.querySelectorAll('.select-mode-chip')];
    return {
      count: chips.length,
      labels: chips.map(c => c.textContent.trim()),
      sentenceOn: !!document.querySelector('.select-mode-chip--on') &&
        document.querySelector('.select-mode-chip--on').textContent.trim() === '例句配对',
      startLabel: (document.querySelector('.select-summary__actions .btn--primary') || {}).textContent || '',
    };
  });
  // 2026-09-19 起选词视图 = 5 个模式 chip + 1 个马拉松开关 chip（toggle，不占模式位）
  check('选词视图 5 个模式 chips + 马拉松开关', chipInfo.count === 6 && chipInfo.labels.filter(l => l.includes('马拉松')).length === 1, JSON.stringify(chipInfo.labels));
  check('sentence chip 高亮选中', chipInfo.sentenceOn);
  check('开始按钮文案=开始例句配对', chipInfo.startLabel.includes('例句配对'), chipInfo.startLabel);

  // ── 2.5 F-003：splitExampleSentence 词边界单测（页面内直接调用，不扰动游戏状态）──
  const splitTests = await page.evaluate(() => {
    const v = document.querySelector('#app')._vnode.component.proxy;
    const t = (sent, en) => v.splitExampleSentence(sent, en);
    return {
      sweptPartial: t('The storm swept away the bridge.', 'sweep'),        // 跨词子串 → 无高亮
      goPartial: t('She has gone home.', 'go'),                            // 短词嵌词尾 → 无高亮
      sweptExact: t('The storm swept away the bridge.', 'swept'),          // 整词 → 高亮
      startBoundary: t('Sweep the floor now.', 'sweep'),                   // 句首 → 高亮
      endBoundary: t('Please sweep.', 'sweep'),                            // 句尾 → 高亮
      phraseNoMatch: t('He signed up for the club.', 'sign up (for sth)'), // 短语无原形 → 回退（保持原行为）
      phraseExact: t('Please sign up for the course.', 'sign up'),         // 短语整词 → 高亮
      caseInsensitive: t('THE CAT sat here.', 'cat'),                      // 大小写不敏感保留
    };
  });
  check('F-003 跨词子串不高亮（sweep→swept / go→gone）', splitTests.sweptPartial.word === '' && splitTests.goPartial.word === '', JSON.stringify({ sp: splitTests.sweptPartial, go: splitTests.goPartial }));
  check('F-003 整词/句首/句尾高亮正常', splitTests.sweptExact.word === 'swept' && splitTests.startBoundary.word === 'Sweep' && splitTests.endBoundary.word === 'sweep', JSON.stringify(splitTests.sweptExact));
  check('F-003 短语动词无原形回退不变（sign up (for sth)）', splitTests.phraseNoMatch.word === '' && splitTests.phraseNoMatch.before === 'He signed up for the club.' && splitTests.phraseExact.word === 'sign up', JSON.stringify(splitTests.phraseNoMatch));
  check('F-003 大小写不敏感保留', splitTests.caseInsensitive.word === 'CAT', JSON.stringify(splitTests.caseInsensitive));

  // ── 3. 第 1 局：数据感知断言 —— 读当前词库/实际渲染结果决定预期形态，
  //      词库 8 词全有 example → 断言显示真实例句（fallbackAll=false）；
  //      无 example → 断言回退 en 卡面（fallbackAll=true）。数据变化不会假红。
  await page.evaluate(() => {
    document.querySelector('.select-summary__actions .btn--primary').click();
  });
  // 轮询观察 currentView 变化（诊断：Transition out-in 期间状态读取）
  const viewTrace = [];
  for (let i = 0; i < 15; i++) {
    await sleep(150);
    const v = await proxy();
    viewTrace.push(v && v.currentView);
    if (viewTrace[viewTrace.length - 1] === 'sentenceGame') break;
  }
  const st = await proxy();
  check('进入 sentenceGame 视图', st.currentView === 'sentenceGame', st.currentView);
  console.log('  [debug] currentView trace:', JSON.stringify(viewTrace));

  // currentView 已切换但 Transition out-in 还在等旧视图退场——DOM 未渲染，必须等卡片出现
  await page.waitForSelector('.sentence-grid .game-card', { timeout: 5000 });
  await sleep(200);

  const g1 = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.sentence-grid .game-card')];
    const v = document.querySelector('#app')._vnode.component.proxy;
    const ex = v.sentenceCards.filter(c => c.type === 'en');
    return {
      cardCount: cards.length,
      sentenceTextCount: document.querySelectorAll('.sentence-text').length,
      hlCount: document.querySelectorAll('.sentence-text__hl').length,
      fallbackAll: ex.every(c => c._sWord === c._word.en && c.text === c._word.en),
      allHaveEx: ex.every(c => (c._word.example || '').length > 0),
      splitFoundCount: ex.filter(c => !!c._sWord).length,
      pairCount: v.sentenceCardPairCount,
    };
  });
  // 高亮数断言数据感知：hl 只渲染在拆分命中的卡上（_sWord 非空）；例句不含原形词（如短语动词）时无高亮属正常
  check('16 卡 / 8 例句卡 / 高亮数=拆分命中数', g1.cardCount === 16 && g1.sentenceTextCount === 8 && g1.hlCount === g1.splitFoundCount, JSON.stringify(g1));
  if (g1.allHaveEx) {
    // 词库已注入 example → 第 1 局应显示真实例句而非回退
    check('词库已注入 example → 第 1 局显示真实例句（fallbackAll=false, 8 句）', !g1.fallbackAll && g1.sentenceTextCount === 8, JSON.stringify(g1));
  } else {
    // 词库无 example → 全部回退 en 卡面
    check('词库无 example → 全部回退 en 卡面（_sWord=en, text=en）', g1.fallbackAll, JSON.stringify(g1));
  }

  // 先做一次错误配对（选中 ex → 点错 zh → wrong 红闪）
  const wrongTest = await page.evaluate(async () => {
    const v = document.querySelector('#app')._vnode.component.proxy;
    const cards = v.sentenceCards;
    const ex = cards.find(c => c.type === 'en');
    const wrongZh = cards.find(c => c.type === 'zh' && c.pairId !== ex.pairId);
    document.querySelector(`[data-card-id="${ex.id}"]`).click();
    await new Promise(r => setTimeout(r, 120));
    document.querySelector(`[data-card-id="${wrongZh.id}"]`).click();
    await new Promise(r => setTimeout(r, 120));
    const wrongEls = document.querySelectorAll('.game-card.wrong');
    return { wrongCount: wrongEls.length, combo: v.sentenceCombo, errKeys: Object.keys(v.sentenceErrors) };
  });
  check('配错 → 双卡 wrong 红闪', wrongTest.wrongCount === 2, JSON.stringify(wrongTest));
  check('配错 → 连击归零 + 错词记录', wrongTest.combo === 0 && wrongTest.errKeys.length === 1, JSON.stringify(wrongTest));
  await sleep(350); // wrong 复位

  // 完成全部 8 对（从错误后状态继续）
  const g1Done = await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const v = document.querySelector('#app')._vnode.component.proxy;
    for (let round = 0; round < 10 && v.sentenceMatchSet.size < 8; round++) {
      const cards = v.sentenceCards.filter(c => !c.matched);
      const ex = cards.find(c => c.type === 'en');
      if (!ex) break;
      const zh = cards.find(c => c.type === 'zh' && c.pairId === ex.pairId);
      document.querySelector(`[data-card-id="${ex.id}"]`).click();
      await sleep(110);
      document.querySelector(`[data-card-id="${zh.id}"]`).click();
      await sleep(110);
    }
    return { matched: v.sentenceMatchSet.size, popup: !!v.sentencePopup, view: v.currentView };
  });
  check('8 对全消 → 结算弹窗', g1Done.matched === 8 && g1Done.popup, JSON.stringify(g1Done));

  const g1pop = await page.evaluate(() => {
    const v = document.querySelector('#app')._vnode.component.proxy;
    const tts = window.__ttsCalls || [];
    const codex = JSON.parse(localStorage.getItem('wordpair_codex') || '{}');
    const review = JSON.parse(localStorage.getItem('wordpair_review') || '{}');
    return {
      popupWrong: v.sentencePopup ? v.sentencePopup.wrong.length : -1,
      popupTotal: v.sentencePopup ? v.sentencePopup.total : -1,
      codexCount: Object.keys(codex).length,
      reviewCount: Object.keys(review).length,
      ttsSpoken: tts.length,
      ttsLast: tts.length ? tts[tts.length - 1].text : '',
    };
  });
  check('结算弹窗含错词 1 个（全 8 对）', g1pop.popupWrong === 1 && g1pop.popupTotal === 8, JSON.stringify(g1pop));
  check('配对成功 → 图鉴收集 8 词', g1pop.codexCount === 8, 'codex=' + g1pop.codexCount);
  check('错词进复习盒子（7 词无错升盒 + 1 错词盒1）', g1pop.reviewCount === 8, 'review=' + g1pop.reviewCount);
  check('TTS 已朗读（配对成功触发）', g1pop.ttsSpoken >= 7, 'tts=' + g1pop.ttsSpoken);

  // ── 4. 第 2 局：注入 example → 高亮拆分 + TTS 整句 ──
  // 返回首页 → 注入 8 条例句 → 再开一局
  await page.evaluate(() => {
    document.querySelector('.review-popup__actions .btn--ghost').click();
  });
  await sleep(600);
  await page.evaluate(() => {
    const words = ALL_WORDS_DATA.books[0].units[0].words;
    for (let i = 0; i < 8; i++) {
      words[i].example = words[i].en + ' is a very important word in this sentence.';
    }
  });
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.home-view__actions .btn')];
    btns.find(x => x.textContent.trim() === '例句配对').click();
  });
  await sleep(700);
  await page.evaluate(() => {
    document.querySelector('.select-summary__actions .btn--primary').click();
  });
  await sleep(600);

  const g2 = await page.evaluate(() => {
    const v = document.querySelector('#app')._vnode.component.proxy;
    const ex = v.sentenceCards.filter(c => c.type === 'en');
    const hlEls = document.querySelectorAll('.sentence-text__hl');
    // 数据感知拆分校验：拼接一致性（before+word+after=text）恒成立；
    // 「精确命中 en（大小写不敏感）」只对非回退词要求——短语动词例句用词形变化
    // （fell away / came to power）时原形子串不命中 → _sWord='' 回退无高亮，F-003 合法行为
    const checks = ex.map(c => {
      const concatOk = c._sBefore + c._sWord + c._sAfter === c.text;
      const fallback = c._sWord === '';
      const ok = fallback
        ? concatOk && c._sBefore === c.text && c._sAfter === ''
        : concatOk && c._sWord.toLowerCase() === c._word.en.toLowerCase();
      return { en: c._word.en, word: c._sWord, fallback, ok };
    });
    return {
      view: v.currentView,
      exCount: ex.length,
      allHaveEx: ex.every(c => (c._word.example || '').length > 0),
      splitOk: checks.every(c => c.ok),
      fallbackCount: checks.filter(c => c.fallback).length,
      fallbackWords: checks.filter(c => c.fallback).map(c => c.en),
      hlCount: hlEls.length,
      splitFoundCount: ex.filter(c => !!c._sWord).length,
      hlTexts: [...hlEls].map(e => e.textContent.trim()),
    };
  });
  check('第 2 局进入视图且 8 词全部带例句', g2.view === 'sentenceGame' && g2.exCount === 8 && g2.allHaveEx, JSON.stringify(g2));
  check(
    `例句卡高亮拆分正确（拆分一致恒成立，非回退词 word=en）${g2.fallbackCount ? `含短语动词回退 ${g2.fallbackCount} 个无高亮` : '无回退'}`,
    g2.splitOk && g2.hlCount === g2.splitFoundCount,
    'fallbackWords=' + JSON.stringify(g2.fallbackWords) + ' hl=' + JSON.stringify(g2.hlTexts.slice(0, 3))
  );

  // 完成第 2 局（全对），验证 TTS 朗读的是整句例句
  await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const v = document.querySelector('#app')._vnode.component.proxy;
    for (let round = 0; round < 10 && v.sentenceMatchSet.size < 8; round++) {
      const cards = v.sentenceCards.filter(c => !c.matched);
      const ex = cards.find(c => c.type === 'en');
      if (!ex) break;
      const zh = cards.find(c => c.type === 'zh' && c.pairId === ex.pairId);
      document.querySelector(`[data-card-id="${ex.id}"]`).click();
      await sleep(110);
      document.querySelector(`[data-card-id="${zh.id}"]`).click();
      await sleep(110);
    }
  });
  const g2end = await page.evaluate(() => {
    const v = document.querySelector('#app')._vnode.component.proxy;
    const tts = window.__ttsCalls || [];
    const ex = v.sentenceCards.find(c => c.type === 'en');
    const exampleText = ex ? ex.text : '';
    const spokenExample = tts.some(t => t.text === exampleText);
    return {
      popup: !!v.sentencePopup,
      exampleText,
      spokenExample,
      ttsTotal: tts.length,
    };
  });
  check('第 2 局完成 → 结算', g2end.popup, JSON.stringify({ t: g2end.exampleText }));
  check('TTS 朗读整句例句（含目标词完整句）', g2end.spokenExample, 'example="' + g2end.exampleText.slice(0, 50) + '..." ttsTotal=' + g2end.ttsTotal);

  // ── 5. F-001：触摸双击吞噬守卫（第 3 局）──
  // 覆盖方式说明：headless 中 CDP 触摸的 touchstart 被 preventDefault 后浏览器一般不派发合成 click，
  // 因此 (a) 用页面内 JS 直接模拟「touchend 置位 → 合成 click」完整事件链做逻辑级验证（守卫吞 click 的直接证据），
  // (b) 用 CDP Input.dispatchTouchEvent 走真实触摸输入管线验证触摸路径端到端可用。
  await page.evaluate(() => {
    document.querySelector('.review-popup__actions .btn--ghost').click();
  });
  await sleep(600);
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.home-view__actions .btn')];
    btns.find(x => x.textContent.trim() === '例句配对').click();
  });
  await sleep(700);
  await page.evaluate(() => {
    document.querySelector('.select-summary__actions .btn--primary').click();
  });
  await page.waitForSelector('.sentence-grid .game-card', { timeout: 5000 });
  await sleep(200);

  // (a) 逻辑级链路验证：touchend 置位 → 合成 click 必须被守卫吞掉（选中保持），守卫一次性消费
  const logicTouch = await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const v = document.querySelector('#app')._vnode.component.proxy;
    const X = v.sentenceCards.find(c => c.type === 'en' && !c.selected);
    const elX = document.querySelector(`[data-card-id="${X.id}"]`);
    v._sentenceTouchId = X.id;
    v.handleSentenceTouchEnd();            // 真实设备上由 touchend 触发：置位 + 立即处理选中
    await sleep(80);
    const afterTouch = { selected: v.sentenceSelected ? v.sentenceSelected.id : null, processed: v.sentenceTouchProcessed, selClass: elX.classList.contains('selected') };
    elX.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); // 浏览器在 touchend 后派发的合成 click
    await sleep(80);
    const afterClick = { selected: v.sentenceSelected ? v.sentenceSelected.id : null, processed: v.sentenceTouchProcessed, selClass: elX.classList.contains('selected') };
    elX.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); // 守卫已消费 → 下一次 click 正常处理
    await sleep(80);
    const afterSecond = { selected: v.sentenceSelected ? v.sentenceSelected.id : null, processed: v.sentenceTouchProcessed, selClass: elX.classList.contains('selected') };
    return { X: X.id, afterTouch, afterClick, afterSecond };
  });
  check('F-001 touchend 链路选中卡（置位+立即处理）', logicTouch.afterTouch.selected === logicTouch.X && logicTouch.afterTouch.processed === true && logicTouch.afterTouch.selClass === true, JSON.stringify(logicTouch.afterTouch));
  check('F-001 合成 click 被守卫吞掉（选中保持，不闪 cancel）', logicTouch.afterClick.selected === logicTouch.X && logicTouch.afterClick.selClass === true && logicTouch.afterClick.processed === false, JSON.stringify(logicTouch.afterClick));
  check('F-001 守卫一次性消费（后续 click 正常处理：同卡取消选中）', logicTouch.afterSecond.selected === null && logicTouch.afterSecond.selClass === false, JSON.stringify(logicTouch.afterSecond));

  // (b) CDP 真实触摸事件：touchStart+touchEnd 点一张卡，断言选中保持 + 无二次取消
  const Y = await page.evaluate(() => {
    const v = document.querySelector('#app')._vnode.component.proxy;
    const y = v.sentenceCards.find(c => c.type === 'en' && !c.selected);
    window.__compatClick = [];
    document.querySelector('.sentence-grid').addEventListener('click', e => {
      const el = e.target.closest('.game-card');
      window.__compatClick.push(el ? el.dataset.cardId : null);
    });
    const r = document.querySelector(`[data-card-id="${y.id}"]`).getBoundingClientRect();
    return { id: y.id, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  });
  const cdp = await page.createCDPSession();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: Y.x, y: Y.y }] });
  await sleep(100);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(400);
  const touchState = await page.evaluate(Yid => {
    const v = document.querySelector('#app')._vnode.component.proxy;
    const card = v.sentenceCards.find(c => c.id === Yid);
    return {
      selected: v.sentenceSelected ? v.sentenceSelected.id : null,
      cardSel: !!card.selected,
      compatClicks: (window.__compatClick || []).length,
    };
  }, Y.id);
  check('F-001 CDP 真实触摸 → 卡选中（触摸路径端到端可用）', touchState.selected === Y.id && touchState.cardSel === true, JSON.stringify(touchState));
  check('F-001 CDP 触摸后选中不丢（合成 click 被吞或无合成 click）', touchState.selected === Y.id, 'compatClicks=' + touchState.compatClicks);

  // ── 6. Vue 编译/页面错误 ──
  const appLen = await page.evaluate(() => document.querySelector('#app').innerHTML.length);
  check('#app 渲染非空（Vue 编译无错误 30）', appLen > 1000, 'len=' + appLen);
  const realErrors = pageErrors.filter(e => !/favicon|manifest|speechSynthesis|not allowed to load local resource|net::|Font/.test(e));
  check('无页面 JS 错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | ') || 'clean');

  console.log('\n===== D5 例句配对探针结果 =====');
  for (const r of results) console.log(r);
  const fails = results.filter(r => r.startsWith('FAIL')).length;
  console.log(`\n${results.length - fails}/${results.length} PASS`);
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('PROBE CRASH:', e); process.exit(2); });
