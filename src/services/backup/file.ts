import type { TodoBackup } from './format';

/** Deliberately thin: all logic that deserves a test lives in format.ts. */
export function backupFileName(date: Date = new Date()): string {
	return `todo-backup-${date.toISOString().slice(0, 10)}.json`;
}

export function downloadBackup(backup: TodoBackup, fileName = backupFileName()): void {
	const blob = new Blob([JSON.stringify(backup, null, '\t')], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');

	link.href = url;
	link.download = fileName;
	link.click();

	URL.revokeObjectURL(url);
}

export function readTextFile(file: File): Promise<string> {
	return file.text();
}
