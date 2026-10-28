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

	const said = { black: '', accent: '', green: '', custom: '', customOnRequest: '' };
	try {
		// NVDA switches to focus mode by itself once Tab lands on a radio (it marks
		// the switch with a sound, not a word), so the arrow keys pressed through
		// it reach the page. Arrows sent to the page past NVDA moved the radios but
		// went unspoken.
		await nvda.clearSpokenPhraseLog();
		for (let index = 0; index < 3; index++) await nvda.press('ArrowRight');
		await pause(page);
		said.black = await speech(nvda);

		await nvda.clearSpokenPhraseLog();
		await nvda.press('Tab');
		said.accent = await speech(nvda);

		await nvda.clearSpokenPhraseLog();
		await nvda.press('ArrowRight');
		await pause(page);
		said.green = await speech(nvda);

		// Tabbing onto a colour input, NVDA with Chrome says only "clickable" and the
		// value the input had when the page loaded: no name, no role, whatever the
		// markup (a bare input with an aria-label sounds the same). What it holds
		// is asked for with NVDA+Tab, which reads the focus in full.
		await nvda.clearSpokenPhraseLog();
		await nvda.press('Tab');
		await pause(page);
		said.custom = await speech(nvda);
		await nvda.clearSpokenPhraseLog();
		await nvda.perform(NVDAKeyCodeCommands.reportCurrentFocus);
		await pause(page);
		said.customOnRequest = await speech(nvda);
	} finally {
		await nvda.perform(NVDAKeyCodeCommands.exitFocusMode);
	}
	dump(
		'sr/appearance.txt',
		[
			'## scheme',
			scheme,
			'## pure black',
			said.black,
			'## accent',
			said.accent,
			'## green',
			said.green,
			'## custom',
			said.custom,
			'## custom, read with NVDA+Tab',
			said.customOnRequest,
		].join('\n'),
	);

	expect(scheme).toContain(msg('en', 'settings.scheme'));
	expect(scheme).toContain(msg('en', 'settings.schemes.standard'));
	expect(scheme).toMatch(/radio button/i);
	expect(scheme).toMatch(/1 of 5/);
	expect(said.black).toContain(msg('en', 'settings.schemes.black'));
	expect(said.black).toContain(msg('en', 'settings.schemeBlackHint'));
	expect(said.accent).toContain(msg('en', 'settings.accent'));
	expect(said.accent).toContain(msg('en', 'settings.accentScheme'));
	expect(said.accent).toMatch(/1 of 11/);
	expect(said.green).toContain(msg('en', 'settings.accents.green'));
	expect(said.custom).toMatch(/clickable/i);
	expect(said.customOnRequest).toContain(msg('en', 'settings.accentCustom'));
	expect(said.customOnRequest).toMatch(/color chooser/i);
	expect(said.customOnRequest).toContain(msg('en', 'settings.accentHint'));
});

test('a section colour in the add dialog', async ({ page, nvda }) => {
	await open(page, 'dreams');
	await focusWebContent(page, nvda);
	await page.getByRole('button', { name: msg('en', 'form.add') }).focus();
	await nvda.press('Enter');
	await pause(page);
	await openDialog(page).getByLabel(msg('en', 'entity.note')).focus();

	const said = { colour: '', green: '', paint: '' };
	try {
		await nvda.clearSpokenPhraseLog();
		await nvda.press('Tab');
		said.colour = await speech(nvda);

		// Focus mode, as on the accent in Settings: the arrows reach the radios.
		await nvda.clearSpokenPhraseLog();
		await nvda.press('ArrowRight');
		await pause(page);
		said.green = await speech(nvda);

		// Past the custom colour, onto the switch a colour makes reachable.
		await nvda.press('Tab');
		await nvda.clearSpokenPhraseLog();
		await nvda.press('Tab');
		said.paint = await speech(nvda);
	} finally {
		await nvda.perform(NVDAKeyCodeCommands.exitFocusMode);
	}
	dump(
		'sr/section-colour.txt',
		['## colour', said.colour, '## green', said.green, '## paint', said.paint].join('\n'),
	);

	expect(said.colour).toContain(msg('en', 'entity.color'));
	expect(said.colour).toContain(msg('en', 'entity.colorDefault'));
	expect(said.colour).toMatch(/radio button/i);
	expect(said.colour).toMatch(/1 of 11/);
	expect(said.green).toContain(msg('en', 'settings.accents.green'));
	expect(said.paint).toContain(msg('en', 'entity.paintItems'));
	expect(said.paint).not.toMatch(/unavailable/i);
});
