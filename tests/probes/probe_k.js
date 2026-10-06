// WAVE2 探针 K：PWA — manifest/theme-color/图标真实 PNG/注册/真离线回放/反向验证
// 注：Chromium 的 CDP offline 模拟对 127.0.0.1 无效（实测 fetch 仍成功），真离线 = 杀掉 http.server 再 reload
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const { execSync, spawn } = require('child_process');
const CHROME = process.env.CHROME_PATH || process.env.CHROME_PATH_64 || '/usr/bin/google-chrome';
const URL = process.env.PROBE_URL || 'http://127.0.0.1:8000/index.html';
const PROBE_PORT = (URL.match(/:(\d+)/) || [null, '8000'])[1];
const URL_ORIGIN = URL.replace(/^(https?:\/\/[^\/]+).*$/, '$1');
const ROOT = process.env.PROBE_ROOT || 'D:/codingaria/word-pair-pk';
const SW_PATH = ROOT + '/sw.js';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log('  PASS', name);
  else { console.log('  FAIL', name, detail || ''); failures++; }
}
function pngSize(file) {
  const b = fs.readFileSync(file);
  const sig = b.slice(0, 8).toString('latin1');
  const w = b.readUInt32BE(16);
  const h = b.readUInt32BE(20);
  return { sig, w, h };
}
function stopServer() {
  try {
    const out = execSync('netstat -ano | findstr ":' + PROBE_PORT + '" | findstr "LISTENING"', { encoding: 'utf8' });
    for (const line of out.trim().split('\n')) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0') { try { execSync('taskkill /F /PID ' + pid, { stdio: 'ignore' }); } catch(e) {} }
    }
  } catch(e) {}
}
function startServer() {
  spawn('python3', ['-m', 'http.server', PROBE_PORT], { cwd: ROOT, detached: true, stdio: 'ignore' }).unref();
}
async function waitServerUp(page) {
  for (let i = 0; i < 30; i++) {
    const ok = await page.evaluate(async (uOrigin) => {
      try { await fetch(uOrigin + '/__up__' + Date.now() + '.txt', { cache: 'no-store' }); return true; } catch(e) { return false; }
    }, URL_ORIGIN);
    if (ok) return true;
    await sleep(500);
  }
  return false;
}

