import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

/**
 * Reads the names in the `items` object store straight out of IndexedDB: a
 * merge writes the whole list, and the in-memory list on screen would hide a
 * write that IndexedDB refused.
 */
function storedNames(page: Page): Promise<string[]> {
	return page.evaluate(
		() =>
			new Promise<string[]>((resolve, reject) => {
				const opening = indexedDB.open('todo');
				opening.onerror = () => reject(opening.error);
				opening.onsuccess = () => {
					const database = opening.result;
					const request = database.transaction('items').objectStore('items').getAll();
					request.onerror = () => reject(request.error);
					request.onsuccess = () => {
						database.close();
						resolve((request.result as Array<{ name: string }>).map((item) => item.name).sort());
					};
				};
			}),
	);
}

async function addTask(page: Page, name: string): Promise<void> {
	await page.goto('/');
	await page.getByRole('button', { name: 'Add', exact: true }).click();
	await page.getByLabel('Name').fill(name);
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.locator('main').getByText(name)).toBeVisible();
}

async function importFile(page: Page, file: { name: string; buffer: Buffer }): Promise<void> {
	await page.goto('/todo/settings');
	const choosing = page.waitForEvent('filechooser');
	await page.getByRole('button', { name: 'Import from a file' }).click();
	await (await choosing).setFiles({ ...file, mimeType: 'text/plain' });
	await expect(page.getByRole('dialog', { name: 'Merge or replace?' })).toBeVisible();
	await page.getByRole('button', { name: 'Merge', exact: true }).click();
}

test("a file from another device merges in beside this device's records", async ({
	page,
	browser,
}) => {
	// The other device: its own browser context, so its own IndexedDB.
	const other = await browser.newContext();
	const otherPage = await other.newPage();
	await addTask(otherPage, 'From the other phone');
	await otherPage.goto('/todo/settings');
	const downloading = otherPage.waitForEvent('download');
	await otherPage.getByRole('button', { name: 'Export to a file' }).click();
	const exported = readFileSync(await (await downloading).path());
	await other.close();

	await addTask(page, 'From this phone');
	await importFile(page, { name: 'todo-backup.json', buffer: exported });

	await expect(
		page.locator('.v-snackbar').getByText('Merged with the file. New records: 1, updated: 0.'),
	).toBeVisible();
	expect(await storedNames(page)).toEqual(['From the other phone', 'From this phone']);

	await page.goto('/');
	await page.reload();
	await expect(page.locator('main').getByText('From the other phone')).toBeVisible();
	await expect(page.locator('main').getByText('From this phone')).toBeVisible();

	// The same file again, shared as text the way Chrome shares it, brings nothing new.
	await importFile(page, { name: 'todo-backup.txt', buffer: exported });
	await expect(
		page
			.locator('.v-snackbar')
			.getByText('The file holds nothing this device does not have already.'),
	).toBeVisible();
	expect(await storedNames(page)).toEqual(['From the other phone', 'From this phone']);
});
