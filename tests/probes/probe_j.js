// WAVE2 探针 J：单词图鉴（codex）— 自动收集/字段完整/图鉴入口/统计/搜索/重复不覆盖
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
  await page.evaluate(() => localStorage.removeItem('wordpair_codex'));

  const openSingle = async () => {
    await page.evaluate(() => {
      const proxy = document.querySelector('#app')._vnode.component.proxy;
      if (proxy.currentView !== 'home') proxy.goHome();
    });
    await sleep(300);
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('.home-view__actions .btn')];
      const b = btns.find(x => x.textContent.includes('单人挑战'));
      if (b) b.click();
    });
    await sleep(400);
    await page.evaluate(() => { document.querySelector('.select-summary__actions .btn--primary').click(); });
    await sleep(400);
    await sleep(3400); // 等倒计时
  };

  // ===== 局 1：配 2 对 → codex 2 key =====
  await openSingle();
  await page.click('.game-side--p1 .game-card[data-card-id="p1-en-0"]');
  await sleep(150);
  await page.click('.game-side--p1 .game-card[data-card-id="p1-zh-0"]');
  await sleep(150);
  await page.click('.game-side--p1 .game-card[data-card-id="p1-en-1"]');
  await sleep(150);
  await page.click('.game-side--p1 .game-card[data-card-id="p1-zh-1"]');
  await sleep(200);

  let codexInfo = await page.evaluate(() => {
    const codex = JSON.parse(localStorage.getItem('wordpair_codex') || '{}');
    const keys = Object.keys(codex);
    return {
      keys,
      entries: keys.map(k => codex[k]),
      allFields: keys.every(k => codex[k].en && codex[k].zh && codex[k].book && codex[k].unit && codex[k].date),
      key0: keys[0],
    };
  });
  check('配对 2 对 → codex 含 2 个 key', codexInfo.keys.length === 2, JSON.stringify(codexInfo.keys));
  check('codex 字段完整（en/zh/book/unit/date）', codexInfo.allFields, JSON.stringify(codexInfo.entries));

  // 把第一个词的 date 改为过去，验证重复收集不覆盖
  await page.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('wordpair_codex'));
    const k = Object.keys(c)[0];
    c[k].date = '2020-01-01';
    localStorage.setItem('wordpair_codex', JSON.stringify(c));
  });
  const firstEn = await page.evaluate(() => {
    const codex = JSON.parse(localStorage.getItem('wordpair_codex') || '{}');
    const k = Object.keys(codex)[0];
    return codex[k].en;
  });
  await page.evaluate(() => document.querySelector('#app')._vnode.component.proxy.goHome());
  await sleep(300);

  // ===== 局 2：重复配同一个词 → date 未被覆盖 =====
  // 随机抽词命中特定词概率极低，开局后把本局第 0 对的词对象替换为目标词（走真实 processCardClick→collectWord 链路）
  await openSingle();
  await page.evaluate((en) => {
    const proxy = document.querySelector('#app')._vnode.component.proxy;
    const enCard = proxy.p1Cards.find(c => c.id === 'p1-en-0');
    const zhCard = proxy.p1Cards.find(c => c.id === 'p1-zh-0');
    const x = { en: en, zh: '重复收集测试' };
    if (enCard) enCard.text = x.en;
    if (zhCard) zhCard.text = x.zh;
    proxy.dualGameWords[0] = x;
  }, firstEn);
  await sleep(3400); // 等倒计时结束
  await page.click('.game-side--p1 .game-card[data-card-id="p1-en-0"]');
  await sleep(150);
  await page.click('.game-side--p1 .game-card[data-card-id="p1-zh-0"]');
  await sleep(200);
  codexInfo = await page.evaluate(() => {
    const codex = JSON.parse(localStorage.getItem('wordpair_codex') || '{}');
    const keys = Object.keys(codex);
    return { n: keys.length, firstDate: codex[keys[0]] ? codex[keys[0]].date : null, key0: keys[0] };
  });
  check('重复配同一词 → 仍 2 key（不新增）', codexInfo.n === 2, JSON.stringify(codexInfo));
  check('重复配同一词 → 原日期未被覆盖（仍 2020-01-01）', codexInfo.firstDate === '2020-01-01', JSON.stringify(codexInfo));
  await page.evaluate(() => document.querySelector('#app')._vnode.component.proxy.goHome());
  await sleep(300);

  // ===== 复习首页 → 图鉴入口 → codexView =====
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.home-view__actions .btn')];
    const b = btns.find(x => x.textContent.includes('单词复习'));
    if (b) b.click();
  });
  await sleep(400);
  const hasEntry = await page.evaluate(() => !!document.querySelector('.review-view__codex'));
  check('复习首页有单词图鉴入口', hasEntry);
  await page.evaluate(() => { document.querySelector('.review-view__codex').click(); });
  await sleep(400);
  const codexView = await page.evaluate(() => {
    const proxy = document.querySelector('#app')._vnode.component.proxy;
    const codex = JSON.parse(localStorage.getItem('wordpair_codex') || '{}');
    return {
      view: proxy.currentView,
      count: proxy.codexCount,
      total: proxy.codexTotal,
      lsCount: Object.keys(codex).length,
      domStats: !!document.querySelector('.codex-stats'),
    };
  });
  check('点击入口进入 codexView', codexView.view === 'codex', JSON.stringify(codexView));
  check('统计栏数字与 localStorage 一致', codexView.count === codexView.lsCount, JSON.stringify(codexView));
  check('统计栏存在', codexView.domStats, JSON.stringify(codexView));

  // ===== 搜索：输入已收集词的 en 前缀 → 结果含该词 =====
  const searchWord = await page.evaluate(() => {
    const proxy = document.querySelector('#app')._vnode.component.proxy;
    const codex = proxy.codexData;
    const k = Object.keys(codex)[0];
    return { en: codex[k].en, prefix: codex[k].en.toLowerCase().slice(0, 3) };
  });
  await page.evaluate((q) => {
    document.querySelector('#app')._vnode.component.proxy.codexSearch = q;
  }, searchWord.prefix);
  await sleep(300);
  const searchResult = await page.evaluate((en) => {
    const proxy = document.querySelector('#app')._vnode.component.proxy;
    return proxy.codexGroups.some(g => g.words.some(w => w.en === en && w.collected));
  }, searchWord.en);
  check('搜索前缀 → 结果含该已收集词（' + searchWord.en + '）', searchResult, JSON.stringify(searchWord));

  console.log(failures === 0 ? '\n=== 探针 J 全绿 ===' : '\n=== 探针 J 失败 ' + failures + ' 项 ===');
  await browser.close();
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('PROBE ERROR', e); process.exit(2); });
