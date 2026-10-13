import { test } from '@playwright/test';
import { openAdmin } from './admin';

test('peek', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() !== 'log' && m.type() !== 'info' && m.type() !== 'debug') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(`/admin/openfilter/filter/edit/code/${process.env.PEEK ?? 'color'}/`); await page.waitForTimeout(4000);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${process.env.SHOTS}/form-${process.env.PEEK ?? 'color'}.png`, fullPage: true });
  console.log('ERRORS', JSON.stringify(errors));
  console.log('TITLE', await page.locator('.page-title').textContent());
});
