import { Status } from '@/types';

export type DeadlineShape = 'none' | 'yearOnly' | 'yearSeason' | 'yearMonth' | 'yearMonthDay';
export type ScheduleKind =
	| 'none'
	| 'oneTimePast'
	| 'oneTimeFuture'
	| 'recurringWeeklyWithCompletions'
	| 'recurringMonthlyNoCompletions'
	| 'recurringWeeklyWithExdate';

export interface DreamTemplate {
	status: Status;
	hasNote: boolean;
}

export interface GoalTemplate {
	status: Status;
	hasNote: boolean;
	/** Index into DREAM_TEMPLATES. Absent = standalone goal. */
	dreamIndex?: number;
	deadlineShape: DeadlineShape;
}

/** A group carries a name only, so its template has nothing to say but its status. */
export interface GroupTemplate {
	status: Status;
}

export interface TaskTemplate {
	status: Status;
	important: boolean;
	urgent: boolean;
	hasNote: boolean;
	/** Index into GOAL_TEMPLATES. Absent = standalone task. */
	goalIndex?: number;
	/** Index into GROUP_TEMPLATES, independent of `goalIndex`. Absent = in no group. */
	groupIndex?: number;
	scheduleKind: ScheduleKind;
}

// Dreams #3 and #4 are deliberately never referenced by any GoalTemplate.dreamIndex below —
// they must render as orphan dreams with no linked goals. #0, #1, #2, #5 are each referenced
// by at least one goal.
export const DREAM_TEMPLATES: DreamTemplate[] = [
	{ status: Status.Opened, hasNote: true }, // 0
	{ status: Status.Opened, hasNote: false }, // 1
	{ status: Status.Done, hasNote: true }, // 2
	{ status: Status.Cancelled, hasNote: false }, // 3
	{ status: Status.Opened, hasNote: true }, // 4
	{ status: Status.Opened, hasNote: false }, // 5
];

export const GOAL_TEMPLATES: GoalTemplate[] = [
	{ status: Status.Opened, hasNote: true, dreamIndex: 0, deadlineShape: 'none' }, // 0
	{ status: Status.Opened, hasNote: false, dreamIndex: 0, deadlineShape: 'yearOnly' }, // 1
	{ status: Status.Cancelled, hasNote: false, dreamIndex: 0, deadlineShape: 'none' }, // 2
	{ status: Status.Opened, hasNote: true, dreamIndex: 1, deadlineShape: 'yearSeason' }, // 3
	{ status: Status.Done, hasNote: true, dreamIndex: 2, deadlineShape: 'yearMonth' }, // 4
	{ status: Status.Opened, hasNote: false, dreamIndex: 5, deadlineShape: 'yearMonthDay' }, // 5
	{ status: Status.Opened, hasNote: true, deadlineShape: 'none' }, // 6
	{ status: Status.Opened, hasNote: false, deadlineShape: 'yearOnly' }, // 7
	{ status: Status.Done, hasNote: false, deadlineShape: 'yearMonth' }, // 8
	{ status: Status.Cancelled, hasNote: true, deadlineShape: 'yearSeason' }, // 9
];

// Group #2 is deliberately never referenced by any TaskTemplate.groupIndex below -- it must
// render as an empty group. Tasks #0 and #10 sit in a goal and a group at once.
export const GROUP_TEMPLATES: GroupTemplate[] = [
	{ status: Status.Opened }, // 0
	{ status: Status.Opened }, // 1
	{ status: Status.Opened }, // 2
	{ status: Status.Done }, // 3
	{ status: Status.Cancelled }, // 4
];

export const TASK_TEMPLATES: TaskTemplate[] = [
	{
		status: Status.Opened,
		important: true,
		urgent: true,
		hasNote: true,
		goalIndex: 0,
		groupIndex: 0,
		scheduleKind: 'none',
	}, // 0
	{
		status: Status.Opened,
		important: true,
		urgent: true,
		hasNote: false,
		scheduleKind: 'oneTimeFuture',
	}, // 1
	{
		status: Status.Opened,
		important: true,
		urgent: false,
		hasNote: true,
		goalIndex: 1,
		scheduleKind: 'recurringWeeklyWithCompletions',
	}, // 2
	{
		status: Status.Opened,
		important: true,
		urgent: false,
		hasNote: false,
		groupIndex: 0,
		scheduleKind: 'none',
	}, // 3
	{
		status: Status.Opened,
		important: false,
		urgent: true,
		hasNote: true,
		goalIndex: 3,
		scheduleKind: 'oneTimePast',
	}, // 4
	{
		status: Status.Opened,
		important: false,
		urgent: true,
		hasNote: false,
		groupIndex: 1,
		scheduleKind: 'none',
	}, // 5
	{
		status: Status.Opened,
		important: false,
		urgent: false,
		hasNote: false,
		goalIndex: 5,
		scheduleKind: 'recurringMonthlyNoCompletions',
	}, // 6
	{
		status: Status.Opened,
		important: false,
		urgent: false,
		hasNote: true,
		groupIndex: 1,
		scheduleKind: 'none',
	}, // 7
	{
		status: Status.Opened,
		important: true,
		urgent: true,
		hasNote: true,
		goalIndex: 5,
		scheduleKind: 'oneTimeFuture',
	}, // 8
	{
		status: Status.Opened,
		important: true,
		urgent: false,
		hasNote: false,
		groupIndex: 0,
		scheduleKind: 'recurringWeeklyWithExdate',
	}, // 9
	{
		status: Status.Opened,
		important: false,
		urgent: true,
		hasNote: false,
		goalIndex: 7,
		groupIndex: 1,
		scheduleKind: 'none',
	}, // 10
	{
		status: Status.Opened,
		important: false,
		urgent: false,
		hasNote: true,
		scheduleKind: 'oneTimePast',
	}, // 11
	{
		status: Status.Opened,
		important: true,
		urgent: false,
		hasNote: false,
		groupIndex: 3,
		scheduleKind: 'none',
	}, // 12
	{
		status: Status.Done,
		important: true,
		urgent: true,
		hasNote: true,
		goalIndex: 0,
		scheduleKind: 'none',
	}, // 13
	{
		status: Status.Done,
		important: false,
		urgent: true,
		hasNote: false,
		goalIndex: 3,
		scheduleKind: 'oneTimePast',
	}, // 14
	{
		status: Status.Done,
		important: true,
		urgent: false,
		hasNote: false,
		groupIndex: 3,
		scheduleKind: 'none',
	}, // 15
	{
		status: Status.Done,
		important: false,
		urgent: false,
		hasNote: true,
		goalIndex: 8,
		scheduleKind: 'none',
	}, // 16
	{
		status: Status.Cancelled,
		important: true,
		urgent: true,
		hasNote: false,
		goalIndex: 2,
		scheduleKind: 'none',
	}, // 17
	{
		status: Status.Cancelled,
		important: false,
		urgent: true,
		hasNote: true,
		scheduleKind: 'oneTimePast',
	}, // 18
	{
		status: Status.Cancelled,
		important: false,
		urgent: false,
		hasNote: false,
		groupIndex: 4,
		scheduleKind: 'none',
	}, // 19
];
