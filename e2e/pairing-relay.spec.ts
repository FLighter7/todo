import { test, expect, type Page } from '@playwright/test';
import { decodeQr, fakePairing, samplePairingCode } from './pairing';

/**
 * A paired device passes the server's code on to another: it reads the code
 * and shows it again, and never pairs with it. The whole path through a real
 * server is in server-sync.spec.ts; this one needs no server.
 */

async function openRelay(page: Page): Promise<void> {
	await fakePairing(page);
	await page.goto('/todo/sync');
	await expect(page.getByText('Server: Desk')).toBeVisible();
	await page.getByRole('button', { name: 'Pair another device' }).click();
	await expect(page.getByRole('dialog', { name: 'Pair another device' })).toBeVisible();
}

async function enterCode(page: Page, code: string): Promise<void> {
	const dialog = page.getByRole('dialog', { name: 'Pair another device' });
	await dialog.getByLabel('Code', { exact: true }).fill(code);
	await dialog.getByRole('button', { name: 'Use this code' }).click();
}

test('shows the code again as a QR code a camera reads, and keeps its own pairing', async ({
	page,
}) => {
	await openRelay(page);
	const pairing = await page.evaluate(() => localStorage.getItem('todo.server'));
	const code = samplePairingCode();

	await enterCode(page, code);

	const picture = page.getByRole('img', { name: 'Pairing code for Desk' });
	await expect(picture).toBeVisible();
	expect(await decodeQr(page, picture)).toBe(code);
	expect(await page.evaluate(() => localStorage.getItem('todo.server'))).toBe(pairing);
});

test('copies the code', async ({ page, context }) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await openRelay(page);
	const code = samplePairingCode();
	await enterCode(page, code);

	await page.getByRole('button', { name: 'Copy the code' }).click();

	await expect(
		page
			.getByRole('dialog', { name: 'Pair another device' })
			.getByText('Code copied. Paste it on the other device.'),
	).toBeVisible();
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
});

test('says when the code is for another server, and passes it on all the same', async ({
	page,
}) => {
	await openRelay(page);

	await enterCode(page, samplePairingCode('S2', 'Laptop'));

	await expect(
		page.getByText('This code is for the server Laptop, not the one this device syncs with.'),
	).toBeVisible();
	await expect(page.getByRole('img', { name: 'Pairing code for Laptop' })).toBeVisible();
});

test('forgets the code when the dialog closes', async ({ page }) => {
	await openRelay(page);
	await enterCode(page, samplePairingCode());
	await expect(page.getByRole('img', { name: 'Pairing code for Desk' })).toBeVisible();

	await page.getByRole('button', { name: 'Close' }).click();
	await expect(page.getByRole('dialog')).toBeHidden();
	await expect(page.getByRole('button', { name: 'Pair another device' })).toBeFocused();
	await page.getByRole('button', { name: 'Pair another device' }).click();

	await expect(page.getByLabel('Code', { exact: true })).toBeVisible();
	await expect(page.getByRole('img', { name: /^Pairing code/ })).toHaveCount(0);
});
