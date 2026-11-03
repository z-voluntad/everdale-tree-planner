import { Check, Sprout } from 'lucide-react';
import { growthProgress } from '../domain/progress';
import type { TreeGroup } from '../domain/types';
import { useI18n } from '../i18n';

export function ProgressPanel({ groups }: { groups: TreeGroup[] }) {
  const { t } = useI18n();
  const progress = growthProgress(groups);
  return (
    <section className="growth-panel" aria-label={t('growthProgress')}>
      <div className="growth-heading">
        <span>
          <Sprout size={16} />
          {t('growthProgress')}
        </span>
        <strong>
          {progress.percent}
          <small>%</small>
        </strong>
      </div>
      <progress aria-label={t('growthProgress')} value={progress.grown} max={progress.total || 1} />
      <div className="growth-counts" aria-live="polite">
        <span>
          <b>{progress.grown}</b> / {progress.total} {t('groupsGrown')}
        </span>
        <span>
          {t('remaining')} <b>{progress.remaining}</b> {t('groups')}
        </span>
      </div>
      <div className="growth-legend">
        <span>
          <i className="legend-grown">
            <Check size={10} />
          </i>
          {t('grown')}
        </span>
        <span>
          <i />
          {t('pending')}
        </span>
      </div>
      <p className="growth-note">{groups.length ? t('growthHint') : t('emptyProgress')}</p>
    </section>
  );
}
