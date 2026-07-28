import { chevronDownSvg, chevronRightSvg, globeSvg, imagesSvg } from './icons';
import { escapeHtml } from './htmlUtils';
import type {
  GroundingCitation,
  GroundingData,
  GroundingImageResult,
} from '../../domain/types/grounding';
import { getHostFromUrl } from '../../utils/url';

export type { GroundingCitation, GroundingData, GroundingImageResult };

function getFaviconHost(item: GroundingCitation | GroundingImageResult): string {
  const c = item as GroundingCitation;
  const i = item as GroundingImageResult;
  return c.favicon || i.domain || getHostFromUrl(c.url || i.sourceUri || i.imageUri || '');
}

function faviconImg(host: string, size = 16): string {
  if (!host) return '<span class="grounding-favicon-fallback">?</span>';
  const letter = host.charAt(0).toUpperCase();
  return (
    `<img src="https://icons.duckduckgo.com/ip3/${escapeHtml(host)}.ico" width="${size}" height="${size}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling&&this.nextElementSibling.classList.remove('hidden')">` +
    `<span class="grounding-favicon-fallback hidden">${letter}</span>`
  );
}

/** Ported from index.html `buildGroundingHtml`. */
export function buildGroundingHtml(
  data: GroundingData,
  opts: { open?: boolean } = {},
): string {
  const citations = data.citations ?? [];
  const imageResults = data.imageResults ?? [];
  const searchQueries = data.searchQueries ?? [];
  const imageSearchQueries = data.imageSearchQueries ?? [];
  const hasWeb = citations.length > 0;
  const hasImages = imageResults.length > 0;
  if (!hasWeb && !hasImages) return '';

  const titleText = hasWeb
    ? `找到 ${citations.length} 条结果`
    : `找到 ${imageResults.length} 张图片`;
  const titleIcon = hasWeb ? globeSvg : imagesSvg;
  const previewItems = hasWeb ? citations : imageResults;
  const faviconStack = previewItems
    .slice(0, 8)
    .map((item, index) => {
      const host = getFaviconHost(item);
      const z = 100 - index;
      return faviconImg(host, 16).replace('<img', `<img style="z-index:${z}"`);
    })
    .join('');

  const openClass = opts.open ? ' open' : '';
  const expanded = opts.open ? 'true' : 'false';
  const chevron = opts.open ? chevronDownSvg : chevronRightSvg;

  const detailParts: string[] = [];
  if (searchQueries.length) {
    detailParts.push(
      '<div class="grounding-section"><span class="grounding-section-label">搜索关键词</span><div class="grounding-tags">' +
        searchQueries.map((q) => `<span class="grounding-tag">${escapeHtml(q)}</span>`).join('') +
        '</div></div>',
    );
  }
  if (hasWeb) {
    detailParts.push(
      '<div class="grounding-citations">' +
        citations
          .map((c) => {
            const host = getFaviconHost(c);
            const title = c.title || host || c.url;
            return (
              `<a class="grounding-citation" href="${escapeHtml(c.url)}" target="_blank" rel="noopener noreferrer">` +
              `<span class="grounding-citation-favicon">${faviconImg(host, 20)}</span>` +
              `<span class="grounding-citation-title">${escapeHtml(title)}</span></a>`
            );
          })
          .join('') +
        '</div>',
    );
  }
  if (imageSearchQueries.length) {
    detailParts.push(
      '<div class="grounding-section"><span class="grounding-section-label">图片搜索关键词</span><div class="grounding-tags">' +
        imageSearchQueries.map((q) => `<span class="grounding-tag">${escapeHtml(q)}</span>`).join('') +
        '</div></div>',
    );
  }
  if (hasImages) {
    detailParts.push(
      '<div class="grounding-image-grid">' +
        imageResults
          .map((item) => {
            const host = getFaviconHost(item);
            const title = (item.title ?? '').replace(/<[^>]*>/g, '');
            const imgSrc =
              item.imageUri ||
              `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="80"><rect fill="%23eef2f7" width="160" height="80"/><text x="80" y="44" text-anchor="middle" fill="%2394a3b8" font-size="11" font-family="system-ui">图片</text></svg>')}`;
            return (
              `<div class="grounding-image-card"><a class="grounding-image-thumb" href="${escapeHtml(item.imageUri || '#')}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(title)}"></a>` +
              `<a class="grounding-image-meta" href="${escapeHtml(item.sourceUri || item.imageUri || '#')}" target="_blank" rel="noopener noreferrer">` +
              (title ? `<div class="grounding-image-title">${escapeHtml(title)}</div>` : '') +
              (host
                ? `<div class="grounding-image-domain">${faviconImg(host, 12)}<span>${escapeHtml(host)}</span></div>`
                : '') +
              '</a></div>'
            );
          })
          .join('') +
        '</div>',
    );
  }

  return (
    `<div class="grounding${openClass}" data-grounding>` +
    `<button class="grounding-head" type="button" aria-expanded="${expanded}">` +
    '<span class="grounding-head-main">' +
    `<span class="grounding-icon">${titleIcon}</span>` +
    `<span class="grounding-title">${titleText}</span>` +
    (opts.open ? '' : `<span class="grounding-favicons">${faviconStack}</span>`) +
    `</span><span class="grounding-chevron">${chevron}</span></button>` +
    `<div class="grounding-detail">${detailParts.join('')}</div></div>`
  );
}
