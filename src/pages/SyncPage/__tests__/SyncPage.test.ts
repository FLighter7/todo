// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import ServerSyncPanel from '../containers/ServerSyncPanel.vue';
import SyncPage from '../SyncPage.vue';

beforeEach(() => {
	setActivePinia(createPinia());
});

describe('SyncPage', () => {
	it('shows the server panel and no tabs', () => {
		const wrapper = mount(SyncPage, {
			global: { plugins: [vuetify, i18n], stubs: { ServerSyncPanel: true } },
		});

		expect(wrapper.findComponent(ServerSyncPanel).exists()).toBe(true);
		expect(wrapper.findAllComponents({ name: 'VTab' })).toHaveLength(0);
	});
});
