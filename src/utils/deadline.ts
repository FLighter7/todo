import { Season, type Deadline } from '@/types';

const SEASON_KEYS: Record<Season, string> = {
	[Season.Winter]: 'goal.deadline.seasonWinter',
	[Season.Spring]: 'goal.deadline.seasonSpring',
	[Season.Summer]: 'goal.deadline.seasonSummer',
	[Season.Autumn]: 'goal.deadline.seasonAutumn',
};

/** A leap year, so a bare "29 February" (no year given) formats without throwing. */
const PLACEHOLDER_YEAR = 2000;

export function formatDeadline(
	deadline: Deadline,
	locale: string,
	t: (key: string) => string,
): string {
	if (deadline.season !== undefined) {
		const season = t(SEASON_KEYS[deadline.season]);
		return deadline.year === undefined ? season : `${season} ${deadline.year}`;
	}

	if (deadline.month !== undefined) {
		// Always build the Date with day 1: JS's Date constructor silently
		// rolls an out-of-range day into the next month (e.g. 29 February on
		// a non-leap year becomes 1 March), which would corrupt the month
		// this formats. Day 1 always exists, so the month/year parts stay
		// correct; the real day number is substituted in afterwards.
		const date = new Date(deadline.year ?? PLACEHOLDER_YEAR, deadline.month - 1, 1);
		const formatter = new Intl.DateTimeFormat(locale, {
			day: deadline.day === undefined ? undefined : 'numeric',
			month: 'long',
			year: deadline.year === undefined ? undefined : 'numeric',
		});

		return formatter
			.formatToParts(date)
			.map((part) =>
				part.type === 'day' && deadline.day !== undefined ? String(deadline.day) : part.value,
			)
			.join('');
	}

	return String(deadline.year);
}
