import type { QueueItem } from '../domain/types';

/** §C.13 demo — queue items with file/image previews for QueueTray. */
export const QUEUE_DEMO_ITEMS: QueueItem[] = [
  {
    id: 'q-demo-1',
    text: '请总结 changelog 并附上截图',
    filesPreview: [
      {
        id: 'f-img-1',
        name: 'changelog.png',
        mimeType: 'image/png',
        url: 'https://docs.example.com/og.png',
      },
    ],
  },
  {
    id: 'q-demo-2',
    text: '分析 package.json 依赖',
    filesPreview: [
      {
        id: 'f-doc-1',
        name: 'package.json',
        mimeType: 'application/json',
      },
    ],
  },
];
