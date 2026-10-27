import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';

export const LOCALES = ['en', 'ru', 'pl'] as const;
export type Locale = (typeof LOCALES)[number];
export type Theme = 'light' | 'dark';

type Messages = Record<string, unknown>;

const MESSAGES = Object.fromEntries(
	LOCALES.map((locale) => [
		locale,
		JSON.parse(
			readFileSync(new URL(`../../src/i18n/locales/${locale}.json`, import.meta.url), 'utf8'),
		) as Messages,
	]),
) as Record<Locale, Messages>;

/** A UI string as the app shows it, so the probes follow the labels in every locale. */
export function msg(locale: Locale, key: string): string {
	const value = key
		.split('.')
		.reduce<unknown>((node, part) => (node as Messages | undefined)?.[part], MESSAGES[locale]);
	if (typeof value !== 'string') {
		throw new Error(`No message "${key}" in ${locale}`);
	}

	// A pluralized message: its first form is enough for a label.
	return value.split(' | ')[0];
}

/** Set to a folder to keep what the probes measured, as the audit report does. */
export const DUMP_DIR = process.env.A11Y_DUMP_DIR;

export function dump(path: string, content: string | Buffer): void {
	if (DUMP_DIR === undefined) {
		return;
	}

	const file = join(DUMP_DIR, path);
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, content);
}

/**
 * Dialog and tab transitions finish before a probe; a looping progress bar never
 * does. Two frames first: a transition that has just been triggered is not
 * running yet, and would read as finished.
 */
export async function settle(page: Page): Promise<void> {
	await page.evaluate(
		() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
	);
	await page.waitForFunction(() =>
		document
			.getAnimations()
			.every(
				(animation) =>
					animation.playState !== 'running' ||
					animation.effect?.getTiming().iterations === Infinity,
			),
	);
}

export interface AuditOptions {
	theme?: Theme;
	locale?: Locale;
	fontScale?: number;
}

/**
 * Written before every page load, so the app starts straight in the wanted
 * theme, locale and text size. Two rows show notes, and the confirmations are
 * on so that a checkbox opens its dialog instead of closing the record.
 */
export async function applySettings(page: Page, options: AuditOptions = {}): Promise<void> {
	const pageSettings = { rows: 2, confirmDone: true, confirmReopen: true, sortOrder: 'az' };
	const document = {
		general: {
			theme: options.theme ?? 'light',
			locale: options.locale ?? 'en',
			startPage: 'tasks',
			cleanupDays: 30,
			fontScale: options.fontScale ?? 1,
			pages: { tasks: true, matrix: true, dreams: true, goals: true, groups: true },
		},
		dreams: pageSettings,
		goals: pageSettings,
		groups: pageSettings,
		tasks: pageSettings,
	};

	await page.addInitScript((value) => {
		localStorage.setItem('todo.settings', value);
	}, JSON.stringify(document));
}

/**
 * Fills the app with the built-in sample data in the current locale, then
 * reloads so that the confirmation toast is gone before anything is probed.
 */
export async function seedSampleData(page: Page, locale: Locale): Promise<void> {
	await page.goto('/todo/settings');
	await page.getByText(msg(locale, 'mockData.action'), { exact: true }).click();
	await expect(
		page.locator('.v-snackbar').getByText(msg(locale, 'mockData.generated').split('.')[0]),
	).toBeVisible();
}

/** The open dialog, whichever one it is: Vuetify keeps closed ones out of the DOM. */
export function openDialog(page: Page): Locator {
	return page.locator('.v-overlay--active[role="dialog"]').last();
}

async function goto(page: Page, path: string): Promise<void> {
	await page.goto(`/todo/${path}`);
	await page.locator('main').waitFor();
}

function rows(page: Page): Locator {
	return page.locator('main .v-list-item');
}

async function openFirstRow(page: Page, path: string): Promise<void> {
	await goto(page, path);
	await rows(page).first().click();
	await expect(openDialog(page)).toBeVisible();
}

async function openAddDialog(page: Page, locale: Locale, tab?: string): Promise<void> {
	await goto(page, 'tasks');
	await page.getByRole('button', { name: msg(locale, 'form.add') }).click();
	await expect(openDialog(page)).toBeVisible();
	if (tab !== undefined) {
		await openDialog(page)
			.getByRole('tab', { name: msg(locale, `${tab}.title`) })
			.click();
	}
}

export interface AuditState {
	name: string;
	/** Leaves the page in the state to probe; a dialog or menu stays open. */
	enter: (page: Page, locale: Locale) => Promise<void>;
}

