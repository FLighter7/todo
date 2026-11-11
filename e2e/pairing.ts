import { fileURLToPath } from 'node:url';
import type { Locator, Page } from '@playwright/test';

/** The legacy build carries its worker inline and sets `QrScanner` globally: one script to add. */
const QR_SCANNER = fileURLToPath(
	new URL('../node_modules/qr-scanner/qr-scanner.legacy.min.js', import.meta.url),
);

/** A pairing code as a server's page shows it; no server stands behind it. */
export function samplePairingCode(serverId = 'S1', name = 'Desk'): string {
	const json = JSON.stringify({
		v: 1,
		id: serverId,
		n: name,
		p: 'a'.repeat(24),
		f: 'A'.repeat(43),
		o: 9,
		h: ['127.0.0.1'],
		s: 'secret',
	});

	return `wsrv1.${Buffer.from(json).toString('base64url')}`;
}

/**
 * Starts the app already paired with server `S1` ("Desk"), which is nowhere:
 * the Sync page shows the paired view, and sync keeps trying in vain.
 * Chrome pairs no host candidate with a loopback address, so nothing is sent.
 */
export async function fakePairing(page: Page): Promise<void> {
	const pairing = {
		serverId: 'S1',
		name: 'Desk',
		device: 'dev1',
		token: 'token',
		password: 'a'.repeat(24),
		fingerprint: Array(32).fill('00').join(':'),
		port: 9,
		hosts: ['127.0.0.1'],
		lastEtag: null,
		lastSyncAt: null,
	};
	await page.addInitScript((value) => {
		localStorage.setItem('todo.server', value);
	}, JSON.stringify(pairing));
}

/** Reads a QR code off the screen the way a camera would: from its pixels. */
export async function decodeQr(page: Page, picture: Locator): Promise<string> {
	const png = await picture.screenshot();
	await page.addScriptTag({ path: QR_SCANNER });

	return page.evaluate(
		async (image) => {
			const { QrScanner } = window as unknown as {
				QrScanner: {
					scanImage(
						source: string,
						options: { returnDetailedScanResult: true },
					): Promise<{ data: string }>;
				};
			};

			return (await QrScanner.scanImage(image, { returnDetailedScanResult: true })).data;
		},
		`data:image/png;base64,${png.toString('base64')}`,
	);
}
