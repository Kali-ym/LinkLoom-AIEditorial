import { AccordionItem, Center, Flexbox, Icon, Text } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import {
  Archive,
  CheckCircle2,
  CircleAlert,
  CircleDot,
  Loader,
  type LucideIcon,
  PauseCircle,
  Star,
} from 'lucide-react';
import { memo } from 'react';

import { TopicItem } from '../../List/Item';
import type { GroupItemComponentProps } from '../GroupedAccordion';

/** §C.44*/
const STATUS_ICON: Record<string, { color: string; icon: LucideIcon }> = {
  active: { color: cssVar.colorTextTertiary, icon: CircleDot },
  archived: { color: cssVar.colorTextDescription, icon: Archive },
  completed: { color: cssVar.colorTextDescription, icon: CheckCircle2 },
  favorite: { color: cssVar.colorWarning, icon: Star },
  paused: { color: cssVar.colorTextDescription, icon: PauseCircle },
  pending: { color: cssVar.colorWarning, icon: CircleAlert },
  running: { color: cssVar.colorWarning, icon: Loader },
};

export const ByStatusGroupItem = memo(function ByStatusGroupItem({
  group,
}: GroupItemComponentProps) {
  const statusIcon = STATUS_ICON[group.id];

  return (
    <AccordionItem
      itemKey={group.id}
      paddingBlock={4}
      paddingInline="8px 4px"
      title={
        <Flexbox horizontal align="center" gap={6} height={24} style={{ overflow: 'hidden' }}>
          {statusIcon ? (
            <Center flex="none" height={16} width={16}>
              <Icon color={statusIcon.color} icon={statusIcon.icon} size={{ size: 13 }} />
            </Center>
          ) : null}
          <Text ellipsis fontSize={12} style={{ flex: 1 }} type="secondary" weight={500}>
            {group.label}
          </Text>
        </Flexbox>
      }
    >
      <Flexbox gap={1} paddingBlock={1}>
        {group.topics.map((topic) => (
          <TopicItem key={topic.id} showWorkingDirectory topic={topic} />
        ))}
      </Flexbox>
    </AccordionItem>
  );
});
