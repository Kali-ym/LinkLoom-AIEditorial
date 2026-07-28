import { Flexbox, Text } from '@lobehub/ui';
import { cx } from 'antd-style';
import { Loader2 } from 'lucide-react';
import { type MouseEventHandler, type ReactNode, memo } from 'react';

import { chatItemStyles } from './chatItemStyles';

export interface ChatItemProps {
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  'data-msg-type'?: string;
  disabled?: boolean;
  id?: string;
  loading?: boolean;
  onDoubleClick?: MouseEventHandler<HTMLDivElement>;
  onMouseEnter?: MouseEventHandler<HTMLDivElement>;
  opacity?: number;
  placement?: 'left' | 'right';
  showAvatar?: boolean;
  showBubble?: boolean;
  showTitle?: boolean;
  time?: string;
  titleAddon?: ReactNode;
}

/** §C.10 ChatItem*/
export const ChatItem = memo(function ChatItem({
  actions,
  children,
  className,
  disabled,
  id,
  loading,
  onDoubleClick,
  onMouseEnter,
  opacity = 1,
  placement = 'left',
  showBubble = true,
  showTitle: _showTitle = false,
  time,
  titleAddon,
  'data-msg-type': dataMsgType,
}: ChatItemProps) {
  const isUser = placement === 'right';

  return (
    <Flexbox
      align={isUser ? 'flex-end' : 'flex-start'}
      className={cx('message-wrapper', chatItemStyles.container, className)}
      data-message
      data-message-id={id}
      data-msg-type={dataMsgType}
      gap={8}
      paddingBlock={8}
      style={{ opacity, paddingInlineStart: isUser ? 36 : 0 }}
      onMouseEnter={onMouseEnter}
    >
      <Flexbox
        horizontal
        align="center"
        className="message-header"
        direction={isUser ? 'horizontal-reverse' : 'horizontal'}
        gap={8}
      >
        {titleAddon}
        {time ? (
          <Text as="time" fontSize={12} type="secondary">
            {time}
          </Text>
        ) : null}
      </Flexbox>
      <Flexbox
        className={cx('message-body', chatItemStyles.messageBody)}
        gap={8}
        style={{ maxWidth: '100%', width: isUser ? undefined : '100%' }}
      >
        <div
          className={cx(
            showBubble && chatItemStyles.bubble,
            disabled && chatItemStyles.disabled,
            'msg_content_flag',
          )}
          style={isUser ? { maxWidth: '100%', width: 'fit-content' } : undefined}
          onDoubleClick={onDoubleClick}
        >
          {children}
        </div>
        {loading && (
          <div
            className={cx(
              chatItemStyles.loading,
              isUser ? chatItemStyles.loadingRight : chatItemStyles.loadingLeft,
            )}
          >
            <Loader2 size={12} strokeWidth={3} />
          </div>
        )}
      </Flexbox>
      {actions && (
        <Flexbox
          horizontal
          align="center"
          gap={8}
          role="menubar"
          style={{ alignSelf: isUser ? 'flex-end' : 'flex-start' }}
        >
          {actions}
        </Flexbox>
      )}
    </Flexbox>
  );
});
