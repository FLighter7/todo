import { Status, parseDream, type Dream, type DreamDraft } from '@/types';
import { ItemDbRepository } from '@/repositories/ItemDbRepository';
import { defineEntityStore } from './createEntityStore';

export const useDreamsStore = defineEntityStore<Dream, DreamDraft>({
	id: 'dreams',
	createRepository: () => ItemDbRepository.create('dreams', parseDream),
	build: (draft, id, now) => ({
		id,
		name: draft.name,
		note: draft.note,
		created: now,
		updated: now,
		status: Status.Opened,
	}),
});
