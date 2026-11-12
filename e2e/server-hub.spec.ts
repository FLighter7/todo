import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { WorkspaceServer, buildServer, onLoopback } from './workspaceServer';

/**
 * A main server and a laptop's server linked to it, both built from
 * ../workspace-server and run on this machine. Browsers pair with the main
 * only, learn the laptop's server from it, sync through it while the main is
 * stopped, and every copy converges once the two servers meet again, also
 * after both moved while apart.
 */

let tmp = '';
let main: WorkspaceServer;
let laptop: WorkspaceServer;
/** A pairing code of the laptop's server, taken before it linked. */
let laptopCode = '';

test.describe.configure({ mode: 'serial' });

/** Whether the laptop's server is linked to the main and connected. */
async function linked(): Promise<boolean> {
	return ((await laptop.api('GET', '/api/upstream')) as { connected: boolean }).connected;
}

async function pairDevice(page: Page, code: string): Promise<void> {
	await page.goto('/todo/sync');
	await page.getByLabel('Code', { exact: true }).fill(code);
	await page.getByRole('button', { name: 'Use this code' }).click();
	await expect(page.getByText('Connected', { exact: true })).toBeVisible({ timeout: 20_000 });
}

async function addTask(page: Page, name: string): Promise<void> {
	await page.goto('/todo/tasks');
	await page.getByRole('button', { name: 'Add', exact: true }).click();
	await page.getByLabel('Name').fill(name);
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.locator('main').getByText(name)).toBeVisible();
}

/** Opens the Sync page anew: the app starts again, and so does its connection. */
async function reopen(context: BrowserContext): Promise<Page> {
	for (const open of context.pages()) await open.close();
	const page = await context.newPage();
	await page.goto('/todo/sync');

	return page;
}

const THROUGH_LAPTOP = 'Through Laptop while this server is out of reach';

async function newDevice(browser: Browser): Promise<BrowserContext> {
	const context = await browser.newContext();
	await context.newPage();

	return context;
}

test.beforeAll(async () => {
	// Building the server with Go takes a while on a cold cache.
	test.setTimeout(180_000);
	tmp = mkdtempSync(join(tmpdir(), 'todo-server-hub-'));
	const binary = buildServer(tmp);
	main = await WorkspaceServer.start(binary, join(tmp, 'desk'));
	laptop = await WorkspaceServer.start(binary, join(tmp, 'laptop'));
	await main.api('PUT', '/api/config', { name: 'Desk' });
	await laptop.api('PUT', '/api/config', { name: 'Laptop' });
	// Once linked, the laptop's page issues no code of its own (devices pair
	// with the main); its server refuses pair before it reads the secret, so
	// a code taken now stands for any code of the laptop.
	laptopCode = await laptop.pairingCode();
	// The servers link over loopback, so the link does not depend on the LAN.
	await laptop.api('POST', '/api/upstream', { code: onLoopback(await main.pairingCode()) });
	await expect.poll(linked, { timeout: 20_000 }).toBe(true);
});

test.afterAll(async () => {
	await Promise.all([main?.stop(), laptop?.stop()]);
	try {
		rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
	} catch {
		// The OS cleans up what a server still held.
	}
});

let a: BrowserContext;
let b: BrowserContext;

test('the laptop’s own code is refused with a reason: devices pair with the main', async ({
	browser,
}) => {
	const page = await browser.newPage();
	await page.goto('/todo/sync');
	await page.getByLabel('Code', { exact: true }).fill(laptopCode);
	await page.getByRole('button', { name: 'Use this code' }).click();

	await expect(
		page.locator('main').getByText(/this is a second server, linked to a main one/),
	).toBeVisible({
		timeout: 20_000,
	});
});

