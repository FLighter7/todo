import { nextTick, ref } from 'vue';
import { defineStore } from 'pinia';

/**
 * What a screen reader should hear about a change that moves no focus: a page
 * opened, a record closed or saved, a notice. DefaultLayout renders `message`
 * in one live region that is in the page from the start, since a region created
 * together with its text, as Vuetify's snackbar is, often goes unannounced.
 */
export const useAnnouncerStore = defineStore('announcer', () => {
	const message = ref('');

	function announce(text: string): void {
		// Cleared first, so the same text twice in a row is still a change, and said again.
		message.value = '';
		void nextTick(() => {
			message.value = text;
		});
	}

	return { message, announce };
});
