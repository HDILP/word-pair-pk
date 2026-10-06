// probe_marathon2.js — 马拉松开关 v2 验收（无缝续组 + 全模式适用）
// 断言组：
//  A. 单人马拉松：开关 chip → 开局（正常抽事件+倒计时一次）→ 组间无缝（无第二次倒计时）→ 末组按实际对数发牌 → 总计时跨组累计 → 结算行 + PB
//  C. 双人马拉松：双份牌、局分累计、无缝不弹雷达、总结算按局分判胜（并列→末局胜者）
//  D. 抢答马拉松：公共池、跨局得分累计、总结算按总分判胜
// 数据感知：组数/词数/末组牌数全部从 Vue 状态读，不写死
const puppeteer = require('puppeteer-core');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const URL = process.env.PROBE_URL || 'http://127.0.0.1:8000/index.html';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (extra !== undefined ? '  [' + JSON.stringify(extra) + ']' : '')); }
}
const st = (page) => page.evaluate(() => {
  const p = document.querySelector('#app')._vnode.component.proxy;
  return { currentView: p.currentView, gameMode: p.gameMode, countdown: p.countdownState };
});
const getState = (page) => page.evaluate(() => {
  const p = document.querySelector('#app')._vnode.component.proxy;
  return {
    currentView: p.currentView, gameMode: p.gameMode, countdown: p.countdownState,
    marathonOn: p.marathonOn, rounds: p.marathonRounds.length, left: p.marathonRoundsLeft,
    totalWords: p.marathonTotalWords, cards: p.p1Cards.length, p2cards: p.p2Cards.length,
    p1m: p._p1MatchSet.size, p2m: p._p2MatchSet.size,
    wins1: p.marathonP1Wins, wins2: p.marathonP2Wins,
    score1: p.marathonP1Score, score2: p.marathonP2Score,
    banner: p.eventBannerName && p.eventBannerVisible ? p.eventBannerName : null,
    result: p.gameResult ? { winner: p.gameResult.winner, time: p.gameResult.time } : null,
    radarShown: !!p.gameResultPopup,
    p1Time: p.p1Time,
    progressText: (document.querySelector('.marathon-progress') || {}).textContent || null,
  };
});

