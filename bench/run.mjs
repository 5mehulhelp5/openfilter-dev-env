// OpenFilter public benchmark (M5 S11, D18): the same shopper scenarios on the same store with OpenFilter off
// (Magento's own layered navigation, Hyvä templates) and on. Per scenario: search engine requests of one uncached
// page (OpenSearch _nodes/stats query_total, like the integration tests), server time (median of 11 uncached loads,
// full body), and over a scripted session of filter clicks the share of pages a second shopper gets from Varnish.
// OpenFilter's own bytes (inline script and stylesheet, gzipped) are measured on the filtered page.
// Writes results/latest.json and results/latest.md. Competitors are not installed (clean room): docs/benchmark.md
// lists their documented public claims with links.
//
// BENCH_GATE=1 fails (exit 1) when OpenFilter needs more engine requests than Magento or adds more than
// BENCH_BUDGET_MS (15) of server time in any scenario Magento can do.
//
// Usage (local Warden fixture): node bench/run.mjs
// CI: OF_FIXTURE=shell BASE_URL=http://localhost OPENSEARCH_URL=http://127.0.0.1:9200 node bench/run.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const base = process.env.BASE_URL ?? 'https://app.openfilter.test';
const runs = Number(process.env.BENCH_RUNS ?? 11);
const shell = process.env.OF_FIXTURE === 'shell';
if (!shell && process.env.NODE_TLS_REJECT_UNAUTHORIZED === undefined) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // the local fixture's certificate
}

function run(command, args, options = {}) {
  return execFileSync(command, args, { cwd: root, encoding: 'utf8', ...options });
}
function magento(...args) {
  return shell
    ? run('php', ['bin/magento', ...args], { cwd: process.env.MAGENTO_ROOT ?? root })
    : run('warden', ['env', 'exec', '-T', 'php-fpm', 'bin/magento', ...args]);
}
function sql(query) {
  const args = ['-N', '-B', '-e', query];
  const out = shell
    ? run('mysql', ['-h', process.env.DB_HOST ?? '127.0.0.1', '-u', process.env.DB_USER ?? 'magento',
      `-p${process.env.DB_PASSWORD ?? 'magento'}`, process.env.DB_NAME ?? 'magento', ...args])
    : run('warden', ['env', 'exec', '-T', 'db', 'mysql', '-umagento', '-pmagento', 'magento', ...args]);
  return out.trim();
}
function engineQueries() {
  const url = `${process.env.OPENSEARCH_URL ?? 'http://opensearch:9200'}/_nodes/stats/indices/search`;
  const body = shell ? run('curl', ['-s', url]) : run('warden', ['env', 'exec', '-T', 'php-fpm', 'curl', '-s', url]);
  return Object.values(JSON.parse(body).nodes).reduce((sum, node) => sum + node.indices.search.query_total, 0);
}
function optionId(attribute, label) {
  return sql(`SELECT o.option_id FROM eav_attribute_option o
    JOIN eav_attribute_option_value v ON v.option_id = o.option_id AND v.store_id = 0
    JOIN eav_attribute a ON a.attribute_id = o.attribute_id AND a.entity_type_id = 4
    WHERE a.attribute_code = '${attribute}' AND v.value = '${label}' LIMIT 1`);
}
function setEnabled(on) {
  magento('config:set', 'openfilter/general/enabled', on ? '1' : '0');
  magento('cache:flush');
}
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const uncached = (path) => `${path}${path.includes('?') ? '&' : '?'}of_t=${Date.now()}${Math.floor(Math.random() * 1e6)}`;

async function load(path) {
  const started = performance.now();
  const response = await fetch(base + path, { redirect: 'manual' });
  const body = await response.text();
  return { ms: performance.now() - started, status: response.status, cache: response.headers.get('x-cache'), body };
}

/** Scenarios with the URLs each mode understands (Magento: option ids, one value per filter). */
function scenarios() {
  const black = optionId('color', 'Black');
  const blue = optionId('color', 'Blue');
  const m = optionId('size', 'M');
  const tops = '/women/tops-women.html';
  return {
    'category page': { off: tops, on: tops },
    'one filter': { off: `${tops}?color=${black}`, on: `${tops}?color=black` },
    'three filters': { off: `${tops}?color=${black}&size=${m}&price=30-40`, on: `${tops}?color=black&size=m&price=30-40` },
    'two values of one filter': { off: null, on: `${tops}?color=black,blue`, note: `Magento: one value per filter (color=${blue} replaces black)` },
    'search page': { off: '/catalogsearch/result/?q=jacket', on: '/catalogsearch/result/?q=jacket' },
    'search with a filter': { off: `/catalogsearch/result/?q=jacket&color=${black}`, on: '/catalogsearch/result/?q=jacket&color=black' },
  };
}

/** A shopper's clicks: the second shopper's pages that Varnish answers (HIT) out of all pages. */
function session(mode, list) {
  const tops = list['category page'][mode];
  return mode === 'on'
    ? [tops, list['one filter'].on, list['two values of one filter'].on, list['one filter'].on, list['three filters'].on, tops]
    : [tops, list['one filter'].off, list['three filters'].off, list['one filter'].off, tops];
}

