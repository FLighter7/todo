// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import type { RouteLocationNormalized } from 'vue-router';
import { DEFAULT_SETTINGS, cloneSettings, type AppPage } from '@/types';
import { settingsService } from '@/services/settings/SettingsService';
import { getStartPageOptions, readStoredStartPage, redirectHiddenPage } from '../index';

beforeEach(() => {
	window.localStorage.clear();
});

function saveWith(startPage: string, hidden: AppPage[] = []): void {
	const settings = cloneSettings(DEFAULT_SETTINGS);
	settings.general.startPage = startPage;
	for (const page of hidden) {
		settings.general.pages[page] = false;
	}
	settingsService.save(settings);
}

function routeNamed(name: string): RouteLocationNormalized {
	return { name } as RouteLocationNormalized;
}

describe('getStartPageOptions', () => {
	it('includes the tasks, matrix, dreams, goals and groups routes, tasks first', () => {
		const values = getStartPageOptions().map((option) => option.value);

		expect(values).toEqual(['tasks', 'matrix', 'dreams', 'goals', 'groups']);
	});
});

describe('readStoredStartPage', () => {
	it('returns the stored start page', () => {
		saveWith('goals');

		expect(readStoredStartPage()).toBe('goals');
	});

	it('falls back to tasks when the stored start page is hidden', () => {
		// Written past parseSettings' own reset, the way a hand-edited document would be.
		const settings = cloneSettings(DEFAULT_SETTINGS);
		settings.general.startPage = 'goals';
		settings.general.pages.goals = false;
		localStorage.setItem('todo.settings', JSON.stringify(settings));

		expect(readStoredStartPage()).toBe('tasks');
	});

	it('falls back to the first page still shown when Tasks is hidden too', () => {
		const settings = cloneSettings(DEFAULT_SETTINGS);
		settings.general.startPage = 'goals';
		settings.general.pages.goals = false;
		settings.general.pages.tasks = false;
		localStorage.setItem('todo.settings', JSON.stringify(settings));

		expect(readStoredStartPage()).toBe('matrix');
	});
});

describe('redirectHiddenPage', () => {
	it('sends a hidden page to the start page', () => {
		saveWith('matrix', ['dreams', 'groups']);

		expect(redirectHiddenPage(routeNamed('dreams'))).toEqual({ name: 'matrix' });
		expect(redirectHiddenPage(routeNamed('groups'))).toEqual({ name: 'matrix' });
	});

	it('sends a hidden Tasks or matrix page to the start page too', () => {
		saveWith('goals', ['tasks', 'matrix']);

		expect(redirectHiddenPage(routeNamed('tasks'))).toEqual({ name: 'goals' });
		expect(redirectHiddenPage(routeNamed('matrix'))).toEqual({ name: 'goals' });
	});

	it('lets shown pages through, and Settings and Sync, which are never hidden', () => {
		saveWith('tasks', ['dreams', 'goals', 'groups']);

		for (const name of ['tasks', 'matrix', 'settings', 'sync']) {
			expect(redirectHiddenPage(routeNamed(name))).toBe(true);
		}

		saveWith('tasks', ['dreams']);
		expect(redirectHiddenPage(routeNamed('goals'))).toBe(true);
	});
});
