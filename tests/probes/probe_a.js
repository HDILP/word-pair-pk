// WAVE1 探针 A：Phigros 点击特效（游戏内触发/三色/6元素/粒子/清理/游戏外不触发）
// 用法: node probe_a.js
const puppeteer = require('puppeteer-core');
const CHROME = process.env.CHROME_PATH || process.env.CHROME_PATH_64 || '/usr/bin/google-chrome';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
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
  await page.setViewport({ width: 1280, height: 800, hasTouch: true });
  page.on('pageerror', e => console.log('[PAGEERROR]', e.message));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2500);

  // 1. 首页点击 → 游戏外不触发（无特效无声）；点左上空白避开按钮区
  await page.mouse.click(200, 300);
  await sleep(200);
  let n = await page.evaluate(() => document.querySelectorAll('.fx-hit').length);
  check('首页点击不触发特效', n === 0, 'fx-hit=' + n);

  // 2. 单人开局
  await page.click('.btn--accent');
  await sleep(600);
  await page.evaluate(() => { document.querySelector('.select-summary__actions .btn--primary').click(); });
  await sleep(3400); // ready 800 + 3/2/1 各600 + go 450 → playing

  // 3. 左键点卡片 → 黄色 + 6 元素 + 粒子 ≥8
  const box = await page.evaluate(() => {
    const el = document.querySelector('.game-card');
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.click(box.x, box.y, { button: 'left' });
  await sleep(150);
  const fx1 = await page.evaluate(() => {
    const hits = document.querySelectorAll('.fx-hit');
    if (hits.length === 0) return null;
    const h = hits[hits.length - 1];
    return {
      count: hits.length,
      yellow: h.classList.contains('fx-hit--yellow'),
      blue: h.classList.contains('fx-hit--blue'),
      red: h.classList.contains('fx-hit--red'),
      sq: h.querySelectorAll('.fx-sq').length,
      sqRot: h.querySelectorAll('.fx-sq-rot').length,
      cShrink: h.querySelectorAll('.fx-circle-shrink').length,
      cGrow: h.querySelectorAll('.fx-circle-grow').length,
      arc: h.querySelectorAll('.fx-arc-wrap').length,
      particles: h.querySelectorAll('.fx-particle').length,
    };
  });
  check('游戏内左键触发特效', fx1 !== null && fx1.count >= 1, JSON.stringify(fx1));
  check('左键=黄色', fx1 !== null && fx1.yellow, JSON.stringify(fx1));
  check('6 元素齐全', fx1 !== null && fx1.sq >= 1 && fx1.sqRot >= 1 && fx1.cShrink >= 1 && fx1.cGrow >= 1 && fx1.arc >= 2, JSON.stringify(fx1));
  check('粒子 ≥8', fx1 !== null && fx1.particles >= 8, 'particles=' + (fx1 && fx1.particles));

  // 4. 等 700ms → DOM 清理无残留
  await sleep(700);
  n = await page.evaluate(() => document.querySelectorAll('.fx-hit').length);
  check('700ms 后特效无残留', n === 0, 'fx-hit=' + n);

  // 5. 右键→蓝 / 中键→红 / 触摸→黄（右键/中键不触发 click，不影响配对状态）
  const clickAndCheck = async (button, expect, label) => {
    await page.mouse.click(box.x, box.y, { button });
    await sleep(150);
    const info = await page.evaluate(() => {
      const hits = document.querySelectorAll('.fx-hit');
      if (!hits.length) return null;
      const h = hits[hits.length - 1];
      return { yellow: h.classList.contains('fx-hit--yellow'), blue: h.classList.contains('fx-hit--blue'), red: h.classList.contains('fx-hit--red') };
    });
    check(label + ' → ' + expect, info !== null && !!info[expect], JSON.stringify(info));
    await sleep(950); // 等清理
  };
  await clickAndCheck('right', 'blue', '右键');
  await clickAndCheck('middle', 'red', '中键');
  // 触摸（CDP dispatchTouchEvent → pointerType=touch → 恒黄）
  const cdp = await page.createCDPSession();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x, y: box.y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(150);
  const fxTouch = await page.evaluate(() => {
    const hits = document.querySelectorAll('.fx-hit');
    if (!hits.length) return null;
    const h = hits[hits.length - 1];
    return { yellow: h.classList.contains('fx-hit--yellow'), blue: h.classList.contains('fx-hit--blue'), red: h.classList.contains('fx-hit--red') };
  });
  check('触摸 → 黄', fxTouch !== null && fxTouch.yellow, JSON.stringify(fxTouch));

  await browser.close();
  console.log(failures === 0 ? 'PROBE_A: ALL GREEN' : 'PROBE_A: ' + failures + ' FAILURES');
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('PROBE_A ERROR:', e.message); process.exit(1); });
