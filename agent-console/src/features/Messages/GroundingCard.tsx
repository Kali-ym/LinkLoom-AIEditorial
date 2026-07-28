import { Block, Flexbox, Image, PreviewGroup, SearchResultCards, Tag } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronRight, Globe, Images } from 'lucide-react';
import { memo, useState, type CSSProperties } from 'react';

import type { GroundingCitation, GroundingData, GroundingImageResult } from '../../domain/types/grounding';
import { getHostFromUrl } from '../../utils/url';

function getFaviconHost(item: GroundingCitation | GroundingImageResult): string {
  const c = item as GroundingCitation;
  const i = item as GroundingImageResult;
  return c.favicon || i.domain || getHostFromUrl(c.url || i.sourceUri || i.imageUri || '');
}

const IMAGE_PLACEHOLDER = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="80"><rect fill="%23eef2f7" width="160" height="80"/><text x="80" y="44" text-anchor="middle" fill="%2394a3b8" font-size="11" font-family="system-ui">图片</text></svg>',
)}`;

const GroundingFavicon = memo(function GroundingFavicon({
  host,
  size = 16,
  stackIndex,
}: {
  host: string;
  size?: number;
  stackIndex?: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const letter = host ? host.charAt(0).toUpperCase() : '?';
  const style: CSSProperties | undefined =
    stackIndex != null ? { zIndex: 100 - stackIndex } : undefined;

  if (!host) {
    return <span style={{ fontSize: 10, opacity: 0.7 }}>?</span>;
  }

  return (
    <>
      {!imgFailed && (
        <img
          src={`https://icons.duckduckgo.com/ip3/${host}.ico`}
          width={size}
          height={size}
          alt=""
          loading="lazy"
          style={{ borderRadius: 4, ...style }}
          onError={() => setImgFailed(true)}
        />
      )}
      {(imgFailed || !host) && (
        <span style={{ fontSize: 10, width: size, height: size, display: 'inline-grid', placeItems: 'center', ...style }}>
          {letter}
        </span>
      )}
    </>
  );
});

/** §C.3 SearchGrounding — Block trigger + Tag + motion expand */
export const GroundingCard = memo(function GroundingCard({
  data,
  defaultExpanded = false,
  id,
}: {
  data: GroundingData;
  defaultExpanded?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(defaultExpanded);
  const [hover, setHover] = useState(false);

  const citations = data.citations ?? [];
  const imageResults = data.imageResults ?? [];
  const searchQueries = data.searchQueries ?? [];
  const imageSearchQueries = data.imageSearchQueries ?? [];
  const hasWeb = citations.length > 0;
  const hasImages = imageResults.length > 0;

  if (!hasWeb && !hasImages) return null;

  const titleText = hasWeb
    ? `找到 ${citations.length} 条结果`
    : `找到 ${imageResults.length} 张图片`;
  const previewItems = hasWeb ? citations : imageResults;

  return (
    <Flexbox gap={4} data-grounding id={id} style={{ width: 'fit-content', maxWidth: '100%' }}>
      <Block
        clickable
        horizontal
        align="center"
        justify="space-between"
        paddingBlock={4}
        paddingInline={8}
        variant="borderless"
        style={{
          borderRadius: 6,
          color: cssVar.colorTextTertiary,
          background: open
            ? cssVar.colorFillTertiary
            : hover
              ? cssVar.colorFillQuaternary
              : undefined,
          cursor: 'pointer',
          width: 'fit-content',
          maxWidth: '100%',
        }}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <Flexbox horizontal align="center" gap={8} style={{ minWidth: 0 }}>
          {hasWeb ? <Globe size={14} /> : <Images size={14} />}
          <span style={{ fontSize: 12 }}>{titleText}</span>
          {!open && (
            <Flexbox horizontal align="center" style={{ marginInlineStart: 4 }}>
              {previewItems.slice(0, 8).map((item, index) => (
                <GroundingFavicon
                  key={`${getFaviconHost(item)}-${index}`}
                  host={getFaviconHost(item)}
                  stackIndex={index}
                />
              ))}
            </Flexbox>
          )}
        </Flexbox>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </Block>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden' }}
            transition={{ duration: 0.2 }}
          >
            <Flexbox gap={12} paddingBlock={8} paddingInline={4}>
              {searchQueries.length > 0 && (
                <Flexbox gap={6}>
                  <span style={{ fontSize: 11, color: cssVar.colorTextTertiary }}>搜索关键词</span>
                  <Flexbox horizontal gap={6} wrap="wrap">
                    {searchQueries.map((q) => (
                      <Tag key={q}>{q}</Tag>
                    ))}
                  </Flexbox>
                </Flexbox>
              )}
              {hasWeb && (
                <SearchResultCards
                  dataSource={citations.map((c) => {
                    const host = getFaviconHost(c);
                    return {
                      title: c.title || host || c.url,
                      url: c.favicon ? `https://${host}` : c.url,
                      summary: c.url,
                      ...( { href: c.url } as { href: string }),
                    };
                  })}
                />
              )}
              {imageSearchQueries.length > 0 && (
                <Flexbox gap={6}>
                  <span style={{ fontSize: 11, color: cssVar.colorTextTertiary }}>图片搜索关键词</span>
                  <Flexbox horizontal gap={6} wrap="wrap">
                    {imageSearchQueries.map((q) => (
                      <Tag key={q}>{q}</Tag>
                    ))}
                  </Flexbox>
                </Flexbox>
              )}
              {hasImages && (
                <PreviewGroup>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                      gap: 8,
                    }}
                  >
                    {imageResults.map((item, index) => {
                      const title = (item.title ?? '').replace(/<[^>]*>/g, '');
                      const imgSrc = item.imageUri || IMAGE_PLACEHOLDER;
                      return (
                        <Image
                          key={`${imgSrc}-${index}`}
                          alt={title}
                          src={imgSrc}
                          style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 6 }}
                        />
                      );
                    })}
                  </div>
                </PreviewGroup>
              )}
            </Flexbox>
          </motion.div>
        )}
      </AnimatePresence>
    </Flexbox>
  );
});
