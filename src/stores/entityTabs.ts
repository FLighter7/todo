import { ref } from 'vue';
import { defineStore } from 'pinia';

/**
 * Which Active/History tab is selected -- one value shared by Tasks, Goals
 * and Dreams, not one per page: switching to History on one switches all
 * three. Lives in a store (not local to a page container) so DefaultLayout
 * can render the toggle itself -- it lives in the app bar's extension row,
 * outside whatever RouterView mounts, and there is no way to pass state the
 * other way, from a routed page component back up into its layout.
 */
export const useEntityTabsStore = defineStore('entityTabs', () => {
	const tab = ref<'active' | 'history'>('active');

	return { tab };
});
