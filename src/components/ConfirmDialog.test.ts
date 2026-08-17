// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import ConfirmDialog from './ConfirmDialog.vue';

function mountDialog(
	actions = [
		{ key: 'no', label: 'Keep it' },
		{ key: 'yes', label: 'Cancel it', color: 'error' },
	],
) {
	return mount(ConfirmDialog, {
		props: {
			modelValue: true,
			title: 'Cancel this branch?',
			body: 'Active tasks under this goal: 2.',
			actions,
		},
		global: { plugins: [vuetify, i18n] },
	});
}

describe('ConfirmDialog', () => {
	it('renders the title and body text', () => {
		const wrapper = mountDialog();

		expect(wrapper.text()).toContain('Cancel this branch?');
		expect(wrapper.text()).toContain('Active tasks under this goal: 2.');
	});

	it('renders one button per action, in order', () => {
		const wrapper = mountDialog();
		const buttons = wrapper.findAllComponents({ name: 'VBtn' });

		expect(buttons.map((b) => b.text())).toEqual(['Keep it', 'Cancel it']);
	});

	it('emits choose with the clicked action key and closes', async () => {
		const wrapper = mountDialog();

		await clickButtonByText(wrapper, 'Cancel it');

		expect(wrapper.emitted('choose')).toEqual([['yes']]);
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false]);
	});
});
