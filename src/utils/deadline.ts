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
		const date = new Date(deadline.year ?? PLACEHOLDER_YEAR, deadline.month - 1, deadline.day ?? 1);
		return new Intl.DateTimeFormat(locale, {
			day: deadline.day === undefined ? undefined : 'numeric',
			month: 'long',
			year: deadline.year === undefined ? undefined : 'numeric',
		}).format(date);
	}

	return String(deadline.year);
}
