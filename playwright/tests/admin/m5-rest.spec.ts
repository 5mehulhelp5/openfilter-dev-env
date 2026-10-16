import { test, expect, APIRequestContext } from '@playwright/test';
import { adminCredentials, magento } from './admin';

/**
 * M5 S9: OpenFilter's REST API over HTTP with an admin token: anonymous calls are refused, a PUT changes only the
 * fields it sends (and is undone), values that do not fit answer 400 with the reason, unknown filters 404, and the
 * exported config document imports as a dry run without changes. Runs in the serial admin project (it changes a
 * filter for a moment).
 */
const API = '/rest/default/V1';

async function token(request: APIRequestContext): Promise<string> {
  const { user, password } = adminCredentials();
  const response = await request.post(`${API}/integration/admin/token`, { data: { username: user, password } });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as string;
}

test('filters and the config document over REST', async ({ request }) => {
  expect((await request.get(`${API}/openfilter/filters/size`)).status()).toBe(401);

  const headers = { Authorization: `Bearer ${await token(request)}` };
  const before = await (await request.get(`${API}/openfilter/filters/size`, { headers })).json();
  expect(before).toMatchObject({ code: 'size', builtin: false, category_mode: 'all' });

  const list = await (await request.get(`${API}/openfilter/filters?searchCriteria[filterGroups][0][filters][0][field]=builtin`
    + '&searchCriteria[filterGroups][0][filters][0][value]=1', { headers })).json();
  expect(list.items.map((f: { code: string }) => f.code)).toEqual(expect.arrayContaining(['price', 'category']));

  try {
    const changed = await request.put(`${API}/openfilter/filters/size`, { headers, data: { config: { sort_by: 'count', visible_options: 3 } } });
    expect(changed.ok()).toBeTruthy();
    expect(await changed.json()).toMatchObject({ sort_by: 'count', visible_options: 3, display_mode: before.display_mode, seo_indexable: before.seo_indexable });

    const refused = await request.put(`${API}/openfilter/filters/size`, { headers, data: { config: { display_mode: 'slider' } } });
    expect(refused.status()).toBe(400);
    expect((await refused.json()).message).toContain('does not fit');
    expect((await request.put(`${API}/openfilter/filters/no-such-filter`, { headers, data: { config: { sort_by: 'name' } } })).status()).toBe(404);
    expect((await request.put(`${API}/openfilter/filters/size`, { headers, data: { config: { code: 'color' } } })).status()).toBe(400);
  } finally {
    await request.put(`${API}/openfilter/filters/size`, { headers, data: { config: { sort_by: before.sort_by, visible_options: before.visible_options } } });
    magento('cache:clean', 'openfilter', 'full_page');
  }
  expect(await (await request.get(`${API}/openfilter/filters/size`, { headers })).json()).toEqual(before);

  const document = await (await request.get(`${API}/openfilter/config`, { headers })).json();
  expect(JSON.parse(document).schema).toBeGreaterThanOrEqual(2);
  const dryRun = await (await request.post(`${API}/openfilter/config`, { headers, data: { config: document, dryRun: true } })).json();
  expect(dryRun).toEqual({ applied: false, changes: [], errors: [] });
});
