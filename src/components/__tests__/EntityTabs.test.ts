// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import EntityTabs from '../EntityTabs.vue';

function mountTabs(modelValue: 'active' | 'history' = 'active') {
	return mount(EntityTabs, {
		props: { modelValue },
		global: { plugins: [vuetify, i18n] },
	});
}

describe('EntityTabs', () => {
	it('renders both labels', () => {
		const wrapper = mountTabs();

		expect(wrapper.text()).toContain('Active');
		expect(wrapper.text()).toContain('History');
	});

	it('emits update:modelValue with the clicked tab', async () => {
		const wrapper = mountTabs('active');

		await clickButtonByText(wrapper, 'History');

		expect(wrapper.emitted('update:modelValue')).toEqual([['history']]);
	});
});
