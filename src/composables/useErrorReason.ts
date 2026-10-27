import { useI18n } from 'vue-i18n';
import { BackupFormatError } from '@/services/backup/BackupService';
import { SyncError } from '@/services/sync/SyncConnection';
import { SignalFormatError } from '@/services/sync/SyncSignal';

/**
 * The reason to put into a "Could not …: {reason}" message, in the user's
 * language. The services say what went wrong in English for a developer; an
 * error they describe carries a code, which is translated here. Anything else
 * (a browser or WebRTC failure, a bug) gets a general reason, and its own
 * message goes to the console for whoever debugs it.
 */
export function useErrorReason(): (error: unknown) => string {
	const { t } = useI18n();

	return (error) => {
		if (error instanceof BackupFormatError) {
			return t(`errors.backup.${error.code}`, error.params);
		}

		if (error instanceof SyncError) {
			return t(`errors.sync.${error.code}`);
		}

		if (error instanceof SignalFormatError) {
			return t(`errors.signal.${error.code}`);
		}

		console.error(error);
		return t('errors.unknown');
	};
}
