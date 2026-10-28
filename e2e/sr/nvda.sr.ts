import { nvdaTest as test, type NVDAPlaywright } from '@guidepup/playwright';
import { NVDAKeyCodeCommands } from '@guidepup/guidepup';
import { expect, type Page } from '@playwright/test';
import { applySettings, dump, msg, openDialog, seedSampleData, settle } from '../a11y/fixtures';

// What NVDA says along the paths a screen reader user takes through the app.
// Each test keeps its spoken log under A11Y_DUMP_DIR before it asserts, so a
// failing run still leaves the whole log to read.

// English speech whatever the Windows language, so the assertions read the same everywhere.
// Full capture: by default Guidepup keeps only the first burst of speech after a
// key, and a dialog is announced a moment later, once its transition has run.
test.use({ nvdaStartOptions: { capture: true, settings: { general: { language: 'en' } } } });

async function speech(nvda: { spokenPhraseLog(): Promise<string[]> }): Promise<string> {
	return (await nvda.spokenPhraseLog()).join('\n');
}

async function visit(page: Page, path: string): Promise<void> {
	await page.goto(`/todo/${path}`);
	await page.locator('main').waitFor();
	await settle(page);
}

async function open(page: Page, path: string): Promise<void> {
	await applySettings(page);
	await seedSampleData(page, 'en');
	await visit(page, path);
}

/**
 * Puts NVDA at the top of the page. Guidepup clicks the middle of the body to
 * get there, which on most pages lands on a row or a button; the page ignores
 * the pointer for that moment so that the click reaches the body alone.
 */
async function focusWebContent(page: Page, nvda: NVDAPlaywright): Promise<void> {
	const shield = await page.addStyleTag({ content: 'body * { pointer-events: none !important; }' });
	await nvda.navigateToWebContent();
	await shield.evaluate((element) => (element as Element).remove());
}

/** Lets NVDA finish what a page change made it say before the log is read. */
function pause(page: Page): Promise<void> {
	return page.waitForTimeout(1500);
}

test('headings and landmarks name every page', async ({ page, nvda }) => {
	const spoken: string[] = [];
	await open(page, 'tasks');
	try {
		for (const path of ['tasks', 'matrix', 'goals', 'settings']) {
			await visit(page, path);
			await focusWebContent(page, nvda);
			await nvda.clearSpokenPhraseLog();
			await nvda.perform(NVDAKeyCodeCommands.reportTitle);
			for (let index = 0; index < 4; index++) await nvda.nextHeading();
			for (let index = 0; index < 4; index++) await nvda.nextLandmark();
			spoken.push(`## ${path}`, await speech(nvda));
		}
	} finally {
		dump('sr/headings-and-landmarks.txt', spoken.join('\n'));
	}

	const log = spoken.join('\n');
	expect(log).toMatch(/heading,?\s+level 1/i);
	expect(log).toMatch(/navigation landmark/i);
});

test('moving between pages from the bottom bar', async ({ page, nvda }) => {
	await open(page, 'tasks');
	await focusWebContent(page, nvda);
	await page.getByRole('link', { name: msg('en', 'nav.goals') }).focus();
	await nvda.clearSpokenPhraseLog();
	await nvda.press('Enter');
	await pause(page);
	const log = await speech(nvda);
	dump('sr/page-change.txt', log);

	expect(log).toContain(msg('en', 'nav.goals'));
});

test('reading and closing a task', async ({ page, nvda }) => {
	await open(page, 'tasks');
	await focusWebContent(page, nvda);
	await nvda.clearSpokenPhraseLog();
	for (let index = 0; index < 12; index++) await nvda.next();
	const reading = await speech(nvda);

	const row = page.locator('main .v-list-item').first();
	const name = (await row.locator('.v-list-item-title').textContent())?.trim() ?? '';
	await row.getByRole('checkbox').focus();
	await nvda.clearSpokenPhraseLog();
	await nvda.press('Space');
	await pause(page);
	const confirming = await speech(nvda);

	await openDialog(page)
		.getByRole('button', { name: msg('en', 'entity.confirm') })
		.focus();
	await nvda.clearSpokenPhraseLog();
	await nvda.press('Enter');
	await pause(page);
	const closed = await speech(nvda);
	dump(
		'sr/task-list.txt',
		['## reading', reading, '## checkbox', confirming, '## confirmed', closed].join('\n'),
	);

	expect(reading).toMatch(/list/i);
	expect(confirming).toContain(msg('en', 'entity.confirmDoneTitle'));
	expect(closed).toContain(name);
});

