import { test, expect } from '@playwright/test';

test('adds a task from the list page and it appears in the table', async ({ page }) => {
	await page.goto('/');

	await page.getByRole('button', { name: 'Add task' }).click();
	await page.getByLabel('Name').fill('Buy milk');
	await page.getByRole('button', { name: 'Save', exact: true }).click();

	await expect(page.getByText('Buy milk')).toBeVisible();
});

test('an important and urgent task lands in the Do quadrant', async ({ page }) => {
	await page.goto('/todo/matrix');

	// Quadrant cards render in QUADRANT_KEYS order: Do, Schedule, Delegate, Eliminate.
	await page.getByRole('button', { name: 'Add task' }).first().click();
	await page.getByLabel('Name').fill('Ship the release');
	await page.getByRole('button', { name: 'Save', exact: true }).click();

	const doQuadrant = page.getByText('Do').locator('..').locator('..');
	await expect(doQuadrant.getByText('Ship the release')).toBeVisible();
});

test('toggling done moves the task from Active to History', async ({ page }) => {
	await page.goto('/');

	await page.getByRole('button', { name: 'Add task' }).click();
	await page.getByLabel('Name').fill('Finish the report');
	await page.getByRole('button', { name: 'Save', exact: true }).click();

	const item = page.locator('.v-list-item', { hasText: 'Finish the report' });
	await item.getByRole('checkbox').click();

	await expect(page.getByText('Finish the report')).not.toBeVisible();

	await page.getByRole('button', { name: 'History' }).click();
	await expect(page.getByText('Finish the report')).toBeVisible();
});

test('cancelling a task removes it from the active list', async ({ page }) => {
	await page.goto('/');

	await page.getByRole('button', { name: 'Add task' }).click();
	await page.getByLabel('Name').fill('Throwaway task');
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByText('Throwaway task')).toBeVisible();

	await page.getByText('Throwaway task').click();
	await page.getByRole('button', { name: 'Cancel this record' }).click();

	await expect(page.getByText('No tasks yet. Add the first one.')).toBeVisible();
});

test('a task survives a page reload', async ({ page }) => {
	await page.goto('/');

	await page.getByRole('button', { name: 'Add task' }).click();
	await page.getByLabel('Name').fill('Survives reload');
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByText('Survives reload')).toBeVisible();

	await page.reload();

	// Rendering the task is not enough: it has to come back from IndexedDB.
	await expect(page.getByText('Survives reload')).toBeVisible();
});
