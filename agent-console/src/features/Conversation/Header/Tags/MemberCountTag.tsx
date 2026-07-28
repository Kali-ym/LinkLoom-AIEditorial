import { Flexbox, Icon, Tag, Tooltip } from '@lobehub/ui';
import { Users } from 'lucide-react';
import { memo } from 'react';

import { useGroupMemberCount } from '../../../../hooks/useSession';

/** §C.15 MemberCountTag*/
export const MemberCountTag = memo(function MemberCountTag() {
  const memberCount = useGroupMemberCount();

  if (memberCount <= 0) return null;

  return (
    <Tooltip title={`${memberCount} 位成员`}>
      <Flexbox height={22}>
        <Tag>
          <Icon icon={Users} />
          <span>{memberCount}</span>
        </Tag>
      </Flexbox>
    </Tooltip>
  );
});
