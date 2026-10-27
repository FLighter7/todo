import { test, expect } from '@playwright/test';
import { applySettings, msg, openDialog, seedSampleData, settle } from './fixtures';

/** Each page with the bottom-bar label or tab that names it. */
const PAGES = [
	{ path: 'tasks', label: 'nav.tasks' },
	{ path: 'matrix', label: 'nav.matrix' },
	{ path: 'goals', label: 'nav.goals' },
	{ path: 'dreams', label: 'nav.dreams' },
	{ path: 'groups', label: 'nav.groups' },
	{ path: 'settings', label: 'nav.settings' },
	{ path: 'sync', label: 'sync.title' },
];

test.describe('page identity', () => {
	for (const locale of ['ru', 'pl'] as const) {
		test(`the document language follows the ${locale} interface`, async ({ page }) => {
			await applySettings(page, { locale });
			await page.goto('/todo/tasks');
			await expect(page.locator('html')).toHaveAttribute('lang', locale);
		});
	}

	test('switching the language moves the document language along', async ({ page }) => {
		await applySettings(page);
		await page.goto('/todo/tasks');
		await page.getByRole('button', { name: msg('en', 'app.toggleLanguage') }).click();
		await openDialog(page).getByText('Polski').click();
		await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
	});

	for (const { path, label } of PAGES) {
		test(`${path} has a title and a single top-level heading of its own`, async ({ page }) => {
			await applySettings(page);
			await page.goto(`/todo/${path}`);
			const name = msg('en', label);
			await expect(page).toHaveTitle(new RegExp(`^${name}\\b`));
			await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
			await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
		});
	}

	test('moving to another page is announced', async ({ page }) => {
		await applySettings(page);
		await page.goto('/todo/tasks');
		await page.getByRole('link', { name: msg('en', 'nav.goals') }).click();
		await expect(page.getByRole('status').filter({ hasText: msg('en', 'nav.goals') })).toHaveCount(
			1,
		);
	});

	test('the bottom bar is a named navigation landmark', async ({ page }) => {
		await applySettings(page);
		await page.goto('/todo/tasks');
		await expect(page.getByRole('navigation')).toHaveAccessibleName(/.+/);
	});
});

test.describe('names and states', () => {
	test('a row checkbox names the record it closes or reopens', async ({ page }) => {
		await applySettings(page);
		await seedSampleData(page, 'en');
		await page.goto('/todo/tasks');
		const row = page.locator('main .v-list-item').first();
		const name = (await row.locator('.v-list-item-title').textContent())?.trim() ?? '';
		await expect(row.getByRole('checkbox')).toHaveAccessibleName(new RegExp(name));

		await page.getByRole('button', { name: msg('en', 'entity.history') }).click();
		const closed = page.locator('main .v-list-item').first();
		const closedName = (await closed.locator('.v-list-item-title').textContent())?.trim() ?? '';
		await expect(closed.getByRole('checkbox')).toHaveAccessibleName(new RegExp(closedName));
	});

	test('a matrix checkbox names its task, and each add button its quadrant', async ({ page }) => {
		await applySettings(page);
		await seedSampleData(page, 'en');
		await page.goto('/todo/matrix');
		const first = page.locator('main .v-list-item').first();
		const name = (await first.locator('.v-list-item-title').textContent())?.trim() ?? '';
		await expect(first.getByRole('checkbox')).toHaveAccessibleName(new RegExp(name));

		const addButtons = page.locator('main').getByRole('button');
		const names = await addButtons.evaluateAll((buttons) =>
			buttons.map((button) => button.getAttribute('aria-label')),
		);
		expect(new Set(names).size).toBe(names.length);
	});

	test('the segmented controls expose which segment is on', async ({ page }) => {
		await applySettings(page);
		await page.goto('/todo/tasks');
		await expect(page.getByRole('button', { name: msg('en', 'entity.active') })).toHaveAttribute(
			'aria-pressed',
			'true',
		);
		await expect(page.getByRole('button', { name: msg('en', 'entity.history') })).toHaveAttribute(
			'aria-pressed',
			'false',
		);
	});

	test('the add button does not claim to add tasks only', async ({ page }) => {
		await applySettings(page);
		await page.goto('/todo/goals');
		const fab = page.locator('nav').getByRole('button');
		await expect(fab).toHaveAccessibleName(msg('en', 'form.add'));
		await expect(fab).not.toHaveAccessibleName(/task/i);
	});
});

test.describe('status messages', () => {
	test('a live region is in place before any message arrives', async ({ page }) => {
		await applySettings(page);
		await page.goto('/todo/tasks');
		await settle(page);
		await expect(page.locator('[role="status"], [aria-live="polite"]').first()).toBeAttached();
	});

	test('closing a record is announced', async ({ page }) => {
		await applySettings(page);
		await seedSampleData(page, 'en');
		await page.goto('/todo/tasks');
		const row = page.locator('main .v-list-item').first();
		const name = (await row.locator('.v-list-item-title').textContent())?.trim() ?? '';
		await row.getByRole('checkbox').click();
		await openDialog(page)
			.getByRole('button', { name: msg('en', 'entity.confirm') })
			.click();
		await expect(page.getByRole('status').filter({ hasText: name })).toHaveCount(1);
	});
});
