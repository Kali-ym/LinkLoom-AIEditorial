import { Alert, Avatar, Button, Flexbox } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { PlusIcon } from 'lucide-react';
import { memo } from 'react';

import type { PendingAuthTool } from '../../../domain/types/toolAuth';
import { useToolAuthStore } from '../../../stores/toolAuthStore';

const styles = createStaticStyles(({ css }) => ({
  divider: css`
    width: 100%;
    height: 0;
    margin-block: 0;
    border: none;
    border-top: 1px dashed ${cssVar.colorBorderSecondary};
  `,
}));

const toolAuthStrings = {
  title: '为助理完成技能授权',
  hint: '以下技能尚未授权，授权后即可在对话中使用。',
  authorize: '授权',
  signIn: '登录',
} as const;

function ToolAuthRow({ tool }: { tool: PendingAuthTool }) {
  const authorizeTool = useToolAuthStore((s) => s.authorizeTool);
  const actionLabel = tool.authType === 'market' ? toolAuthStrings.signIn : toolAuthStrings.authorize;

  return (
    <Flexbox horizontal align="center" justify="space-between" gap={12} width="100%">
      <Flexbox horizontal align="center" gap={8}>
        <Avatar avatar={tool.avatar} size={20} />
        <span style={{ fontSize: 13 }}>{tool.label}</span>
      </Flexbox>
      <Button icon={PlusIcon} size="small" type="text" onClick={() => void authorizeTool(tool.id)}>
        {actionLabel}
      </Button>
    </Flexbox>
  );
}

/** §C.59 ToolAuthAlert*/
export const ToolAuthAlert = memo(function ToolAuthAlert() {
  const pendingTools = useToolAuthStore((s) => s.pendingTools);

  if (pendingTools.length === 0) return null;

  return (
    <Alert
      showIcon={false}
      style={{ background: 'transparent', width: '100%' }}
      title={toolAuthStrings.title}
      type="secondary"
      description={
        <Flexbox gap={12} width="100%">
          <span style={{ color: cssVar.colorTextSecondary, fontSize: 13 }}>{toolAuthStrings.hint}</span>
          <hr className={styles.divider} />
          {pendingTools.map((tool) => (
            <ToolAuthRow key={tool.id} tool={tool} />
          ))}
        </Flexbox>
      }
    />
  );
});
