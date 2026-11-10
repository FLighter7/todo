// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { sectionColorFor } from '@/plugins/theme';
import type { Hex } from '@/types';
import SectionColorSummary from '../SectionColorSummary.vue';

function mountSummary(color?: Hex, paintItems?: boolean) {
	return mount(SectionColorSummary, {
		props: { color, paintItems },
		global: { plugins: [vuetify, i18n] },
	});
}

/** The line as it reads: the dot between the label and the name leaves a space either side. */
function line(wrapper: ReturnType<typeof mountSummary>): string {
	return wrapper.text().replace(/\s+/g, ' ');
}

describe('SectionColorSummary', () => {
	it('says nothing without a colour', () => {
		expect(mountSummary().text()).toBe('');
	});

	it('names a swatch, and says when the text inside takes it too', () => {
		expect(line(mountSummary('#1E6FD9'))).toBe('Colour: Blue');
		expect(line(mountSummary('#1e6fd9', true))).toBe('Colour: Blue, text inside too');
	});

	it('calls a colour picked by hand a custom one, and shows it as a section draws it', () => {
		const wrapper = mountSummary('#123456');

		expect(line(wrapper)).toBe('Colour: Custom colour');
		expect(wrapper.get('[aria-hidden="true"]').attributes('style')).toContain(
			sectionColorFor('standard', 'light', '#123456'),
		);
	});
});
