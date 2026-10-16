import { test, expect } from '@playwright/test';
import { deflateSync } from 'node:zlib';
import { openGroup } from '../helpers';
import { magento, openAdmin, snapshotOpenFilter, sql, uncached, waitForAdmin } from './admin';

/**
 * M6 S2 option images: the merchant uploads an image for an option of Material (no swatches), switches the filter to
 * "Images" and the storefront shows it next to the label; removing it shows the label again. Serial admin project;
 * settings and images are restored afterwards.
 */
const TOPS = '/women/tops-women.html';
let restore: () => void;

/** A small solid PNG, so the spec needs no image file in the repository. */
function png(): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    return c >>> 0;
  });
  const crc = (data: Buffer): number => {
    let c = 0xffffffff;
    for (const byte of data) {
      c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer): Buffer => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, sum]);
  };
  const size = 8;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const rows = Buffer.concat(Array.from({ length: size }, () => Buffer.from([0, ...Array(size).fill([0x2a, 0x6f, 0x97]).flat()])));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

test.beforeAll(() => {
  restore = snapshotOpenFilter();
});

test.afterAll(() => {
  restore();
  magento('cache:clean', 'openfilter', 'full_page');
});

test('an uploaded option image shows on the storefront and leaves when removed', async ({ page }) => {
  await page.goto(uncached(TOPS));
  const shown = (await (await openGroup(page, 'material')).locator('a[data-of-link]').allInnerTexts())
    .map((text) => text.split('\n')[0].trim());
  expect(shown.length).toBeGreaterThan(0);

  await openAdmin(page, 'openfilter/filter/edit/code/material/');
  await page.locator('select[name="display_mode"]').selectOption('images');
  const images = page.locator('[data-index="images"]');
  await images.locator('.fieldset-wrapper-title').click();
  const rows = images.locator('tr.data-row');
  await expect(rows.first()).toBeVisible();
  const labels = (await rows.locator('.openfilter-row-text').allInnerTexts()).map((text) => text.trim());
  const label = labels.find((candidate) => shown.includes(candidate));
  expect(label, `an option on the first page of the table that ${TOPS} lists`).toBeTruthy();
  const row = rows.filter({ has: page.locator('.openfilter-row-text', { hasText: new RegExp(`^\\s*${label}\\s*$`) }) });
  const uploaded = page.waitForResponse((response) => response.url().includes('openfilter/filter/uploadImage'));
  await row.locator('input[type="file"]').first().setInputFiles({ name: 'option.png', mimeType: 'image/png', buffer: png() });
  const result = await (await uploaded).json();
  expect(result.error, 'Magento reports success as error 0').toBeFalsy();
  expect(result.name).toMatch(/\.png$/);
  await expect(row.locator('.file-uploader-preview img')).toBeVisible();
  await page.locator('#save').click();
  await waitForAdmin(page);
  await expect(page.locator('.message-success')).toContainText('You saved the filter.');
  expect(Number(sql('SELECT COUNT(*) FROM openfilter_option_image')[0][0])).toBe(1);

  await page.goto(uncached(TOPS));
  const option = (await openGroup(page, 'material')).locator('a.of-swatch', { hasText: label });
  const image = option.locator('img.of-swatch__visual');
  await expect(image).toHaveAttribute('src', /\/media\/openfilter\/options\/.+\.png$/);
  await expect.poll(() => image.evaluate((img) => (img as HTMLImageElement).naturalWidth), { message: 'the file is served' }).toBeGreaterThan(0);

  await openAdmin(page, 'openfilter/filter/edit/code/material/');
  await images.locator('.fieldset-wrapper-title').click();
  await row.locator('.file-uploader-preview .action-remove').click();
  await page.locator('#save').click();
  await waitForAdmin(page);
  await expect(page.locator('.message-success')).toContainText('You saved the filter.');
  expect(Number(sql('SELECT COUNT(*) FROM openfilter_option_image')[0][0])).toBe(0);
});
