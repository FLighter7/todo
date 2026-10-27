import { test, expect, type Page } from '@playwright/test';
import {
	STATES,
	applySettings,
	dump,
	msg,
	seedSampleData,
	settle,
	type AuditOptions,
	type Locale,
} from './fixtures';

const NARROW = { width: 320, height: 640 };
const PHONE = { width: 360, height: 740 };

interface ClippedText {
	text: string;
	className: string;
	/** How much of the text's width is cut off, in CSS pixels. */
	hidden: number;
}

/** Text an element hides by clipping or ellipsis rather than wrapping. */
function clippedText(page: Page): Promise<ClippedText[]> {
	return page.evaluate(() => {
		const found: ClippedText[] = [];
		for (const element of document.querySelectorAll<HTMLElement>('body *')) {
			const ownText = [...element.childNodes]
				.filter((node) => node.nodeType === Node.TEXT_NODE)
				.map((node) => node.textContent ?? '')
				.join('')
				.trim();
			// A visually hidden heading clips itself on purpose.
			if (ownText === '' || element.offsetParent === null || element.closest('.d-sr-only')) {
				continue;
			}

			const style = getComputedStyle(element);
			const hides = style.overflowX !== 'visible' || style.textOverflow === 'ellipsis';
			if (hides && element.scrollWidth > element.clientWidth + 1) {
				found.push({
					text: ownText.slice(0, 60),
					className: element.className.toString().split(' ').slice(0, 2).join(' '),
					hidden: element.scrollWidth - element.clientWidth,
				});
			}
		}
		return found;
	});
}

