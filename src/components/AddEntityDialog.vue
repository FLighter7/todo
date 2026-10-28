<style lang="scss" module>
// The dialog's card is a flex column, and a form taller than the screen (the task
// tab at a large text size) would otherwise squeeze the tab bar to nothing.
.tabs {
	flex-shrink: 0;

	// Four tabs share a phone-width dialog, and Vuetify's 90px minimum per tab would
	// scroll the first one out of view. They split the width by their own labels
	// instead, and scroll only once a large text size leaves no room for all four.
	:global(.v-tab.v-tab.v-btn) {
		min-width: 0;
		padding-inline: 0.5rem;
	}
}

// Wraps rather than squeezing a label mid-word when large text leaves no room
// for both switches on one line.
.flags {
	display: flex;
	flex-wrap: wrap;
	column-gap: 1.5rem;
}

.saveAndNewIcon {
	display: inline-flex;
	position: relative;
}

.saveAndNewBadge {
	bottom: -4px;
	position: absolute;
	right: -4px;
}
</style>

<template>
	<VDialog v-model="open" max-width="480" :aria-label="t('form.addTitle')">
		<VCard variant="elevated">
			<VCardActions>
				<!-- Escape, the scrim and Back close it too, but a touch screen reader user
				needs something to find. -->
				<VBtn :icon="mdiClose" variant="text" :aria-label="t('form.close')" @click="open = false" />
				<VSpacer />
				<VBtn icon variant="text" :aria-label="t('form.saveAndNew')" @click="onSaveAndNew">
					<span :class="$style.saveAndNewIcon">
						<VIcon :icon="mdiCheck" />
						<VIcon :icon="mdiPlusThick" size="16" :class="$style.saveAndNewBadge" />
					</span>
				</VBtn>
				<VBtn :icon="mdiCheck" variant="text" :aria-label="t('form.save')" @click="onSave" />
			</VCardActions>

			<!-- A lone tab needs no tab bar. -->
			<VTabs
				v-if="visibleTabs.length > 1"
				v-model="activeTab"
				color="primary"
				grow
				show-arrows
				:class="$style.tabs"
			>
				<VTab v-for="tab in visibleTabs" :key="tab" :value="tab">{{ t(`${tab}.title`) }}</VTab>
			</VTabs>

			<VCardText>
				<template v-if="activeTab === 'dream'">
					<VTextField
						ref="nameField"
						v-model="dreamName"
						:label="t('entity.nameField')"
						:error-messages="dreamNameError"
						autofocus
					/>
					<VTextarea v-model="dreamNote" :label="t('entity.note')" rows="3" />
					<SectionColorField v-model:color="dreamColor" v-model:paint-items="dreamPaintItems" />
				</template>

				<template v-else-if="activeTab === 'goal'">
					<VTextField
						ref="nameField"
						v-model="goalName"
						:label="t('entity.nameField')"
						:error-messages="goalNameError"
						autofocus
					/>
					<VTextarea v-model="goalNote" :label="t('entity.note')" rows="3" />
					<VSelect
						v-if="showDream"
						v-model="goalDreamId"
						:items="goalDreamSelectItems"
						item-title="title"
						item-value="value"
						:label="t('goal.dreamLabel')"
					/>
					<DeadlineField v-model="goalDeadline" />
					<SectionColorField v-model:color="goalColor" v-model:paint-items="goalPaintItems" />
				</template>

				<template v-else-if="activeTab === 'group'">
					<VTextField
						ref="nameField"
						v-model="groupName"
						:label="t('entity.nameField')"
						:error-messages="groupNameError"
						autofocus
					/>
					<SectionColorField v-model:color="groupColor" v-model:paint-items="groupPaintItems" />
				</template>

				<template v-else>
					<VTextField
						ref="nameField"
						v-model="taskName"
						:label="t('entity.nameField')"
						:error-messages="taskNameError"
						autofocus
					/>
					<VTextarea v-model="taskNote" :label="t('entity.note')" rows="3" />
					<div :class="$style.flags">
						<VSwitch
							v-model="taskImportant"
							:label="t('task.important')"
							color="primary"
							hide-details
						/>
						<VSwitch v-model="taskUrgent" :label="t('task.urgent')" color="primary" hide-details />
					</div>
					<VSelect
						v-if="showGoal"
						v-model="taskGoalId"
						:items="taskGoalSelectItems"
						item-title="title"
						item-value="value"
						:label="t('task.goalLabel')"
					/>
					<VSelect
						v-if="showGroup"
						v-model="taskGroupId"
						:items="taskGroupSelectItems"
						item-title="title"
						item-value="value"
						:label="t('task.groupLabel')"
					/>
					<ScheduleField v-model="taskSchedule" />
				</template>
			</VCardText>
		</VCard>
	</VDialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiCheck, mdiClose, mdiPlusThick } from '@mdi/js';