// 配完当前单人局（P1 click 链路；末组按 dualGameWords.length 判定）
async function playSingle(page) {
  for (let i = 0; i < 40; i++) {
    const s = await page.evaluate(() => {
      const p = document.querySelector('#app')._vnode.component.proxy;
      if (p.gameResult) return 'result';
      if (p._p1MatchSet.size >= (p.dualGameWords || []).length) return 'done';
      const en = p.p1Cards.find(c => c.type === 'en' && !c.matched);
      const zh = en && p.p1Cards.find(c => c.type === 'zh' && !c.matched && c.pairId === en.pairId);
      if (!en || !zh) return 'done';
      const el1 = document.querySelector('[data-card-id="' + en.id + '"]');
      const el2 = document.querySelector('[data-card-id="' + zh.id + '"]');
      if (!el1 || !el2) return 'wait';
      el1.click(); setTimeout(() => el2.click(), 60);
      return 'wait';
    });
    if (s === 'result' || s === 'done') return s;
    await sleep(180);
  }
  return 'timeout';
}
// 双人：指定 side 配完自己一整份
async function playDualFor(page, winner) {
  for (let i = 0; i < 60; i++) {
    const s = await page.evaluate((winner) => {
      const p = document.querySelector('#app')._vnode.component.proxy;
      if (p.gameResult) return 'result';
      const set = winner === 'p1' ? p._p1MatchSet : p._p2MatchSet;
      if (set.size >= (p.dualGameWords || []).length) return 'done';
      const cards = winner === 'p1' ? p.p1Cards : p.p2Cards;
      const en = cards.find(c => c.type === 'en' && !c.matched);
      const zh = en && cards.find(c => c.type === 'zh' && !c.matched && c.pairId === en.pairId);
      if (!en || !zh) return 'done';
      const el1 = document.querySelector('[data-card-id="' + en.id + '"]');
      const el2 = document.querySelector('[data-card-id="' + zh.id + '"]');
      if (!el1 || !el2) return 'wait';
      el1.click(); setTimeout(() => el2.click(), 60);
      return 'wait';
    }, winner);
    if (s === 'result' || s === 'done') return s;
    await sleep(160);
  }
  return 'timeout';
}
const waitPlaying = async (page) => {
  for (let i = 0; i < 24; i++) {
    const s = await st(page);
    if (s.countdown === 'playing') return true;
    await sleep(250);
  }
  return false;
};

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
  await page.waitForSelector('#app', { timeout: 20000 });
  await sleep(6000);

  // ===== A. 单人马拉松 =====
  await page.evaluate(() => { document.querySelector('#app')._vnode.component.proxy.currentView = 'select'; });
  await sleep(500);
  const toggleChip = await page.evaluateHandle(() => [...document.querySelectorAll('.select-mode-chip--marathon')].pop());
  check('A1 选词视图有马拉松开关 chip', !!(await toggleChip.asElement()));
  await toggleChip.asElement().click();
  await sleep(200);
  let g = await getState(page);
  check('A2 开关开启 marathonOn=true', g.marathonOn === true, g.marathonOn);
  await page.evaluate(() => {
    const v = document.querySelector('#app')._vnode.component.proxy;
    v.pickSelectMode('single');
    for (const b of v.books) for (const u of b.units) u._checked = false;
    v.books[0].units[0]._checked = true;
  });
  await sleep(150);
  const summaryText = await page.evaluate(() => (document.querySelector('.select-summary__marathon') || {}).textContent || '');
  check('A3 摘要行显示马拉松提示', summaryText.includes('马拉松'), summaryText);
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.select-summary__actions .btn')];
    btns.find(b => b.textContent.includes('开始')).click();
  });
  await sleep(400);
  await page.waitForSelector('.game-view .game-card', { timeout: 8000 });
  g = await getState(page);
  const ROUNDS = g.rounds, TOTAL = g.totalWords;
  check('A4 开局进入游戏视图', g.currentView === 'game');
  check('A5 组数=ceil(词数/8)（' + TOTAL + '词→' + ROUNDS + '组）', ROUNDS === Math.ceil(TOTAL / 8), { ROUNDS, TOTAL });
  check('A6 剩余组数=总组-1', g.left === ROUNDS - 1, g.left);
  check('A7 正常抽事件(开局横幅=fog/reshuffle)', g.banner === 'fog' || g.banner === 'reshuffle', g.banner);
  check('A8 单人发牌16张', g.cards === 16, g.cards);
  check('A9 心形隐藏(马拉松不扣心)', !(await page.evaluate(() => !!document.querySelector('.game-view .hearts'))));
  check('A10 总进度标签出现 0/' + TOTAL, g.progressText === '0/' + TOTAL, g.progressText);
  check('A11 倒计时正常启动', await waitPlaying(page));

  // 中间组：验证无缝性
  const seenCountdowns = new Set();
  for (let r = 0; r < ROUNDS - 1; r++) {
    const res = await playSingle(page);
    check('A12 第' + (r + 1) + '局配完', res === 'done' || res === 'result', res);
    await sleep(120);
    const mid = await getState(page);
    if (r === 0) {
      check('A13 组间出现 marathon 横幅', mid.banner === 'marathon', mid.banner);
      check('A14 组间倒计时状态保持 playing（不重新读秒）', mid.countdown === 'playing', mid.countdown);
    }
    if (mid.countdown !== 'playing') seenCountdowns.add(mid.countdown);
    await sleep(500); // 400ms 横幅 + 余量
    const next = await getState(page);
    if (r === 0) {
      check('A15 无缝续组后剩余组数-1', next.left === ROUNDS - 2 - r, { left: next.left, expect: ROUNDS - 2 - r });
      check('A16 无缝后配对集清零', next.p1m === 0, next.p1m);
    }
  }
  check('A18 全程未捕获到重新倒计时状态', seenCountdowns.size === 0, [...seenCountdowns]);
  check('A19 总计时跨组累计>0', (await getState(page)).p1Time > 0);

  // 末组：按实际对数发牌
  const lastPairs = TOTAL - (ROUNDS - 1) * 8;
  const lastCards = lastPairs * 2;
  const g2 = await getState(page);
  check('A20 末组发牌 ' + lastCards + ' 张（' + lastPairs + ' 对，数据感知）', g2.cards === lastCards, { got: g2.cards, expect: lastCards });
  const res = await playSingle(page);
  check('A21 末局配完触发结算', res === 'result' || res === 'done', res);
  await sleep(500);
  g = await getState(page);
  check('A22 终局单人结算 winner=single', g.result && g.result.winner === 'single', g.result);
  check('A23 结算时间=全程总时(>' + ((ROUNDS - 1) * 2) + ')', g.result && g.result.time > (ROUNDS - 1) * 2, g.result);
  const modalText = await page.evaluate(() => (document.querySelector('.result-overlay') || {}).textContent || '');
  check('A24 结算弹窗含马拉松统计行', modalText.includes('马拉松') && modalText.includes(TOTAL + ' 词'), modalText.slice(0, 120));
  const pbM = await page.evaluate(() => localStorage.getItem('wordpair_pb_marathon'));
  const pbS = await page.evaluate(() => localStorage.getItem('wordpair_pb'));
  check('A25 PB写入wordpair_pb_marathon', pbM !== null, pbM);
  check('A26 普通单人PB不被污染', pbS === null || pbS === '', pbS);

  // ===== C. 双人马拉松 =====
  await page.evaluate(() => { localStorage.removeItem('wordpair_pb_marathon'); document.querySelector('#app')._vnode.component.proxy.goSelect('dual'); });
  await sleep(400);
  const chip2 = await page.evaluateHandle(() => [...document.querySelectorAll('.select-mode-chip--marathon')].pop());
  await chip2.asElement().click(); // 已开 → 关
  await sleep(100);
  await chip2.asElement().click(); // 再开
  await sleep(100);
  g = await getState(page);
  check('C1 开关可反复 toggle（当前开）', g.marathonOn === true, g.marathonOn);
  await page.evaluate(() => {
    const v = document.querySelector('#app')._vnode.component.proxy;
    for (const b of v.books) for (const u of b.units) u._checked = false;
    v.books[0].units[0]._checked = true;
    const btns = [...document.querySelectorAll('.select-summary__actions .btn')];
    btns.find(b => b.textContent.includes('开始')).click();
  });
  await sleep(400);
  await page.waitForSelector('.game-view .game-card', { timeout: 8000 });
  g = await getState(page);
  check('C2 双人开局 p2 也发牌', g.p2cards === g.cards && g.cards > 0, { p1: g.cards, p2: g.p2cards });
  check('C3 双人正常倒计时', await waitPlaying(page));
  // 中间局 2..ROUNDS-1 全部让 P1 赢（P2 第1局已拿 1 分）
  for (let r = 0; r < ROUNDS - 2; r++) {
    await playDualFor(page, 'p1');
    await sleep(550); // 无缝续组
  }
  const c4 = await playDualFor(page, 'p2');
  check('C4 第2局P2先配完', c4 === 'done' || c4 === 'result', c4);
  await sleep(120);
  let mid = await getState(page);
  check('C5 P2 局分=1（其余局 P1 胜）', mid.wins2 === 1 && mid.wins1 === ROUNDS - 2, { w1: mid.wins1, w2: mid.wins2 });
  check('C6 组间不弹雷达(无缝)', !mid.radarShown, mid.radarShown);
  check('C7 组间不重新倒计时', mid.countdown === 'playing', mid.countdown);
  await sleep(500);
  const c8 = await playDualFor(page, 'p1');
  check('C8 末局配完', c8 === 'result' || c8 === 'done', c8);
  await sleep(500);
  g = await getState(page);
  check('C9 双人马拉松总结算弹雷达', g.radarShown, g.radarShown);
  // 局分：P1 = 1(中间局) + 末局 = ROUNDS-1，P2 = 1 → P1 局分多者胜
  check('C10 局分多者 P1 胜', g.result && g.result.winner === 'p1', { result: g.result, w1: g.wins1, w2: g.wins2 });
  check('C11 结算时间=马拉松总时>0', g.result && g.result.time > 0, g.result);

  // ===== D. 抢答马拉松 =====
  await page.evaluate(() => { document.querySelector('#app')._vnode.component.proxy.goSelect('rush'); });
  await sleep(400);
  await page.evaluate(() => {
    const v = document.querySelector('#app')._vnode.component.proxy;
    if (!v.marathonOn) v.toggleMarathon();
    for (const b of v.books) for (const u of b.units) u._checked = false;
    v.books[0].units[0]._checked = true;
    const btns = [...document.querySelectorAll('.select-summary__actions .btn')];
    btns.find(b => b.textContent.includes('开始')).click();
  });
  await sleep(400);
  await page.waitForSelector('.game-view .game-card', { timeout: 8000 });
  g = await getState(page);
  const RROUNDS = g.rounds;
  check('D1 抢答马拉松开局（公共池 16 张）', g.cards === 16 && g.p2cards === 0, { cards: g.cards, p2: g.p2cards });
  check('D2 倒计时启动', await waitPlaying(page));
  // 第1局：P1 抢 5 对、P2 抢 3 对（P2 直接走 processRushClick 'p2'）
  await page.evaluate(async () => {
    const p = document.querySelector('#app')._vnode.component.proxy;
    const click = async (card) => {
      const el = document.querySelector('[data-card-id="' + card.id + '"]');
      if (el) { el.click(); await new Promise(r => setTimeout(r, 60)); }
    };
    for (let i = 0; i < 5; i++) {
      const en = p.p1Cards.find(c => c.type === 'en' && !c.matched);
      const zh = p.p1Cards.find(c => c.type === 'zh' && !c.matched && c.pairId === en.pairId);
      await click(en); await click(zh);
      await new Promise(r => setTimeout(r, 110));
    }
    for (let i = 0; i < 3; i++) {
      const en = p.p1Cards.find(c => c.type === 'en' && !c.matched);
      const zh = p.p1Cards.find(c => c.type === 'zh' && !c.matched && c.pairId === en.pairId);
      p.processRushClick(zh.id, 'p2'); p.processRushClick(en.id, 'p2');
      await new Promise(r => setTimeout(r, 110));
    }
  });
  await sleep(250);
  mid = await getState(page);
  check('D3 第1局抢答配完触发无缝续组', mid.banner === 'marathon' || mid.left === RROUNDS - 2, { banner: mid.banner, left: mid.left });
  check('D4 跨局得分累计 P1=5 P2=3', mid.score1 === 5 && mid.score2 === 3, { s1: mid.score1, s2: mid.score2 });
  await sleep(600);
  // 剩余局全部 P1 抢完（P1 拿下全部 → 总分远超 P2）
  for (let r = 0; r < RROUNDS - 1; r++) {
    await waitPlaying(page);
    await page.evaluate(async () => {
      const p = document.querySelector('#app')._vnode.component.proxy;
      const click = async (card) => {
        const el = document.querySelector('[data-card-id="' + card.id + '"]');
        if (el) { el.click(); await new Promise(r2 => setTimeout(r2, 50)); }
      };
      for (let guard = 0; guard < 30; guard++) {
        const en = p.p1Cards.find(c => c.type === 'en' && !c.matched);
        if (!en) break;
        const zh = p.p1Cards.find(c => c.type === 'zh' && !c.matched && c.pairId === en.pairId);
        if (!zh) break;
        p.processRushClick(en.id, 'p1'); p.processRushClick(zh.id, 'p1');
        await new Promise(r2 => setTimeout(r2, 90));
      }
    });
    await sleep(550);
  }
  g = await getState(page);
  check('D5 抢答马拉松总结算弹雷达', g.radarShown, g.radarShown);
  check('D6 总分判定 P1 胜', g.result && g.result.winner === 'p1', { result: g.result, s1: g.score1, s2: g.score2 });
  check('D7 结算时间=马拉松总时>0', g.result && g.result.time > 0, g.result);

  check('D8 无页面JS错误', pageErrors.length === 0, pageErrors.slice(0, 3));
  console.log('\n===== probe_marathon2: ' + pass + ' PASS, ' + fail + ' FAIL =====');
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.error('PROBE_CRASH', e); process.exit(2); });
