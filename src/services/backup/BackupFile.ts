import type { TodoBackup } from './BackupService';

export class BackupFile {
	/** Deliberately thin: all logic that deserves a test lives in BackupService. */
	fileName(date: Date = new Date()): string {
		return `todo-backup-${date.toISOString().slice(0, 10)}.json`;
	}

	download(backup: TodoBackup, fileName = this.fileName()): void {
		const blob = new Blob([JSON.stringify(backup, null, '\t')], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');

		link.href = url;
		link.download = fileName;
		link.click();

		URL.revokeObjectURL(url);
	}

	readText(file: File): Promise<string> {
		return file.text();
	}
}

export const backupFile = new BackupFile();
