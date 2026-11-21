import path from 'node:path';
import { generateId } from 'ai';
import { expect, test as setup } from '@playwright/test';

const authFile = path.join(__dirname, '../playwright/.auth/session.json');

setup('authenticate', async ({ page }) => {
  const testEmail = `test-${generateId(12)}@example.test`;
  const testPassword = generateId(16);

  await page.goto('/register');
  await page.getByPlaceholder('user@acme.com').click();
  await page.getByPlaceholder('user@acme.com').fill(testEmail);
  await page.getByLabel('Password').click();
  await page.getByLabel('Password').fill(testPassword);
  await page.getByRole('button', { name: 'Sign Up' }).click();

  await expect(page.getByTestId('toast')).toContainText(
    'Account created successfully!',
  );

  await page.context().storageState({ path: authFile });
});
