import { Flexbox, Icon, Popover, Text } from '@lobehub/ui';
import { LoadingDots } from '@lobehub/ui/chat';
import { createStaticStyles, cssVar, cx } from 'antd-style';
import { CircleDollarSign, Footprints } from 'lucide-react';
import { Fragment, memo } from 'react';

import { shinyTextStyles } from '../../styles/shinyTextStyles';
import {
  useActiveOpElapsedMs,
  useActiveOpPhrase,
  useActiveOpTrayVisible,
  useActiveStreamCost,
  useActiveStreamStepCount,
  useActiveStreamTokenCount,
  useActiveTopicStreaming,
} from '../../services/streaming/streamingScope';
import { overlayStackStyles } from './overlayStackStyles';

const styles = createStaticStyles(({ css, cssVar }) => ({
  tray: css`
    container-type: inline-size;

    display: flex;
    gap: 10px;
    align-items: center;
    padding-block: 8px;
    padding-inline: 14px;
    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
  `,
  divider: css`
    width: 1px;
    height: 12px;
    background: ${cssVar.colorBorderSecondary};
  `,
  metric: css`
    display: inline-flex;
    gap: 4px;
    align-items: center;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  `,
  metricGroup: css`
    display: inline-flex;
    flex: none;
    gap: 10px;
    align-items: center;
    margin-inline-start: auto;

    @container (max-width: 360px) {
      display: none;
    }
  `,
  metricIcon: css`
    flex: none;
    color: ${cssVar.colorTextTertiary};
  `,
  metricPopover: css`
    min-width: 150px;
    padding: 2px;
  `,
  metricPopoverLabel: css`
    color: ${cssVar.colorTextTertiary};
  `,
  metricPopoverValue: css`
    font-variant-numeric: tabular-nums;
    color: ${cssVar.colorTextSecondary};
  `,
  compactMetric: css`
    cursor: default;
    display: none;
    flex: none;
    margin-inline-start: auto;

    @container (max-width: 360px) {
      display: inline-flex;
    }
  `,
  statusMetric: css`
    overflow: hidden;
    flex: 1 1 auto;
    min-width: 0;
  `,
  statusPhrase: css`
    @keyframes op-status-tray-phrase-enter {
      from {
        transform: translateY(3px);
        opacity: 0;
      }

      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    display: inline-block;
    animation: op-status-tray-phrase-enter 0.4s ease;
  `,
  timer: css`
    flex: none;
    font-family: ${cssVar.fontFamilyCode};
    font-size: 12px;
    color: ${cssVar.colorTextTertiary};
    white-space: nowrap;
  `,
}));

function formatOpTimer(elapsedMs: number): string {
  const sec = Math.floor(elapsedMs / 1000);
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}

function formatCost(cost: number): string {
  if (cost <= 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

/** §C.13 OpStatusTray*/
export const OpStatusTray = memo(function OpStatusTray({
  topAttached,
}: {
  topAttached?: boolean;
}) {
  const isActiveStreaming = useActiveTopicStreaming();
  const opTrayVisible = useActiveOpTrayVisible();
  const visible = opTrayVisible && isActiveStreaming;
  const phrase = useActiveOpPhrase();
  const elapsedMs = useActiveOpElapsedMs();
  const tokenCount = useActiveStreamTokenCount();
  const stepCount = useActiveStreamStepCount();
  const cost = useActiveStreamCost();

  if (!visible) return null;

  const metricsPopover = (
    <Flexbox className={styles.metricPopover} gap={6}>
      {stepCount > 1 ? (
        <Flexbox horizontal align="center" justify="space-between" gap={12}>
          <Text className={styles.metricPopoverLabel} fontSize={12}>
            Steps
          </Text>
          <Text className={styles.metricPopoverValue} fontSize={12}>
            {stepCount}
          </Text>
        </Flexbox>
      ) : null}
      <Flexbox horizontal align="center" justify="space-between" gap={12}>
        <Text className={styles.metricPopoverLabel} fontSize={12}>
          Tokens
        </Text>
        <Text className={styles.metricPopoverValue} fontSize={12}>
          {tokenCount}
        </Text>
      </Flexbox>
      <Flexbox horizontal align="center" justify="space-between" gap={12}>
        <Text className={styles.metricPopoverLabel} fontSize={12}>
          Cost
        </Text>
        <Text className={styles.metricPopoverValue} fontSize={12}>
          {formatCost(cost)}
        </Text>
      </Flexbox>
    </Flexbox>
  );

  const metricItems = [
    stepCount > 1 ? (
      <span className={styles.metric} key="steps">
        <Icon className={styles.metricIcon} icon={Footprints} size={12} />
        {stepCount}
      </span>
    ) : null,
    <span className={styles.metric} key="tokens">
      {tokenCount} tokens
    </span>,
    cost > 0 ? (
      <span className={styles.metric} key="cost">
        <Icon className={styles.metricIcon} icon={CircleDollarSign} size={12} />
        {formatCost(cost)}
      </span>
    ) : null,
  ].filter(Boolean);

  return (
    <Flexbox
      horizontal
      align="center"
      className={cx(
        overlayStackStyles.panel,
        styles.tray,
        topAttached && overlayStackStyles.panelTopAttached,
      )}
      data-testid="op-status-tray"
      gap={10}
    >
      <LoadingDots color={cssVar.colorTextSecondary} size={12} variant="pulse" />
      <div className={styles.statusMetric}>
        <Text
          className={cx(shinyTextStyles.shinyText, styles.statusPhrase)}
          fontSize={12}
          key={phrase}
          type="secondary"
        >
          {phrase}
        </Text>
      </div>
      <span className={styles.timer}>{formatOpTimer(elapsedMs)}</span>
      <div className={styles.metricGroup}>
        {metricItems.map((item, index) => (
          <Fragment key={index}>
            {index > 0 ? <span className={styles.divider} /> : null}
            {item}
          </Fragment>
        ))}
      </div>
      <Popover content={metricsPopover} placement="top">
        <span className={cx(styles.metric, styles.compactMetric)}>{tokenCount} tokens</span>
      </Popover>
    </Flexbox>
  );
});
