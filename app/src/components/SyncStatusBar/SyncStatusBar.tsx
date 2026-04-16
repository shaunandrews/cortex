import { forwardRef, type HTMLAttributes } from 'react';
import { Text } from '@wordpress/ui';
import './SyncStatusBar.css';

export type SyncPhase = 'idle' | 'bootstrapping' | 'prefetching' | 'maintaining';

export type SyncStatusBarProps = HTMLAttributes<HTMLDivElement> & {
  phase: SyncPhase;
  /** Prefetch progress. Required when `phase === 'prefetching'` to render the bar. */
  progress?: { fetched: number; total: number };
  /** Human-readable relative time string, shown in the `maintaining` phase. */
  lastUpdatedLabel?: string;
};

function resolveLabel(
  phase: SyncPhase,
  progress: SyncStatusBarProps['progress'],
  lastUpdatedLabel: string | undefined,
): string {
  if (phase === 'bootstrapping') return 'Connecting…';
  if (phase === 'prefetching' && progress) {
    return `Syncing ${progress.fetched} of ${progress.total} sites`;
  }
  if (phase === 'maintaining') {
    return lastUpdatedLabel ? `Live · Updated ${lastUpdatedLabel}` : 'Live';
  }
  return '';
}

const SyncStatusBar = forwardRef<HTMLDivElement, SyncStatusBarProps>(function SyncStatusBar(
  { phase, progress, lastUpdatedLabel, className, ...rest },
  ref,
) {
  if (phase === 'idle') return null;

  const label = resolveLabel(phase, progress, lastUpdatedLabel);
  const showProgress = phase === 'prefetching' && progress && progress.total > 0;
  const pct = showProgress ? (progress.fetched / progress.total) * 100 : 0;

  const classes = ['sync-status'];
  if (className) classes.push(className);

  return (
    <div ref={ref} className={classes.join(' ')} {...rest}>
      {showProgress && (
        <div className="sync-status-bar" role="progressbar" aria-valuenow={pct}>
          <div className="sync-status-fill" style={{ width: `${pct}%` }} />
        </div>
      )}
      <Text variant="body-sm" className="sync-status-label">
        {label}
      </Text>
    </div>
  );
});

export default SyncStatusBar;
