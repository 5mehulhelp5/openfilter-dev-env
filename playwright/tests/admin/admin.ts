import { expect, Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { magento, sql } from '../fixture';

export { magento, sql };

/** Admin credentials from the gitignored admin.env at the repository root (or ADMIN_USER / ADMIN_PASSWORD). */
export function adminCredentials(): { user: string; password: string } {
  let env: Record<string, string> = {};
  try {
    const text = readFileSync(resolve(__dirname, '../../../admin.env'), 'utf8');
    env = Object.fromEntries(
      text.split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
    );
  } catch {
    // fall back to the environment
  }
  const user = process.env.ADMIN_USER ?? env.ADMIN_USER;
  const password = process.env.ADMIN_PASSWORD ?? env.ADMIN_PASSWORD;
  if (!user || !password) {
    throw new Error('Admin credentials missing: create admin.env from admin.env.example or set ADMIN_USER/ADMIN_PASSWORD');
  }
  return { user, password };
}

export const AUTH_FILE = resolve(__dirname, '../../.auth/admin.json');

/** Waits until the admin UI-component spinner is gone. */
export async function waitForAdmin(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.admin__data-grid-loading-mask:visible, .loading-mask:visible')).toHaveCount(0, { timeout: 30_000 });
}

/**
 * Closes Magento's first-login popups (usage data, release notes, surveys) on a fresh install.
 */
export async function dismissAdminPopups(page: Page): Promise<void> {
  for (let i = 0; i < 5; i++) {
    const modal = page.locator('.modal-popup._show, .modal-slide._show').last();
    if (!(await modal.isVisible().catch(() => false))) {
      return;
    }
    const later = modal.getByRole('button', { name: /show me later|don't allow|no thanks|done|close/i }).first();
    const target = (await later.isVisible().catch(() => false)) ? later : modal.locator('.action-close').first();
    await target.click({ timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(300);
  }
}

/** Opens an admin route and waits for the UI to settle. */
export async function openAdmin(page: Page, route: string): Promise<void> {
  await page.goto(`/admin/${route}`);
  await waitForAdmin(page);
  await dismissAdminPopups(page);
}

/** OpenFilter's settings and URL-name tables: admin specs snapshot them and put them back afterwards. */
export const OPENFILTER_TABLES = [
  'openfilter_attribute', 'openfilter_attribute_store', 'openfilter_builtin', 'openfilter_builtin_store',
  'openfilter_option_slug', 'openfilter_attribute_slug', 'openfilter_filter_category',
];

function mysqlArgs(): { command: string; args: string[]; dumpCommand: string; dumpArgs: string[] } {
  if (process.env.OF_FIXTURE === 'shell') {
    const auth = ['-h', process.env.DB_HOST ?? '127.0.0.1', '-u', process.env.DB_USER ?? 'magento',
      `-p${process.env.DB_PASSWORD ?? 'magento'}`];
    const db = process.env.DB_NAME ?? 'magento';
    return { command: 'mysql', args: [...auth, db], dumpCommand: 'mysqldump', dumpArgs: [...auth, db] };
  }
  const exec = ['env', 'exec', '-T', 'db'];
  return {
    command: 'warden', args: [...exec, 'mysql', '-umagento', '-pmagento', 'magento'],
    dumpCommand: 'warden', dumpArgs: [...exec, 'mysqldump', '-umagento', '-pmagento', 'magento'],
  };
}

/**
 * Saves the OpenFilter tables and returns a function that restores them (data only) and cleans the caches that
 * hold them, so admin specs leave the fixture as they found it.
 */
export function snapshotOpenFilter(): () => void {
  const { command, args, dumpCommand, dumpArgs } = mysqlArgs();
  const cwd = resolve(__dirname, '../../..');
  const dump = execFileSync(dumpCommand, [...dumpArgs, '--no-create-info', '--skip-triggers', '--complete-insert', ...OPENFILTER_TABLES], { cwd, encoding: 'utf8' });
  return () => {
    const reset = `SET FOREIGN_KEY_CHECKS=0; ${OPENFILTER_TABLES.map((t) => `DELETE FROM ${t};`).join(' ')}\n`;
    execFileSync(command, args, { cwd, input: reset + dump + '\nSET FOREIGN_KEY_CHECKS=1;\n', encoding: 'utf8' });
    magento('cache:clean', 'openfilter', 'full_page');
  };
}

/** A storefront URL that skips Varnish (an extra parameter OpenFilter and Magento ignore). */
export function uncached(path: string): string {
  return `${path}${path.includes('?') ? '&' : '?'}of_t=${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

/** Ticks grid rows by their first-column text and runs a mass action from the Actions menu. */
export async function massAction(page: Page, labels: string[], action: string): Promise<void> {
  for (const label of labels) {
    const row = page.locator('.data-grid tbody tr.data-row').filter({ has: page.locator('td', { hasText: new RegExp(`^\\s*${label}\\s*$`) }) }).first();
    await row.locator('input.admin__control-checkbox').check();
  }
  // Checking a row below the fold turns on the grid's sticky header, which hides the toolbar's own Actions button.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('.admin__data-grid-header .action-select').filter({ hasText: 'Actions' }).first().click();
  await page.locator('.action-menu-item', { hasText: action }).first().click();
}
