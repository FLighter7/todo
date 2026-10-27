import { nextTick, onBeforeUpdate, onUpdated, watch, type Ref } from 'vue';

/** Every list row the pages draw, in document order. */
const ROWS = 'main [role="listitem"]';

/** Where the focus was, and its row's place, for when the element itself is gone. */
interface FocusAnchor {
	element: HTMLElement;
	/** Its row's index among every row on the page, or -1 outside a row. */
	row: number;
}

function anchorOf(element: Element | null): FocusAnchor | null {
	if (!(element instanceof HTMLElement) || element === document.body) {
		return null;
	}

	const row = element.closest(ROWS);
	return {
		element,
		row: row === null ? -1 : [...document.querySelectorAll(ROWS)].indexOf(row),
	};
}

/**
 * Focuses the row that took the place of row `index`, or the last one, or with
 * no rows left the page's heading: never the document body, where a keyboard or
 * screen reader user would have to start the page over.
 */
function focusRowAt(index: number): void {
	const rows = document.querySelectorAll<HTMLElement>(ROWS);
	const row = rows[Math.min(index, rows.length - 1)];
	const target = row?.querySelector<HTMLElement>('input, button') ?? document.querySelector('h1');
	(target as HTMLElement | null)?.focus();
}

function restore(anchor: FocusAnchor | null): void {
	if (anchor === null) {
		return;
	}

	if (anchor.element.isConnected) {
		anchor.element.focus();
	} else if (anchor.row !== -1) {
		focusRowAt(anchor.row);
	}
}

/**
 * Hands the focus back to whatever had it when the dialog opened. Vuetify does
 * that only for a dialog opened through its activator slot, and every dialog
 * here opens through `v-model`. When the dialog closed the record its trigger
 * belonged to (a done or cancelled row leaves the list), the focus goes to the
 * row that took its place. The list has re-rendered by the next tick: a store
 * write replaces `records` before it awaits storage.
 */
export function useReturnFocus(open: Ref<boolean>): void {
	let anchor: FocusAnchor | null = null;

	watch(open, (isOpen) => {
		if (isOpen) {
			anchor = anchorOf(document.activeElement);
			return;
		}

		const saved = anchor;
		anchor = null;
		void nextTick(() => restore(saved));
	});
}

/**
 * Keeps the focus in a list when the row that held it leaves on its own, with
 * no dialog in between: a task marked done with confirmations off, or from the
 * matrix. Without this the focus drops to the document body.
 */
export function useKeepFocusInList(root: Readonly<Ref<HTMLElement | null>>): void {
	let anchor: FocusAnchor | null = null;

	onBeforeUpdate(() => {
		const active = document.activeElement;
		anchor = root.value?.contains(active) ? anchorOf(active) : null;
	});

	onUpdated(() => {
		const saved = anchor;
		anchor = null;
		if (saved !== null && !saved.element.isConnected && saved.row !== -1) {
			focusRowAt(saved.row);
		}
	});
}