/** Every page, tab, dialog and menu the app has, each in a state worth probing. */
export const STATES: AuditState[] = [
	{ name: 'tasks', enter: (page) => goto(page, 'tasks') },
	{
		name: 'tasks-history',
		enter: async (page, locale) => {
			await goto(page, 'tasks');
			await page.getByRole('button', { name: msg(locale, 'entity.history') }).click();
		},
	},
	{ name: 'matrix', enter: (page) => goto(page, 'matrix') },
	{ name: 'goals', enter: (page) => goto(page, 'goals') },
	{ name: 'dreams', enter: (page) => goto(page, 'dreams') },
	{ name: 'groups', enter: (page) => goto(page, 'groups') },
	{ name: 'settings-general', enter: (page) => goto(page, 'settings') },
	{
		name: 'settings-tasks',
		enter: async (page, locale) => {
			await goto(page, 'settings');
			await page.getByRole('tab', { name: msg(locale, 'nav.tasks'), exact: true }).click();
		},
	},
	{ name: 'sync', enter: (page) => goto(page, 'sync') },
	{ name: 'add-task', enter: (page, locale) => openAddDialog(page, locale) },
	{
		name: 'add-task-errors',
		enter: async (page, locale) => {
			await openAddDialog(page, locale);
			await openDialog(page)
				.getByRole('button', { name: msg(locale, 'form.save'), exact: true })
				.click();
			await expect(openDialog(page).getByText(msg(locale, 'form.nameRequired'))).toBeVisible();
		},
	},
	{
		name: 'add-task-schedule',
		enter: async (page, locale) => {
			await openAddDialog(page, locale);
			await openDialog(page)
				.getByRole('checkbox', { name: msg(locale, 'task.schedule.enabled') })
				.check();
		},
	},
	{ name: 'add-goal', enter: (page, locale) => openAddDialog(page, locale, 'goal') },
	{
		name: 'add-goal-deadline',
		enter: async (page, locale) => {
			await openAddDialog(page, locale, 'goal');
			await openDialog(page)
				.getByRole('checkbox', { name: msg(locale, 'goal.deadline.enabled') })
				.check();
		},
	},
	{ name: 'add-dream', enter: (page, locale) => openAddDialog(page, locale, 'dream') },
	{ name: 'add-group', enter: (page, locale) => openAddDialog(page, locale, 'group') },
	{ name: 'task-read', enter: (page) => openFirstRow(page, 'tasks') },
	{
		name: 'task-read-completions',
		enter: async (page, locale) => {
			await goto(page, 'tasks');
			const count = await rows(page).count();
			for (let index = 0; index < count; index++) {
				await rows(page).nth(index).click();
				const dialog = openDialog(page);
				await expect(dialog).toBeVisible();
				if ((await dialog.getByText(msg(locale, 'task.completions.label')).count()) > 0) {
					return;
				}
				// Escape during the opening transition can go unheard.
				await settle(page);
				await page.keyboard.press('Escape');
				await expect(dialog).toBeHidden();
			}
			throw new Error('No task with completions in the sample data');
		},
	},
	{
		name: 'task-edit',
		enter: async (page, locale) => {
			await openFirstRow(page, 'tasks');
			await openDialog(page)
				.getByRole('button', { name: msg(locale, 'entity.edit') })
				.click();
		},
	},
	{
		name: 'confirm-done',
		enter: async (page) => {
			await goto(page, 'tasks');
			await rows(page).first().getByRole('checkbox').click();
			await expect(openDialog(page)).toBeVisible();
		},
	},
	{ name: 'goal-read', enter: (page) => openFirstRow(page, 'goals') },
	{ name: 'dream-read', enter: (page) => openFirstRow(page, 'dreams') },
	{ name: 'group-read', enter: (page) => openFirstRow(page, 'groups') },
	{
		name: 'dream-cascade',
		enter: async (page, locale) => {
			// A dream that has goals is the legend of the first section on the Goals page.
			await goto(page, 'goals');
			const dreamName = (await page.locator('main legend').first().textContent())?.trim() ?? '';
			await goto(page, 'dreams');
			await rows(page).filter({ hasText: dreamName }).first().click();
			const dialog = openDialog(page);
			await dialog.getByRole('button', { name: msg(locale, 'entity.edit') }).click();
			await dialog.getByRole('button', { name: msg(locale, 'entity.cancelRecord') }).click();
			await expect(page.getByText(msg(locale, 'entity.cascadeTitle'))).toBeVisible();
		},
	},
	{
		name: 'matrix-add',
		enter: async (page, locale) => {
			await goto(page, 'matrix');
			await page
				.locator('main')
				.getByRole('button', { name: msg(locale, 'form.add') })
				.first()
				.click();
			await expect(openDialog(page)).toBeVisible();
		},
	},
	{
		name: 'theme-menu',
		enter: async (page, locale) => {
			await goto(page, 'tasks');
			await page.getByRole('button', { name: msg(locale, 'app.toggleTheme') }).click();
			await expect(openDialog(page)).toBeVisible();
		},
	},
	{
		name: 'locale-menu',
		enter: async (page, locale) => {
			await goto(page, 'tasks');
			await page.getByRole('button', { name: msg(locale, 'app.toggleLanguage') }).click();
			await expect(openDialog(page)).toBeVisible();
		},
	},
	{
		name: 'sort-menu',
		enter: async (page, locale) => {
			await goto(page, 'tasks');
			await page
				.getByRole('button', { name: msg(locale, 'entity.sortLabel'), exact: true })
				.click();
			await expect(page.locator('.v-overlay--active .v-list')).toBeVisible();
		},
	},
	{
		name: 'mock-confirm',
		enter: async (page, locale) => {
			await goto(page, 'settings');
			await page.getByText(msg(locale, 'mockData.action'), { exact: true }).click();
			await expect(openDialog(page)).toBeVisible();
		},
	},
];