import DeadlineField from './DeadlineField.vue';
import ScheduleField from './ScheduleField.vue';
import SectionColorField from './SectionColorField.vue';
import { useReturnFocus } from '@/composables/useKeepFocus';
import type {
	Deadline,
	DreamDraft,
	GoalDraft,
	GroupDraft,
	Hex,
	Schedule,
	TaskDraft,
} from '@/types';

const TABS = ['dream', 'goal', 'group', 'task'] as const;
type AddTab = (typeof TABS)[number];

const props = withDefaults(
	defineProps<{
		defaultTab: AddTab;
		dreamOptions: Array<{ value: string; title: string }>;
		goalOptions: Array<{ value: string; title: string }>;
		groupOptions: Array<{ value: string; title: string }>;
		/**
		 * False while that page is switched off in Settings: its tab goes, and so
		 * does its picker on the other tabs. Tasks show on two pages, Tasks and the
		 * matrix, so the task tab goes only when both are off.
		 */
		showDream?: boolean;
		showGoal?: boolean;
		showGroup?: boolean;
		showTask?: boolean;
	}>(),
	{ showDream: true, showGoal: true, showGroup: true, showTask: true },
);

const emit = defineEmits<{
	'save-dream': [draft: DreamDraft];
	'save-goal': [draft: GoalDraft];
	'save-group': [draft: GroupDraft];
	'save-task': [draft: TaskDraft];
}>();

const open = defineModel<boolean>({ required: true });

const { t } = useI18n();

useReturnFocus(open);

const visibleTabs = computed(() => {
	const shown: Record<AddTab, boolean> = {
		dream: props.showDream,
		goal: props.showGoal,
		group: props.showGroup,
		task: props.showTask,
	};
	return TABS.filter((tab) => shown[tab]);
});

/** The default tab when it is shown, otherwise the task tab, otherwise the first one left. */
function openingTab(): AddTab {
	if (visibleTabs.value.includes(props.defaultTab)) {
		return props.defaultTab;
	}

	return visibleTabs.value.includes('task') ? 'task' : (visibleTabs.value[0] ?? 'task');
}

const activeTab = ref<AddTab>(openingTab());
const showErrors = ref(false);
const nameField = useTemplateRef<{ focus: () => void }>('nameField');

const dreamName = ref('');
const dreamNote = ref('');
const dreamColor = ref<Hex | undefined>(undefined);
const dreamPaintItems = ref(false);

const goalName = ref('');
const goalNote = ref('');
const goalDreamId = ref('');
const goalDeadline = ref<Deadline | undefined>(undefined);
const goalColor = ref<Hex | undefined>(undefined);
const goalPaintItems = ref(false);

const groupName = ref('');
const groupColor = ref<Hex | undefined>(undefined);
const groupPaintItems = ref(false);

const taskName = ref('');
const taskNote = ref('');
const taskImportant = ref(false);
const taskUrgent = ref(false);
const taskGoalId = ref('');
const taskGroupId = ref('');
const taskSchedule = ref<Schedule | undefined>(undefined);

const goalDreamSelectItems = computed(() => [
	{ value: '', title: t('goal.noDream') },
	...props.dreamOptions,
]);
const taskGoalSelectItems = computed(() => [
	{ value: '', title: t('task.noGoal') },
	...props.goalOptions,
]);
const taskGroupSelectItems = computed(() => [
	{ value: '', title: t('task.noGroup') },
	...props.groupOptions,
]);

