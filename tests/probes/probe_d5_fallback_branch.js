// probe_d5_fallback_branch.js — 一次性验证：无 example 数据下 else 分支应触发（fallbackAll=true）
const puppeteer = require('puppeteer-core');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const URL = process.env.PROBE_URL || 'http://127.0.0.1:8000/index.html';
const CHROME = process.env.CHROME_PATH || process.env.CHROME_PATH_64 || '/usr/bin/google-chrome';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
  await page.waitForSelector('#app', { timeout: 20000 });
  await sleep(2500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });

  // 剥掉全部 example（模拟旧数据状态）
  await page.evaluate(() => {
    for (const b of ALL_WORDS_DATA.books) for (const u of (b.units || [])) for (const w of (u.words || [])) delete w.example;
  });

  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.home-view__actions .btn')];
    const b = btns.find(x => x.textContent.trim() === '例句配对');
    if (b) b.click();
  });
  await sleep(700);
  await page.evaluate(() => document.querySelector('.select-summary__actions .btn--primary').click());
  for (let i = 0; i < 15; i++) {
    await sleep(150);
    const v = await page.evaluate(() => document.querySelector('#app')._vnode.component.proxy.currentView);
    if (v === 'sentenceGame') break;
  }
  await page.waitForSelector('.sentence-grid .game-card', { timeout: 5000 });
  await sleep(200);

  const g1 = await page.evaluate(() => {
    const v = document.querySelector('#app')._vnode.component.proxy;
    const ex = v.sentenceCards.filter(c => c.type === 'en');
    return {
      allHaveEx: ex.every(c => (c._word.example || '').length > 0),
      fallbackAll: ex.every(c => c._sWord === c._word.en && c.text === c._word.en),
      sentenceTextCount: document.querySelectorAll('.sentence-text').length,
      hlCount: document.querySelectorAll('.sentence-text__hl').length,
      splitFoundCount: ex.filter(c => !!c._sWord).length,
    };
  });
  const pass = !g1.allHaveEx && g1.fallbackAll && g1.sentenceTextCount === 8 && g1.hlCount === g1.splitFoundCount;
  console.log(pass ? 'PASS else 分支（无 example → 全部回退 en 卡面）' : 'FAIL else 分支', JSON.stringify(g1));
  await browser.close();
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error('CRASH:', e); process.exit(2); });
