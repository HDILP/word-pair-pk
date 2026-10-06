// run_all.js — 依次跑 tests/probes 下全部探针，汇总结果
// 用法：
//   node run_all.js                 # 全部探针
//   node run_all.js probe_a probe_b # 只跑指定探针（不带 .js 后缀）
// 环境变量：
//   PROBE_URL    目标页面（CI 里指向本地 http server）
//   CHROME_PATH  Chrome 可执行文件路径（CI 里用 setup-chrome 安装的稳定通道路径）
//   PROBE_TIMEOUT_MS 单探针超时（默认 240000）
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
let list = args.filter(a => !a.startsWith('-'));
if (list.length === 0) {
  list = fs.readdirSync(__dirname)
    .filter(f => /^probe_.*\.js$/.test(f))
    .sort();
} else {
  list = list.map(f => (f.endsWith('.js') ? f : f + '.js'));
  for (const f of list) {
    if (!fs.existsSync(path.join(__dirname, f))) {
      console.error('NO_SUCH_PROBE ' + f);
      process.exit(2);
    }
  }
}

const timeoutMs = parseInt(process.env.PROBE_TIMEOUT_MS || '240000', 10);
const env = { ...process.env };
if (!env.PROBE_URL) env.PROBE_URL = 'http://127.0.0.1:8080/index.html';

const results = [];
let failed = 0;
for (const f of list) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], {
    env,
    timeout: timeoutMs,
    encoding: 'utf8',
  });
  const dur = ((Date.now() - t0) / 1000).toFixed(1);
  const out = (r.stdout || '') + (r.stderr || '');
  // 从输出末尾抓汇总行（探针们最后都打一行总结）
  const tailLines = out.trim().split('\n').slice(-3).join(' | ');
  let status;
  if (r.error && r.error.killed) status = 'TIMEOUT';
  else if (r.status === 0) status = 'PASS';
  else status = 'FAIL(exit=' + r.status + ')';
  if (status !== 'PASS') failed++;
  results.push({ file: f, status, dur });
  console.log(`[${status}] ${f} (${dur}s)  ${tailLines.slice(0, 220)}`);
}

console.log('\n===== run_all: ' + (results.length - failed) + '/' + results.length + ' PASS =====');
process.exit(failed > 0 ? 1 : 0);
