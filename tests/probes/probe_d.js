// WAVE1 探针 D：双人 PK 错词合并入库（box=1）+ 弱点雷达弹层
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

  // 双人开局（PK 默认 gameMode='dual'）
  await page.click('.btn--primary');
  await sleep(600);
  await page.evaluate(() => { document.querySelector('.select-summary__actions .btn--primary').click(); });
  await sleep(3400);

  const getPair = (pairIdx) => page.evaluate((idx) => {
    const proxy = document.querySelector('#app')._vnode.component.proxy;
    const cards = proxy.p1Cards;
    const en = cards.find(c => c.pairId === idx && c.type === 'en');
    const zh = cards.find(c => c.pairId === idx && c.type === 'zh');
    return { enId: en && en.id, zhId: zh && zh.id, enText: en && en.text };
  }, pairIdx);
  const clickCard = (id) => page.evaluate((cardId) => {
    document.querySelector(`.game-card[data-card-id="${cardId}"]`).click();
  }, id);
  const wkey = s => s.trim().toLowerCase().replace(/\s+/g, '_').slice(0, 60);

  // 故意配错 1 次（pair0 en + pair1 en）
  const p0 = await getPair(0);
  const p1 = await getPair(1);
  await clickCard(p0.enId);
  await sleep(80);
  await clickCard(p1.enId);
  await sleep(400); // wrong 动画 300ms

  // 正常配完全部 8 对
  for (let i = 0; i < 8; i++) {
    const p = await getPair(i);
    await clickCard(p.enId);
    await sleep(60);
    await clickCard(p.zhId);
    await sleep(150);
  }
  await sleep(400); // endGame + 弹层渲染

  const st = await page.evaluate(() => {
    const proxy = document.querySelector('#app')._vnode.component.proxy;
    const radar = document.querySelector('.radar-popup');
    return {
      popupVisible: !!proxy.gameResultPopup,
      popupText: radar ? radar.textContent : null,
      review: JSON.parse(localStorage.getItem('wordpair_review') || '{}'),
      p1Errors: proxy.p1Errors,
    };
  });
  const wrongKey = wkey(p0.enText);
  const entry = st.review[wrongKey];
  check('错词已入库且 box=1', entry !== undefined && entry.box === 1, JSON.stringify(entry));
  check('错词错误次数=1', entry !== undefined && entry.totalErrors === 1, JSON.stringify(entry));
  check('弹层可见', st.popupVisible, '');
  check('弹层含错词', st.popupText !== null && st.popupText.includes(p0.enText), 'popup=' + (st.popupText || '').slice(0, 120));
  check('弹层含获胜方', st.popupText !== null && st.popupText.includes('P1 获胜'), '');
  check('弹层含已加入今日复习', st.popupText !== null && st.popupText.includes('已加入今日复习'), '');
  // 全对词应升 box（正确 7 词 correctStreak=1 → box=2）
  const okKey = wkey((await getPair(2)).enText);
  check('全对词正常升盒', st.review[okKey] && st.review[okKey].box === 2, JSON.stringify(st.review[okKey]));

  // 弹层关闭 → 原 saveResult 流程（姓名输入弹窗出现）
  await page.evaluate(() => { document.querySelector('.radar-popup .btn--primary').click(); });
  await sleep(300);
  const after = await page.evaluate(() => ({
    popupGone: !document.querySelector('.radar-popup'),
    resultOverlayVisible: !!document.querySelector('.result-overlay .result-modal'),
  }));
  check('关闭弹层后原结算弹窗可见', after.popupGone && after.resultOverlayVisible, JSON.stringify(after));

  await browser.close();
  console.log(failures === 0 ? 'PROBE_D: ALL GREEN' : 'PROBE_D: ' + failures + ' FAILURES');
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('PROBE_D ERROR:', e.message); process.exit(1); });
