// Upgrade gate (M5 S12): with the settings a 1.0 store has, OpenFilter 1.1 must render the same storefront.
// `capture <file>` saves, per page, the status, redirect target, head tags (title, robots, canonical, description)
// and OpenFilter's regions (#of-filters, #of-state, #of-results) with volatile parts normalised (form keys, CSP
// nonces, static versions, script bodies); `compare <file>` captures again and prints the differences (exit 1).
// Usage: node scripts/upgrade-gate.mjs capture /tmp/of-1.0.json  (on 1.0)  → upgrade → compare /tmp/of-1.0.json
import { readFileSync, writeFileSync } from 'node:fs';

const base = process.env.BASE_URL ?? 'https://app.openfilter.test';
if (!process.env.BASE_URL && process.env.NODE_TLS_REJECT_UNAUTHORIZED === undefined) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}
const PAGES = [
  '/women/tops-women.html',
  '/women/tops-women.html?color=black',
  '/women/tops-women.html?color=black,blue&size=m',
  '/women/tops-women.html?price=30-40',
  '/women/tops-women.html?color=49',
  '/women/tops-women.html?color=black,blue,brown,gray,green,red',
  '/women/tops-women.html?color=green&price=90-100',
  '/women/tops-women.html?p=2&product_list_order=price',
  '/catalogsearch/result/?q=jacket',
  '/catalogsearch/result/?q=jacket&color=black&product_list_order=price&product_list_dir=asc',
];

function region(html, id) {
  const start = html.indexOf(`id="${id}"`);
  if (start < 0) return null;
  const open = html.lastIndexOf('<', start);
  const tag = /^<(\w+)/.exec(html.slice(open))[1];
  let depth = 0;
  const pattern = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g');
  pattern.lastIndex = open;
  for (let m; (m = pattern.exec(html));) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(open, m.index + m[0].length);
  }
  return html.slice(open);
}

const normalise = (text) => text
  .replace(/<script\b([^>]*)>[\s\S]*?<\/script>/g, '<script$1>…</script>')
  .replace(/\s(nonce|data-csp-nonce)="[^"]*"/g, '')
  .replace(/(form_key[^"]*"\s*value=|form_key=)"?[A-Za-z0-9]+/g, '$1KEY')
  .replace(/(name="form_key"\s+type="hidden"\s+value=")[A-Za-z0-9]+/g, '$1KEY')
  .replace(/\/static\/version\d+\//g, '/static/VERSION/')
  .replace(/(?:[?&]|&amp;)of_t=\d+/g, '')
  .replace(/name="of_t"\s+value="\d+"/g, 'name="of_t" value="X"')
  .replace(/_[0-9a-f]{13}\b/g, '_ID') // Hyvä's uniqid() names
  .replace(/uenc\/[A-Za-z0-9,_-]+/g, 'uenc/X')
  .replace(/\s+/g, ' ');

async function capture() {
  const out = {};
  for (const path of PAGES) {
    const response = await fetch(`${base}${path}${path.includes('?') ? '&' : '?'}of_t=${Date.now()}`, { redirect: 'manual' });
    const html = await response.text();
    const meta = (name) => new RegExp(`<meta name="${name}" content="([^"]*)"`).exec(html)?.[1] ?? null;
    out[path] = {
      status: response.status,
      location: response.headers.get('location')?.replace(/[?&]of_t=\d+/, '') ?? null,
      title: /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? null,
      robots: meta('robots'),
      description: meta('description'),
      canonical: /<link\s+rel="canonical"\s+href="([^"]*)"/.exec(html)?.[1] ?? null,
      filters: normalise(region(html, 'of-filters') ?? ''),
      state: normalise(region(html, 'of-state') ?? ''),
      results: normalise(region(html, 'of-results') ?? ''),
    };
  }
  return out;
}

const [mode, file] = process.argv.slice(2);
const now = await capture();
if (mode === 'capture') {
  writeFileSync(file, JSON.stringify(now, null, 2));
  console.log(`captured ${Object.keys(now).length} pages → ${file}`);
} else {
  const before = JSON.parse(readFileSync(file, 'utf8'));
  const differences = [];
  for (const [path, page] of Object.entries(before)) {
    for (const [key, value] of Object.entries(page)) {
      const region = ['filters', 'state', 'results'].includes(key);
      const a = region ? normalise(String(value)) : String(value);
      const b = region ? normalise(String(now[path]?.[key])) : String(now[path]?.[key]);
      if (a !== b) {
        let i = 0;
        while (i < a.length && a[i] === b[i]) i++;
        differences.push(`${path} ${key}: …${a.slice(Math.max(0, i - 80), i + 120)}… → …${b.slice(Math.max(0, i - 80), i + 120)}…`);
      }
    }
  }
  console.log(differences.length ? differences.join('\n\n') : `no differences on ${Object.keys(before).length} pages`);
  process.exit(differences.length ? 1 : 0);
}
