import { computed, ref, shallowRef, type ComputedRef, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Status, type ItemBase } from '@/types';
import { useSettingsStore, type SettingsEntity } from '@/stores/settings';

export interface ToggleableStore<T extends ItemBase> {
	records: T[];
	close: (id: string, status: Status.Done | Status.Cancelled) => Promise<void>;
	reopen: (id: string) => Promise<void>;
}

export interface UseToggleConfirm {
	toggleConfirmOpen: Ref<boolean>;
	toggleConfirmTitle: ComputedRef<string>;
	toggleConfirmBody: ComputedRef<string>;
	toggleConfirmActions: ComputedRef<Array<{ key: string; label: string; color?: string }>>;
	onToggle: (id: string) => void;
	onToggleChoice: (key: string) => Promise<void>;
}

/**
 * The Done/Reopen confirm flow shared by every page's list container --
 * `DreamList.vue`, `GoalList.vue`, `GroupList.vue`, `TaskList.vue`. `markingDone` is derived
 * from which tab is active, not from the raw boolean `EntityList` emits: a
 * Cancelled record's checkbox reads unchecked, same as a Done one's, so
 * checking it while on the History tab must mean "reopen", never "mark
 * done" -- the bug commit 941ccc5 fixed for Dream/Goal.
 */
export function useToggleConfirm<T extends ItemBase>(
	store: ToggleableStore<T>,
	settingsEntity: SettingsEntity,
	tab: Ref<'active' | 'history'>,
): UseToggleConfirm {
	const settings = useSettingsStore();
	const { t } = useI18n();

	const pendingToggle = shallowRef<{ record: T; done: boolean } | null>(null);
	const toggleConfirmOpen = ref(false);

	const toggleConfirmTitle = computed(() =>
		pendingToggle.value?.done ? t('entity.confirmDoneTitle') : t('entity.confirmReopenTitle'),
	);
	const toggleConfirmBody = computed(() => {
		const pending = pendingToggle.value;
		if (!pending) {
			return '';
		}

		return pending.done
			? t('entity.confirmDoneBody', { name: pending.record.name })
			: t('entity.confirmReopenBody', { name: pending.record.name });
	});
	const toggleConfirmActions = computed(() => [
		{ key: 'no', label: t('form.cancel') },
		{ key: 'yes', label: t('entity.confirm'), color: 'primary' },
	]);

	async function applyToggle(record: T, done: boolean): Promise<void> {
		if (done) {
			await store.close(record.id, Status.Done);
		} else {
			await store.reopen(record.id);
		}
	}

	function onToggle(id: string): void {
		const record = store.records.find((candidate) => candidate.id === id);
		if (!record) {
			return;
		}

		const markingDone = tab.value === 'active';
		const needsConfirm = markingDone
			? settings[settingsEntity].confirmDone
			: settings[settingsEntity].confirmReopen;

		if (!needsConfirm) {
			void applyToggle(record, markingDone);
			return;
		}

		pendingToggle.value = { record, done: markingDone };
		toggleConfirmOpen.value = true;
	}

	async function onToggleChoice(key: string): Promise<void> {
		const pending = pendingToggle.value;
		pendingToggle.value = null;
		if (key !== 'yes' || !pending) {
			return;
		}

		await applyToggle(pending.record, pending.done);
	}

	return {
		toggleConfirmOpen,
		toggleConfirmTitle,
		toggleConfirmBody,
		toggleConfirmActions,
		onToggle,
		onToggleChoice,
	};
}
