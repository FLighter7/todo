import { test, expect, type Page } from '@playwright/test';

/** A theme colour as Vuetify writes it on the app root: `r,g,b`. */
function themeColour(page: Page, name: string): Promise<string> {
	return page
		.locator('.v-application')
		.evaluate(
			(root, variable) => getComputedStyle(root).getPropertyValue(variable).trim(),
			`--v-theme-${name}`,
		);
}

function savedGeneral(page: Page): Promise<Record<string, unknown>> {
	return page.evaluate(() => JSON.parse(localStorage.getItem('todo.settings') ?? '{}').general);
}

async function openSettings(page: Page): Promise<void> {
	await page.goto('/');
	await page.getByRole('button', { name: 'Settings', exact: true }).click();
}

test('a colour scheme and a swatch apply at once and survive a reload', async ({ page }) => {
	await openSettings(page);
	const scheme = page.getByRole('radiogroup', { name: 'Colour scheme' });
	const accent = page.getByRole('radiogroup', { name: 'Accent colour' });
	const standardPrimary = await themeColour(page, 'primary');

	await scheme.getByRole('radio', { name: 'High contrast' }).check();
	await expect(page.locator('.v-application')).toHaveClass(/v-theme--contrast-(light|dark)/);
	expect(await themeColour(page, 'background')).toMatch(/^(255,255,255|0,0,0)$/);

	await accent.getByRole('radio', { name: 'Pink' }).check();
	const pinkPrimary = await themeColour(page, 'primary');
	expect(pinkPrimary).not.toBe(standardPrimary);

	await page.reload();
	await expect(scheme.getByRole('radio', { name: 'High contrast' })).toBeChecked();
	await expect(accent.getByRole('radio', { name: 'Pink' })).toBeChecked();
	expect(await themeColour(page, 'primary')).toBe(pinkPrimary);
	expect(await savedGeneral(page)).toMatchObject({ scheme: 'contrast', accent: '#D81B60' });

	await accent.getByRole('radio', { name: "The scheme's own" }).check();
	expect(await savedGeneral(page)).toMatchObject({ accent: null });
});

test('a colour picked by hand becomes the accent, fitted to the palette', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'light' });
	await openSettings(page);

	// Pale yellow, far too light to read on a light background as it is.
	await page.getByLabel('Custom colour').fill('#ffee88');

	await expect.poll(() => savedGeneral(page)).toMatchObject({ accent: '#ffee88' });
	const primary = await themeColour(page, 'primary');
	const [r, g, b] = primary.split(',').map(Number);
	expect(r + g + b).toBeLessThan(0xff + 0xee + 0x88);
	await expect(
		page.getByRole('radiogroup', { name: 'Accent colour' }).getByRole('radio', { checked: true }),
	).toHaveCount(0);

	await page.reload();
	expect(await themeColour(page, 'primary')).toBe(primary);
});

test('the browser bar follows the theme', async ({ page }) => {
	await openSettings(page);

	await page.getByRole('radio', { name: 'High contrast' }).check();

	const background = await themeColour(page, 'background');
	const hex = background === '0,0,0' ? '#000000' : '#ffffff';
	await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
		'content',
		new RegExp(hex, 'i'),
	);
});
