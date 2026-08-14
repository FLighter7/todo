import { test, expect } from '@playwright/test';

test('registers a service worker on first load', async ({ page }) => {
	await page.goto('/');

	const hasController = await page.waitForFunction(
		() => navigator.serviceWorker.controller !== null,
		null,
		{ timeout: 15_000 },
	);

	expect(await hasController.jsonValue()).toBe(true);
});

test('the app shell still loads after going offline', async ({ page, context }) => {
	await page.goto('/');
	await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
		timeout: 15_000,
	});

	await context.setOffline(true);
	await page.reload();

	await expect(page.getByRole('button', { name: 'Add task' })).toBeVisible();

	await context.setOffline(false);
});
