import { createStaticStyles, cssVar } from 'antd-style';
import { memo } from 'react';

import type { MessageVideoItem } from '../../../domain/types';

const styles = createStaticStyles(({ css }) => ({
  video: css`
    max-width: 100%;
    border-radius: 8px;
    background: ${cssVar.colorFillQuaternary};
  `,
}));

/** Upstream `VideoFileListViewer` subset */
export const VideoFileListViewer = memo(function VideoFileListViewer({
  videos,
}: {
  videos: MessageVideoItem[];
}) {
  if (!videos?.length) return null;

  return (
    <>
      {videos.map((video) => (
        <video key={video.id} className={styles.video} controls src={video.url} />
      ))}
    </>
  );
});
