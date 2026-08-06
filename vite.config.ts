import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';
import vueI18n from '@intlify/unplugin-vue-i18n/vite';

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
