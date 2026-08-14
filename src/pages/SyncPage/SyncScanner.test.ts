// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import SyncScanner from './SyncScanner.vue';

// vi.mock's factory is hoisted above regular imports, so it runs before any
// plain top-level `const` in this file would be initialized. Values the
// factory needs to close over must come from vi.hoisted() instead, which is
// hoisted together with vi.mock rather than left behind by it.
const { start, destroy, scannerState, QrScannerMock } = vi.hoisted(() => {
	const start = vi.fn(async () => {
		return undefined;
	});
	const destroy = vi.fn(() => {
		return undefined;
	});
	const scannerState = { onDecode: null as ((result: { data: string }) => void) | null };

	const QrScannerMock = vi.fn(function (
		_video: HTMLVideoElement,
		onDecode: (result: { data: string }) => void,
		_options?: Record<string, unknown>,
	) {
		scannerState.onDecode = onDecode;
		return { start, destroy };
	});

	return { start, destroy, scannerState, QrScannerMock };
});

vi.mock('qr-scanner', () => ({
	default: QrScannerMock,
}));

beforeEach(() => {
	start.mockReset();
	destroy.mockReset();
	scannerState.onDecode = null;
});

describe('SyncScanner camera path', () => {
	it('emits code when the scanner decodes a frame', async () => {
		start.mockResolvedValue(undefined);

		const wrapper = mount(SyncScanner, { global: { plugins: [vuetify, i18n] } });
		await flushPromises();

		expect(wrapper.text()).not.toContain('camera is unavailable');
		scannerState.onDecode?.({ data: '1oc.scanned' });

		expect(wrapper.emitted('code')).toEqual([['1oc.scanned']]);
	});

	it('falls back to the paste UI when the camera fails to start', async () => {
		start.mockRejectedValue(new Error('no camera'));

		const wrapper = mount(SyncScanner, { global: { plugins: [vuetify, i18n] } });
		await flushPromises();

		expect(wrapper.text()).toContain('camera is unavailable');
		expect(destroy).toHaveBeenCalled();
	});
});

describe('SyncScanner paste path', () => {
	it('emits the trimmed pasted code and clears the field', async () => {
		start.mockResolvedValue(undefined);

		const wrapper = mount(SyncScanner, { global: { plugins: [vuetify, i18n] } });
		await flushPromises();

		await wrapper.get('textarea').setValue('  1oc.pasted  ');
		await clickButtonByText(wrapper, 'Use this code');

		expect(wrapper.emitted('code')).toEqual([['1oc.pasted']]);
		expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('');
	});

	it('disables the submit button while the field is empty', async () => {
		start.mockResolvedValue(undefined);

		const wrapper = mount(SyncScanner, { global: { plugins: [vuetify, i18n] } });
		await flushPromises();

		const button = wrapper
			.findAll('button')
			.find((candidate) => candidate.text().includes('Use this code'));

		expect(button?.attributes('disabled')).toBeDefined();
	});
});
