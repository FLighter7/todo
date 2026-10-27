import { test, expect, type Page } from '@playwright/test';

/** Just the fields these tests look at; the real shapes live in src/types. */
interface StoredItem {
	id: string;
	type: number;
	name: string;
	status: number;
	updated: string;
	note?: string;
	groupId?: string;
	deadline?: unknown;
	schedule?: { rrule?: string };
	completions?: Array<{ occurrence: string; done: boolean }>;
}

const TASK = 1;
const GROUP = 2;
const GOAL = 3;
const DREAM = 4;
const OPENED = 1;

/**
 * Reads the `items` object store straight out of IndexedDB. Unit tests run
 * against an in-memory repository that happily holds what IndexedDB would
 * refuse — a reactive proxy fails structured clone — so persistence has to be
 * checked where it actually happens.
 */
function readItems(page: Page): Promise<StoredItem[]> {
	return page.evaluate(
		() =>
			new Promise<StoredItem[]>((resolve, reject) => {
				const opening = indexedDB.open('todo');
				opening.onerror = () => reject(opening.error);
				opening.onsuccess = () => {
					const database = opening.result;
					const request = database.transaction('items').objectStore('items').getAll();
					request.onerror = () => reject(request.error);
					request.onsuccess = () => {
						database.close();
						const items = request.result as StoredItem[];
						resolve(items.sort((a, b) => (a.id < b.id ? -1 : 1)));
					};
				};
			}),
	);
}

async function generateSampleData(page: Page): Promise<StoredItem[]> {
	await page.goto('/todo/settings');
	await page.getByText('Generate sample data').click();
	await expect(page.locator('.v-snackbar').getByText(/Sample data generated/)).toBeVisible();

	return readItems(page);
}

test('sample data with deadlines, schedules and marks survives a reload unchanged', async ({
	page,
}) => {
	const before = await generateSampleData(page);

	expect(new Set(before.map((item) => item.type))).toEqual(new Set([TASK, GROUP, GOAL, DREAM]));
	expect(before.some((item) => item.groupId !== undefined)).toBe(true);
	expect(before.some((item) => item.deadline !== undefined)).toBe(true);
	expect(before.some((item) => item.schedule !== undefined)).toBe(true);
	expect(before.some((item) => (item.completions ?? []).length > 0)).toBe(true);

	await page.goto('/todo/tasks');
	await page.reload();
	await expect(page.locator('.v-list-item').first()).toBeVisible();

	expect(await readItems(page)).toEqual(before);
});

test('a scheduled task keeps its schedule through an edit, and an occurrence mark persists', async ({
	page,
}) => {
	const generated = await generateSampleData(page);
	const task = generated.find(
		(item) =>
			item.type === TASK &&
			item.status === OPENED &&
			item.schedule?.rrule !== undefined &&
			(item.completions ?? []).length > 0,
	);
	expect(task).toBeDefined();

	await page.goto('/todo/tasks');
	const dialog = page.getByRole('dialog');

	// Edit and save without changing anything: the schedule goes back through
	// the form, the path where a reactive value would reach IndexedDB.
	await page.getByText(task!.name, { exact: true }).first().click();
	await dialog.getByRole('button', { name: 'Edit' }).click();
	await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(dialog).toBeHidden();

	// Checked before anything else writes the task: a later write of a plain
	// copy would otherwise cover up a save that never reached storage. The
	// write is asynchronous, so wait for it to land rather than race a reload.
	const storedTask = async () => (await readItems(page)).find((item) => item.id === task!.id);
	await expect
		.poll(async () => Date.parse((await storedTask())!.updated))
		.toBeGreaterThan(Date.parse(task!.updated));
	await page.reload();
	await expect(page.locator('.v-list-item').first()).toBeVisible();
	const edited = await storedTask();
	expect(edited?.schedule).toEqual(task!.schedule);
	expect(Date.parse(edited!.updated)).toBeGreaterThan(Date.parse(task!.updated));

	await page.getByText(task!.name, { exact: true }).first().click();
	await dialog
		.getByRole('button', { name: /^Mark done: / })
		.first()
		.click();

	const doneCount = (item: StoredItem | undefined) =>
		item?.completions?.filter((entry) => entry.done).length ?? 0;
	await expect.poll(async () => doneCount(await storedTask())).toBe(doneCount(task) + 1);
	await page.reload();
	await expect(page.locator('.v-list-item').first()).toBeVisible();
	expect(doneCount(await storedTask())).toBe(doneCount(task) + 1);
});

test('a group made on its page, and a task put in it, survive a reload', async ({ page }) => {
	await page.goto('/todo/groups');
	const dialog = page.getByRole('dialog');

	await page.getByRole('button', { name: 'Add', exact: true }).click();
	await dialog.getByLabel('Name').fill('Errands');
	await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.locator('.v-list-item', { hasText: 'Errands' })).toBeVisible();

	// In-app navigation, not page.goto: a reload could cut the group's write short.
	await page.getByRole('link', { name: 'Tasks' }).click();
	await page.getByRole('button', { name: 'Add', exact: true }).click();
	await dialog.getByLabel('Name').fill('Buy stamps');
	// The field's own overlay takes the click, not the input the label points at.
	await dialog.locator('.v-field', { has: page.getByLabel('Group', { exact: true }) }).click();
	await page.getByRole('option', { name: 'Errands' }).click();
	await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.locator('.v-list-item', { hasText: 'Buy stamps' })).toBeVisible();

	const stored = async () => {
		const items = await readItems(page);
		return {
			group: items.find((item) => item.type === GROUP),
			task: items.find((item) => item.type === TASK),
		};
	};
	await expect.poll(async () => (await stored()).task?.groupId).toBeDefined();
	const { group, task } = await stored();
	expect(group).toMatchObject({ name: 'Errands', status: OPENED });
	expect(group?.note).toBeUndefined();
	expect(task?.groupId).toBe(group?.id);

	await page.reload();
	await page.getByText('Buy stamps', { exact: true }).click();
	await expect(dialog.getByText('Group: Errands')).toBeVisible();
	expect(await stored()).toEqual({ group, task });
});
