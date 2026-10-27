import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
import {
	DUMP_DIR,
	STATES,
	applySettings,
	dump,
	seedSampleData,
	settle,
	type Locale,
	type Theme,
} from './fixtures';

/** The tags of every WCAG 2.2 A and AA rule; best-practice ones are dumped, never failed. */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * A violation the audit knows about and left in its backlog. Each entry names
 * the finding in docs/accessibility-audit.md that tracks it, so the list only
 * shrinks.
 */
interface AllowedViolation {
	rule: string;
	/** State names; absent means every state. */
	states?: string[];
	themes?: Theme[];
	finding: string;
}

const ALLOWED = JSON.parse(
	readFileSync(new URL('./allowlist.json', import.meta.url), 'utf8'),
) as AllowedViolation[];

/** Every state in both themes; the other two locales on the states that carry the most text. */
const LOCALE_STATES = ['tasks', 'settings-general', 'add-task-schedule', 'add-goal-deadline'];
const RUNS: Array<{ theme: Theme; locale: Locale; states: typeof STATES }> = [
	{ theme: 'light', locale: 'en', states: STATES },
	{ theme: 'dark', locale: 'en', states: STATES },
	...(['ru', 'pl'] as const).map((locale) => ({
		theme: 'light' as const,
		locale,
		states: STATES.filter((state) => LOCALE_STATES.includes(state.name)),
	})),
];

function isAllowed(rule: string, state: string, theme: Theme): boolean {
	return ALLOWED.some(
		(entry) =>
			entry.rule === rule &&
			(entry.states === undefined || entry.states.includes(state)) &&
			(entry.themes === undefined || entry.themes.includes(theme)),
	);
}

for (const { theme, locale, states } of RUNS) {
	test.describe(`axe [${theme}/${locale}]`, () => {
		for (const state of states) {
			test(state.name, async ({ page }) => {
				await applySettings(page, { theme, locale });
				await seedSampleData(page, locale);
				await state.enter(page, locale);
				await settle(page);

				const results = await new AxeBuilder({ page })
					.withTags([...WCAG_TAGS, 'best-practice'])
					.analyze();

				if (DUMP_DIR !== undefined) {
					const key = `${state.name}--${theme}--${locale}`;
					const violations = results.violations.map((violation) => ({
						id: violation.id,
						impact: violation.impact,
						tags: violation.tags,
						help: violation.help,
						nodes: violation.nodes.map((node) => ({
							target: node.target,
							html: node.html.slice(0, 300),
							summary: node.failureSummary,
						})),
					}));
					dump(`axe/${key}.json`, JSON.stringify(violations, null, 1));
					dump(`aria/${key}.yml`, await page.locator('body').ariaSnapshot());
				}

				const unexpected = results.violations
					.filter((violation) => violation.tags.some((tag) => WCAG_TAGS.includes(tag)))
					.filter((violation) => !isAllowed(violation.id, state.name, theme))
					.map((violation) => ({
						rule: violation.id,
						help: violation.help,
						targets: violation.nodes.map((node) => node.target.join(' ')),
					}));
				expect(unexpected).toEqual([]);
			});
		}
	});
}
