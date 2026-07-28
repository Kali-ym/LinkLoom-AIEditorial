import { memo } from 'react';

import { useWorkspaceStore } from '../../../stores';
import { CompressedGroupMessage } from '../../Messages/CompressedGroupMessage';
import { SupervisorMessage } from '../../Messages/SupervisorMessage';
import { TaskMessage } from '../../Messages/TaskMessage';
import { ToolStandaloneMessage } from '../../Messages/ToolStandaloneMessage';
import { VerifyMessage } from '../../Messages/VerifyMessage';
import { ShowcasePanel } from './ShowcasePanel';
import { showcaseStyles } from './showcaseStyles';

/** index.html `#msgTypesShowcase` */
export const MsgTypesShowcase = memo(function MsgTypesShowcase() {
  const title = useWorkspaceStore((s) => s.showcase.msgTypes.title);

  return (
    <ShowcasePanel itemKey="msg-types" title={title}>
      <div className={showcaseStyles.msgTypesGrid}>
        <SupervisorMessage>
          <strong>Supervisor</strong> — 已接管本轮对话，正在协调子 Agent 执行任务…
        </SupervisorMessage>
        <TaskMessage
          status="运行中"
          title="抓取 Changelog 页面"
          description="web-browsing › fetchPage · 已运行 01:23"
        />
        <VerifyMessage title="验证结果 #2" assertion="assert page.title.includes('Changelog') — passed" />
        <ToolStandaloneMessage text="tool · web-browsing › fetchPage（内联工具消息）" />
        <CompressedGroupMessage summary="已压缩 4 条助手组消息 · 点击展开" />
      </div>
    </ShowcasePanel>
  );
});
