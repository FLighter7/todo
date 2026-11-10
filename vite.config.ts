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
			// Only the top-level catalogs (en/ru/pl.json) are real translation
			// message tables. `**` would also sweep up src/i18n/locales/mockData/
			// -- plain content pools for the sample-data generator, not messages
			// -- and precompile their string arrays into vue-i18n's compiled
			// message AST format, silently corrupting them for any non-i18n
			// consumer (see src/services/mockData/pools.ts / MockDataService.ts).
			include: [fileURLToPath(new URL('./src/i18n/locales/*.json', import.meta.url))],
			runtimeOnly: true,
		}),
		VitePWA({
			registerType: 'autoUpdate',
			// The globPatterns below already match every svg and png copied from
			// public/, so neither includeAssets nor the plugin's own manifest-icon
			// precaching may add them again: a URL listed twice makes Workbox call
			// cache.put on it twice, the install step rejects with "Entry already
			// exists", and the app silently ends up with no offline mode at all.
			includeManifestIcons: false,
			manifest: {
				name: 'TODO',
				short_name: 'TODO',
				// The manifest carries one fixed language; English matches the i18n
				// fallback locale. It cannot follow the in-app language switch.
				description: 'A personal todo list with an Eisenhower matrix',
				lang: 'en',
				// standalone is what exempts an installed app from Safari's
				// seven-day deletion of site data. Do not weaken it to 'browser'.
				display: 'standalone',
				background_color: '#F6F4EF',
				theme_color: '#F6F4EF',
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
				globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
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
	server: {
		port: 3000,
	},
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts'],
		setupFiles: ['src/vitest.setup.ts'],
		server: {
			deps: {
				// vite-plugin-vuetify's autoImport injects a `.css` side-import per
				// Vuetify component used. Vitest's SSR module runner externalizes
				// `vuetify` to Node's native module loader by default (for speed),
				// and that loader chokes on a raw `.css` extension. Inlining the
				// package runs it through Vite's transform pipeline instead, which
				// strips those CSS imports like the dev server and build already do.
				inline: ['vuetify'],
			},
		},
	},
});
