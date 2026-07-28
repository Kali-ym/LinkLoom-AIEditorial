import { memo, useEffect, useState, type ReactNode } from 'react';
import { Rnd } from 'react-rnd';

import { MAX_WIDTH, MIN_WIDTH } from '../const';
import { styles } from '../styles';

interface DevResizablePanelProps {
  children: ReactNode;
  height: number;
  onWidthChange: (width: number) => void;
  width: number;
}

/** §C.42*/
export const DevResizablePanel = memo(function DevResizablePanel({
  children,
  height,
  onWidthChange,
  width,
}: DevResizablePanelProps) {
  const [resizeWidth, setResizeWidth] = useState(width);

  useEffect(() => {
    setResizeWidth(width);
  }, [width]);

  return (
    <Rnd
      className={styles.devResizablePanel}
      disableDragging
      enableResizing={{
        bottom: false,
        bottomLeft: false,
        bottomRight: false,
        left: false,
        right: true,
        top: false,
        topLeft: false,
        topRight: false,
      }}
      maxHeight={height}
      maxWidth={MAX_WIDTH}
      minHeight={height}
      minWidth={MIN_WIDTH}
      size={{ height, width: resizeWidth }}
      style={{ position: 'relative' }}
      onResize={(_e, _dir, ref) => {
        setResizeWidth(ref.offsetWidth);
      }}
      onResizeStop={(_e, _dir, ref) => {
        const nextWidth = ref.offsetWidth;
        setResizeWidth(nextWidth);
        onWidthChange(nextWidth);
      }}
    >
      {children}
    </Rnd>
  );
});
