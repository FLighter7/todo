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

// Each page is switched off from its own tab in Settings.
async function switchPageOff(page: Page, name: string): Promise<void> {
	await page.getByRole('tab', { name, exact: true }).click();
	await page.getByRole('checkbox', { name: 'Show this page' }).uncheck();
}

async function openGeneralTab(page: Page): Promise<void> {
	await page.getByRole('tab', { name: 'General', exact: true }).click();
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
		await switchPageOff(page, name);
	}

	await openGeneralTab(page);
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

test('Tasks and the matrix can go too, and with every page off only Tasks can be opened', async ({
	page,
}) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Settings', exact: true }).click();
	const startPage = page.locator('.v-select').first();

	for (const name of ['Dreams', 'Goals', 'Groups', 'Tasks']) {
		await switchPageOff(page, name);
	}

	await openGeneralTab(page);
	await expect(startPage).toContainText('Matrix');
	await expect.poll(() => bottomBarLabels(page)).toEqual(['Matrix', 'Add task']);

	await switchPageOff(page, 'Matrix');

	// Every page off: the bar holds the add button alone, and Tasks is the one page left,
	// so its own settings stay within reach while its switch stays off.
	const showPage = page.getByRole('checkbox', { name: 'Show this page' });
	await expect(showPage).not.toBeChecked();
	await page.getByRole('tab', { name: 'Tasks', exact: true }).click();
	await expect(showPage).not.toBeChecked();
	await expect(page.getByRole('checkbox', { name: 'Confirm before marking done' })).toBeEnabled();
	await page.getByRole('tab', { name: 'Goals', exact: true }).click();
	await expect(page.getByRole('checkbox', { name: 'Confirm before marking done' })).toBeDisabled();

	await openGeneralTab(page);
	await expect(startPage).toContainText('Tasks');
	await expect.poll(() => bottomBarLabels(page)).toEqual(['Add task']);

	for (const address of ['matrix', 'goals', '']) {
		await page.goto(address);
		await expect(page).toHaveURL(/\/tasks$/);
	}

	await page.reload();
	await expect.poll(() => bottomBarLabels(page)).toEqual(['Add task']);
	await page.getByRole('button', { name: 'Add task' }).click();
	await expect(page.getByRole('dialog').getByLabel('Name')).toBeVisible();
	await expect(page.getByRole('dialog').getByRole('tab')).toHaveCount(0);
});
