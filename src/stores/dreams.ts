import { Status, parseDream, type Dream, type DreamDraft } from '@/types';
import { EntityDbRepository } from '@/repositories/EntityDbRepository';
import { defineEntityStore } from './createEntityStore';

export const useDreamsStore = defineEntityStore<Dream, DreamDraft>({
	id: 'dreams',
	createRepository: () => EntityDbRepository.create('dreams', parseDream),
	build: (draft, id, now) => ({
		id,
		name: draft.name,
		note: draft.note,
		created: now,
		updated: now,
		status: Status.Opened,
	}),
});
