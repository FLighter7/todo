// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import AddEntityDialog from '../AddEntityDialog.vue';

const dreamOptions = [{ value: 'dream-1', title: 'Visit Japan' }];
const goalOptions = [{ value: 'goal-1', title: 'Learn Japanese' }];
const groupOptions = [{ value: 'group-1', title: 'Errands' }];

function mountDialog(defaultTab: 'dream' | 'goal' | 'group' | 'task' = 'task') {
	return mount(AddEntityDialog, {
		props: { modelValue: true, defaultTab, dreamOptions, goalOptions, groupOptions },
		global: { plugins: [vuetify, i18n] },
	});
}

describe('AddEntityDialog default tab', () => {
	it('starts on the tab passed in as defaultTab', () => {
		const wrapper = mountDialog('goal');

		expect(wrapper.findComponent({ name: 'VTabs' }).props('modelValue')).toBe('goal');
	});
});

describe('AddEntityDialog with pages switched off', () => {
	function mountWith(
		shown: { showDream?: boolean; showGoal?: boolean; showGroup?: boolean; showTask?: boolean },
		defaultTab: 'dream' | 'goal' | 'group' | 'task' = 'task',
	) {
		return mount(AddEntityDialog, {
			props: { modelValue: true, defaultTab, dreamOptions, goalOptions, groupOptions, ...shown },
			global: { plugins: [vuetify, i18n] },
		});
	}

	function selectLabels(wrapper: VueWrapper): string[] {
		return wrapper.findAllComponents({ name: 'VSelect' }).map((select) => select.props('label'));
	}

	it('leaves out the tab of a hidden page', () => {
		const wrapper = mountWith({ showDream: false, showGroup: false });

		expect(wrapper.findAllComponents({ name: 'VTab' }).map((tab) => tab.text())).toEqual([
			'Goal',
			'Task',
		]);
	});

	it('shows no tab bar when only the task tab is left', () => {
		const wrapper = mountWith({ showDream: false, showGoal: false, showGroup: false });

		expect(wrapper.findComponent({ name: 'VTabs' }).exists()).toBe(false);
		expect(wrapper.get('input').attributes('type')).toBe('text');
	});

	it('opens on the task tab when the default one is hidden', () => {
		const wrapper = mountWith({ showGoal: false }, 'goal');

		expect(wrapper.findComponent({ name: 'VTabs' }).props('modelValue')).toBe('task');
	});

	it('leaves out the task tab, and then opens on the first tab left', () => {
		const wrapper = mountWith({ showDream: false, showTask: false });

		expect(wrapper.findAllComponents({ name: 'VTab' }).map((tab) => tab.text())).toEqual([
			'Goal',
			'Group',
		]);
		expect(wrapper.findComponent({ name: 'VTabs' }).props('modelValue')).toBe('goal');
	});

	it('shows no tab bar when only one other tab is left', () => {
		const wrapper = mountWith({ showDream: false, showGoal: false, showTask: false });

		expect(wrapper.findComponent({ name: 'VTabs' }).exists()).toBe(false);
		expect(wrapper.findAllComponents({ name: 'VSelect' })).toHaveLength(0);
	});

	it('leaves out the goal and group pickers on the task tab', async () => {
		const wrapper = mountWith({ showGoal: false, showGroup: false });

		expect(selectLabels(wrapper)).not.toContain('Goal');
		expect(selectLabels(wrapper)).not.toContain('Group');

		await wrapper.get('input').setValue('Buy stamps');
		await clickSave(wrapper);

		expect(wrapper.emitted('save-task')?.[0][0]).toMatchObject({
			goalId: undefined,
			groupId: undefined,
		});
	});

	it('leaves out the dream picker on the goal tab', () => {
		const wrapper = mountWith({ showDream: false }, 'goal');

		expect(selectLabels(wrapper)).not.toContain('Dream');
	});
});

function clickSave(wrapper: VueWrapper): Promise<void> {
	return wrapper.get('button[aria-label="Save"]').trigger('click');
}

function clickSaveAndNew(wrapper: VueWrapper): Promise<void> {
	return wrapper.get('button[aria-label="Save & New"]').trigger('click');
}

describe('AddEntityDialog saving a dream', () => {
	it('emits save-dream with a trimmed draft and closes', async () => {
		const wrapper = mountDialog('dream');

		await wrapper.get('input').setValue('  Visit Japan  ');
		await clickSave(wrapper);

		expect(wrapper.emitted('save-dream')).toEqual([[{ name: 'Visit Japan', note: undefined }]]);
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false]);
	});

	it('blocks save and shows an error when the dream name is empty', async () => {
		const wrapper = mountDialog('dream');

		await clickSave(wrapper);

		expect(wrapper.emitted('save-dream')).toBeUndefined();
		expect(wrapper.text()).toContain('Name is required');
	});
});

