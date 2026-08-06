import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';
import vueI18n from '@intlify/unplugin-vue-i18n/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
	// GitHub Pages serves a project repository from a sub-path.
	base: '/todo/',
	plugins: [
		vue(),
		vuetify({ autoImport: true }),
		vueI18n({
			include: [fileURLToPath(new URL('./src/i18n/locales/**', import.meta.url))],
			runtimeOnly: true,
		}),
		VitePWA({
			registerType: 'autoUpdate',
			includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
			manifest: {
				name: 'Todo',
				short_name: 'Todo',
				description: 'Личный список дел с матрицей Эйзенхауэра',
				lang: 'ru',
				// standalone is what exempts an installed app from Safari's
				// seven-day deletion of site data. Do not weaken it to 'browser'.
				display: 'standalone',
				background_color: '#FFFFFF',
				theme_color: '#1867C0',
				icons: [
					{ src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
					{ src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
					{
						src: 'pwa-maskable-512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable',
					},
				],
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,svg,png}'],
				navigateFallback: '/todo/index.html',
				cleanupOutdatedCaches: true,
			},
		}),
	],
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
		},
	},
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts'],
	},
});
