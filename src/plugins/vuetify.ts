import '@mdi/font/css/materialdesignicons.css';
import 'vuetify/styles';
import { createVuetify } from 'vuetify';

const THEME_STORAGE_KEY = 'todo.theme';

export type AppTheme = 'light' | 'dark' | 'system';

function readStoredTheme(): AppTheme {
	const stored = localStorage.getItem(THEME_STORAGE_KEY);
	return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}

export function persistTheme(theme: AppTheme): void {
	localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export default createVuetify({
	theme: {
		defaultTheme: readStoredTheme(),
	},
});