describe('AddEntityDialog saving a goal', () => {
	it('emits save-goal with the picked dream', async () => {
		const wrapper = mountDialog('goal');

		await wrapper.get('input').setValue('Learn Japanese');
		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		await select.vm.$emit('update:modelValue', 'dream-1');
		await clickSave(wrapper);

		expect(wrapper.emitted('save-goal')).toEqual([
			[{ name: 'Learn Japanese', note: undefined, dreamId: 'dream-1' }],
		]);
	});

	it('emits save-goal with a deadline when one is set', async () => {
		const wrapper = mountDialog('goal');

		await wrapper.get('input').setValue('Learn Japanese');
		await wrapper.get('input[type="checkbox"]').setValue(true);
		await wrapper.get('input[type="number"]').setValue('2027');
		await clickSave(wrapper);

		expect(wrapper.emitted('save-goal')).toEqual([
			[{ name: 'Learn Japanese', note: undefined, dreamId: undefined, deadline: { year: 2027 } }],
		]);
	});
});

describe('AddEntityDialog saving a group', () => {
	it('offers a name and a colour but no note, and emits save-group with a trimmed name', async () => {
		const wrapper = mountDialog('group');

		expect(wrapper.findAll('input[type="text"]')).toHaveLength(1);
		expect(wrapper.find('[role="radiogroup"]').exists()).toBe(true);
		expect(wrapper.find('textarea').exists()).toBe(false);

		await wrapper.get('input').setValue('  Errands  ');
		await clickSave(wrapper);

		expect(wrapper.emitted('save-group')).toEqual([[{ name: 'Errands' }]]);
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false]);
	});

	it('blocks save and shows an error when the group name is empty', async () => {
		const wrapper = mountDialog('group');

		await clickSave(wrapper);

		expect(wrapper.emitted('save-group')).toBeUndefined();
		expect(wrapper.text()).toContain('Name is required');
	});

	it('clears the name on save and new', async () => {
		const wrapper = mountDialog('group');

		await wrapper.get('input').setValue('Errands');
		await clickSaveAndNew(wrapper);

		expect(wrapper.emitted('save-group')).toEqual([[{ name: 'Errands' }]]);
		expect((wrapper.get('input').element as HTMLInputElement).value).toBe('');
	});
});

