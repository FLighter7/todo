import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createSocket } from 'node:dgram';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test, expect, type Browser, type Page } from '@playwright/test';
import { decodeQr } from './pairing';

/**
 * Two and then three browsers syncing through a real workspace-server. The
 * server comes from its repository next to this one (or
 * WORKSPACE_SERVER_DIR), built with Go; WORKSPACE_SERVER_BIN runs a binary
 * already built instead, for a machine without Go.
 */
const SERVER_DIR = resolve(process.env.WORKSPACE_SERVER_DIR ?? '../workspace-server');
const PREBUILT = process.env.WORKSPACE_SERVER_BIN;

let server: ChildProcess | null = null;
let tmp = '';
let dataDir = '';
let httpPort = 0;
let firstCode = '';

test.describe.configure({ mode: 'serial' });

function freeTcpPort(): Promise<number> {
	return new Promise((resolvePort, reject) => {
		const probe = createServer();
		probe.once('error', reject);
		probe.listen(0, '127.0.0.1', () => {
			const address = probe.address();
			probe.close(() => resolvePort(typeof address === 'object' && address ? address.port : 0));
		});
	});
}

function freeUdpPort(): Promise<number> {
	return new Promise((resolvePort, reject) => {
		const probe = createSocket('udp4');
		probe.once('error', reject);
		probe.bind(0, () => {
			const { port } = probe.address();
			probe.close(() => resolvePort(port));
		});
	});
}

function buildServer(): string {
	if (PREBUILT) return resolve(PREBUILT);
	if (!existsSync(join(SERVER_DIR, 'go.mod'))) {
		throw new Error(
			`No workspace-server repository at ${SERVER_DIR}: clone FLighter7/workspace-server ` +
				'next to this repository, or set WORKSPACE_SERVER_DIR (or WORKSPACE_SERVER_BIN).',
		);
	}

	const binary = join(
		tmp,
		process.platform === 'win32' ? 'workspace-server.exe' : 'workspace-server',
	);
	const build = spawnSync('go', ['build', '-o', binary, './cmd/workspace-server'], {
		cwd: SERVER_DIR,
		encoding: 'utf8',
	});
	if (build.status !== 0) {
		throw new Error(`go build failed: ${build.error?.message ?? ''}${build.stderr ?? ''}`);
	}

	return binary;
}

async function waitForServer(): Promise<void> {
	const deadline = Date.now() + 30_000;
	while (Date.now() < deadline) {
		if (server?.exitCode !== null) throw new Error('workspace-server exited at start');
		try {
			const response = await fetch(`http://127.0.0.1:${httpPort}/api/status`);
			if (response.ok) return;
		} catch {
			// Not listening yet.
		}
		await new Promise((done) => setTimeout(done, 200));
	}

	throw new Error('workspace-server did not start within 30 s');
}

/** A fresh one-time pairing code, as the server's page would show it. */
async function pairingCode(): Promise<string> {
	const response = await fetch(`http://127.0.0.1:${httpPort}/api/pairing`, {
		method: 'POST',
		headers: { 'X-Workspace-Server': '1' },
	});
	expect(response.ok).toBe(true);
	const { code } = (await response.json()) as { code: string };

	return code;
}

async function openDevice(browser: Browser, path = '/todo/sync'): Promise<Page> {
	const context = await browser.newContext();
	const page = await context.newPage();
	await page.goto(path);

	return page;
}

async function pastePairingCode(page: Page, code: string): Promise<void> {
	await page.getByLabel('Code', { exact: true }).fill(code);
	await page.getByRole('button', { name: 'Use this code' }).click();
}

async function pairDevice(page: Page, code: string): Promise<void> {
	await pastePairingCode(page, code);
	await expect(page.getByText('Connected', { exact: true })).toBeVisible({ timeout: 20_000 });
}

test.beforeAll(async () => {
	// Building the server with Go takes a while on a cold cache.
	test.setTimeout(180_000);
	tmp = mkdtempSync(join(tmpdir(), 'todo-server-sync-'));
	dataDir = join(tmp, 'server');
	const binary = buildServer();
	httpPort = await freeTcpPort();
	const udpPort = await freeUdpPort();

	server = spawn(
		binary,
		['run', '-dir', dataDir, '-udp-port', String(udpPort), '-http-port', String(httpPort)],
		{ stdio: 'ignore' },
	);
	await waitForServer();
});

test.afterAll(() => {
	server?.kill();
	server = null;
	try {
		rmSync(tmp, { recursive: true, force: true });
	} catch {
		// The server may still hold its lock file for a moment; the OS cleans up.
	}
});

test('two devices pair and an edit reaches the other without a reload', async ({ browser }) => {
	const a = await openDevice(browser);
	const b = await openDevice(browser);

	firstCode = await pairingCode();
	await pairDevice(a, firstCode);
	await pairDevice(b, await pairingCode());

	await b.goto('/todo/tasks');
	await a.goto('/todo/tasks');
	await a.getByRole('button', { name: 'Add', exact: true }).click();
	await a.getByLabel('Name').fill('Buy milk');
	await a.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(a.locator('main').getByText('Buy milk')).toBeVisible();

	await expect(b.locator('main').getByText('Buy milk')).toBeVisible({ timeout: 15_000 });
});

test('a device paired later receives the existing list', async ({ browser }) => {
	const c = await openDevice(browser);

	await pairDevice(c, await pairingCode());
	await c.goto('/todo/tasks');

	await expect(c.locator('main').getByText('Buy milk')).toBeVisible({ timeout: 15_000 });
});

test('the server keeps the document as a backup file', () => {
	const document = JSON.parse(readFileSync(join(dataDir, 'apps', 'todo', 'data.json'), 'utf8')) as {
		version: number;
		syncSchema: number;
		items: { name: string }[];
	};

	expect(document.version).toBe(4);
	expect(document.syncSchema).toBe(5);
	expect(document.items.map((item) => item.name)).toContain('Buy milk');
});

test('a used code is refused with a reason', async ({ browser }) => {
	const d = await openDevice(browser);

	await pastePairingCode(d, firstCode);

	await expect(d.locator('main').getByText(/the code has expired or was already used/)).toBeVisible(
		{
			timeout: 20_000,
		},
	);
});

test('a paired device passes a code on, and the device that reads it pairs', async ({
	browser,
}) => {
	const phone = await openDevice(browser);
	await pairDevice(phone, await pairingCode());
	const pairing = await phone.evaluate(() => localStorage.getItem('todo.server'));

	await phone.getByRole('button', { name: 'Pair another device' }).click();
	const relay = phone.getByRole('dialog', { name: 'Pair another device' });
	await relay.getByLabel('Code', { exact: true }).fill(await pairingCode());
	await relay.getByRole('button', { name: 'Use this code' }).click();
	const relayed = await decodeQr(phone, relay.getByRole('img', { name: /^Pairing code for / }));

	const laptop = await openDevice(browser);
	await pairDevice(laptop, relayed);
	await laptop.goto('/todo/tasks');

	await expect(laptop.locator('main').getByText('Buy milk')).toBeVisible({ timeout: 15_000 });
	expect(await phone.evaluate(() => localStorage.getItem('todo.server'))).toBe(pairing);
});