test('adding a task, with and without a name', async ({ page, nvda }) => {
	await open(page, 'tasks');
	await focusWebContent(page, nvda);
	await page.getByRole('button', { name: msg('en', 'form.add') }).focus();
	await nvda.clearSpokenPhraseLog();
	await nvda.press('Enter');
	await pause(page);
	const opened = await speech(nvda);

	await nvda.clearSpokenPhraseLog();
	for (let index = 0; index < 8; index++) await nvda.press('Tab');
	const fields = await speech(nvda);

	await openDialog(page)
		.getByRole('button', { name: msg('en', 'form.save'), exact: true })
		.focus();
	await nvda.clearSpokenPhraseLog();
	await nvda.press('Enter');
	await pause(page);
	const invalid = await speech(nvda);

	await openDialog(page).getByLabel(msg('en', 'entity.name')).fill('Call the plumber');
	await openDialog(page)
		.getByRole('button', { name: msg('en', 'form.save'), exact: true })
		.focus();
	await nvda.clearSpokenPhraseLog();
	await nvda.press('Enter');
	await pause(page);
	const saved = await speech(nvda);
	dump(
		'sr/add-dialog.txt',
		['## opened', opened, '## fields', fields, '## invalid', invalid, '## saved', saved].join('\n'),
	);

	expect(opened).toMatch(/dialog/i);
	expect(opened).not.toMatch(/^dialog$/im);
	expect(invalid).toContain(msg('en', 'form.nameRequired'));
	expect(saved).toContain('Call the plumber');
});

test('the matrix quadrants', async ({ page, nvda }) => {
	await open(page, 'matrix');
	await focusWebContent(page, nvda);
	await nvda.clearSpokenPhraseLog();
	for (let index = 0; index < 5; index++) await nvda.nextHeading();
	const headings = await speech(nvda);

	await page.locator('main').getByRole('button').first().focus();
	await nvda.clearSpokenPhraseLog();
	for (let index = 0; index < 4; index++) await nvda.press('Tab');
	const tabbing = await speech(nvda);
	dump('sr/matrix.txt', ['## headings', headings, '## tabbing', tabbing].join('\n'));

	expect(headings).toContain(msg('en', 'quadrant.do'));
	expect(headings).toContain(msg('en', 'quadrant.eliminate'));
});

test('settings controls', async ({ page, nvda }) => {
	await open(page, 'settings');
	await focusWebContent(page, nvda);
	await page.getByRole('tab', { name: msg('en', 'settings.general') }).focus();
	await nvda.clearSpokenPhraseLog();
	// Past the text size, the scheme, the accent and the custom colour.
	for (let index = 0; index < 11; index++) await nvda.press('Tab');
	const tabbing = await speech(nvda);

	await page.getByRole('button', { name: msg('en', 'settings.fontScaleIncrease') }).focus();
	await nvda.clearSpokenPhraseLog();
	await nvda.press('Enter');
	await pause(page);
	const larger = await speech(nvda);

	await page.getByRole('tab', { name: msg('en', 'nav.tasks'), exact: true }).click();
	await page.getByRole('button', { name: msg('en', 'settings.rows1') }).focus();
	await nvda.clearSpokenPhraseLog();
	await nvda.press('Tab');
	await nvda.press('Shift+Tab');
	const toggle = await speech(nvda);
	dump(
		'sr/settings.txt',
		['## tabbing', tabbing, '## larger text', larger, '## rows toggle', toggle].join('\n'),
	);

	expect(tabbing).toContain(msg('en', 'settings.startPage'));
	expect(tabbing).toContain(msg('en', 'settings.cleanupDays'));
	// The percent sign is read out in the Windows language, so only the number is matched.
	expect(larger).toMatch(/112[.,]5/);
	expect(toggle).toMatch(/pressed|selected/i);
});

test('colour scheme and accent', async ({ page, nvda }) => {
	await open(page, 'settings');
	await focusWebContent(page, nvda);
	await page.getByRole('button', { name: msg('en', 'settings.fontScaleIncrease') }).focus();
	await nvda.clearSpokenPhraseLog();
	await nvda.press('Tab');
	const scheme = await speech(nvda);

	// The arrow keys go to the page itself: in browse mode NVDA would take them
	// to move through the text rather than the radios.
	await nvda.clearSpokenPhraseLog();
	for (let index = 0; index < 3; index++) await page.keyboard.press('ArrowRight');
	await pause(page);
	const black = await speech(nvda);

	await nvda.clearSpokenPhraseLog();
	await nvda.press('Tab');
	const accent = await speech(nvda);

	await nvda.clearSpokenPhraseLog();
	await page.keyboard.press('ArrowRight');
	await pause(page);
	const green = await speech(nvda);

	await nvda.clearSpokenPhraseLog();
	await nvda.press('Tab');
	const custom = await speech(nvda);
	dump(
		'sr/appearance.txt',
		[
			'## scheme',
			scheme,
			'## pure black',
			black,
			'## accent',
			accent,
			'## green',
			green,
			'## custom',
			custom,
		].join('\n'),
	);

	expect(scheme).toContain(msg('en', 'settings.scheme'));
	expect(scheme).toContain(msg('en', 'settings.schemes.standard'));
	expect(scheme).toMatch(/radio button/i);
	expect(scheme).toMatch(/1 of 5/);
	expect(black).toContain(msg('en', 'settings.schemes.black'));
	expect(black).toContain(msg('en', 'settings.schemeBlackHint'));
	expect(accent).toContain(msg('en', 'settings.accent'));
	expect(accent).toContain(msg('en', 'settings.accentScheme'));
	expect(accent).toMatch(/1 of 11/);
	expect(green).toContain(msg('en', 'settings.accents.green'));
	expect(custom).toContain(msg('en', 'settings.accentCustom'));
});
