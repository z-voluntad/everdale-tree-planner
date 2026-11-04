import { useI18n } from '../i18n';
import type { StorageState } from '../services/storage';
import type { MessageKey } from '../i18n/messages';

interface Props {
  state: StorageState;
  onBackup: () => void;
  onOriginal: () => void;
  onReload: () => void;
  onRecover: () => void;
  onRetry: () => void;
}
export function StorageNotice({
  state,
  onBackup,
  onOriginal,
  onReload,
  onRecover,
  onRetry,
}: Props) {
  const { t } = useI18n();
  if (!state.issue) return null;
  const messages: Record<NonNullable<StorageState['issue']>, MessageKey> = {
    corrupt: state.recoveredFromBackup ? 'storageRecovered' : 'storageCorrupt',
    conflict: 'storageConflict',
    unavailable: 'storageUnavailable',
    write: 'saveError',
    unsupported: 'storageUnsupported',
  };
  return (
    <aside className="storage-notice" role="alert">
      <p>
        <strong>{t('savePaused')}</strong> {t(messages[state.issue])}
      </p>
      <div className="storage-notice-actions">
        <button className="button" onClick={onBackup}>
          {t('exportLibrary')}
        </button>
        {state.needsRecovery && state.original && (
          <button className="button" onClick={onOriginal}>
            {t('exportOriginal')}
          </button>
        )}
        {state.needsRecovery && (state.issue === 'corrupt' || state.issue === 'write') && (
          <button className="button" onClick={onRecover}>
            {t('resumeSaving')}
          </button>
        )}
        {(state.issue === 'conflict' || state.issue === 'unavailable') && (
          <button className="button" onClick={onReload}>
            {t('reloadStorage')}
          </button>
        )}
        {state.issue === 'write' && !state.needsRecovery && (
          <button className="button" onClick={onRetry}>
            {t('retrySave')}
          </button>
        )}
      </div>
    </aside>
  );
}
