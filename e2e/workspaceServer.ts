import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createSocket } from 'node:dgram';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';

/**
 * Real workspace-servers for the e2e tests. The server comes from its
 * repository next to this one (or WORKSPACE_SERVER_DIR), built with Go;
 * WORKSPACE_SERVER_BIN runs a binary already built instead, for a machine
 * without Go.
 */
const SERVER_DIR = resolve(process.env.WORKSPACE_SERVER_DIR ?? '../workspace-server');
const PREBUILT = process.env.WORKSPACE_SERVER_BIN;

export function freeTcpPort(): Promise<number> {
	return new Promise((resolvePort, reject) => {
		const probe = createServer();
		probe.once('error', reject);
		probe.listen(0, '127.0.0.1', () => {
			const address = probe.address();
			probe.close(() => resolvePort(typeof address === 'object' && address ? address.port : 0));
		});
	});
}

export function freeUdpPort(): Promise<number> {
	return new Promise((resolvePort, reject) => {
		const probe = createSocket('udp4');
		probe.once('error', reject);
		probe.bind(0, () => {
			const { port } = probe.address();
			probe.close(() => resolvePort(port));
		});
	});
}

/** Builds the server into `dir`, unless WORKSPACE_SERVER_BIN names one; returns the binary. */
export function buildServer(dir: string): string {
	if (PREBUILT) return resolve(PREBUILT);
	if (!existsSync(join(SERVER_DIR, 'go.mod'))) {
		throw new Error(
			`No workspace-server repository at ${SERVER_DIR}: clone FLighter7/workspace-server ` +
				'next to this repository, or set WORKSPACE_SERVER_DIR (or WORKSPACE_SERVER_BIN).',
		);
	}

	const binary = join(
		dir,
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

/** One server process, which can be stopped and started again on the same folder and ports. */
export class WorkspaceServer {
	private process: ChildProcess | null = null;

	private constructor(
		private readonly binary: string,
		readonly dir: string,
		readonly httpPort: number,
		readonly udpPort: number,
	) {}

	static async start(binary: string, dir: string): Promise<WorkspaceServer> {
		const server = new WorkspaceServer(binary, dir, await freeTcpPort(), await freeUdpPort());
		await server.run();

		return server;
	}

	/** Starts the process and waits until its page answers. */
	async run(): Promise<void> {
		const process = spawn(
			this.binary,
			[
				'run',
				'-dir',
				this.dir,
				'-udp-port',
				String(this.udpPort),
				'-http-port',
				String(this.httpPort),
			],
			{ stdio: 'ignore' },
		);
		this.process = process;
		const deadline = Date.now() + 30_000;
		while (Date.now() < deadline) {
			if (process.exitCode !== null) throw new Error('workspace-server exited at start');
			try {
				const response = await fetch(`http://127.0.0.1:${this.httpPort}/api/status`);
				if (response.ok) return;
			} catch {
				// Not listening yet.
			}
			await new Promise((done) => setTimeout(done, 200));
		}

		throw new Error('workspace-server did not start within 30 s');
	}

	/** Ends the process, as a computer switched off would, and waits until it is gone. */
	async stop(): Promise<void> {
		const process = this.process;
		this.process = null;
		if (!process || process.exitCode !== null) return;
		// Windows releases the server's files only once the process is gone.
		const exited = new Promise((done) => process.once('exit', done));
		process.kill();
		await exited;
	}

	/** Calls the page's API; a body is sent as JSON. */
	async api(method: string, path: string, body?: unknown): Promise<unknown> {
		const response = await fetch(`http://127.0.0.1:${this.httpPort}${path}`, {
			method,
			headers: { 'X-Workspace-Server': '1', 'Content-Type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		const text = await response.text();
		if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${text}`);

		return text === '' ? null : JSON.parse(text);
	}

	/** A fresh one-time pairing code, as the server's page would show it. */
	async pairingCode(): Promise<string> {
		const { code } = (await this.api('POST', '/api/pairing')) as { code: string };

		return code;
	}

	/** The names of the items in this server's todo document, `[]` when it has none. */
	itemNames(): string[] {
		const file = join(this.dir, 'apps', 'todo', 'data.json');
		if (!existsSync(file)) return [];
		const document = JSON.parse(readFileSync(file, 'utf8')) as { items: { name: string }[] };

		return document.items.map((item) => item.name).sort();
	}
}

/** `code` with 127.0.0.1 as its only host: a server on this machine reached without the LAN. */
export function onLoopback(code: string): string {
	const prefix = 'wsrv1.';
	const json = JSON.parse(Buffer.from(code.slice(prefix.length), 'base64url').toString('utf8'));

	return prefix + Buffer.from(JSON.stringify({ ...json, h: ['127.0.0.1'] })).toString('base64url');
}
