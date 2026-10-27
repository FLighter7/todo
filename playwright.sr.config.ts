import { devices } from '@playwright/test';
import { withGuidepup } from '@guidepup/playwright';
import base from './playwright.config';

// Screen reader runs: NVDA on Windows, driven through Guidepup. Not part of
// `npm run test:e2e` or CI. Guidepup takes over the keyboard and NVDA speaks
// aloud, so the machine stays untouched while it runs. One-time setup:
// `npx @guidepup/setup setup` and `npx @guidepup/setup install`.
export default withGuidepup({
	...base,
	testDir: './e2e/sr',
	testMatch: '**/*.sr.ts',
	timeout: 5 * 60 * 1000,
	retries: 0,
	reportSlowTests: null,
	projects: [{ name: 'nvda', use: { ...devices['Desktop Chrome'] } }],
});
