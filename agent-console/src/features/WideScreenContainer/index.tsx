import { type FlexboxProps, Flexbox } from '@lobehub/ui';
import { createStaticStyles, cssVar, cx } from 'antd-style';
import { type CSSProperties, memo, useEffect } from 'react';

import { CONVERSATION_MIN_WIDTH } from '../../constants/layoutTokens';
import { WIDE_SCREEN_WIDTH_TRANSITION_S } from '../../constants/motionTokens';
import { useLayoutStore } from '../../stores';

const styles = createStaticStyles(({ css }) => ({
  container: css`
    flex-grow: 1;
    align-self: center;
    transition: width ${WIDE_SCREEN_WIDTH_TRANSITION_S}s ${cssVar.motionEaseInOut};
  `,
}));

interface WideScreenContainerProps extends FlexboxProps {
  minWidth?: number;
  onChange?: () => void;
  wrapperStyle?: CSSProperties;
}

/** §C.20*/
export const WideScreenContainer = memo(function WideScreenContainer({
  children,
  className,
  minWidth = CONVERSATION_MIN_WIDTH,
  onChange,
  wrapperStyle,
  onClick,
  width: wrapperWidth = '100%',
  ...rest
}: WideScreenContainerProps) {
  const wideScreen = useLayoutStore((s) => s.wideScreen);
  const isMobileViewport = useLayoutStore((s) => s.isMobileViewport);

  useEffect(() => {
    onChange?.();
  }, [onChange, wideScreen]);

  const contentWidth =
    isMobileViewport || wideScreen ? '100%' : `min(${minWidth}px, 100%)`;

  return (
    <Flexbox style={wrapperStyle} width={wrapperWidth} onClick={onClick}>
      <Flexbox
        className={cx(styles.container, className)}
        paddingInline={isMobileViewport ? 12 : 16}
        width={contentWidth}
        {...rest}
      >
        {children}
      </Flexbox>
    </Flexbox>
  );
});
