import { cx } from 'antd-style';
import { memo, useState } from 'react';

import { showToast } from '../../services/ui/toast';
import { inputCompletionAlertStyles } from './inputCompletionAlertStyles';

/** index.html `#inputCompletionAlert` — 自动补全失败提示（默认隐藏） */
export const InputCompletionAlert = memo(function InputCompletionAlert() {
  const [visible, setVisible] = useState(false);

  if (!visible) {
    return (
      <div
        className={inputCompletionAlertStyles.root}
        id="inputCompletionAlert"
        role="alert"
      >
        {/* 演示：点击 ControlBar 审批区双击可触发；此处保留 DOM 供样式对齐 */}
      </div>
    );
  }

  return (
    <div
      className={cx(inputCompletionAlertStyles.root, inputCompletionAlertStyles.visible)}
      id="inputCompletionAlert"
      role="alert"
    >
      <svg
        className={inputCompletionAlertStyles.warningIcon}
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <div>
        <strong className={inputCompletionAlertStyles.title}>自动补全暂不可用</strong>
        <p className={inputCompletionAlertStyles.description}>
          模型补全服务连接失败。可重试或前往设置检查 API 配置。
        </p>
        <button
          className={`btn btn-ghost ${inputCompletionAlertStyles.retryButton}`}
          type="button"
          id="completionRetryBtn"
          onClick={() => {
            setVisible(false);
            showToast('已重试连接补全服务（演示）');
          }}
        >
          重试
        </button>
      </div>
    </div>
  );
});
