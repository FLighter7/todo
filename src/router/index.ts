import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import TodoListView from '@/views/TodoListView.vue';

const routes: RouteRecordRaw[] = [
	{ path: '/', name: 'list', component: TodoListView },
	{ path: '/matrix', name: 'matrix', component: () => import('@/views/MatrixView.vue') },
	{ path: '/sync', name: 'sync', component: () => import('@/views/SyncView.vue') },
];

export default createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes,
});
