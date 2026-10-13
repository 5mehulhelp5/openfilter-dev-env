// Lighthouse gate for M3 (07 §6, 10 FE10, 04 M3 done-when): the same pages are measured with OpenFilter enabled
// and disabled (disabled = Hyvä's stock layered navigation), mobile and desktop, three runs each (median).
// Asserts: CLS added by OpenFilter = 0.000, performance score not lower than the noise margin (0.05, Iman
// 2026-10-13), exactly one OpenFilter stylesheet, OpenFilter's inline script ≤ 6 KB and stylesheet ≤ 4 KB gzipped.
// Writes lighthouse-report/summary.{json,md}. Ported from openlabel-dev-env's lh-compare.mjs.
//
// Usage (local Warden fixture): npm run lighthouse   (CI: OF_FIXTURE=shell, BASE_URL=http://localhost)
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const base = process.env.BASE_URL ?? 'https://app.openfilter.test';
const runs = Number(process.env.LH_RUNS ?? 3);
const pages = {
  listing: '/women/tops-women.html',
  filtered: '/women/tops-women.html?color=blue&size=m',
  search: '/catalogsearch/result/?q=jacket',
};
const viewports = {
  mobile: { formFactor: 'mobile', screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false } },
  desktop: { formFactor: 'desktop', screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false } },
};
const SCORE_MARGIN = 0.05;
const JS_BUDGET = 6 * 1024;
const CSS_BUDGET = 4 * 1024;

const shell = process.env.OF_FIXTURE === 'shell';
function magento(...args) {
  return shell
    ? execFileSync('php', ['bin/magento', ...args], { cwd: process.env.MAGENTO_ROOT ?? root, encoding: 'utf8' })
    : execFileSync('warden', ['env', 'exec', '-T', 'php-fpm', 'bin/magento', ...args], { cwd: root, encoding: 'utf8' });
}
function setEnabled(on) {
  magento('config:set', 'openfilter/general/enabled', on ? '1' : '0');
  magento('cache:flush');
}
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

async function measure(chrome, url, viewport) {
  const result = await lighthouse(url, { port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: ['performance'] }, {
    extends: 'lighthouse:default',
    settings: { ...viewports[viewport], throttlingMethod: 'provided', disableStorageReset: false },
  });
  const lhr = result.lhr;
  const requests = lhr.audits['network-requests'].details.items.map((item) => item.url);
  return {
    score: lhr.categories.performance.score,
    cls: lhr.audits['cumulative-layout-shift'].numericValue,
    lcp: lhr.audits['largest-contentful-paint'].numericValue,
    ofCss: requests.filter((u) => /\/Iranimij_OpenFilter\/css\/openfilter\.css/.test(u)).length,
  };
}

/** OpenFilter's own bytes on the page: the component's inline script and the stylesheet, gzipped. */
async function budgets(url) {
  const html = await (await fetch(url)).text();
  const script = /x-data="openFilter"[\s\S]*?<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';
  const cssUrl = /href="([^"]*Iranimij_OpenFilter\/css\/openfilter\.css)"/.exec(html)?.[1];
  const css = cssUrl ? await (await fetch(new URL(cssUrl, url))).text() : '';
  return { js: gzipSync(script, { level: 9 }).length, css: gzipSync(css, { level: 9 }).length, hasScript: script !== '' };
}

async function series(chrome, label) {
  const out = {};
  for (const [page, path] of Object.entries(pages)) {
    for (const viewport of Object.keys(viewports)) {
      const url = base + path;
      await fetch(url).catch(() => undefined); // warm Varnish
      const samples = [];
      for (let i = 0; i < runs; i++) {
        samples.push(await measure(chrome, url, viewport));
      }
      out[`${page}/${viewport}`] = {
        score: median(samples.map((s) => s.score)),
        cls: median(samples.map((s) => s.cls)),
        lcp: median(samples.map((s) => s.lcp)),
        ofCss: Math.max(...samples.map((s) => s.ofCss)),
      };
      console.log(label, page, viewport, JSON.stringify(out[`${page}/${viewport}`]));
    }
  }
  return out;
}

if (base.startsWith('https:')) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // the local fixture's self-signed certificate
}
const chrome = await chromeLauncher.launch({
  chromePath: chromium.executablePath(),
  chromeFlags: ['--headless=new', '--ignore-certificate-errors', '--no-sandbox'],
});
let on;
let off;
let bytes;
try {
  setEnabled(true);
  bytes = await budgets(base + pages.listing);
  on = await series(chrome, 'on ');
  setEnabled(false);
  off = await series(chrome, 'off');
} finally {
  setEnabled(true);
  await chrome.kill();
}

const failures = [];
const rows = [];
for (const key of Object.keys(on)) {
  const a = on[key];
  const b = off[key];
  const clsDelta = a.cls - b.cls;
  const scoreDelta = a.score - b.score;
  rows.push(`| ${key} | ${b.score.toFixed(2)} → ${a.score.toFixed(2)} | ${b.cls.toFixed(3)} → ${a.cls.toFixed(3)} | ${Math.round(b.lcp)} → ${Math.round(a.lcp)} ms | ${a.ofCss} |`);
  if (clsDelta > 0.0005) failures.push(`${key}: OpenFilter adds CLS ${clsDelta.toFixed(4)}`);
  if (scoreDelta < -SCORE_MARGIN) failures.push(`${key}: performance score ${scoreDelta.toFixed(2)}`);
  if (a.ofCss !== 1) failures.push(`${key}: ${a.ofCss} OpenFilter stylesheet requests (expected 1)`);
  if (b.ofCss !== 0) failures.push(`${key}: OpenFilter stylesheet loaded while disabled`);
}
if (!bytes.hasScript) failures.push('OpenFilter component script not found on the listing');
if (bytes.js > JS_BUDGET) failures.push(`OpenFilter script ${bytes.js} B gzipped (budget ${JS_BUDGET})`);
if (bytes.css > CSS_BUDGET) failures.push(`OpenFilter stylesheet ${bytes.css} B gzipped (budget ${CSS_BUDGET})`);

const out = resolve(here, '../lighthouse-report');
mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, 'summary.json'), JSON.stringify({ runs, scoreMargin: SCORE_MARGIN, on, off, bytes, failures }, null, 2));
writeFileSync(resolve(out, 'summary.md'), [
  `# OpenFilter Lighthouse on/off (median of ${runs})`,
  '',
  '| page/viewport | score off → on | CLS off → on | LCP off → on | OpenFilter CSS requests |',
  '|---|---|---|---|---|',
  ...rows,
  '',
  `OpenFilter script ${bytes.js} B gzipped (budget ${JS_BUDGET}), stylesheet ${bytes.css} B gzipped (budget ${CSS_BUDGET}).`,
  '',
  failures.length ? `**Failures:**\n${failures.map((f) => `- ${f}`).join('\n')}` : '**Pass.**',
  '',
].join('\n'));
console.log(failures.length ? `FAIL\n${failures.join('\n')}` : 'PASS');
process.exit(failures.length ? 1 : 0);