describe('AddEntityDialog saving a task', () => {
	it('emits save-task with the picked group next to the picked goal', async () => {
		const wrapper = mountDialog('task');

		await wrapper.get('input').setValue('Buy stamps');
		const [goalSelect, groupSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		await goalSelect.vm.$emit('update:modelValue', 'goal-1');
		await groupSelect.vm.$emit('update:modelValue', 'group-1');
		await clickSave(wrapper);

		expect(wrapper.emitted('save-task')?.[0][0]).toMatchObject({
			goalId: 'goal-1',
			groupId: 'group-1',
		});
	});

	it('emits save-task with flags and the picked goal', async () => {
		const wrapper = mountDialog('task');

		await wrapper.get('input').setValue('Do Duolingo');
		await wrapper.findAll('input[type="checkbox"]')[0].setValue(true); // important
		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		await select.vm.$emit('update:modelValue', 'goal-1');
		await clickSave(wrapper);

		expect(wrapper.emitted('save-task')).toEqual([
			[{ name: 'Do Duolingo', note: undefined, important: true, urgent: false, goalId: 'goal-1' }],
		]);
	});

	it('emits save-task with a schedule when one is set', async () => {
		const wrapper = mountDialog('task');

		await wrapper.get('input').setValue('Water plants');
		await wrapper.findAll('input[type="checkbox"]')[2].setValue(true); // has a schedule
		await wrapper.get('input[type="datetime-local"]').setValue('2026-08-21T09:00');
		await clickSave(wrapper);

		expect(wrapper.emitted('save-task')).toEqual([
			[
				{
					name: 'Water plants',
					note: undefined,
					important: false,
					urgent: false,
					goalId: undefined,
					schedule: {
						start: '2026-08-21T09:00',
						tzid: undefined,
						duration: undefined,
						rrule: undefined,
					},
				},
			],
		]);
	});
});

describe('AddEntityDialog colour', () => {
	/** The paint switch closes the form; the goal tab's deadline switch comes before it. */
	function paintSwitch(wrapper: VueWrapper) {
		return wrapper.findAll('input[type="checkbox"]').at(-1)!;
	}

	async function pickBlueAndPaint(wrapper: VueWrapper): Promise<void> {
		await wrapper.get('input[type="radio"][value="blue"]').setValue();
		await paintSwitch(wrapper).setValue(true);
	}

	it('emits the picked colour with a dream, a goal and a group', async () => {
		for (const tab of ['dream', 'goal', 'group'] as const) {
			const wrapper = mountDialog(tab);

			await wrapper.get('input').setValue('Named');
			await pickBlueAndPaint(wrapper);
			await clickSave(wrapper);

			expect(wrapper.emitted(`save-${tab}`)?.[0][0], tab).toMatchObject({
				color: '#1E6FD9',
				paintItems: true,
			});
		}
	});

	it('starts each opening on the default grey with the switch off', async () => {
		const wrapper = mountDialog('dream');
		await pickBlueAndPaint(wrapper);

		await wrapper.setProps({ modelValue: false });
		await wrapper.setProps({ modelValue: true });

		expect(
			(wrapper.get('input[type="radio"][value="default"]').element as HTMLInputElement).checked,
		).toBe(true);
		expect((paintSwitch(wrapper).element as HTMLInputElement).checked).toBe(false);
	});

	it('keeps the colour for the next entry on save and new', async () => {
		const wrapper = mountDialog('goal');

		await wrapper.get('input').setValue('Learn Japanese');
		await pickBlueAndPaint(wrapper);
		await clickSaveAndNew(wrapper);
		await wrapper.get('input').setValue('Pass JLPT N2');
		await clickSave(wrapper);

		expect(wrapper.emitted('save-goal')?.[1][0]).toMatchObject({
			color: '#1E6FD9',
			paintItems: true,
		});
	});
});

describe('AddEntityDialog tab switching', () => {
	it("preserves a tab's typed name after switching away and back", async () => {
		const wrapper = mountDialog('dream');

		await wrapper.get('input').setValue('Visit Japan');

		await clickButtonByText(wrapper, 'Task');
		await clickButtonByText(wrapper, 'Dream');

		expect((wrapper.get('input').element as HTMLInputElement).value).toBe('Visit Japan');
	});

	it("validates only the active tab's name", async () => {
		const wrapper = mountDialog('dream');

		await wrapper.get('input').setValue('Visit Japan');
		await clickButtonByText(wrapper, 'Task');
		await clickSave(wrapper);

		expect(wrapper.text()).toContain('Name is required');
		expect(wrapper.emitted('save-task')).toBeUndefined();
	});
});

describe('AddEntityDialog saving and starting a new one', () => {
	it('emits the save event without closing the dialog', async () => {
		const wrapper = mountDialog('dream');

		await wrapper.get('input').setValue('Visit Japan');
		await clickSaveAndNew(wrapper);

		expect(wrapper.emitted('save-dream')).toEqual([[{ name: 'Visit Japan', note: undefined }]]);
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
	});

	it('clears the name and note but keeps the other fields for the next entry', async () => {
		const wrapper = mountDialog('goal');

		await wrapper.get('input').setValue('Learn Japanese');
		await wrapper.get('textarea').setValue('Start with hiragana');
		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		await select.vm.$emit('update:modelValue', 'dream-1');
		await clickSaveAndNew(wrapper);

		expect((wrapper.get('input').element as HTMLInputElement).value).toBe('');
		expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('');

		await wrapper.get('input').setValue('Pass JLPT N2');
		await clickSave(wrapper);

		expect(wrapper.emitted('save-goal')).toEqual([
			[{ name: 'Learn Japanese', note: 'Start with hiragana', dreamId: 'dream-1' }],
			[{ name: 'Pass JLPT N2', note: undefined, dreamId: 'dream-1' }],
		]);
	});

	it('blocks and shows an error when the name is empty, without clearing note', async () => {
		const wrapper = mountDialog('task');

		await clickSaveAndNew(wrapper);

		expect(wrapper.emitted('save-task')).toBeUndefined();
		expect(wrapper.text()).toContain('Name is required');
	});
});

describe('AddEntityDialog close button', () => {
	it('closes the dialog without saving anything', async () => {
		const wrapper = mountDialog('task');

		await wrapper.get('button[aria-label="Close"]').trigger('click');

		expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
		expect(wrapper.emitted('save-task')).toBeUndefined();
	});
});
