import { test, expect, type Page } from '@playwright/test';

function rootFontSize(page: Page): Promise<string> {
	return page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
}

async function openSettings(page: Page): Promise<void> {
	await page.goto('/');
	await page.getByRole('button', { name: 'Settings', exact: true }).click();
}

test('the text size setting scales the root font size and survives a reload', async ({ page }) => {
	await openSettings(page);

	await page.getByRole('button', { name: 'Larger text' }).click();
	await expect(page.getByText('112.5%')).toBeVisible();
	expect(await rootFontSize(page)).toBe('18px');

	await page.reload();
	await expect(page.getByText('112.5%')).toBeVisible();
	expect(await rootFontSize(page)).toBe('18px');
});

test('fields stay at 16px when the text size goes below the default', async ({ page }) => {
	await openSettings(page);

	await page.getByRole('button', { name: 'Smaller text' }).click();
	await expect(page.getByText('87.5%')).toBeVisible();
	expect(await rootFontSize(page)).toBe('14px');

	// iOS Safari zooms the page into any input whose text is under 16px.
	const inputFontSize = await page
		.locator('.v-field input')
		.first()
		.evaluate((input) => getComputedStyle(input).fontSize);
	expect(inputFontSize).toBe('16px');
});
