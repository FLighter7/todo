import { computed, type ComputedRef } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ItemBase } from '@/types';
import { useSettingsStore, type SettingsEntity } from '@/stores/settings';
import { sortEntityRows, type EntityRow, type ListSection } from '@/utils/sortEntities';

/**
 * Shared wiring for `TaskList`/`GroupList`/`GoalList`/`DreamList`: each reads
 * its own page's `sortOrder` off `useSettingsStore()` and the active locale
 * off `useI18n()`, then hands both to `sortEntityRows`.
 */
export function useSortedEntityRows<T extends ItemBase>(
	sections: ComputedRef<ListSection<T>[]>,
	loose: ComputedRef<T[]>,
	settingsEntity: SettingsEntity,
): ComputedRef<EntityRow<T>[]> {
	const settings = useSettingsStore();
	const { locale } = useI18n();

	return computed(() =>
		sortEntityRows(sections.value, loose.value, settings[settingsEntity].sortOrder, locale.value),
	);
}