(async () => {
  // 保护：上次异常退出可能残留 REVERSE 版 sw.js（探针启动时读到的"原始"必须是干净版）
  const swNow = fs.readFileSync(SW_PATH, 'utf8');
  if (swNow.includes('// REVERSE')) {
    fs.writeFileSync(SW_PATH, swNow.replace('[// REVERSE', '['));
    console.log('  [recover] sw.js 已从 REVERSE 残留还原');
  }

  // ===== 1. 文件级断言 =====
  const html = fs.readFileSync(ROOT + '/index.html', 'utf8');
  check('index.html 有 manifest link', html.includes('rel="manifest"'), '');
  check('index.html 有 theme-color meta', html.includes('theme-color'), '');
  let manifest = null;
  try { manifest = JSON.parse(fs.readFileSync(ROOT + '/manifest.json', 'utf8')); } catch(e) {}
  check('manifest.json 存在且 JSON 合法', !!manifest);
  check('manifest.json icons 路径正确（192/512, PNG）', manifest && manifest.icons && manifest.icons.length === 2 &&
    manifest.icons.some(i => i.src === 'assets/icons/icon-192.png' && i.sizes === '192x192') &&
    manifest.icons.some(i => i.src === 'assets/icons/icon-512.png' && i.sizes === '512x512'), manifest ? JSON.stringify(manifest.icons) : '');
  const p192 = pngSize(ROOT + '/assets/icons/icon-192.png');
  const p512 = pngSize(ROOT + '/assets/icons/icon-512.png');
  check('icon-192.png 真实 PNG 且 192x192', p192.sig === '\x89PNG\r\n\x1a\n' && p192.w === 192 && p192.h === 192, JSON.stringify(p192));
  check('icon-512.png 真实 PNG 且 512x512', p512.sig === '\x89PNG\r\n\x1a\n' && p512.w === 512 && p512.h === 512, JSON.stringify(p512));

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  page.on('pageerror', e => console.log('[PAGEERROR]', e.message));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2500);

  // ===== 2. SW 注册（轮询最多 10s）=====
  let reg = null;
  for (let i = 0; i < 20; i++) {
    reg = await page.evaluate(() => navigator.serviceWorker.getRegistration());
    if (reg) break;
    await sleep(500);
  }
  check('SW 注册成功（getRegistration 非空）', !!reg);
  await sleep(1500);
  const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
  check('页面已被 SW 控制', controlled);

  const client = await page.target().createCDPSession();
  await client.send('Network.enable');

  // ===== 3. 真离线回放：杀 server → reload → 页面仍渲染（清 HTTP 缓存确保测 SW 缓存）=====
  await client.send('Network.clearBrowserCache');
  stopServer();
  await sleep(500);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  await sleep(2000);
  const offlineState = await page.evaluate(() => {
    return {
      appHtml: (document.querySelector('#app') ? document.querySelector('#app').innerHTML.length : 0),
      footer: !!document.querySelector('.app-footer'),
      title: document.title,
    };
  });
  check('真离线 reload 页面仍渲染（#app 有内容）', offlineState.appHtml > 500, JSON.stringify(offlineState));
  check('真离线 reload footer 可见', offlineState.footer, JSON.stringify(offlineState));
  startServer();
  const serverUp = await waitServerUp(page);
  check('server 重启成功', serverUp);
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(1500);

  // ===== 4. 反向验证：sw.js install 缓存清空 → 清 SW/caches → 重新注册 → 真离线白屏 =====
  const swOriginal = fs.readFileSync(SW_PATH, 'utf8');
  const swBroken = swOriginal.replace("const CORE_ASSETS = [", "const CORE_ASSETS = [// REVERSE");
  fs.writeFileSync(SW_PATH, swBroken);
  await page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) await r.unregister();
    const keys = await caches.keys();
    for (const k of keys) await caches.delete(k);
  });
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(2000);
  let reg2 = null;
  for (let i = 0; i < 20; i++) {
    reg2 = await page.evaluate(() => navigator.serviceWorker.getRegistration());
    if (reg2) break;
    await sleep(500);
  }
  check('REVERSE: 空缓存 SW 已注册（准备验证离线白屏）', !!reg2);
  await sleep(1000); // 等 skipWaiting+claim 完成接管
  await client.send('Network.clearBrowserCache');
  stopServer();
  await sleep(500);
  // 诊断：确认 server 真的死了（fetch 新 URL 应 reject）
  const deadProbe = await page.evaluate(async () => {
    try { await fetch(URL_ORIGIN + '/__dead__' + Date.now() + '.txt'); return 'alive'; }
    catch(e) { return 'dead'; }
  });
  check('REVERSE: server 已停止（fetch 失败）', deadProbe === 'dead', deadProbe);
  // 关键：再清一次 caches——reload 期间 SW 的 network-first 分支（cache.put）可能已把 index.html 写回缓存
  await page.evaluate(async () => {
    const keys = await caches.keys();
    for (const k of keys) await caches.delete(k);
  });
  const cacheEmpty = await page.evaluate(async () => {
    const keys = await caches.keys();
    return keys.length === 0;
  });
  check('REVERSE: caches 二次清空（无任何缓存可兜底）', cacheEmpty);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  await sleep(2000);
  const reverseState = await page.evaluate(() => {
    return {
      appHtml: document.querySelector('#app') ? document.querySelector('#app').innerHTML.length : 0,
      url: location.href,
      readyState: document.readyState,
      bodyLen: document.body ? document.body.innerHTML.length : -1,
      controller: (navigator.serviceWorker && navigator.serviceWorker.controller) ? navigator.serviceWorker.controller.scriptURL : null,
    };
  });
  check('REVERSE: 无缓存时真离线 reload 白屏（app 空）', reverseState.appHtml === 0, JSON.stringify(reverseState));
  await sleep(3000);
  const reverseState2 = await page.evaluate(() => {
    return {
      appHtml: document.querySelector('#app') ? document.querySelector('#app').innerHTML.length : 0,
      url: location.href,
      readyState: document.readyState,
      bodyLen: document.body ? document.body.innerHTML.length : -1,
    };
  });
  console.log('  [diag 5s后]', JSON.stringify(reverseState2));
  startServer();
  await waitServerUp(page);

  // ===== 5. 还原 sw.js → 清 SW/caches → 重新注册 → 真离线回放全绿 =====
  fs.writeFileSync(SW_PATH, swOriginal);
  // 页面还停在 chrome-error:// 错误页，先导航回正常页面（server 已重启）
  await page.goto(URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(1500);
  await page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) await r.unregister();
    const keys = await caches.keys();
    for (const k of keys) await caches.delete(k);
  });
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(2000);
  let reg3 = null;
  for (let i = 0; i < 20; i++) {
    reg3 = await page.evaluate(() => navigator.serviceWorker.getRegistration());
    if (reg3) break;
    await sleep(500);
  }
  check('还原后 SW 重新注册', !!reg3);
  await sleep(1000);
  // 等原版 SW 预缓存（addAll 5 资源）完成，再离线验证
  let precached = false;
  for (let i = 0; i < 20; i++) {
    precached = await page.evaluate(async (uOrigin) => {
      const keys = await caches.keys();
      for (const k of keys) {
        const c = await caches.open(k);
        const hit = await c.match(location.origin + '/index.html', { ignoreSearch: true, ignoreVary: true }) || await c.match(location.origin + '/', { ignoreSearch: true, ignoreVary: true });
        if (hit) return true;
      }
      return false;
    }, URL_ORIGIN);
    if (precached) break;
    await sleep(500);
  }
  check('还原后 SW 预缓存就绪（index.html 已入缓存）', precached);
  await client.send('Network.clearBrowserCache');
  stopServer();
  await sleep(500);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  await sleep(2000);
  const restoreState = await page.evaluate(() => {
    return { appHtml: document.querySelector('#app') ? document.querySelector('#app').innerHTML.length : 0 };
  });
  check('还原后真离线回放页面仍渲染', restoreState.appHtml > 500, JSON.stringify(restoreState));
  startServer();
  await waitServerUp(page);

  // ===== 6. 清理：unregister 全部 SW + 清 caches（防污染其他探针）=====
  await page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) await r.unregister();
    const keys = await caches.keys();
    for (const k of keys) await caches.delete(k);
  });
  await sleep(500);
  const clean = await page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    const keys = await caches.keys();
    return { regs: regs.length, caches: keys.length };
  });
  check('测试结束 SW 全部 unregister + caches 清空', clean.regs === 0 && clean.caches === 0, JSON.stringify(clean));

  console.log(failures === 0 ? '\n=== 探针 K 全绿 ===' : '\n=== 探针 K 失败 ' + failures + ' 项 ===');
  await browser.close();
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('PROBE ERROR', e); process.exit(2); });
