import { createStaticStyles, cssVar, keyframes } from 'antd-style';

export const rippleAnim = keyframes`
  0% {
    transform: scale(1);
    opacity: 0.7;
  }
  100% {
    transform: scale(3);
    opacity: 0;
  }
`;

export const topicItemStyles = createStaticStyles(({ css }) => ({
  unreadWrapper: css`
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
  `,
  unreadDot: css`
    position: relative;
    z-index: 1;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${cssVar.colorInfo};
  `,
  unreadRipple: css`
    position: absolute;
    inset: 0;
    width: 6px;
    height: 6px;
    margin: auto;
    border: 1px solid ${cssVar.colorInfo};
    border-radius: 50%;
    background: transparent;
    animation: ${rippleAnim} 1.8s ease-out infinite;
  `,
  runningElapsedTime: css`
    flex: none;
    min-width: 42px;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    color: ${cssVar.colorTextTertiary};
    text-align: end;
  `,
}));
