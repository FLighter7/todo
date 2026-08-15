import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { mdiViewGridOutline, mdiViewListOutline } from '@mdi/js';
import TodoListPage from '@/pages/TodoListPage/TodoListPage.vue';

declare module 'vue-router' {
	interface RouteMeta {
		/** Present on routes that can be picked as the app's start page. */
		startPage?: {
			icon: string;
			labelKey: string;
		};
	}
}

const START_PAGE_STORAGE_KEY = 'todo.startPage';

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
		path: '/list',
		name: 'list',
		component: TodoListPage,
		meta: { startPage: { icon: mdiViewListOutline, labelKey: 'settings.startPageList' } },
	},
	{
		path: '/matrix',
		name: 'matrix',
		component: () => import('@/pages/MatrixPage/MatrixPage.vue'),
		meta: { startPage: { icon: mdiViewGridOutline, labelKey: 'settings.startPageMatrix' } },
	},
	{ path: '/sync', name: 'sync', component: () => import('@/pages/SyncPage/SyncPage.vue') },
	{ path: '/settings', name: 'settings', component: () => import('@/pages/SettingsPage/SettingsPage.vue') },
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
	const stored = localStorage.getItem(START_PAGE_STORAGE_KEY);
	const options = getStartPageOptions();
	const fallback = options[0]?.value ?? 'list';

	if (stored === null) {
		return fallback;
	}

	return options.some((option) => option.value === stored) ? stored : fallback;
}

export function persistStartPage(page: StartPage): void {
	localStorage.setItem(START_PAGE_STORAGE_KEY, page);
}

export default createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes,
});
