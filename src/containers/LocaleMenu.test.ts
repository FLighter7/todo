// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import LocaleMenu from './LocaleMenu.vue';

function openMenu(wrapper: VueWrapper): Promise<void> {
	// The trigger's aria-label is localized, so it can't be used as a
	// locale-independent selector -- the component renders exactly one
	// <button> before the dialog opens.
	return wrapper.get('button').trigger('click');
}

beforeEach(() => {
	window.localStorage.clear();
	i18n.global.locale.value = 'en';
});

describe('LocaleMenu', () => {
	it('lists the options in order: English, Русский, Polski', async () => {
		const wrapper = mount(LocaleMenu, { global: { plugins: [vuetify, i18n] } });

		await openMenu(wrapper);

		const labels = wrapper
			.findAll('.v-list-item')
			.map((item) => item.text())
			.filter((text) => text.length > 0);

		expect(labels).toEqual(['English', 'Русский', 'Polski']);
	});

	it('shows each language with its flag', async () => {
		const wrapper = mount(LocaleMenu, { global: { plugins: [vuetify, i18n] } });

		await openMenu(wrapper);

		const items = wrapper.findAllComponents({ name: 'VListItem' });
		const flagSrc = (label: string) =>
			items.find((item) => item.text().includes(label))?.find('img').attributes('src');

		expect(flagSrc('English')).toContain('us');
		expect(flagSrc('Русский')).toContain('ru');
		expect(flagSrc('Polski')).toContain('pl');
	});

	it('marks the currently active locale with a checkmark', async () => {
		i18n.global.locale.value = 'ru';
		const wrapper = mount(LocaleMenu, { global: { plugins: [vuetify, i18n] } });

		await openMenu(wrapper);

		const items = wrapper.findAllComponents({ name: 'VListItem' });
		const ru = items.find((item) => item.text().includes('Русский'));
		const en = items.find((item) => item.text().includes('English'));

		expect(ru?.props('appendIcon')).toBeTruthy();
		expect(en?.props('appendIcon')).toBeFalsy();
	});

	it('applies and persists the chosen locale, closing the dialog', async () => {
		const wrapper = mount(LocaleMenu, { global: { plugins: [vuetify, i18n] } });

		await openMenu(wrapper);
		await clickButtonByText(wrapper, 'Polski');

		expect(i18n.global.locale.value).toBe('pl');
		expect(window.localStorage.getItem('todo.locale')).toBe('pl');
		expect(wrapper.find('.v-overlay--active').exists()).toBe(false);
	});
});
