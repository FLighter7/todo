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
	type Scheme,
	type Theme,
} from './fixtures';

/** The tags of every WCAG 2.2 A and AA rule; best-practice ones are dumped, never failed. */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** The high contrast scheme is held to AAA as well: text at 7:1 (1.4.6). */
const AAA_TAGS = [...WCAG_TAGS, 'wcag2aaa'];

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

interface Run {
	theme: Theme;
	scheme?: Scheme;
	accent?: string;
	locale: Locale;
	states: typeof STATES;
	tags?: string[];
}

/**
 * Every state in both themes and in high contrast; the other two locales on
 * the states that carry the most text; the other schemes and an accent of
 * one's own on the states that show the most colours.
 */
const LOCALE_STATES = ['tasks', 'settings-general', 'add-task-schedule', 'add-goal-deadline'];
const COLOUR_STATES = ['tasks', 'matrix', 'settings-general', 'add-task', 'task-read', 'sync'];
const colourStates = STATES.filter((state) => COLOUR_STATES.includes(state.name));
const RUNS: Run[] = [
	{ theme: 'light', locale: 'en', states: STATES },
	{ theme: 'dark', locale: 'en', states: STATES },
	...(['ru', 'pl'] as const).map((locale) => ({
		theme: 'light' as const,
		locale,
		states: STATES.filter((state) => LOCALE_STATES.includes(state.name)),
	})),
	...(['light', 'dark'] as const).map((theme) => ({
		theme,
		scheme: 'contrast' as const,
		locale: 'en' as const,
		states: STATES,
		tags: AAA_TAGS,
	})),
	{ theme: 'light', scheme: 'neutral', locale: 'en', states: colourStates },
	{ theme: 'dark', scheme: 'cool', locale: 'en', states: colourStates },
	{ theme: 'dark', scheme: 'black', locale: 'en', states: colourStates },
	// A hue the standard palette is furthest from, fitted darker and lighter.
	{ theme: 'light', accent: '#EF6C00', locale: 'en', states: colourStates },
	{ theme: 'dark', accent: '#3F51B5', locale: 'en', states: colourStates },
	{
		theme: 'dark',
		scheme: 'contrast',
		accent: '#FFFF00',
		locale: 'en',
		states: colourStates,
		tags: AAA_TAGS,
	},
];

/** `light/en` for the standard scheme, as the audit report names its runs. */
function runName({ theme, scheme, accent, locale }: Run): string {
	const look = [scheme === undefined ? theme : `${scheme}-${theme}`, accent].filter(Boolean);
	return `${look.join('+')}/${locale}`;
}

function isAllowed(rule: string, state: string, theme: Theme): boolean {
	return ALLOWED.some(
		(entry) =>
			entry.rule === rule &&
			(entry.states === undefined || entry.states.includes(state)) &&
			(entry.themes === undefined || entry.themes.includes(theme)),
	);
}

for (const run of RUNS) {
	const { theme, scheme, accent, locale, states, tags = WCAG_TAGS } = run;
	test.describe(`axe [${runName(run)}]`, () => {
		for (const state of states) {
			test(state.name, async ({ page }) => {
				await applySettings(page, { theme, scheme, accent, locale });
				await seedSampleData(page, locale);
				await state.enter(page, locale);
				await settle(page);

				const results = await new AxeBuilder({ page })
					.withTags([...tags, 'best-practice'])
					.analyze();

				if (DUMP_DIR !== undefined) {
					const key = `${state.name}--${runName(run).replace(/[/+#]/g, '--')}`;
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
					.filter((violation) => violation.tags.some((tag) => tags.includes(tag)))
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
