import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import TodoListPage from '@/pages/TodoListPage/TodoListPage.vue';

const START_PAGE_STORAGE_KEY = 'todo.startPage';

export type StartPage = 'list' | 'matrix';

export function readStoredStartPage(): StartPage {
	const stored = localStorage.getItem(START_PAGE_STORAGE_KEY);
	return stored === 'list' || stored === 'matrix' ? stored : 'list';
}

export function persistStartPage(page: StartPage): void {
	localStorage.setItem(START_PAGE_STORAGE_KEY, page);
}

const routes: RouteRecordRaw[] = [
	{ path: '/', redirect: () => ({ name: readStoredStartPage() }) },
	{ path: '/list', name: 'list', component: TodoListPage },
	{ path: '/matrix', name: 'matrix', component: () => import('@/pages/MatrixPage/MatrixPage.vue') },
	{ path: '/sync', name: 'sync', component: () => import('@/pages/SyncPage/SyncPage.vue') },
	{ path: '/settings', name: 'settings', component: () => import('@/pages/SettingsPage/SettingsPage.vue') },
];

export default createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes,
});