/** The URL a scenario lands on: each mode answers non-canonical spellings with a redirect. */
async function canonical(path) {
  for (let hops = 0; hops < 3; hops++) {
    const response = await fetch(base + uncached(path), { redirect: 'manual' });
    await response.text();
    const location = response.headers.get('location');
    if (response.status < 300 || response.status >= 400 || !location) return path;
    const target = new URL(location, base);
    target.searchParams.delete('of_t');
    path = target.pathname + (target.search ? target.search.replace(/%2C/g, ',') : '');
  }
  return path;
}

async function measureMode(mode, list) {
  for (const urls of Object.values(list)) {
    if (urls[mode] !== null) urls[mode] = await canonical(urls[mode]);
  }
  const out = {};
  for (const [name, urls] of Object.entries(list)) {
    const path = urls[mode];
    if (path === null) {
      out[name] = { supported: false, note: urls.note };
      continue;
    }
    await load(uncached(path)); // warm caches of the code path (not of the page)
    const before = engineQueries();
    const first = await load(uncached(path));
    const requests = engineQueries() - before;
    const times = [];
    for (let i = 0; i < runs; i++) {
      times.push((await load(uncached(path))).ms);
    }
    if (first.status !== 200) throw new Error(`${mode} ${path}: HTTP ${first.status}`);
    out[name] = { supported: true, url: path, engineRequests: requests, serverMs: Math.round(median(times) * 10) / 10 };
  }
  const clicks = session(mode, list);
  for (const path of clicks) await load(path); // first shopper
  let hits = 0;
  for (const path of clicks) hits += (await load(path)).cache === 'HIT' ? 1 : 0;
  out.session = { pages: clicks.length, varnishHits: hits };
  return out;
}

async function openFilterBytes(path) {
  const html = (await load(uncached(path))).body;
  const script = /x-data="openFilter"[\s\S]*?<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';
  const cssUrl = /href="([^"]*Iranimij_OpenFilter\/css\/openfilter\.css)"/.exec(html)?.[1];
  const css = cssUrl ? await (await fetch(new URL(cssUrl, base))).text() : '';
  return { jsGzip: gzipSync(script, { level: 9 }).length, cssGzip: gzipSync(css, { level: 9 }).length };
}

const list = scenarios();
const result = { date: new Date().toISOString(), base, runs, magento: magento('--version').trim(), modes: {} };
try {
  setEnabled(false);
  result.modes.magento = await measureMode('off', list);
  setEnabled(true);
  result.modes.openfilter = await measureMode('on', list);
  result.openFilterBytes = await openFilterBytes(list['three filters'].on);
} finally {
  setEnabled(true);
}

const rows = Object.keys(list).map((name) => {
  const off = result.modes.magento[name];
  const on = result.modes.openfilter[name];
  const cell = (m) => (m.supported ? `${m.engineRequests} · ${m.serverMs} ms` : 'not possible');
  return `| ${name} | ${cell(off)} | ${cell(on)} |`;
});
const sessionCell = (m) => `${m.session.varnishHits} of ${m.session.pages}`;
const markdown = [
  `Benchmark ${result.date} · ${result.magento} · ${base} · median of ${runs} uncached loads`,
  '',
  '| Scenario | Magento: engine requests · server time | OpenFilter: engine requests · server time |',
  '|---|---|---|',
  ...rows,
  `| second shopper's clicks served by Varnish | ${sessionCell(result.modes.magento)} | ${sessionCell(result.modes.openfilter)} |`,
  '',
  `OpenFilter's own bytes on a filtered page: script ${result.openFilterBytes.jsGzip} B, stylesheet ${result.openFilterBytes.cssGzip} B (gzipped).`,
].join('\n');
mkdirSync(resolve(here, 'results'), { recursive: true });
writeFileSync(resolve(here, 'results/latest.json'), `${JSON.stringify(result, null, 2)}\n`);
writeFileSync(resolve(here, 'results/latest.md'), `${markdown}\n`);
console.log(markdown);

if (process.env.BENCH_GATE === '1') {
  const budget = Number(process.env.BENCH_BUDGET_MS ?? 15);
  const failures = Object.keys(list).flatMap((name) => {
    const off = result.modes.magento[name];
    const on = result.modes.openfilter[name];
    if (!off.supported) return [];
    return [
      ...(on.engineRequests > off.engineRequests ? [`${name}: ${on.engineRequests} engine requests > ${off.engineRequests}`] : []),
      ...(on.serverMs - off.serverMs > budget ? [`${name}: +${Math.round(on.serverMs - off.serverMs)} ms > ${budget} ms`] : []),
    ];
  });
  if (failures.length) {
    console.error(`Benchmark gate failed:\n${failures.join('\n')}`);
    process.exit(1);
  }
  console.log(`Benchmark gate passed (engine requests ≤ Magento, server time ≤ +${budget} ms).`);
}
