// WAVE1 探针 F：随机事件卡（banner 文本合法/事件类/fog 结束清理/事件池集齐 2 种）
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

  const openRound = async () => {
    await page.evaluate(() => {
      const proxy = document.querySelector('#app')._vnode.component.proxy;
      if (proxy.currentView !== 'home') proxy.goHome();
    });
    for (let i = 0; i < 20; i++) {
      const ok = await page.evaluate(() => !!document.querySelector('.btn--primary'));
      if (ok) break;
      await sleep(100);
    }
    await page.click('.btn--primary');
    await sleep(400);
    await page.evaluate(() => { document.querySelector('.select-summary__actions .btn--primary').click(); });
    for (let i = 0; i < 20; i++) {
      const ok = await page.evaluate(() => !!document.querySelector('.game-board'));
      if (ok) break;
      await sleep(100);
    }
    await sleep(150);
    return page.evaluate(() => {
      const proxy = document.querySelector('#app')._vnode.component.proxy;
      const banner = document.querySelector('.event-banner');
      const board = document.querySelector('.game-board');
      return {
        view: proxy.currentView,
        event: proxy.currentEvent,
        bannerName: proxy.eventBannerName,
        bannerText: banner ? banner.textContent.trim() : null,
        boardClasses: board ? board.className : '',
      };
    });
  };

  const checkFog = async (label) => {
    // fog 效果从 playing 才出现：轮询等 fx-event--fog 挂上（最多 6s）
    let appeared = false;
    for (let i = 0; i < 12; i++) {
      const has = await page.evaluate(() => {
        const b = document.querySelector('.game-board');
        return b ? b.classList.contains('fx-event--fog') : false;
      });
      if (has) { appeared = true; break; }
      await sleep(500);
    }
    check(label + ' fog 在 playing 后出现', appeared);
    const opMid = await page.evaluate(() => {
      const c = document.querySelector('.game-card');
      return c ? getComputedStyle(c).opacity : null;
    });
    check(label + ' fog 中卡片半透明(0.3)', opMid === '0.3', 'opacity=' + opMid);
    // 轮询等待 fog 结束（2.5s + 渐显 1.5s，最多 8s）
    for (let i = 0; i < 16; i++) {
      const ev = await page.evaluate(() => document.querySelector('#app')._vnode.component.proxy.currentEvent);
      if (ev === null) break;
      await sleep(500);
    }
    const fs = await page.evaluate(() => {
      const proxy = document.querySelector('#app')._vnode.component.proxy;
      const board = document.querySelector('.game-board');
      const card = document.querySelector('.game-card');
      return {
        currentEvent: proxy.currentEvent,
        boardHasFog: board ? board.classList.contains('fx-event--fog') : false,
        cardOpacity: card ? getComputedStyle(card).opacity : null,
      };
    });
    check(label + ' fog 结束后事件类移除', fs.currentEvent === null && !fs.boardHasFog, JSON.stringify(fs));
    check(label + ' fog 结束后卡片不透明度恢复 1', fs.cardOpacity === '1', 'opacity=' + fs.cardOpacity);
  };

  const VALID = ['🌫️ 迷雾开局', '🔀 中途洗牌'];
  const clsMap = { fog: 'fx-event--fog', reshuffle: 'fx-event--reshuffle' };
  const seenEvents = new Set();
  let fogChecked = false;

  // 前 3 局：断言 banner 文本合法 + game-board 带对应事件类；fog 局当场检查行为
  for (let i = 0; i < 3; i++) {
    const st = await openRound();
    check('第' + (i + 1) + '局 banner 文本合法', st.view === 'game' && VALID.includes(st.bannerText), JSON.stringify(st));
    // reshuffle 立即挂类；fog 必须未挂类（效果推迟到 playing，checkFog 再验证出现）
    const expectClass = st.bannerName === 'reshuffle' ? 'fx-event--reshuffle' : 'fx-event--fog';
    const expectHas = st.bannerName === 'reshuffle';
    check('第' + (i + 1) + '局 reshuffle 立即挂类 / fog 推迟生效', st.bannerName === null || st.boardClasses.includes(expectClass) === expectHas, 'name=' + st.bannerName + ' event=' + st.event + ' classes=' + st.boardClasses);
    seenEvents.add(st.bannerName);
    if (st.bannerName === 'fog' && !fogChecked) {
      await checkFog('第' + (i + 1) + '局');
      fogChecked = true;
    }
  }

  // 长尾：最多 20 局集齐 2 种事件（验证事件池确实二选一）
  let extra = 0;
  while (seenEvents.size < 2 && extra < 20) {
    const st = await openRound();
    seenEvents.add(st.bannerName);
    if (st.bannerName === 'fog' && !fogChecked) {
      await checkFog('长尾局');
      fogChecked = true;
    }
    extra++;
  }
  check('事件池集齐 2 种（fog/reshuffle）', seenEvents.size === 2, 'seen=' + [...seenEvents].join(','));
  if (!fogChecked) console.log('  WARN 未抽到 fog 局（概率极低），跳过 fog 行为断言');

  await browser.close();
  console.log(failures === 0 ? 'PROBE_F: ALL GREEN' : 'PROBE_F: ' + failures + ' FAILURES');
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('PROBE_F ERROR:', e.message); process.exit(1); });