const dreamNameError = computed(() =>
	showErrors.value && dreamName.value.trim() === '' ? t('form.nameRequired') : '',
);
const goalNameError = computed(() =>
	showErrors.value && goalName.value.trim() === '' ? t('form.nameRequired') : '',
);
const groupNameError = computed(() =>
	showErrors.value && groupName.value.trim() === '' ? t('form.nameRequired') : '',
);
const taskNameError = computed(() =>
	showErrors.value && taskName.value.trim() === '' ? t('form.nameRequired') : '',
);

watch(open, (isOpen) => {
	if (!isOpen) {
		return;
	}

	activeTab.value = openingTab();
	showErrors.value = false;
	dreamName.value = '';
	dreamNote.value = '';
	dreamColor.value = undefined;
	dreamPaintItems.value = false;
	goalName.value = '';
	goalNote.value = '';
	goalDreamId.value = '';
	goalDeadline.value = undefined;
	goalColor.value = undefined;
	goalPaintItems.value = false;
	groupName.value = '';
	groupColor.value = undefined;
	groupPaintItems.value = false;
	taskName.value = '';
	taskNote.value = '';
	taskImportant.value = false;
	taskUrgent.value = false;
	taskGoalId.value = '';
	taskGroupId.value = '';
	taskSchedule.value = undefined;
});

/** Stored only while it says something: with a colour, and on. */
function paintsItems(color: Hex | undefined, paint: boolean): true | undefined {
	return color !== undefined && paint ? true : undefined;
}

function trySave(): boolean {
	if (activeTab.value === 'dream') {
		if (dreamName.value.trim() === '') {
			showErrors.value = true;
			return false;
		}

		const trimmedNote = dreamNote.value.trim();
		emit('save-dream', {
			name: dreamName.value.trim(),
			note: trimmedNote === '' ? undefined : trimmedNote,
			color: dreamColor.value,
			paintItems: paintsItems(dreamColor.value, dreamPaintItems.value),
		});
		return true;
	}

	if (activeTab.value === 'goal') {
		if (goalName.value.trim() === '') {
			showErrors.value = true;
			return false;
		}

		const trimmedNote = goalNote.value.trim();
		emit('save-goal', {
			name: goalName.value.trim(),
			note: trimmedNote === '' ? undefined : trimmedNote,
			dreamId: goalDreamId.value === '' ? undefined : goalDreamId.value,
			deadline: goalDeadline.value,
			color: goalColor.value,
			paintItems: paintsItems(goalColor.value, goalPaintItems.value),
		});
		return true;
	}

	if (activeTab.value === 'group') {
		if (groupName.value.trim() === '') {
			showErrors.value = true;
			return false;
		}

		emit('save-group', {
			name: groupName.value.trim(),
			color: groupColor.value,
			paintItems: paintsItems(groupColor.value, groupPaintItems.value),
		});
		return true;
	}

	if (taskName.value.trim() === '') {
		showErrors.value = true;
		return false;
	}

	const trimmedNote = taskNote.value.trim();
	emit('save-task', {
		name: taskName.value.trim(),
		note: trimmedNote === '' ? undefined : trimmedNote,
		important: taskImportant.value,
		urgent: taskUrgent.value,
		goalId: taskGoalId.value === '' ? undefined : taskGoalId.value,
		groupId: taskGroupId.value === '' ? undefined : taskGroupId.value,
		schedule: taskSchedule.value,
	});
	return true;
}

function onSave(): void {
	if (trySave()) {
		open.value = false;
	}
}

function onSaveAndNew(): void {
	if (!trySave()) {
		return;
	}

	showErrors.value = false;
	if (activeTab.value === 'dream') {
		dreamName.value = '';
		dreamNote.value = '';
	} else if (activeTab.value === 'goal') {
		goalName.value = '';
		goalNote.value = '';
	} else if (activeTab.value === 'group') {
		groupName.value = '';
	} else {
		taskName.value = '';
		taskNote.value = '';
	}

	void nextTick(() => nameField.value?.focus());
}
</script>
