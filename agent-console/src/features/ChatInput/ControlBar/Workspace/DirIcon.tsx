import { Github } from '@lobehub/icons';
import { Icon } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { Folder, GitBranch } from 'lucide-react';
import { memo } from 'react';

/** §C.46*/
export const DirIcon = memo(function DirIcon({
  repoType,
  size = 16,
}: {
  repoType?: 'git' | 'github';
  size?: number;
}) {
  const iconStyle = { color: cssVar.colorTextTertiary, flex: 'none' as const };
  if (repoType === 'github') return <Github size={size} style={iconStyle} />;
  return (
    <Icon
      icon={repoType === 'git' ? GitBranch : Folder}
      size={size}
      style={iconStyle}
    />
  );
});
