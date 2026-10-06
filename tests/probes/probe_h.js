// WAVE2 探针 H：心形生命值（单人挑战）— 开局 5 心/扣心/0 心提前结束
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

  // 首页 → 单人挑战
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.home-view__actions .btn')];
    const b = btns.find(x => x.textContent.includes('单人挑战'));
    if (b) b.click();
  });
  await sleep(400);
  await page.evaluate(() => { document.querySelector('.select-summary__actions .btn--primary').click(); });
  await sleep(400);
  await sleep(3400); // 等倒计时结束

  const snap = async () => page.evaluate(() => {
    const proxy = document.querySelector('#app')._vnode.component.proxy;
    return {
      hearts: proxy.hearts,
      matched: proxy._p1MatchSet.size,
      result: proxy.gameResult ? proxy.gameResult.winner : null,
      heartDom: document.querySelectorAll('.heart').length,
      lostDom: document.querySelectorAll('.heart--lost').length,
      overlay: !!document.querySelector('.result-overlay'),
    };
  });

  let s = await snap();
  check('单人开局 ♥×5 显示（hearts=5, DOM 5 颗）', s.hearts === 5 && s.heartDom === 5, JSON.stringify(s));

  // 错 1 次
  await page.click('.game-side--p1 .game-card[data-card-id="p1-en-0"]');
  await sleep(150);
  await page.click('.game-side--p1 .game-card[data-card-id="p1-zh-1"]');
  await sleep(200);
  s = await snap();
  check('配错 1 次 → ♥×4（hearts=4, 灭 1 颗）', s.hearts === 4 && s.lostDom === 1 && s.matched === 0, JSON.stringify(s));

  // 再错 3 次（共 4 次）
  const pairs = [[2, 3], [4, 5], [6, 7]];
  for (const [a, b] of pairs) {
    await page.click('.game-side--p1 .game-card[data-card-id="p1-en-' + a + '"]');
    await sleep(120);
    await page.click('.game-side--p1 .game-card[data-card-id="p1-zh-' + b + '"]');
    await sleep(180);
  }
  s = await snap();
  check('共错 4 次 → ♥×1（hearts=1, 灭 4 颗）', s.hearts === 1 && s.lostDom === 4, JSON.stringify(s));

  // 第 5 次错 → 0 心 → 游戏提前结束，匹配数 < 8
  await page.click('.game-side--p1 .game-card[data-card-id="p1-en-1"]');
  await sleep(150);
  await page.click('.game-side--p1 .game-card[data-card-id="p1-zh-0"]');
  await sleep(300);
  s = await snap();
  check('错 5 次 → 0 心游戏结束（gameResult 非空）', s.hearts === 0 && s.result === 'single', JSON.stringify(s));
  check('0 心结束时匹配数 < 8（提前结束）', s.matched < 8, 'matched=' + s.matched);
  check('0 心结束弹层出现', s.overlay, JSON.stringify(s));

  console.log(failures === 0 ? '\n=== 探针 H 全绿 ===' : '\n=== 探针 H 失败 ' + failures + ' 项 ===');
  await browser.close();
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('PROBE ERROR', e); process.exit(2); });
