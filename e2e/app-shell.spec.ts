import { test, expect } from '@playwright/test';

test('the app shell loads and shows the list page', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByText('Todo').first()).toBeVisible();
	await expect(page.getByRole('button', { name: 'Add task' })).toBeVisible();
});
