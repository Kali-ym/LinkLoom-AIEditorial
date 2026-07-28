import { Icon } from '@lobehub/ui';
import { McpIcon, SkillsIcon } from '@lobehub/ui/icons';
import { memo } from 'react';

interface MentionItemIconProps {
  avatar?: string;
  category: 'skill' | 'tool';
  label: string;
  size?: number;
}

const MentionItemIcon = memo<MentionItemIconProps>(({ avatar, category, label, size = 24 }) => {
  if (category === 'tool' && !avatar) {
    return <Icon icon={McpIcon} size={Math.round(size * 0.8)} />;
  }

  if (category === 'skill' && !avatar) {
    return <Icon icon={SkillsIcon} size={Math.round(size * 0.8)} />;
  }

  return (
    <span
      style={{
        alignItems: 'center',
        display: 'flex',
        fontSize: 11,
        fontWeight: 600,
        height: size,
        justifyContent: 'center',
        width: size,
      }}
      title={label}
    >
      {label.slice(0, 1).toUpperCase()}
    </span>
  );
});

MentionItemIcon.displayName = 'MentionItemIcon';

export default MentionItemIcon;
