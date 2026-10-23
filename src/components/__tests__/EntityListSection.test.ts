// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import EntityListSection from '../EntityListSection.vue';

describe('EntityListSection', () => {
	it('renders the label in a legend and the slot content inside a fieldset', () => {
		const wrapper = mount(EntityListSection, {
			props: { label: 'Visit Japan' },
			slots: { default: '<p>Learn Japanese</p>' },
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.find('fieldset').exists()).toBe(true);
		expect(wrapper.find('legend').text()).toBe('Visit Japan');
		expect(wrapper.text()).toContain('Learn Japanese');
	});
});
