// WAVE1 探针 B：连击 Combo（成功+1、大字显示、失败清零断连）
// 用法: node probe_b.js
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

  // 单人开局
  await page.click('.btn--accent');
  await sleep(600);
  await page.evaluate(() => { document.querySelector('.select-summary__actions .btn--primary').click(); });
  await sleep(3400);

  // 通过 Vue 实例读取卡片，找配对
  const getPair = (pairIdx) => page.evaluate((idx) => {
    const proxy = document.querySelector('#app')._vnode.component.proxy;
    const cards = proxy.p1Cards;
    const en = cards.find(c => c.pairId === idx && c.type === 'en');
    const zh = cards.find(c => c.pairId === idx && c.type === 'zh');
    return { enId: en && en.id, zhId: zh && zh.id };
  }, pairIdx);

  const clickCard = (id) => page.evaluate((cardId) => {
    const el = document.querySelector(`.game-card[data-card-id="${cardId}"]`);
    el.click();
  }, id);

  const comboState = () => page.evaluate(() => {
    const num = document.querySelector('.combo-banner__num');
    const brk = document.querySelector('.combo-banner__break');
    const proxy = document.querySelector('#app')._vnode.component.proxy;
    return {
      numText: num ? num.textContent.trim() : null,
      breakVisible: !!brk,
      singleCombo: proxy.singleCombo,
      matched: proxy._p1MatchSet.size,
    };
  });

  // 第 1 对：combo → 1
  let p = await getPair(0);
  await clickCard(p.enId);
  await sleep(80);
  await clickCard(p.zhId);
  await sleep(200);
  // 第 2 对：combo → 2
  p = await getPair(1);
  await clickCard(p.enId);
  await sleep(80);
  await clickCard(p.zhId);
  await sleep(200);

  let st = await comboState();
  check('连击=2', st.singleCombo === 2, JSON.stringify(st));
  check('combo 大字显示 2', st.numText === '2 Combo', 'numText=' + st.numText);

  // 配错 1 次（pair2 en + pair3 en 不同 pairId）→ 清零 + 断连
  const bad1 = await getPair(2);
  const bad2 = await getPair(3);
  await clickCard(bad1.enId);
  await sleep(80);
  await clickCard(bad2.enId);
  await sleep(200);
  st = await comboState();
  check('配错后连击归零', st.singleCombo === 0, JSON.stringify(st));
  check('combo 大字隐藏', st.numText === null, 'numText=' + st.numText);
  check('断连提示显示', st.breakVisible, JSON.stringify(st));

  await browser.close();
  console.log(failures === 0 ? 'PROBE_B: ALL GREEN' : 'PROBE_B: ' + failures + ' FAILURES');
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('PROBE_B ERROR:', e.message); process.exit(1); });
