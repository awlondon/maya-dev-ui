import { test, expect } from '@playwright/test';

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'https://dev.primarydesignco.com';
const sessionCookie = process.env.TEST_SESSION_COOKIE;

test('should show the game controller button above chat input', async ({ page, context }) => {
  test.skip(!sessionCookie, 'Missing TEST_SESSION_COOKIE for authenticated chat view.');

  const baseHostname = new URL(baseUrl).hostname;

  await context.addCookies([
    {
      name: 'maya_session',
      value: sessionCookie as string,
      domain: baseHostname,
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax'
    }
  ]);

  await page.goto(baseUrl);

  const controls = page.locator('.chat-controls');
  const controllerRow = page.locator('.playable-wrapper-container');
  const ctrlBtn = page.locator('#playable-controller-btn');
  const chatInputRow = page.locator('.chat-input-row');

  await expect(controls).toBeVisible();
  await expect(controllerRow).toBeVisible();
  await expect(ctrlBtn).toBeVisible();
  await expect(ctrlBtn).toHaveAttribute('type', 'button');
  await expect(chatInputRow).toBeVisible();

  const controllerBox = await controllerRow.boundingBox();
  const inputBox = await chatInputRow.boundingBox();

  expect(controllerBox).not.toBeNull();
  expect(inputBox).not.toBeNull();
  expect(controllerBox!.y).toBeLessThan(inputBox!.y);
});