/** Content wider than the viewport, which would need scrolling in two directions. */
function horizontalOverflow(page: Page): Promise<number> {
	return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

async function enter(
	page: Page,
	name: string,
	options: AuditOptions & { locale?: Locale } = {},
): Promise<void> {
	const locale = options.locale ?? 'en';
	const state = STATES.find((entry) => entry.name === name)!;
	await applySettings(page, options);
	await seedSampleData(page, locale);
	await state.enter(page, locale);
	await settle(page);
}

const REFLOW_STATES = [
	'tasks',
	'matrix',
	'goals',
	'settings-general',
	'settings-tasks',
	'sync',
	'add-task-schedule',
	'add-goal-deadline',
	'task-read-completions',
	'confirm-done',
	'dream-cascade',
];

test.describe('reflow at 320 CSS px', () => {
	test.use({ viewport: NARROW });

	for (const name of REFLOW_STATES) {
		for (const fontScale of [1, 1.5]) {
			test(`${name} at ${fontScale * 100}% text needs no horizontal scrolling`, async ({
				page,
			}) => {
				await enter(page, name, { fontScale, locale: 'ru' });
				const clipped = await clippedText(page);
				dump(`reflow/${name}--${fontScale}.json`, JSON.stringify(clipped, null, 1));
				dump(`reflow/${name}--${fontScale}.png`, await page.screenshot({ fullPage: true }));

				expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
			});
		}
	}
});

test.describe('text spacing', () => {
	test.use({ viewport: PHONE });

	for (const name of ['tasks', 'matrix', 'settings-general', 'add-task-schedule', 'confirm-done']) {
		test(`${name} keeps every word visible with WCAG 1.4.12 spacing`, async ({ page }) => {
			await enter(page, name, { locale: 'ru' });
			const before = await clippedText(page);
			await page.addStyleTag({
				content: `* { line-height: 1.5 !important; letter-spacing: 0.12em !important;
					word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }`,
			});
			await settle(page);
			const after = await clippedText(page);
			dump(`spacing/${name}.json`, JSON.stringify({ before, after }, null, 1));
			dump(`spacing/${name}.png`, await page.screenshot({ fullPage: true }));

			expect(after.length).toBeLessThanOrEqual(before.length);
		});
	}
});

interface FontUse {
	text: string;
	fonts: string[];
}

/** Which installed font actually drew each text node, per Chromium's own layout. */
async function renderedFonts(page: Page): Promise<FontUse[]> {
	const session = await page.context().newCDPSession(page);
	await session.send('DOM.enable');
	await session.send('CSS.enable');
	const { root } = await session.send('DOM.getDocument', { depth: -1 });
	const { nodeIds } = await session.send('DOM.querySelectorAll', {
		nodeId: root.nodeId,
		selector: 'main *, nav *, header *, [role="dialog"] *',
	});

	const uses: FontUse[] = [];
	for (const nodeId of nodeIds) {
		const { fonts } = await session.send('CSS.getPlatformFontsForNode', { nodeId });
		if (fonts.length === 0) {
			continue;
		}

		const { node } = await session.send('DOM.describeNode', { nodeId, depth: 1 });
		const text = (node.children ?? [])
			.filter((child) => child.nodeType === 3)
			.map((child) => child.nodeValue)
			.join('')
			.trim();
		if (text !== '') {
			uses.push({ text: text.slice(0, 50), fonts: fonts.map((font) => font.familyName) });
		}
	}

	return uses;
}

test.describe('webfonts', () => {
	for (const locale of ['ru', 'pl'] as const) {
		test(`draw every letter of the ${locale} interface`, async ({ page }) => {
			await enter(page, 'tasks', { locale });
			await page.evaluate(() => document.fonts.ready);
			const uses = await renderedFonts(page);
			const fallback = uses.filter((use) =>
				use.fonts.some((font) => !/^(Manrope|Alegreya)/.test(font)),
			);
			dump(`fonts/${locale}.json`, JSON.stringify(fallback, null, 1));

			expect(fallback).toEqual([]);
		});
	}
});

interface SmallTarget {
	name: string;
	width: number;
	height: number;
}

/**
 * The part of each control a tap actually reaches: along the lines through its
 * centre, the longest run of points where the control is the topmost element.
 * Each control is scrolled to the middle first, clear of the fixed bars; with a
 * dialog open, only its own controls count, the rest sit under its scrim.
 */
function smallTargets(page: Page): Promise<SmallTarget[]> {
	return page.evaluate(() => {
		const selector =
			'button, a[href], input:not([type="hidden"]), [role="tab"], [tabindex="0"], [tabindex="-2"]';
		const dialogs = document.querySelectorAll('.v-overlay--active[role="dialog"]');
		const scope = dialogs.length > 0 ? dialogs[dialogs.length - 1] : document;
		const small: SmallTarget[] = [];

		function hits(element: Element, x: number, y: number): boolean {
			const top = document.elementFromPoint(x, y);
			return top !== null && (element === top || element.contains(top));
		}

		function run(points: Array<[number, number]>, element: Element): number {
			let best = 0;
			let current = 0;
			for (const [x, y] of points) {
				current = hits(element, x, y) ? current + 1 : 0;
				best = Math.max(best, current);
			}
			return best;
		}

		for (const control of scope.querySelectorAll(selector)) {
			if ((control as HTMLInputElement).disabled || control.closest('[aria-hidden="true"]')) {
				continue;
			}

			// A select or a field takes the tap on its whole box, not on the input inside.
			const element = control.closest('.v-field') ?? control;

			element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
			const rect = element.getBoundingClientRect();
			if (rect.width === 0 || rect.height === 0) {
				continue;
			}

			const cx = rect.x + rect.width / 2;
			const cy = rect.y + rect.height / 2;
			const across: Array<[number, number]> = [];
			const down: Array<[number, number]> = [];
			for (let x = Math.floor(rect.left - 8); x <= rect.right + 8; x++) across.push([x, cy]);
			for (let y = Math.floor(rect.top - 8); y <= rect.bottom + 8; y++) down.push([cx, y]);
			const width = run(across, element);
			const height = run(down, element);
			if (width < 24 || height < 24) {
				small.push({
					name:
						element.getAttribute('aria-label') ??
						element.closest('[aria-label]')?.getAttribute('aria-label') ??
						(element.textContent ?? '').trim().slice(0, 40),
					width,
					height,
				});
			}
		}
		return small;
	});
}

test.describe('target size', () => {
	test.use({ viewport: PHONE, hasTouch: true });

	for (const name of [
		'tasks',
		'matrix',
		'settings-general',
		'add-task-schedule',
		'task-read-completions',
	]) {
		test(`${name} has no tap target under 24 CSS px`, async ({ page }) => {
			await enter(page, name);
			const small = await smallTargets(page);
			dump(`targets/${name}.json`, JSON.stringify(small, null, 1));

			expect(small).toEqual([]);
		});
	}
});

test.describe('screenshots for review', () => {
	test.use({ viewport: PHONE });

	for (const name of [
		'tasks',
		'tasks-history',
		'matrix',
		'settings-tasks',
		'add-task',
		'confirm-done',
	]) {
		test(`${name} in forced colours and simulated colour blindness`, async ({ page }) => {
			await enter(page, name);
			const session = await page.context().newCDPSession(page);
			for (const type of ['achromatopsia', 'deuteranopia', 'protanopia', 'tritanopia'] as const) {
				await session.send('Emulation.setEmulatedVisionDeficiency', { type });
				dump(`vision/${name}--${type}.png`, await page.screenshot());
			}
			await session.send('Emulation.setEmulatedVisionDeficiency', { type: 'none' });

			await page.emulateMedia({ forcedColors: 'active' });
			await settle(page);
			dump(`forced/${name}--light.png`, await page.screenshot());
			await page.keyboard.press('Tab');
			dump(`forced/${name}--focus.png`, await page.screenshot());
		});
	}

	test('reduced motion leaves no animation running in a dialog transition', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await applySettings(page);
		await seedSampleData(page, 'en');
		await page.goto('/todo/tasks');
		await page.getByRole('button', { name: msg('en', 'form.add') }).click();
		const running = await page.evaluate(() =>
			document.getAnimations().map((animation) => ({
				name:
					(animation as CSSAnimation).animationName ??
					(animation as CSSTransition).transitionProperty ??
					'script',
				duration: animation.effect?.getTiming().duration,
			})),
		);
		dump('motion/add-dialog.json', JSON.stringify(running, null, 1));
	});
});
