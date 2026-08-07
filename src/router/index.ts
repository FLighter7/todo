import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import TodoListPage from '@/pages/TodoListPage/TodoListPage.vue';

const routes: RouteRecordRaw[] = [
	{ path: '/', name: 'list', component: TodoListPage },
	{ path: '/matrix', name: 'matrix', component: () => import('@/pages/MatrixPage/MatrixPage.vue') },
	{ path: '/sync', name: 'sync', component: () => import('@/pages/SyncPage/SyncPage.vue') },
];

export default createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes,
});
