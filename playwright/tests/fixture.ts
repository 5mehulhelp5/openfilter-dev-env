import { test as base, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * How specs reach the fixture's database and CLI.
 * - Local (default): the Warden environment of this repository (`warden env exec`).
 * - CI (`OF_FIXTURE=shell`): Magento in `MAGENTO_ROOT`, MySQL from `DB_HOST`/`DB_USER`/`DB_PASSWORD`/`DB_NAME`.
 */
const shell = process.env.OF_FIXTURE === 'shell';
const repoRoot = resolve(__dirname, '../..');

export const magentoRoot = shell ? (process.env.MAGENTO_ROOT ?? repoRoot) : repoRoot;

/** Runs SQL and returns tab-separated rows. */
export function sql(query: string): string[][] {
  const args = ['-N', '-B', '-e', query];
  const out = shell
    ? execFileSync('mysql', [
      '-h', process.env.DB_HOST ?? '127.0.0.1',
      '-u', process.env.DB_USER ?? 'magento',
      `-p${process.env.DB_PASSWORD ?? 'magento'}`,
      process.env.DB_NAME ?? 'magento',
      ...args,
    ], { encoding: 'utf8' })
    : execFileSync('warden', ['env', 'exec', '-T', 'db', 'mysql', '-umagento', '-pmagento', 'magento', ...args], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
  return out.trim() === '' ? [] : out.trim().split('\n').map((line) => line.split('\t'));
}

/** Runs bin/magento. */
export function magento(...args: string[]): string {
  return shell
    ? execFileSync('php', ['bin/magento', ...args], { cwd: magentoRoot, encoding: 'utf8' })
    : execFileSync('warden', ['env', 'exec', '-T', 'php-fpm', 'bin/magento', ...args], { cwd: repoRoot, encoding: 'utf8' });
}

/**
 * Storefront specs import `test` from here: the `request` fixture then carries the project's storage state (store
 * view cookies, see tests/stores.ts), like `page` does, so HTML fetched with `request` comes from the same store view.
 */
export const test = base.extend({
  request: async ({ playwright, baseURL, storageState, ignoreHTTPSErrors }, use) => {
    const context = await playwright.request.newContext({ baseURL, storageState, ignoreHTTPSErrors });
    await use(context);
    await context.dispose();
  },
  // CSP sweep (10, 08 §7): every storefront test with JavaScript fails on a Content-Security-Policy violation,
  // reported by the browser's securitypolicyviolation event or its console message.
  page: async ({ page, javaScriptEnabled }, use) => {
    const violations: string[] = [];
    if (javaScriptEnabled !== false) {
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (event) => {
          console.error(`CSP violation: ${event.violatedDirective} ${event.blockedURI} ${event.sourceFile}:${event.lineNumber}`);
        });
      });
      page.on('console', (message) => {
        if (/CSP violation|Content Security Policy|Refused to (load|execute|apply)/i.test(message.text())) {
          violations.push(message.text());
        }
      });
    }
    await use(page);
    expect(violations, 'Content-Security-Policy violations').toEqual([]);
  },
});

/** Adds an OpenLabel label on every product (listing and product page); returns its id (OpenLabel's own seed). */
export function seedOpenLabel(name: string): number {
  sql(`DELETE FROM openlabel_label WHERE name = '${name}'`);
  const id = Number(sql(
    `INSERT INTO openlabel_label (name, status, priority, design_id, store_ids, customer_group_ids, conditions_serialized) `
    + `SELECT '${name}', 1, 9, MIN(design_id), '', '', NULL FROM openlabel_design WHERE is_system = 1; `
    + `SET @l = LAST_INSERT_ID(); `
    + `INSERT INTO openlabel_placement (label_id, area, position, max_labels) VALUES (@l, 'listing', 'tl', 3), (@l, 'product', 'tl', 3); `
    + `SELECT @l;`,
  ).pop()?.[0]);
  magento('openlabel:reindex', String(id));
  magento('openlabel:css:regenerate');
  magento('cache:flush', 'full_page');
  return id;
}

export function unseedOpenLabel(id: number): void {
  sql(`DELETE FROM openlabel_label WHERE label_id = ${Number(id)}`);
  magento('openlabel:css:regenerate');
  magento('cache:flush', 'full_page');
}
export { expect };

/** Hyvä default theme version of the running project as [major, minor] (project metadata, tests/stores.ts). */
export function hyvaThemeVersion(): number[] {
  const hyva = String(base.info().project.metadata?.hyva ?? '1.4');
  return hyva.split('.').map((part) => Number.parseInt(part, 10) || 0);
}

/** Hyvä 1.5 rebuilt layered navigation (details) and the product gallery (#gallery-main is a scrolling track). */
export function isHyva15(): boolean {
  const [major, minor] = hyvaThemeVersion();
  return major > 1 || (major === 1 && minor >= 5);
}

/** Store view code of the running project ("default" when none is set). */
export function projectStore(): string {
  return String(base.info().project.metadata?.store ?? 'default');
}
