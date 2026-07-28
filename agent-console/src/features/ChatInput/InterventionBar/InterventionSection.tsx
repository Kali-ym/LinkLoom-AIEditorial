import { cx } from 'antd-style';
import type { ReactNode } from 'react';
import { memo } from 'react';

import { interventionStyles } from './interventionStyles';

export const InterventionSection = memo(function InterventionSection({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx(interventionStyles.section, className)}>
      {title ? <h4 className={interventionStyles.sectionTitle}>{title}</h4> : null}
      {description ? <p className={interventionStyles.sectionDesc}>{description}</p> : null}
      {children}
    </section>
  );
});

export const InterventionPanel = memo(function InterventionPanel({
  children,
  className,
  mono,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  mono?: boolean;
  padded?: boolean;
}) {
  return (
    <div
      className={cx(
        interventionStyles.panel,
        mono && interventionStyles.panelMono,
        padded && interventionStyles.panelPadded,
        className,
      )}
    >
      {children}
    </div>
  );
});
