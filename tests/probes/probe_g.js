// WAVE2 探针 G：抢答 PK（rush）— 开局/状态机/抢牌归属/结束判定
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

  // 首页 → 点"抢答 PK"
  const rushBtn = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.home-view__actions .btn')];
    const b = btns.find(x => x.textContent.includes('抢答 PK'));
    if (b) b.click();
    return !!b;
  });
  check('首页存在"抢答 PK"按钮', rushBtn);
  await sleep(400);

  // 选词视图 → 开始
  await page.evaluate(() => { document.querySelector('.select-summary__actions .btn--primary').click(); });
  await sleep(400);

  const st = await page.evaluate(() => {
    const proxy = document.querySelector('#app')._vnode.component.proxy;
    return {
      view: proxy.currentView,
      mode: proxy.gameMode,
      p1Len: proxy.p1Cards.length,
      p2Len: proxy.p2Cards.length,
      domCards: document.querySelectorAll('.game-card').length,
    };
  });
  check('rush 开局 currentView=game', st.view === 'game', JSON.stringify(st));
  check('rush 开局 gameMode=rush', st.mode === 'rush', JSON.stringify(st));
  check('公共池 16 张卡（p1Cards=16, p2Cards=空）', st.p1Len === 16 && st.p2Len === 0, JSON.stringify(st));

  // 等倒计时结束（ready 800 + 3/2/1 各 600 + go 450）
  await sleep(3400);

  const state = async () => page.evaluate(() => {
    const proxy = document.querySelector('#app')._vnode.component.proxy;
    return {
      p1: proxy._p1MatchSet.size,
      p2: proxy._p2MatchSet.size,
      sel: proxy.rushSelected ? proxy.rushSelected.id : null,
      owner: proxy.rushOwner,
    };
  });

  // 场景 1：P1 选中 A → 点 A 的配对卡 → 自己得分+1
  await page.click('.game-side--p1 .game-card[data-card-id="p1-en-0"]');
  await sleep(150);
  let s1 = await state();
  check('场景1a：P1 选中卡 A（owner=p1）', s1.sel === 'p1-en-0' && s1.owner === 'p1', JSON.stringify(s1));
  await page.click('.game-side--p1 .game-card[data-card-id="p1-zh-0"]');
  await sleep(150);
  s1 = await state();
  check('场景1b：自己配对得分+1（p1MatchSet=1, p2MatchSet=0）', s1.p1 === 1 && s1.p2 === 0, JSON.stringify(s1));

  // 场景 2（抢）：对方（P2）选中卡 B → 自己（P1）点 B 的配对卡 → 归自己
  await page.click('.game-side--p2 .game-card[data-card-id="p1-en-1"]');
  await sleep(150);
  let s2 = await state();
  check('场景2a：P2 选中卡 B（owner=p2）', s2.sel === 'p1-en-1' && s2.owner === 'p2', JSON.stringify(s2));
  await page.click('.game-side--p1 .game-card[data-card-id="p1-zh-1"]');
  await sleep(150);
  s2 = await state();
  check('场景2b：抢！配对归完成者 P1（p1MatchSet=2, p2MatchSet=0）', s2.p1 === 2 && s2.p2 === 0, JSON.stringify(s2));

  // 场景 3：自己选中卡 C → 对方点无关卡 D → C 仍选中（不被顶掉），无得分
  await page.click('.game-side--p1 .game-card[data-card-id="p1-en-2"]');
  await sleep(150);
  let s3 = await state();
  check('场景3a：P1 选中卡 C（owner=p1）', s3.sel === 'p1-en-2' && s3.owner === 'p1', JSON.stringify(s3));
  await page.click('.game-side--p2 .game-card[data-card-id="p1-zh-5"]');
  await sleep(150);
  s3 = await state();
  check('场景3b：对方无效点击不顶掉选中（C 仍选中）', s3.sel === 'p1-en-2' && s3.owner === 'p1', JSON.stringify(s3));
  check('场景3c：无效点击无得分（p1=2, p2=0 不变）', s3.p1 === 2 && s3.p2 === 0, JSON.stringify(s3));

  // 场景 4：配完剩余 6 对 → 8 对全消 → 弹层出现且胜者为得分多的一方
  // C(p1-en-2) 仍选中：直接点其配对卡完成第一对
  await page.click('.game-side--p1 .game-card[data-card-id="p1-zh-2"]');
  await sleep(120);
  const pairs = [3, 4, 5, 6, 7];
  for (const pid of pairs) {
    await page.click('.game-side--p1 .game-card[data-card-id="p1-en-' + pid + '"]');
    await sleep(120);
    await page.click('.game-side--p1 .game-card[data-card-id="p1-zh-' + pid + '"]');
    await sleep(120);
  }
  await sleep(400);
  const fin = await page.evaluate(() => {
    const proxy = document.querySelector('#app')._vnode.component.proxy;
    return {
      p1: proxy._p1MatchSet.size,
      p2: proxy._p2MatchSet.size,
      result: proxy.gameResult ? proxy.gameResult.winner : null,
      popup: proxy.gameResultPopup ? proxy.gameResultPopup.winner : null,
      popupDom: !!document.querySelector('.radar-popup'),
    };
  });
  check('场景4：8 对全消（p1=8, p2=0）', fin.p1 === 8 && fin.p2 === 0, JSON.stringify(fin));
  check('场景4：弱点雷达弹层出现', fin.popupDom, JSON.stringify(fin));
  check('场景4：胜者为得分多的一方（P1）', fin.result === 'p1' && fin.popup === 'p1', JSON.stringify(fin));

  console.log(failures === 0 ? '\n=== 探针 G 全绿 ===' : '\n=== 探针 G 失败 ' + failures + ' 项 ===');
  await browser.close();
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('PROBE ERROR', e); process.exit(2); });
