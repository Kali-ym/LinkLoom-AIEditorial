import { Icon } from '@lobehub/ui';
import { cx } from 'antd-style';
import { memo } from 'react';

import type { PendingIntervention } from '../../../domain/types';
import { getInterventionMeta, RISK_LABEL } from './interventionMeta';
import { interventionStyles } from './interventionStyles';

export const InterventionChrome = memo(function InterventionChrome({
  intervention,
}: {
  intervention: PendingIntervention;
}) {
  const meta = getInterventionMeta(intervention.apiName, intervention.identifier);
  const riskClass =
    meta.risk === 'low'
      ? interventionStyles.risk_low
      : meta.risk === 'high'
        ? interventionStyles.risk_high
        : interventionStyles.risk_medium;

  return (
    <header className={interventionStyles.chrome} data-risk={meta.risk}>
      <div className={interventionStyles.chromeBody}>
        <div className={interventionStyles.chromeIcon} data-risk={meta.risk}>
          <Icon icon={meta.icon} size={18} />
        </div>
        <div className={interventionStyles.chromeCopy}>
          <div className={interventionStyles.chromeEyebrow}>
            <span className={interventionStyles.chromePulse} />
            等待你的确认
          </div>
          <h3 className={interventionStyles.chromeTitle}>{meta.label}</h3>
          <p className={interventionStyles.chromeSubtitle}>{meta.subtitle}</p>
        </div>
        <span className={cx(interventionStyles.riskBadge, riskClass)}>
          {RISK_LABEL[meta.risk]}
        </span>
      </div>
    </header>
  );
});
