import type { GroundingData } from '../domain/types/grounding';
import { buildGroundingHtml } from '../services/mock/groundingBuilder';

const UI_PREVIEW_SVG = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="%23dbeafe"/><stop offset="1" stop-color="%23e0e7ff"/></linearGradient></defs><rect fill="url(%23g)" width="240" height="120" rx="8"/><rect x="16" y="16" width="80" height="8" rx="4" fill="%2394a3b8" opacity=".5"/><rect x="16" y="34" width="160" height="6" rx="3" fill="%2394a3b8" opacity=".35"/><rect x="16" y="52" width="120" height="6" rx="3" fill="%2394a3b8" opacity=".35"/></svg>',
);

const LAYOUT_PREVIEW_SVG = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120"><rect fill="%23f1f5f9" width="240" height="120" rx="8"/><rect x="12" y="12" width="56" height="96" rx="6" fill="%23cbd5e1"/><rect x="76" y="12" width="152" height="96" rx="6" fill="%23e2e8f0"/></svg>',
);

/** Static grounding on `#assistantMsg` — index.html lines ~5430–5436. */
export const STATIC_GROUNDING: GroundingData = {
  searchQueries: ['UI changelog', '@lobehub/ui components'],
  citations: [
    {
      favicon: 'docs.example.com',
      title: '@lobehub/ui Changelog',
      url: 'https://docs.example.com/changelog',
    },
    {
      favicon: 'github.com',
      title: 'example/ui-lib — React component library',
      url: 'https://github.com/example/ui-lib',
    },
  ],
};

/** Web results demo — index.html `#groundingDemoMount` first card. */
export const GROUNDING_SHOWCASE_WEB: GroundingData = {
  searchQueries: ['UI changelog', 'ThemeProvider Accordion'],
  citations: [
    {
      favicon: 'docs.example.com',
      title: '@lobehub/ui Changelog',
      url: 'https://docs.example.com/changelog',
    },
    { favicon: 'github.com', title: 'example/ui-lib', url: 'https://github.com/example/ui-lib' },
    { favicon: 'example.com', title: '文档', url: 'https://example.com/docs' },
  ],
};

/** Image results demo — index.html `#groundingDemoMount` second card. */
export const GROUNDING_SHOWCASE_IMAGES: GroundingData = {
  imageSearchQueries: ['agent console dashboard screenshot'],
  imageResults: [
    {
      domain: 'docs.example.com',
      title: 'UI 组件预览',
      imageUri: `data:image/svg+xml,${UI_PREVIEW_SVG}`,
      sourceUri: 'https://docs.example.com',
    },
    {
      domain: 'github.com',
      title: 'Agent console layout reference',
      imageUri: `data:image/svg+xml,${LAYOUT_PREVIEW_SVG}`,
      sourceUri: 'https://github.com/example/ui-lib',
    },
  ],
};

export const GROUNDING_SHOWCASE_TITLE =
  'Grounding 状态示例（网页结果 / 图片结果）';

/** Pre-built HTML matching index.html `#groundingDemoMount`. */
export function buildGroundingShowcaseHtml(): string {
  return (
    buildGroundingHtml(GROUNDING_SHOWCASE_WEB, { open: true }) +
    buildGroundingHtml(GROUNDING_SHOWCASE_IMAGES, { open: true })
  );
}
