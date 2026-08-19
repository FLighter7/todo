// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import QRCode from 'qrcode';
import SyncCode from '../SyncCode.vue';

vi.mock('qrcode', () => ({
	default: { toCanvas: vi.fn().mockResolvedValue(undefined) },
}));

const toCanvas = vi.mocked(QRCode.toCanvas);
const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
	toCanvas.mockClear();
	writeText.mockClear();
	Object.defineProperty(navigator, 'clipboard', {
		value: { writeText },
		configurable: true,
	});
});

describe('SyncCode', () => {
	it('draws the given code onto the canvas on mount', () => {
		mount(SyncCode, { props: { code: '1oc.example' }, global: { plugins: [vuetify, i18n] } });

		expect(toCanvas).toHaveBeenCalledWith(
			expect.any(HTMLCanvasElement),
			'1oc.example',
			expect.objectContaining({ errorCorrectionLevel: 'L' }),
		);
	});

	it('redraws when the code prop changes', async () => {
		const wrapper = mount(SyncCode, {
			props: { code: '1oc.first' },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.setProps({ code: '1oc.second' });

		expect(toCanvas).toHaveBeenLastCalledWith(
			expect.any(HTMLCanvasElement),
			'1oc.second',
			expect.anything(),
		);
	});

	it('copies the code and emits copied when the button is clicked', async () => {
		const wrapper = mount(SyncCode, {
			props: { code: '1oc.example' },
			global: { plugins: [vuetify, i18n] },
		});

		await clickButtonByText(wrapper, 'Copy code');

		expect(writeText).toHaveBeenCalledWith('1oc.example');
		expect(wrapper.emitted('copied')).toHaveLength(1);
	});
});
