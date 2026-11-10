import { test, expect, type Page } from '@playwright/test';
import {
	STATES,
	applySettings,
	dump,
	msg,
	openDialog,
	seedSampleData,
	settle,
	type AuditState,
} from './fixtures';

interface TabStop {
	name: string;
	role: string;
	/** Pixels whose colour changes by at least 3:1 when the element gains focus. */
	pixels: number;
	/** A 1px line around the element's whole perimeter, the least a focus indicator may draw. */
	needed: number;
	/** The element's centre is covered by something else, the app bar or the bottom bar. */
	obscured: boolean;
}

/**
 * Pixel-wise contrast between two same-sized screenshots, in the page, where
 * the browser can decode the PNGs: the count of pixels that changed by 3:1 or more.
 */
function changedPixels(page: Page, focused: Buffer, blurred: Buffer): Promise<number> {
	return page.evaluate(
		async ([a, b]) => {
			async function decode(base64: string): Promise<Uint8ClampedArray> {
				const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob();
				const bitmap = await createImageBitmap(blob);
				const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
				const context = canvas.getContext('2d')!;
				context.drawImage(bitmap, 0, 0);
				return context.getImageData(0, 0, bitmap.width, bitmap.height).data;
			}

			function channel(value: number): number {
				const v = value / 255;
				return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
			}

			const [x, y] = await Promise.all([decode(a), decode(b)]);
			let count = 0;
			for (let i = 0; i < x.length; i += 4) {
				const l1 = 0.2126 * channel(x[i]) + 0.7152 * channel(x[i + 1]) + 0.0722 * channel(x[i + 2]);
				const l2 = 0.2126 * channel(y[i]) + 0.7152 * channel(y[i + 1]) + 0.0722 * channel(y[i + 2]);
				if ((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05) >= 3) {
					count++;
				}
			}
			return count;
		},
		[focused.toString('base64'), blurred.toString('base64')],
	);
}

/** Measures the focused element, then puts the focus back where it was. */
async function measureFocus(page: Page, shot?: string): Promise<TabStop | null> {
	const box = await page.evaluate(() => {
		const element = document.activeElement as HTMLElement | null;
		if (element === null || element === document.body) {
			return null;
		}

		// A field shows its focus on its whole box, not on the input inside.
		const rect = (element.closest('.v-field') ?? element).getBoundingClientRect();
		const centre = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
		return {
			x: rect.x,
			y: rect.y,
			width: rect.width,
			height: rect.height,
			name:
				element.getAttribute('aria-label') ??
				element.closest('[aria-label]')?.getAttribute('aria-label') ??
				(element.textContent ?? '').trim().slice(0, 40),
			role: element.getAttribute('role') ?? element.tagName.toLowerCase(),
			obscured:
				centre !== null &&
				!element.contains(centre) &&
				!centre.contains(element) &&
				!element.closest('.v-field')?.contains(centre),
		};
	});
	if (box === null) {
		return null;
	}

	const viewport = page.viewportSize()!;
	const pad = 4;
	const x = Math.max(0, box.x - pad);
	const y = Math.max(0, box.y - pad);
	const clip = {
		x,
		y,
		width: Math.max(1, Math.min(viewport.width - x, box.width + 2 * pad)),
		height: Math.max(1, Math.min(viewport.height - y, box.height + 2 * pad)),
	};

	const focused = await page.screenshot({ clip, animations: 'disabled' });
	if (shot !== undefined) {
		dump(shot, focused);
	}
	await page.evaluate(() => {
		const holder = window as unknown as { probeFocus: HTMLElement };
		holder.probeFocus = document.activeElement as HTMLElement;
		holder.probeFocus.blur();
	});
	const blurred = await page.screenshot({ clip, animations: 'disabled' });
	await page.evaluate(() => (window as unknown as { probeFocus: HTMLElement }).probeFocus.focus());

	return {
		name: box.name,
		role: box.role,
		pixels: await changedPixels(page, focused, blurred),
		needed: Math.round(2 * (box.width + box.height)),
		obscured: box.obscured,
	};
}

/** Tabs through every stop once, until the focus comes back round to one it has seen. */
async function walkTabOrder(page: Page, name: string, limit = 60): Promise<TabStop[]> {
	await page.mouse.move(0, 0);
	await page.evaluate(() => {
		(window as unknown as { probeSeen: Set<Element> }).probeSeen = new Set();
	});

	const stops: TabStop[] = [];
	for (let index = 0; index < limit; index++) {
		await page.keyboard.press('Tab');
		const seen = await page.evaluate(() => {
			const holder = window as unknown as { probeSeen: Set<Element> };
			const element = document.activeElement;
			if (element === null || holder.probeSeen.has(element)) {
				return true;
			}

			holder.probeSeen.add(element);
			return false;
		});
		if (seen) {
			break;
		}

		await settle(page);
		const stop = await measureFocus(page, `keyboard/${name}/${index}.png`);
		if (stop !== null) {
			stops.push(stop);
		}
	}

	return stops;
}

