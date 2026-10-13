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
});
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