test('a device paired with the main syncs through the laptop while the main is stopped', async ({
	browser,
}) => {
	test.setTimeout(120_000);
	a = await newDevice(browser);
	const page = a.pages()[0];
	await pairDevice(page, await main.pairingCode());
	const fallbacks = await page.evaluate(
		() =>
			(
				JSON.parse(localStorage.getItem('todo.server') ?? '{}') as {
					fallbacks?: { name: string }[];
				}
			).fallbacks,
	);
	expect(fallbacks?.map((server) => server.name)).toEqual(['Laptop']);

	await addTask(page, 'Buy milk');
	await expect.poll(() => laptop.itemNames(), { timeout: 20_000 }).toEqual(['Buy milk']);

	await main.stop();
	const away = await reopen(a);
	await expect(away.getByText('Server: Desk')).toBeVisible();
	await expect(away.getByText(THROUGH_LAPTOP)).toBeVisible({ timeout: 30_000 });
	await expect(away.getByText('Connected', { exact: true })).toBeVisible();
	await addTask(away, 'Walk the dog');
	await expect
		.poll(() => laptop.itemNames(), { timeout: 20_000 })
		.toEqual(['Buy milk', 'Walk the dog']);

	// The main is back: the laptop's server pushes what it got meanwhile,
	// and the app opened again prefers the main.
	await main.run();
	await expect
		.poll(() => main.itemNames(), { timeout: 30_000 })
		.toEqual(['Buy milk', 'Walk the dog']);
	const home = await reopen(a);
	await expect(home.getByText('Connected', { exact: true })).toBeVisible({ timeout: 30_000 });
	await expect(home.getByText(THROUGH_LAPTOP)).toHaveCount(0);
});

test('edits made on both sides while the servers are apart converge', async ({ browser }) => {
	test.setTimeout(180_000);
	b = await newDevice(browser);
	await pairDevice(b.pages()[0], await main.pairingCode());
	await b.pages()[0].goto('/todo/tasks');
	await expect(b.pages()[0].locator('main').getByText('Walk the dog')).toBeVisible({
		timeout: 15_000,
	});
	for (const open of b.pages()) await open.close();

	// The laptop's side moves while the main is stopped...
	await main.stop();
	const away = await reopen(a);
	await expect(away.getByText(THROUGH_LAPTOP)).toBeVisible({ timeout: 30_000 });
	await addTask(away, 'Laptop task');
	await expect.poll(() => laptop.itemNames(), { timeout: 20_000 }).toContain('Laptop task');
	for (const open of a.pages()) await open.close();

	// ...and the main's side while the laptop is stopped.
	await laptop.stop();
	await main.run();
	const desk = await reopen(b);
	await expect(desk.getByText('Connected', { exact: true })).toBeVisible({ timeout: 30_000 });
	await addTask(desk, 'Desk task');
	await expect.poll(() => main.itemNames(), { timeout: 20_000 }).toContain('Desk task');

	// They meet: the main's copy wins on the laptop, whose own version goes
	// to its history, and the devices merge what each of them holds.
	await laptop.run();
	await expect.poll(linked, { timeout: 30_000 }).toBe(true);
	const back = await reopen(a);
	await expect(back.getByText('Connected', { exact: true })).toBeVisible({ timeout: 30_000 });

	const all = ['Buy milk', 'Desk task', 'Laptop task', 'Walk the dog'];
	await expect.poll(() => main.itemNames(), { timeout: 30_000 }).toEqual(all);
	await expect.poll(() => laptop.itemNames(), { timeout: 30_000 }).toEqual(all);
	await back.goto('/todo/tasks');
	await expect(back.locator('main').getByText('Desk task')).toBeVisible({ timeout: 15_000 });
	await desk.goto('/todo/tasks');
	await expect(desk.locator('main').getByText('Laptop task')).toBeVisible({ timeout: 15_000 });

	const history = join(laptop.dir, 'apps', 'todo', 'history');
	const kept = readdirSync(history).map((name) => readFileSync(join(history, name), 'utf8'));
	expect(kept.some((doc) => doc.includes('Laptop task') && !doc.includes('Desk task'))).toBe(true);
});
