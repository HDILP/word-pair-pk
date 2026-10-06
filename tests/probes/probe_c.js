// WAVE1 探针 C：3-2-1 擂台倒计时（序列 3→2→1→GO→playing）+ playing 后配对正常
// 用法: node probe_c.js
const puppeteer = require('puppeteer-core');
const CHROME = process.env.CHROME_PATH || process.env.CHROME_PATH_64 || '/usr/bin/google-chrome';
const URL = process.env.PROBE_URL || 'http://127.0.0.1:8000/index.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log('  PASS', name);
  else { console.log('  FAIL', name, detail || ''); failures++; }
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  page.on('pageerror', e => console.log('[PAGEERROR]', e.message));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2500);

  // 单人开局
  await page.click('.btn--accent');
  await sleep(600);
  await page.evaluate(() => { document.querySelector('.select-summary__actions .btn--primary').click(); });

  // 每 300ms 采样 countdown 文本
  const seen = [];
  const t0 = Date.now();
  while (Date.now() - t0 < 4500) {
    const s = await page.evaluate(() => {
      const proxy = document.querySelector('#app')._vnode.component.proxy;
      const el = document.querySelector('.countdown-overlay > div');
      return { state: proxy.countdownState, text: el ? el.textContent.trim() : null };
    });
    seen.push(s);
    await sleep(300);
  }
  const states = seen.map(s => s.state);
  const texts = seen.map(s => s.text);
  const has = (v) => texts.includes(v);
  check('出现 3', has('3'), 'texts=' + JSON.stringify(texts));
  check('出现 2', has('2'), '');
  check('出现 1', has('1'), '');
  check('出现 GO', has('GO !'), '');
  // 顺序：3 在 2 前，2 在 1 前，1 在 GO 前
  const idx = v => texts.indexOf(v);
  check('顺序 3→2→1→GO', idx('3') >= 0 && idx('3') < idx('2') && idx('2') < idx('1') && idx('1') < idx('GO !'), 'idx=' + [idx('3'), idx('2'), idx('1'), idx('GO !')].join(','));
  check('最终 playing', states[states.length - 1] === 'playing', 'last=' + states[states.length - 1]);

  // playing 后点击卡片 → 配对正常
  const proxyInfo = await page.evaluate(() => {
    const proxy = document.querySelector('#app')._vnode.component.proxy;
    const cards = proxy.p1Cards;
    const en = cards.find(c => c.pairId === 0 && c.type === 'en');
    const zh = cards.find(c => c.pairId === 0 && c.type === 'zh');
    return { enId: en.id, zhId: zh.id, countdownState: proxy.countdownState };
  });
  check('倒计时=playing', proxyInfo.countdownState === 'playing', JSON.stringify(proxyInfo));
  const clickCard = (id) => page.evaluate((cardId) => {
    document.querySelector(`.game-card[data-card-id="${cardId}"]`).click();
  }, id);
  await clickCard(proxyInfo.enId);
  await sleep(120);
  await clickCard(proxyInfo.zhId);
  await sleep(300);
  const matched = await page.evaluate(() => {
    const proxy = document.querySelector('#app')._vnode.component.proxy;
    return { matched: proxy._p1MatchSet.size, matchedCards: document.querySelectorAll('.game-card.matched').length };
  });
  check('playing 后配对正常', matched.matched === 1 && matched.matchedCards === 2, JSON.stringify(matched));

  await browser.close();
  console.log(failures === 0 ? 'PROBE_C: ALL GREEN' : 'PROBE_C: ' + failures + ' FAILURES');
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('PROBE_C ERROR:', e.message); process.exit(1); });
