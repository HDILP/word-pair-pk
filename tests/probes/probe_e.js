// WAVE1 探针 E：每日挑战（入口/种子稳定/完成写入/重复进入不重置）
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
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  page.on('pageerror', e => console.log('[PAGEERROR]', e.message));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2500);
  let lastDialog = null;
  page.on('dialog', async d => { lastDialog = d.message(); await d.dismiss(); });

  // 1. 首页入口存在
  const hasEntry = await page.evaluate(() => !!document.querySelector('.daily-card'));
  check('首页有今日挑战入口', hasEntry, '');

  // 2. 第一次进入 → game 视图；记录词序列
  await page.evaluate(() => document.querySelector('.daily-card').click());
  await sleep(500);
  const seq1 = await page.evaluate(() => {
    const proxy = document.querySelector('#app')._vnode.component.proxy;
    return {
      view: proxy.currentView,
      dailyMode: proxy.dailyMode,
      words: proxy.singleGameWords.map(w => w.en),
      unit: proxy.dailyPick ? proxy.dailyPick.unit : null,
    };
  });
  check('进入 game 且 dailyMode', seq1.view === 'game' && seq1.dailyMode === true, JSON.stringify(seq1));
  check('词序列 8 个', seq1.words.length === 8, 'len=' + seq1.words.length);

  // 3. 回首页再进 → 序列一致（种子稳定）；不覆盖已完成状态
  await page.evaluate(() => { history.back(); }); // 无效果兜底
  const goHome = await page.evaluate(() => {
    const proxy = document.querySelector('#app')._vnode.component.proxy;
    proxy.goHome();
  });
  await sleep(300);
  await page.evaluate(() => document.querySelector('.daily-card').click());
  await sleep(500);
  const seq2 = await page.evaluate(() => {
    const proxy = document.querySelector('#app')._vnode.component.proxy;
    return proxy.singleGameWords.map(w => w.en);
  });
  check('两次进入词序列一致', JSON.stringify(seq1.words) === JSON.stringify(seq2), JSON.stringify(seq1.words) + ' vs ' + JSON.stringify(seq2));

  // 4. 配完全部 8 对 → done
  await sleep(3400); // 等倒计时
  const clickCard = (id) => page.evaluate((cardId) => {
    document.querySelector(`.game-card[data-card-id="${cardId}"]`).click();
  }, id);
  for (let i = 0; i < 8; i++) {
    const p = await page.evaluate((idx) => {
      const proxy = document.querySelector('#app')._vnode.component.proxy;
      const cards = proxy.p1Cards;
      return {
        enId: cards.find(c => c.pairId === idx && c.type === 'en').id,
        zhId: cards.find(c => c.pairId === idx && c.type === 'zh').id,
      };
    }, i);
    await clickCard(p.enId);
    await sleep(60);
    await clickCard(p.zhId);
    await sleep(150);
  }
  await sleep(500); // endGame
  const afterDone = await page.evaluate(() => {
    const today = new Date().toISOString().slice(0, 10);
    const dc = JSON.parse(localStorage.getItem('wordpair_daily_challenge') || 'null');
    const log = JSON.parse(localStorage.getItem('wordpair_daily_log') || '[]');
    return { dc, log, today, logHasToday: log.includes(today), streakShown: document.querySelector('.daily-card') ? null : null };
  });
  check('挑战 done=true', afterDone.dc !== null && afterDone.dc.done === true, JSON.stringify(afterDone.dc));
  check('date=今天', afterDone.dc && afterDone.dc.date === afterDone.today, '');
  check('log 含今天', afterDone.logHasToday, JSON.stringify(afterDone.log));
  check('log 去重（今天只 1 条）', afterDone.log.filter(d => d === afterDone.today).length === 1, JSON.stringify(afterDone.log));

  // 5. 再次进入 → 提示已完成不重置（弹 dialog）
  await page.evaluate(() => {
    const proxy = document.querySelector('#app')._vnode.component.proxy;
    proxy.goHome();
  });
  await sleep(300);
  lastDialog = null;
  await page.evaluate(() => document.querySelector('.daily-card').click());
  await sleep(400);
  check('重复进入提示已完成', lastDialog !== null && lastDialog.includes('今日已完成'), 'dialog=' + lastDialog);
  const dc2 = await page.evaluate(() => JSON.parse(localStorage.getItem('wordpair_daily_challenge') || 'null'));
  check('done 未被重置', dc2 !== null && dc2.done === true, '');
  const log2 = await page.evaluate(() => JSON.parse(localStorage.getItem('wordpair_daily_log') || '[]'));
  check('log 未重复写', log2.filter(d => d === afterDone.today).length === 1, JSON.stringify(log2));

  await browser.close();
  console.log(failures === 0 ? 'PROBE_E: ALL GREEN' : 'PROBE_E: ' + failures + ' FAILURES');
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('PROBE_E ERROR:', e.message); process.exit(1); });
