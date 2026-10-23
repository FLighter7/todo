import { fail, isRecordObject, parseEntityBase, type EntityBase } from './entity';

export enum Season {
	Winter = 1,
	Spring = 2,
	Summer = 3,
	Autumn = 4,
}

/**
 * Deliberately vague-capable: "in 2027", "summer 2027", "March 2027" and
 * "15 March 2027" are all things people mean. The constraints run between
 * fields, so they are checked here rather than expressed in the type.
 */
export interface Deadline {
	year?: number;
	/** 1–12. */
	month?: number;
	/** 1–31, requires a month. */
	day?: number;
	/** Mutually exclusive with month and day. */
	season?: Season;
}

export interface Goal extends EntityBase {
	dreamId?: string;
	deadline?: Deadline;
}

export interface GoalDraft {
	name: string;
	note?: string;
	dreamId?: string;
	deadline?: Deadline;
}

export function isSeason(value: unknown): value is Season {
	return (
		value === Season.Winter ||
		value === Season.Spring ||
		value === Season.Summer ||
		value === Season.Autumn
	);
}

function readOptionalInteger(
	entry: Record<string, unknown>,
	key: string,
	min: number,
	max: number,
): number | undefined {
	const value = entry[key];
	if (value === undefined) {
		return undefined;
	}

	if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
		fail(`"${key}" must be a whole number between ${min} and ${max}`);
	}

	return value;
}

export function parseDeadline(value: unknown): Deadline {
	if (!isRecordObject(value)) {
		fail('"deadline" must be an object');
	}

	const year = readOptionalInteger(value, 'year', 1, 9999);
	const month = readOptionalInteger(value, 'month', 1, 12);
	const day = readOptionalInteger(value, 'day', 1, 31);

	let season: Season | undefined;
	if (value.season !== undefined) {
		if (!isSeason(value.season)) {
			fail('"season" must be one of Winter, Spring, Summer, Autumn');
		}
		season = value.season;
	}

	if (day !== undefined && month === undefined) {
		fail('"deadline.day" requires a month');
	}

	if (season !== undefined && (month !== undefined || day !== undefined)) {
		fail('"deadline" cannot carry both a season and a month');
	}

	if (year === undefined && month === undefined && season === undefined) {
		fail('"deadline" must carry at least one field');
	}

	return { year, month, day, season };
}

export function parseGoal(value: unknown): Goal {
	const base = parseEntityBase(value);
	const entry = value as Record<string, unknown>;

	const dreamId = entry.dreamId;
	if (dreamId !== undefined && typeof dreamId !== 'string') {
		fail('"dreamId" must be a string when present');
	}

	return {
		...base,
		dreamId,
		deadline: entry.deadline === undefined ? undefined : parseDeadline(entry.deadline),
	};
}
