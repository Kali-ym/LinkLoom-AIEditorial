import { Accordion, AccordionItem } from '@lobehub/ui';
import { memo, type ReactNode } from 'react';

import { showcaseStyles } from './showcaseStyles';

/** 虚线框折叠面板 — dev/demo Showcase 区 */
export const ShowcasePanel = memo(function ShowcasePanel({
  itemKey,
  title,
  children,
}: {
  itemKey: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={showcaseStyles.panel}>
      <Accordion defaultExpandedKeys={[]}>
        <AccordionItem itemKey={itemKey} title={<span className={showcaseStyles.accordionLabel}>{title}</span>}>
          {children}
        </AccordionItem>
      </Accordion>
    </div>
  );
});
