// WAVE2 探针 I：听力挑战（listen）— 4 选项/1 正确/得分/扣心/错词入库/结算
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

  // 首页 → 听力挑战
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.home-view__actions .btn')];
    const b = btns.find(x => x.textContent.includes('听力挑战'));
    if (b) b.click();
  });
  await sleep(400);
  await page.evaluate(() => { document.querySelector('.select-summary__actions .btn--primary').click(); });
  await sleep(400);

  const snap = async () => page.evaluate(() => {
    const proxy = document.querySelector('#app')._vnode.component.proxy;
    return {
      view: proxy.currentView,
      mode: proxy.gameMode,
      index: proxy.listenIndex,
      score: proxy.listenScore,
      hearts: proxy.hearts,
      wrongLen: proxy.listenWrong.length,
      opts: proxy.listenOptions.length,
      corrects: proxy.listenOptions.filter(o => o.correct).length,
      correctPair: proxy.listenOptions.find(o => o.correct) ? proxy.listenOptions.find(o => o.correct).pairId : null,
      popup: proxy.listenPopup ? proxy.listenPopup.score : null,
      popupDom: !!document.querySelector('.review-popup'),
      optDom: document.querySelectorAll('.listen-option').length,
    };
  });

  let s = await snap();
  check('听力开局进入 listenGame 视图', s.view === 'listenGame' && s.mode === 'listen', JSON.stringify(s));
  check('开局 4 张选项卡（DOM 4, 状态 4）', s.optDom === 4 && s.opts === 4, JSON.stringify(s));
  check('每轮恰好 1 张正确', s.corrects === 1, JSON.stringify(s));
  check('正确项 pairId=当前轮次', s.correctPair === s.index, 'pair=' + s.correctPair + ' index=' + s.index);

  const pickCorrect = async () => {
    await page.evaluate(() => {
      const proxy = document.querySelector('#app')._vnode.component.proxy;
      const i = proxy.listenOptions.findIndex(o => o.correct);
      const el = document.querySelectorAll('.listen-option')[i];
      if (el) el.click();
    });
    await sleep(150);
  };
  const pickWrong = async () => {
    await page.evaluate(() => {
      const proxy = document.querySelector('#app')._vnode.component.proxy;
      const i = proxy.listenOptions.findIndex(o => !o.correct);
      const el = document.querySelectorAll('.listen-option')[i];
      if (el) el.click();
    });
    await sleep(150);
  };

  // 第 1 轮点正确 → 得分+1，进入下一轮
  const en0 = await page.evaluate(() => document.querySelector('#app')._vnode.component.proxy.listenWords[0].en);
  await pickCorrect();
  s = await snap();
  check('点正确 → 得分+1 且进入下一轮', s.score === 1 && s.index === 1, JSON.stringify(s));

  // 第 2 轮点错 → hearts-1 + 该词进错词记录，仍进下一轮
  const en1 = await page.evaluate(() => document.querySelector('#app')._vnode.component.proxy.listenWords[1].en);
  await pickWrong();
  s = await snap();
  check('点错 → hearts-1（4）', s.hearts === 4, JSON.stringify(s));
  check('点错 → 错词记录 +1 且为当前词', s.wrongLen === 1, JSON.stringify(s));
  const wrongEn = await page.evaluate(() => document.querySelector('#app')._vnode.component.proxy.listenWrong[0].en);
  check('错词就是本轮词（' + en1 + '）', wrongEn === en1, 'wrong=' + wrongEn);
  check('点错也进下一轮（index=2）', s.index === 2, JSON.stringify(s));

  // 第 3-8 轮全对（共 8 轮，错 1 对 7）
  for (let i = 0; i < 6; i++) await pickCorrect();
  s = await snap();
  check('8 轮结束（index=7, finished）', s.index === 7, JSON.stringify(s));
  check('结算弹层出现（listenPopup 非空 + DOM）', s.popup !== null && s.popupDom, JSON.stringify(s));
  check('得分=7（错 1 对 7）', s.popup === 7, 'score=' + s.popup);

  // 错词进复习盒子 box=1
  const reviewInfo = await page.evaluate((en) => {
    const data = JSON.parse(localStorage.getItem('wordpair_review') || '{}');
    const key = en.trim().toLowerCase().replace(/\s+/g, '_').slice(0, 60);
    const entry = data[key];
    return { key: key, box: entry ? entry.box : null, last: entry ? entry.lastReview : null };
  }, en1);
  check('错词进 wordpair_review 且 box=1', reviewInfo.box === 1, JSON.stringify(reviewInfo));

  console.log(failures === 0 ? '\n=== 探针 I 全绿 ===' : '\n=== 探针 I 失败 ' + failures + ' 项 ===');
  await browser.close();
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('PROBE ERROR', e); process.exit(2); });
