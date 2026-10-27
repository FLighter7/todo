export type SignalType = 'offer' | 'answer';

export interface Signal {
	type: SignalType;
	sdp: string;
}

export const SIGNAL_VERSION = 1;

/** What is wrong with a pairing code, for the interface to say in the user's language. */
export type SignalErrorCode = 'notPairingCode' | 'tooNew' | 'damaged' | 'noConnectionDetails';

/** The message is English, for a developer; `code` is what the interface translates. */
export class SignalFormatError extends Error {
	constructor(
		message: string,
		readonly code: SignalErrorCode,
	) {
		super(message);
		this.name = 'SignalFormatError';
	}
}

/**
 * Everything a peer genuinely needs; the rest of the SDP is constant for a
 * data-channel-only connection and gets rebuilt from the template below.
 */
interface CompactSignal {
	/** ice-ufrag */
	u: string;
	/** ice-pwd */
	p: string;
	/** sha-256 certificate fingerprint */
	f: string;
	/** candidate host (usually an mDNS .local name) */
	h: string;
	/** candidate port */
	o: string;
	/** candidate transport */
	t: string;
	/** DTLS setup role */
	s: string;
}

function toBase64Url(text: string): string {
	let binary = '';
	for (const byte of new TextEncoder().encode(text)) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): string {
	const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
	return new TextDecoder().decode(Uint8Array.from(binary, (ch) => ch.charCodeAt(0)));
}

function extract(sdp: string): CompactSignal | null {
	const ufrag = /a=ice-ufrag:(\S+)/.exec(sdp)?.[1];
	const pwd = /a=ice-pwd:(\S+)/.exec(sdp)?.[1];
	const fingerprint = /a=fingerprint:sha-256 (\S+)/.exec(sdp)?.[1];
	const setup = /a=setup:(\S+)/.exec(sdp)?.[1];
	const candidate = /a=candidate:\S+ \d+ (\S+) \d+ (\S+) (\d+) typ host/.exec(sdp);

	if (!ufrag || !pwd || !fingerprint || !setup || !candidate) {
		return null;
	}

	return {
		u: ufrag,
		p: pwd,
		f: fingerprint,
		h: candidate[2],
		o: candidate[3],
		t: candidate[1],
		s: setup,
	};
}

function rebuild(fields: CompactSignal): string {
	return (
		[
			'v=0',
			'o=- 0 2 IN IP4 127.0.0.1',
			's=-',
			't=0 0',
			'a=group:BUNDLE 0',
			'a=extmap-allow-mixed',
			'a=msid-semantic: WMS',
			'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
			'c=IN IP4 0.0.0.0',
			`a=candidate:1 1 ${fields.t} 2113937151 ${fields.h} ${fields.o} typ host generation 0`,
			`a=ice-ufrag:${fields.u}`,
			`a=ice-pwd:${fields.p}`,
			'a=ice-options:trickle',
			`a=fingerprint:sha-256 ${fields.f}`,
			`a=setup:${fields.s}`,
			'a=mid:0',
			'a=sctp-port:5000',
			'a=max-message-size:262144',
		].join('\r\n') + '\r\n'
	);
}

function isCompact(value: unknown): value is CompactSignal {
	if (typeof value !== 'object' || value === null) {
		return false;
	}

	const record = value as Record<string, unknown>;
	return (['u', 'p', 'f', 'h', 'o', 't', 's'] as const).every(
		(key) => typeof record[key] === 'string' && record[key] !== '',
	);
}

export class SyncSignal {
	/**
	 * Encodes a description as a short string for a QR code.
	 *
	 * The compact mode carries only the fields that vary and rebuilds the rest,
	 * which measured 212 bytes against 586 for the whole SDP — the difference
	 * between a QR a phone reads at a glance and one it has to be held against.
	 * An SDP that will not reduce falls back to carrying the whole thing, so an
	 * unfamiliar shape costs a bigger code rather than breaking sync outright.
	 */
	encode(signal: Signal): string {
		const marker = signal.type === 'offer' ? 'o' : 'a';
		const fields = extract(signal.sdp);

		if (fields) {
			return `${SIGNAL_VERSION}${marker}c.${toBase64Url(JSON.stringify(fields))}`;
		}

		// Deflate was measured at 570 chars against 586 raw: three percent, not
		// worth making every caller async.
		return `${SIGNAL_VERSION}${marker}f.${toBase64Url(signal.sdp)}`;
	}

	decode(text: string): Signal {
		const trimmed = text.trim();
		const match = /^(\d)([oa])([cf])\.(.+)$/.exec(trimmed);

		if (!match) {
			throw new SignalFormatError('This is not a pairing code', 'notPairingCode');
		}

		const [, version, marker, mode, payload] = match;

		if (Number(version) > SIGNAL_VERSION) {
			throw new SignalFormatError('The code is newer than this app supports', 'tooNew');
		}

		const type: SignalType = marker === 'o' ? 'offer' : 'answer';

		let decoded: string;
		try {
			decoded = fromBase64Url(payload);
		} catch {
			throw new SignalFormatError('The code is damaged', 'damaged');
		}

		if (mode === 'f') {
			return { type, sdp: decoded };
		}

		let fields: unknown;
		try {
			fields = JSON.parse(decoded);
		} catch {
			throw new SignalFormatError('The code is damaged', 'damaged');
		}

		if (!isCompact(fields)) {
			throw new SignalFormatError('The code is missing connection details', 'noConnectionDetails');
		}

		return { type, sdp: rebuild(fields) };
	}
}

export const syncSignal = new SyncSignal();
