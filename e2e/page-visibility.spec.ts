import { test, expect, type Page } from '@playwright/test';

function bottomBarLabels(page: Page): Promise<string[]> {
	return page
		.locator('nav')
		.filter({ has: page.getByRole('button', { name: 'Add task' }) })
		.locator('.v-btn')
		.evaluateAll((buttons) =>
			buttons.map(
				(button) => button.textContent?.trim() || button.getAttribute('aria-label') || '',
			),
		);
}

test('pages switched off in Settings leave the bottom bar, the start page and their address', async ({
	page,
}) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Settings', exact: true }).click();

	// Start on Goals first, so that switching Goals off has a start page to hand back.
	const startPage = page.locator('.v-select').first();
	await startPage.locator('.v-field').click();
	await page.getByRole('option', { name: 'Goals' }).click();
	await expect(startPage).toContainText('Goals');

	for (const name of ['Dreams', 'Goals', 'Groups']) {
		await page.getByRole('checkbox', { name, exact: true }).uncheck();
	}

	await expect(startPage).toContainText('Tasks');
	await expect.poll(() => bottomBarLabels(page)).toEqual(['Tasks', 'Add task', 'Matrix']);

	await page.getByRole('button', { name: 'Add task' }).click();
	const dialog = page.getByRole('dialog');
	await expect(dialog.getByLabel('Name')).toBeVisible();
	await expect(dialog.getByRole('tab')).toHaveCount(0);
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();

	await page.goto('dreams');
	await expect(page).toHaveURL(/\/tasks$/);

	await page.reload();
	await expect.poll(() => bottomBarLabels(page)).toEqual(['Tasks', 'Add task', 'Matrix']);

	await page.goto('');
	await expect(page).toHaveURL(/\/tasks$/);
});

test('Tasks and the matrix can go too, and with every page off Tasks is the one left', async ({
	page,
}) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Settings', exact: true }).click();
	const startPage = page.locator('.v-select').first();

	for (const name of ['Dreams', 'Goals', 'Groups', 'Tasks']) {
		await page.getByRole('checkbox', { name, exact: true }).uncheck();
	}

	await expect(startPage).toContainText('Matrix');
	await expect.poll(() => bottomBarLabels(page)).toEqual(['Matrix', 'Add task']);

	await page.getByRole('checkbox', { name: 'Matrix', exact: true }).uncheck();

	const tasksBox = page.getByRole('checkbox', { name: 'Tasks', exact: true });
	await expect(tasksBox).toBeChecked();
	await expect(tasksBox).toBeDisabled();
	await expect(startPage).toContainText('Tasks');
	await expect.poll(() => bottomBarLabels(page)).toEqual(['Tasks', 'Add task']);

	await page.goto('matrix');
	await expect(page).toHaveURL(/\/tasks$/);
});
