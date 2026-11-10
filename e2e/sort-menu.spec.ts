import { test, expect } from '@playwright/test';

test('a click outside the open sort menu only closes it, without reaching what lies beneath', async ({
	page,
}) => {
	await page.goto('/');

	const history = page.getByRole('button', { name: 'History' });
	await expect(history).toBeVisible();
	const box = await history.boundingBox();
	if (!box) throw new Error('History tab has no bounding box');

	await page.getByRole('button', { name: 'Sort' }).click();
	await expect(page.getByText('Newest first')).toBeVisible();

	// A raw mouse click, not locator.click(): the latter refuses to click an
	// element covered by something else, which is exactly the point here.
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

	await expect(page.getByText('Newest first')).not.toBeVisible();
	await expect(history).not.toHaveClass(/v-btn--active/);
	await expect(page.getByRole('button', { name: 'Active' })).toHaveClass(/v-btn--active/);
});
