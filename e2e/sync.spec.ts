import { test, expect } from '@playwright/test';

test('a task added on one device reaches the other after pairing', async ({ browser }) => {
	const deviceA = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
	const deviceB = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
	const pageA = await deviceA.newPage();
	const pageB = await deviceB.newPage();

	await pageA.goto('/');
	await pageA.getByRole('button', { name: 'Add task' }).click();
	await pageA.getByLabel('Name').fill('Buy milk');
	await pageA.getByRole('button', { name: 'Save' }).click();
	await expect(pageA.getByText('Buy milk')).toBeVisible();

	await pageA.goto('/todo/sync');
	await pageB.goto('/todo/sync');

	await pageA.getByRole('button', { name: 'This device starts' }).click();
	await pageA.getByRole('button', { name: 'Copy code' }).click();
	const offerCode = await pageA.evaluate(() => navigator.clipboard.readText());

	await pageB.getByRole('button', { name: 'This device joins' }).click();
	await pageB.getByLabel('No camera? Paste the code here').fill(offerCode);
	await pageB.getByRole('button', { name: 'Use this code' }).click();

	await pageB.getByRole('button', { name: 'Copy code' }).click();
	const answerCode = await pageB.evaluate(() => navigator.clipboard.readText());

	await pageA.getByLabel('No camera? Paste the code here').fill(answerCode);
	await pageA.getByRole('button', { name: 'Use this code' }).click();

	await expect(pageA.getByText(/Sync finished/)).toBeVisible({ timeout: 20_000 });
	await expect(pageB.getByText(/Sync finished/)).toBeVisible({ timeout: 20_000 });

	await pageB.goto('/');
	await expect(pageB.getByText('Buy milk')).toBeVisible();

	await deviceA.close();
	await deviceB.close();
});
