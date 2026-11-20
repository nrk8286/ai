import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('invalid UUIDs return client errors instead of PostgreSQL failures', async ({
  request,
  page,
}) => {
  for (const url of [
    '/api/document?id=invalid',
    '/api/vote?chatId=invalid',
    '/api/suggestions?documentId=invalid',
    '/api/history?starting_after=invalid',
    '/api/history?limit=-1',
  ]) {
    expect((await request.get(url)).status()).toBe(400);
  }
  expect((await page.goto('/chat/invalid'))?.status()).toBe(404);
});

test('document versions persist and another account cannot overwrite them', async ({
  request,
  browser,
  baseURL,
}) => {
  const id = randomUUID();
  const url = `/api/document?id=${id}`;
  const first = {
    title: 'Database API test',
    kind: 'text',
    content: 'First version',
  };
  expect((await request.post(url, { data: first })).status()).toBe(200);
  expect(
    (
      await request.post(url, { data: { ...first, content: 'Second version' } })
    ).status(),
  ).toBe(200);
  const versions = await (await request.get(url)).json();
  expect(versions.map((item: { content: string }) => item.content)).toEqual([
    'First version',
    'Second version',
  ]);
  expect(versions[0].kind).toBe('text');

  const otherContext = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  try {
    const otherPage = await otherContext.newPage();
    await otherPage.goto(`${baseURL}/register`);
    await otherPage
      .getByPlaceholder('user@acme.com')
      .fill(`${randomUUID()}@example.test`);
    await otherPage
      .getByLabel('Password', { exact: true })
      .fill('Disposable account password');
    await otherPage
      .getByRole('button', { name: 'Sign Up', exact: true })
      .click();
    await expect(otherPage).toHaveURL(`${baseURL}/`);
    const denied = await otherContext.request.post(`${baseURL}${url}`, {
      data: { ...first, content: 'Unauthorized edit' },
    });
    expect(denied.status()).toBe(401);
    expect((await (await request.get(url)).json()).length).toBe(2);
  } finally {
    await otherContext.close();
  }

  expect(
    (
      await request.patch(url, { data: { timestamp: versions[0].createdAt } })
    ).status(),
  ).toBe(200);
  const remaining = await (await request.get(url)).json();
  expect(remaining).toHaveLength(1);
  expect(remaining[0].content).toBe('First version');
});
