import { test, expect } from '@playwright/test';

test('adds a task from the list page and it appears in the table', async ({ page }) => {
	await page.goto('/');

	await page.getByRole('button', { name: 'Add task' }).click();
	await page.getByLabel('Title').fill('Buy milk');
	await page.getByRole('button', { name: 'Save' }).click();

	await expect(page.getByText('Buy milk')).toBeVisible();
});

test('an important and urgent task lands in the Do quadrant', async ({ page }) => {
	await page.goto('/todo/matrix');

	// Quadrant cards render in QUADRANT_KEYS order: Do, Schedule, Delegate, Eliminate.
	await page.getByRole('button', { name: 'Add task' }).first().click();
	await page.getByLabel('Title').fill('Ship the release');
	await page.getByRole('button', { name: 'Save' }).click();

	const doQuadrant = page.getByText('Do').locator('..').locator('..');
	await expect(doQuadrant.getByText('Ship the release')).toBeVisible();
});

test('toggling done crosses the task out', async ({ page }) => {
	await page.goto('/');

	await page.getByRole('button', { name: 'Add task' }).click();
	await page.getByLabel('Title').fill('Finish the report');
	await page.getByRole('button', { name: 'Save' }).click();

	const row = page.getByRole('row', { name: /Finish the report/ });
	await row.getByRole('checkbox').click();

	await expect(row.getByText('Finish the report')).toHaveCSS('text-decoration-line', 'line-through');
});

test('deleting a task removes it from the list', async ({ page }) => {
	await page.goto('/');

	await page.getByRole('button', { name: 'Add task' }).click();
	await page.getByLabel('Title').fill('Throwaway task');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByText('Throwaway task')).toBeVisible();

	await page.getByRole('row', { name: /Throwaway task/ }).getByRole('button', { name: 'Actions' }).click();

	await expect(page.getByText('No tasks yet. Add the first one.')).toBeVisible();
});
