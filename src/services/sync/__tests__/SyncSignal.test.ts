import { describe, expect, it } from 'vitest';
import { SignalFormatError, SyncSignal } from '../SyncSignal';

// A real offer captured from Chromium: data channel only, no ICE servers.
const OFFER_SDP = [
	'v=0',
	'o=- 8035900643094450347 2 IN IP4 127.0.0.1',
	's=-',
	't=0 0',
	'a=group:BUNDLE 0',
	'a=extmap-allow-mixed',
	'a=msid-semantic: WMS',
	'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
	'c=IN IP4 0.0.0.0',
	'a=candidate:1779541748 1 udp 2113937151 985474cd-5ecf-4dd0-a480-e27e3c60c0ff.local 59305 typ host generation 0 network-cost 999',
	'a=ice-ufrag:iyHk',
	'a=ice-pwd:9/jC2urxOBBe3WTcfXy/bme8',
	'a=ice-options:trickle',
	'a=fingerprint:sha-256 8A:ED:C6:E1:5B:81:42:19:D5:16:9A:E2:A7:63:81:F2:6B:75:63:B4:DE:99:7A:62:40:8E:0D:C0:AF:19:53:90',
	'a=setup:actpass',
	'a=mid:0',
	'a=sctp-port:5000',
	'a=max-message-size:262144',
	'',
].join('\r\n');

const ANSWER_SDP = OFFER_SDP.replace('a=setup:actpass', 'a=setup:active');

function fieldsOf(sdp: string) {
	return {
		ufrag: /a=ice-ufrag:(\S+)/.exec(sdp)?.[1],
		pwd: /a=ice-pwd:(\S+)/.exec(sdp)?.[1],
		fingerprint: /a=fingerprint:\S+ (\S+)/.exec(sdp)?.[1],
		host: /a=candidate:\S+ \d+ \S+ \d+ (\S+) (\d+) typ host/.exec(sdp)?.slice(1),
	};
}

const signal = new SyncSignal();

describe('SyncSignal.encode', () => {
	it('produces a compact payload for an ordinary offer', () => {
		const encoded = signal.encode({ type: 'offer', sdp: OFFER_SDP });

		expect(encoded.startsWith('1oc.')).toBe(true);
		expect(encoded.length).toBeLessThan(320);
	});

	it('marks an answer differently from an offer', () => {
		const offer = signal.encode({ type: 'offer', sdp: OFFER_SDP });
		const answer = signal.encode({ type: 'answer', sdp: ANSWER_SDP });

		expect(offer[1]).toBe('o');
		expect(answer[1]).toBe('a');
	});

	it('falls back to the full mode when the sdp cannot be reduced', () => {
		const encoded = signal.encode({ type: 'offer', sdp: 'v=0\r\nnothing useful here\r\n' });

		expect(encoded.startsWith('1of.')).toBe(true);
	});
});

describe('SyncSignal.decode', () => {
	it('round-trips the fields that matter for an offer', () => {
		const decoded = signal.decode(signal.encode({ type: 'offer', sdp: OFFER_SDP }));

		expect(decoded.type).toBe('offer');
		expect(fieldsOf(decoded.sdp)).toEqual(fieldsOf(OFFER_SDP));
	});

	it('round-trips an answer and keeps its setup role', () => {
		const decoded = signal.decode(signal.encode({ type: 'answer', sdp: ANSWER_SDP }));

		expect(decoded.type).toBe('answer');
		expect(decoded.sdp).toContain('a=setup:active');
	});

	it('rebuilds an sdp that still looks like one', () => {
		const decoded = signal.decode(signal.encode({ type: 'offer', sdp: OFFER_SDP }));

		expect(decoded.sdp.startsWith('v=0')).toBe(true);
		expect(decoded.sdp).toContain('m=application 9 UDP/DTLS/SCTP webrtc-datachannel');
		expect(decoded.sdp).toContain('a=sctp-port:5000');
	});

	it('round-trips through the full mode as well', () => {
		const odd = 'v=0\r\nnothing useful here\r\n';

		expect(signal.decode(signal.encode({ type: 'offer', sdp: odd })).sdp).toBe(odd);
	});

	it('rejects an empty string', () => {
		expect(() => signal.decode('')).toThrow(SignalFormatError);
	});

	it('rejects text that is not a signal at all', () => {
		expect(() => signal.decode('https://example.com')).toThrow(SignalFormatError);
	});

	it('rejects a newer format version', () => {
		expect(() => signal.decode('9oc.eyJ9')).toThrow(/newer/i);
	});

	it('rejects an unknown mode', () => {
		expect(() => signal.decode('1oz.eyJ9')).toThrow(SignalFormatError);
	});

	it('rejects a damaged payload instead of returning nonsense', () => {
		const encoded = signal.encode({ type: 'offer', sdp: OFFER_SDP });
		const damaged = encoded.slice(0, -6);

		expect(() => signal.decode(damaged)).toThrow(SignalFormatError);
	});

	it('trims surrounding whitespace so pasted text works', () => {
		const encoded = signal.encode({ type: 'offer', sdp: OFFER_SDP });

		expect(signal.decode(`  ${encoded}\n`).type).toBe('offer');
	});
});
