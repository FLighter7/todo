// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { sectionColorFor } from '@/plugins/theme';
import type { Hex } from '@/types';
import EntityListSection from '../EntityListSection.vue';

/** The CSS module's own classes, by the name in the source rather than the hashed one. */
function styles(wrapper: ReturnType<typeof mountSection>): string[] {
	return wrapper
		.get('fieldset')
		.classes()
		.map((name) => name.replace(/^_(\w+)_\w+$/, '$1'));
}

function mountSection(props: { color?: Hex; paintItems?: boolean } = {}) {
	return mount(EntityListSection, {
		props: { label: 'Visit Japan', ...props },
		slots: { default: '<p>Learn Japanese</p>' },
		global: { plugins: [vuetify, i18n] },
	});
}

describe('EntityListSection', () => {
	it('renders the label in a legend and the slot content inside a fieldset', () => {
		const wrapper = mountSection();

		expect(wrapper.find('fieldset').exists()).toBe(true);
		expect(wrapper.find('legend').text()).toBe('Visit Japan');
		expect(wrapper.text()).toContain('Learn Japanese');
	});

	it('stays the palette grey without a colour of its own', () => {
		const wrapper = mountSection();

		expect(wrapper.get('fieldset').attributes('style')).toBeUndefined();
		expect(styles(wrapper)).toEqual(['section']);
	});

	it('draws a colour as the palette on screen needs it', () => {
		const wrapper = mountSection({ color: '#EF6C00' });

		expect(wrapper.get('fieldset').attributes('style')).toContain(
			`--section-color: ${sectionColorFor('standard', 'light', '#EF6C00')}`,
		);
		expect(styles(wrapper)).toEqual(['section', 'colored']);
	});

	it('paints the rows only with a colour, and only when asked to', () => {
		expect(styles(mountSection({ color: '#EF6C00', paintItems: true }))).toEqual([
			'section',
			'colored',
			'painted',
		]);
		expect(styles(mountSection({ paintItems: true }))).toEqual(['section']);
	});
});
