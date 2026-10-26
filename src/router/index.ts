import {
	createRouter,
	createWebHistory,
	type RouteLocationNormalized,
	type RouteLocationRaw,
	type RouteRecordRaw,
} from 'vue-router';
import {
	mdiFlagOutline,
	mdiFolderOutline,
	mdiTelescope,
	mdiViewGridOutline,
	mdiViewListOutline,
} from '@mdi/js';
import TasksPage from '@/pages/TasksPage/TasksPage.vue';
import { settingsService } from '@/services/settings/SettingsService';
import { firstShownPage, isPageHidden } from '@/types';

declare module 'vue-router' {
	interface RouteMeta {
		/** Present on routes that can be picked as the app's start page. */
		startPage?: {
			icon: string;
			labelKey: string;
		};
	}
}

/**
 * Not a real union — the set of eligible routes is derived at runtime from
 * `routes` (see `getStartPageOptions`), keyed by `meta.startPage`.
 */
export type StartPage = string;

export interface StartPageOption {
	value: StartPage;
	icon: string;
	labelKey: string;
}

const routes: RouteRecordRaw[] = [
	{ path: '/', redirect: () => ({ name: readStoredStartPage() }) },
	{
		path: '/tasks',
		name: 'tasks',
		component: TasksPage,
		meta: { startPage: { icon: mdiViewListOutline, labelKey: 'settings.startPageTasks' } },
	},
	{
		path: '/matrix',
		name: 'matrix',
		component: () => import('@/pages/MatrixPage/MatrixPage.vue'),
		meta: { startPage: { icon: mdiViewGridOutline, labelKey: 'settings.startPageMatrix' } },
	},
	{
		path: '/dreams',
		name: 'dreams',
		component: () => import('@/pages/DreamsPage/DreamsPage.vue'),
		meta: { startPage: { icon: mdiTelescope, labelKey: 'settings.startPageDreams' } },
	},
	{
		path: '/goals',
		name: 'goals',
		component: () => import('@/pages/GoalsPage/GoalsPage.vue'),
		meta: { startPage: { icon: mdiFlagOutline, labelKey: 'settings.startPageGoals' } },
	},
	{
		path: '/groups',
		name: 'groups',
		component: () => import('@/pages/GroupsPage/GroupsPage.vue'),
		meta: { startPage: { icon: mdiFolderOutline, labelKey: 'settings.startPageGroups' } },
	},
	{ path: '/sync', name: 'sync', component: () => import('@/pages/SyncPage/SyncPage.vue') },
	{
		path: '/settings',
		name: 'settings',
		component: () => import('@/pages/SettingsPage/SettingsPage.vue'),
	},
];

export function getStartPageOptions(): StartPageOption[] {
	const options: StartPageOption[] = [];

	for (const route of routes) {
		const startPage = route.meta?.startPage;

		if (typeof route.name !== 'string' || startPage === undefined) {
			continue;
		}

		options.push({ value: route.name, ...startPage });
	}

	return options;
}

export function readStoredStartPage(): StartPage {
	const settings = settingsService.load();
	const stored = settings.general.startPage;
	const known = getStartPageOptions().some((option) => option.value === stored);

	return known && !isPageHidden(settings, stored) ? stored : firstShownPage(settings);
}

/**
 * A page switched off in Settings cannot be reached by its address either:
 * it leads to the start page, which is never a hidden one.
 */
export function redirectHiddenPage(to: RouteLocationNormalized): RouteLocationRaw | true {
	return isPageHidden(settingsService.load(), String(to.name))
		? { name: readStoredStartPage() }
		: true;
}

const router = createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes,
});

router.beforeEach(redirectHiddenPage);

export default router;
