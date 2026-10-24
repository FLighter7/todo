import { test, expect, type Browser, type Page } from '@playwright/test';

async function openDevice(browser: Browser): Promise<Page> {
	const device = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
	return device.newPage();
}

/** Pairs two pages already on the sync page and waits for both to finish. */
async function pair(pageA: Page, pageB: Page): Promise<void> {
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
}

/** Writes records straight into the `items` object store, bypassing the app. */
function seedItems(page: Page, items: object[]): Promise<void> {
	return page.evaluate(
		(records) =>
			new Promise<void>((resolve, reject) => {
				const opening = indexedDB.open('todo');
				opening.onerror = () => reject(opening.error);
				opening.onsuccess = () => {
					const database = opening.result;
					const transaction = database.transaction('items', 'readwrite');
					records.forEach((record) => transaction.objectStore('items').put(record));
					transaction.oncomplete = () => {
						database.close();
						resolve();
					};
					transaction.onerror = () => reject(transaction.error);
				};
			}),
		items,
	);
}

function countItems(page: Page): Promise<number> {
	return page.evaluate(
		() =>
			new Promise<number>((resolve, reject) => {
				const opening = indexedDB.open('todo');
				opening.onerror = () => reject(opening.error);
				opening.onsuccess = () => {
					const database = opening.result;
					const request = database.transaction('items').objectStore('items').count();
					request.onerror = () => reject(request.error);
					request.onsuccess = () => {
						database.close();
						resolve(request.result);
					};
				};
			}),
	);
}

test('a task added on one device reaches the other after pairing', async ({ browser }) => {
	const pageA = await openDevice(browser);
	const pageB = await openDevice(browser);

	await pageA.goto('/');
	await pageA.getByRole('button', { name: 'Add task' }).click();
	await pageA.getByLabel('Name').fill('Buy milk');
	await pageA.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(pageA.getByText('Buy milk')).toBeVisible();

	await pageA.goto('/todo/sync');
	await pageB.goto('/todo/sync');
	await pair(pageA, pageB);

	await pageB.goto('/');
	await expect(pageB.getByText('Buy milk')).toBeVisible();

	await pageA.context().close();
	await pageB.context().close();
});

test('a list far larger than one data channel message syncs whole', async ({ browser }) => {
	const pageA = await openDevice(browser);
	const pageB = await openDevice(browser);
	const now = new Date().toISOString();
	// Cyrillic names take two bytes a character, ~700 KB in all: well past
	// both the old 200 KB one-message cap and the 256 KB a message can carry.
	const tasks = Array.from({ length: 2000 }, (_, index) => ({
		id: `bulk-${index}`,
		type: 1,
		name: `Купить продукты на неделю и не забыть хлеб — ${index}`,
		note: 'Заметка на кириллице, чтобы каждый символ занимал два байта',
		created: now,
		updated: now,
		status: 1,
		important: index % 2 === 0,
		urgent: index % 3 === 0,
	}));

	await pageA.goto('/todo/sync');
	await seedItems(pageA, tasks);
	await pageA.reload();
	await pageB.goto('/todo/sync');

	await pair(pageA, pageB);

	await expect(pageB.getByText('Sync finished. Added: 2000. Updated: 0.')).toBeVisible();
	expect(await countItems(pageB)).toBe(2000);

	await pageA.context().close();
	await pageB.context().close();
});
