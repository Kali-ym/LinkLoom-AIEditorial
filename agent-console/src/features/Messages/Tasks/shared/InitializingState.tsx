import { Flexbox, Text } from '@lobehub/ui';
import { createStaticStyles, cssVar, keyframes } from 'antd-style';
import { memo, useEffect, useState } from 'react';

import { NeuralNetworkLoading } from '../../../../components/NeuralNetworkLoading';
import { shinyTextStyles } from '../../../../styles/shinyTextStyles';
import { formatElapsedTime } from './utils';

const shimmer = keyframes`
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
`;

const styles = createStaticStyles(({ css }) => ({
  container: css`
    padding-block: 12px;
  `,
  progress: css`
    position: relative;
    overflow: hidden;
    height: 3px;
    border-radius: 2px;
    background: ${cssVar.colorFillSecondary};
  `,
  progressShimmer: css`
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, ${cssVar.colorPrimaryBgHover}, transparent);
    animation: ${shimmer} 2s infinite;
  `,
}));

/** §C.47*/
export const InitializingState = memo(function InitializingState({
  showProgress = true,
}: {
  showProgress?: boolean;
}) {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const timer = setInterval(() => setElapsedTime(Date.now() - startTime), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Flexbox className={styles.container} gap={12}>
      <Flexbox horizontal align="center" gap={8}>
        <NeuralNetworkLoading size={14} />
        <Text className={shinyTextStyles.shinyText} weight={500}>
          任务启动中…
        </Text>
        <Text type="secondary">({formatElapsedTime(elapsedTime)})</Text>
      </Flexbox>
      {showProgress ? (
        <div className={styles.progress}>
          <div className={styles.progressShimmer} />
        </div>
      ) : null}
    </Flexbox>
  );
});
