import { useEffect, useRef } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { useI18n } from '../i18n';
export function SourcesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) ref.current?.showModal();
    else ref.current?.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="sources-title"
      className="sources-dialog"
    >
      <div className="dialog-inner">
        <header>
          <h2 id="sources-title">{t('sources')}</h2>
          <button className="icon-button" onClick={onClose} aria-label={t('close')}>
            <X size={18} />
          </button>
        </header>
        <p>{t('sourceIntro')}</p>
        {(['config', 'fixed', 'refs', 'count'] as const).map((k) => (
          <section key={k}>
            <h3>{t(`${k}Title`)}</h3>
            <p>{t(`${k}Text`)}</p>
          </section>
        ))}
        <a
          href="https://github.com/everdale-forever/everdale-assets/blob/main/assets/csv_logic/tilemaps.csv"
          target="_blank"
          rel="noreferrer"
        >
          {t('upstream')}
          <ExternalLink size={13} />
        </a>
        <p className="source-note">{t('detailedSources')}</p>
        <footer>{t('rights')}</footer>
      </div>
    </dialog>
  );
}