const WALKED = [
	'tasks',
	'matrix',
	'settings-general',
	'sync',
	'add-task',
	'task-read',
	'confirm-done',
];

test.describe('focus indicator', () => {
	for (const state of STATES.filter((entry) => WALKED.includes(entry.name))) {
		test(`every tab stop shows a 3:1 focus indicator and stays in view: ${state.name}`, async ({
			page,
		}) => {
			await applySettings(page);
			await seedSampleData(page, 'en');
			await state.enter(page, 'en');
			await settle(page);
			if (!state.name.includes('-')) {
				// A page: start from the top of the document rather than where the click left the focus.
				await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
			}

			const stops = await walkTabOrder(page, state.name);
			dump(`keyboard/${state.name}.json`, JSON.stringify(stops, null, 1));

			expect(stops.length).toBeGreaterThan(0);
			expect(stops.filter((stop) => stop.pixels < stop.needed || stop.obscured)).toEqual([]);
		});
	}
});

async function activeName(page: Page): Promise<string> {
	return page.evaluate(() => {
		const element = document.activeElement;
		if (element === null || element === document.body) {
			return '<body>';
		}

		return element.getAttribute('aria-label') ?? (element.textContent ?? '').trim().slice(0, 60);
	});
}

interface ReturnCase {
	name: string;
	open: (page: Page) => Promise<void>;
	trigger: string;
}

const RETURN_CASES: ReturnCase[] = [
	{
		name: 'the add dialog',
		trigger: msg('en', 'form.add'),
		open: async (page) => {
			await page.goto('/todo/tasks');
			await page.getByRole('button', { name: msg('en', 'form.add') }).focus();
			await page.keyboard.press('Enter');
		},
	},
	{
		name: 'the theme menu',
		trigger: msg('en', 'app.toggleTheme'),
		open: async (page) => {
			await page.goto('/todo/tasks');
			await page.getByRole('button', { name: msg('en', 'app.toggleTheme') }).focus();
			await page.keyboard.press('Enter');
		},
	},
	{
		name: 'a quadrant add dialog',
		trigger: msg('en', 'form.add'),
		open: async (page) => {
			await page.goto('/todo/matrix');
			await page
				.locator('main')
				.getByRole('button', { name: msg('en', 'form.add') })
				.first()
				.focus();
			await page.keyboard.press('Enter');
		},
	},
];

test.describe('focus after a dialog', () => {
	for (const entry of RETURN_CASES) {
		test(`closing ${entry.name} returns the focus to its trigger`, async ({ page }) => {
			await applySettings(page);
			await seedSampleData(page, 'en');
			await entry.open(page);
			await expect(openDialog(page)).toBeVisible();
			await settle(page);
			await page.keyboard.press('Escape');
			await expect(openDialog(page)).toBeHidden();

			expect(await activeName(page)).toContain(entry.trigger);
		});
	}

	test('closing a record dialog returns the focus to its row', async ({ page }) => {
		await applySettings(page);
		await seedSampleData(page, 'en');
		await page.goto('/todo/tasks');
		const row = page.locator('main .v-list-item').first();
		const name = (await row.locator('.v-list-item-title').textContent())?.trim() ?? '';
		await row.focus();
		await page.keyboard.press('Enter');
		await expect(openDialog(page)).toBeVisible();
		await settle(page);
		await page.keyboard.press('Escape');
		await expect(openDialog(page)).toBeHidden();

		expect(await activeName(page)).toContain(name);
	});
});

test.describe('focus after a row leaves the list', () => {
	const cases: Array<{ name: string; state: AuditState['name'] }> = [
		{ name: 'marking a task done on the Tasks page', state: 'tasks' },
		{ name: 'marking a task done in the matrix', state: 'matrix' },
	];

	for (const entry of cases) {
		test(`${entry.name} keeps the focus in the list`, async ({ page }) => {
			await applySettings(page);
			await seedSampleData(page, 'en');
			await page.goto(`/todo/${entry.state}`);
			const checkbox = page.locator('main').getByRole('checkbox').first();
			await checkbox.focus();
			await page.keyboard.press('Space');
			if (entry.state === 'tasks') {
				// The audit turns confirmations on; the dialog's own button finishes the job.
				await openDialog(page)
					.getByRole('button', { name: msg('en', 'entity.confirm') })
					.press('Enter');
				await expect(openDialog(page)).toBeHidden();
			}
			await settle(page);

			expect(await activeName(page)).not.toBe('<body>');
		});
	}
});
