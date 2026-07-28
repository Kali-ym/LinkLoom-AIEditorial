import { Button } from '@lobehub/ui';
import { Check, CornerDownLeft } from 'lucide-react';
import { memo } from 'react';

import { interventionStyles } from './interventionStyles';

/** Shared footer — same layout as ApprovalActions (reject + approve row). */
export const InteractionActionDock = memo(function InteractionActionDock({
  secondaryLabel,
  onSecondary,
  secondaryDisabled,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  primaryLoading,
  showShortcutHint,
}: {
  secondaryLabel: string;
  onSecondary: () => void;
  secondaryDisabled?: boolean;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  showShortcutHint?: boolean;
}) {
  return (
    <div className={interventionStyles.actionDock}>
      <div className={interventionStyles.actionRow}>
        <Button
          className={interventionStyles.rejectBtn}
          disabled={secondaryDisabled}
          size="large"
          onClick={onSecondary}
        >
          {secondaryLabel}
        </Button>
        <Button
          className={interventionStyles.approveBtn}
          disabled={primaryDisabled}
          icon={Check}
          loading={primaryLoading}
          size="large"
          type="primary"
          onClick={onPrimary}
        >
          {primaryLabel}
          {showShortcutHint ? (
            <span className={interventionStyles.shortcutHint}>
              <CornerDownLeft size={12} />
            </span>
          ) : null}
        </Button>
      </div>
    </div>
  );
});
