import { Accordion, AccordionItem, Center, Flexbox, Text } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { memo, type ReactNode, useState } from 'react';

import { NeuralNetworkLoading } from '../../../components/NeuralNetworkLoading';

export interface SkillSectionHeader {
  collapsible?: boolean;
  count?: number;
  defaultExpanded?: boolean;
  title: string;
}

export interface SkillSectionProps {
  children?: ReactNode;
  emptyText?: string;
  isEmpty?: boolean;
  isLoading?: boolean;
  /** When true, render only `AccordionItem` (parent must provide `Accordion`). */
  nestedInAccordion?: boolean;
  sectionHeader?: SkillSectionHeader;
}

const styles = createStaticStyles(({ css, cssVar }) => ({
  count: css`
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    color: ${cssVar.colorTextTertiary};
  `,
  empty: css`
    font-size: 12px;
    color: ${cssVar.colorTextTertiary};
  `,
  flatHeader: css`
    padding-inline: 4px;
  `,
  label: css`
    font-size: 12px;
    font-weight: 500;
  `,
}));

const HeaderRow = memo(function HeaderRow({ count, title }: { count?: number; title: string }) {
  return (
    <Flexbox horizontal align="center" gap={6}>
      <Text className={styles.label} type="secondary">
        {title}
      </Text>
      {typeof count === 'number' && count > 0 ? <span className={styles.count}>{count}</span> : null}
    </Flexbox>
  );
});

const Body = memo(function Body({
  children,
  emptyText,
  isEmpty,
  isLoading,
}: {
  children?: ReactNode;
  emptyText?: string;
  isEmpty?: boolean;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <Center paddingBlock={12}>
        <NeuralNetworkLoading size={24} />
      </Center>
    );
  }
  if (isEmpty) {
    return (
      <Center paddingBlock={8}>
        <Text className={styles.empty}>{emptyText}</Text>
      </Center>
    );
  }
  return <>{children}</>;
});

/** §C.27*/
export const SkillSection = memo(function SkillSection({
  children,
  emptyText,
  isEmpty,
  isLoading,
  nestedInAccordion,
  sectionHeader,
}: SkillSectionProps) {
  const [expanded, setExpanded] = useState(sectionHeader?.defaultExpanded ?? true);

  const body = (
    <Body emptyText={emptyText} isEmpty={isEmpty} isLoading={isLoading}>
      {children}
    </Body>
  );

  if (!sectionHeader) return body;

  const { collapsible = true, count, title } = sectionHeader;
  const itemKey = `skill-section-${title}`;

  if (!collapsible) {
    return (
      <Flexbox gap={4}>
        <div className={styles.flatHeader}>
          <HeaderRow count={count} title={title} />
        </div>
        {body}
      </Flexbox>
    );
  }

  const accordionItem = (
    <AccordionItem
      itemKey={itemKey}
      paddingBlock={2}
      paddingInline={4}
      title={<HeaderRow count={count} title={title} />}
    >
      {body}
    </AccordionItem>
  );

  if (nestedInAccordion) return accordionItem;

  return (
    <Accordion
      expandedKeys={expanded ? [itemKey] : []}
      gap={4}
      onExpandedChange={(keys) => setExpanded(keys.length > 0)}
    >
      {accordionItem}
    </Accordion>
  );
});
