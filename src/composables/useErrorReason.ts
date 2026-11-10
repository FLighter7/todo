import { useI18n } from 'vue-i18n';
import { WorkspaceError } from '@flighter7/workspace-client';
import { BackupFormatError } from '@/services/backup/BackupService';

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

		// Sync's errors, and this app's own document errors among them.
		if (error instanceof WorkspaceError) {
			return t(`errors.server.${error.code}`);
		}

		console.error(error);
		return t('errors.unknown');
	};
}
