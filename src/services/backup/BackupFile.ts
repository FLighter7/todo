import type { Backup } from './BackupService';

/**
 * The two shapes a backup is shared in. Chrome shares only an allowlist of
 * file types, and JSON is not on it: there the same text goes out as a
 * `.txt` file, which the import picker accepts too, since `parse` reads the
 * content and never the name.
 */
const SHARE_FORMATS = [
	{ extension: 'json', type: 'application/json' },
	{ extension: 'txt', type: 'text/plain' },
] as const;

type ShareFormat = (typeof SHARE_FORMATS)[number];

export class BackupFile {
	/** Deliberately thin: all logic that deserves a test lives in BackupService. */
	fileName(date: Date = new Date(), extension = 'json'): string {
		return `todo-backup-${date.toISOString().slice(0, 10)}.${extension}`;
	}

	download(backup: Backup, fileName = this.fileName()): void {
		const blob = new Blob([this.text(backup)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');

		link.href = url;
		link.download = fileName;
		link.click();

		URL.revokeObjectURL(url);
	}

	/** Whether this browser can hand a backup file to the system's share sheet. */
	canShare(): boolean {
		return this.shareFormat() !== undefined;
	}

	/**
	 * Opens the system's share sheet with the backup as a file. Rejects with
	 * an `AbortError` when the sheet is closed without picking anyone.
	 */
	async share(backup: Backup): Promise<void> {
		const format = this.shareFormat();
		if (format === undefined) {
			throw new Error('This browser cannot share files');
		}

		const file = new File([this.text(backup)], this.fileName(new Date(), format.extension), {
			type: format.type,
		});
		await navigator.share({ files: [file] });
	}

	readText(file: File): Promise<string> {
		return file.text();
	}

	private text(backup: Backup): string {
		return JSON.stringify(backup, null, '\t');
	}

	/** The first format the browser would share, probed with an empty file of each. */
	private shareFormat(): ShareFormat | undefined {
		if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') {
			return undefined;
		}

		return SHARE_FORMATS.find((format) => {
			const probe = new File([''], `probe.${format.extension}`, { type: format.type });
			try {
				return navigator.canShare({ files: [probe] });
			} catch {
				return false;
			}
		});
	}
}

export const backupFile = new BackupFile();
