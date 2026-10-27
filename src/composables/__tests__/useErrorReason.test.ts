// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { i18n } from '@/i18n';
import { BackupFormatError } from '@/services/backup/BackupService';
import { SyncError } from '@/services/sync/SyncConnection';
import { SignalFormatError } from '@/services/sync/SyncSignal';
import { useErrorReason } from '../useErrorReason';

function mountReason(): (error: unknown) => string {
	let reason: (error: unknown) => string = () => '';
	mount(
		defineComponent({
			setup() {
				reason = useErrorReason();
				return () => null;
			},
		}),
		{ global: { plugins: [i18n] } },
	);
	return reason;
}

afterEach(() => {
	i18n.global.locale.value = 'en';
	vi.restoreAllMocks();
});

describe('useErrorReason', () => {
	it('translates a backup error from its code, with its numbers', () => {
		i18n.global.locale.value = 'ru';
		const reason = mountReason();

		const error = new BackupFormatError('This app reads backup version 4 only', 'wrongVersion', {
			expected: 4,
			found: 5,
		});

		expect(reason(error)).toBe('это копия версии 5, а приложение читает только версию 4');
	});

	it('translates sync and pairing code errors from their codes', () => {
		i18n.global.locale.value = 'pl';
		const reason = mountReason();

		expect(reason(new SyncError('The other device sent nothing', 'sentNothing'))).toBe(
			'drugie urządzenie nic nie wysłało',
		);
		expect(reason(new SignalFormatError('The code is damaged', 'damaged'))).toBe(
			'kod jest uszkodzony',
		);
	});

	it('gives any other error a general reason and logs the error itself', () => {
		const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
		const reason = mountReason();
		const error = new DOMException('The operation is insecure.');

		expect(reason(error)).toBe('something unexpected went wrong');
		expect(logged).toHaveBeenCalledWith(error);
	});
});
