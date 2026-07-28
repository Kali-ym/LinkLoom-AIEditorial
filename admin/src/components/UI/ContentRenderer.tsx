import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import DOMPurify from 'dompurify';
import { proxyHtmlImages, proxyImageUrl } from '../../utils/imageUtils';
import { hasDailyFrontMatter, splitDailyMarkdown } from '../../utils/dailyMarkdown';

interface ContentRendererProps {
  content: string;
  imageProxy?: string;
  className?: string;
}

const DailyTitle = ({ title }: { title: string }) => (
  <h1 className="text-2xl font-medium text-text-ink dark:text-white mb-4 border-b border-hairline-soft dark:border-white/10 pb-3 not-prose">
    {title}
  </h1>
);

const ContentRenderer: React.FC<ContentRendererProps> = memo(({ content, imageProxy, className = '' }) => {
  if (!content) return null;

  let renderContent = content;
  let dailyTitle: string | null = null;
  if (hasDailyFrontMatter(content)) {
    const split = splitDailyMarkdown(content);
    renderContent = split.body;
    dailyTitle = split.displayTitle || null;
  }

  const trimmedContent = renderContent.trim();
  const startsWithTag = trimmedContent.startsWith('<');
  const hasCommonTags = /<(div|p|section|a|span|h[1-6]|ul|ol|li|img|br|table|tr|td|blockquote|pre|code|video|source|iframe|header|footer|main|aside)[\s>]/i.test(
    renderContent
  );
  const hasMarkdownMarkers =
    /[#*_`[\]-]/.test(renderContent) ||
    /^\s*[-+*]\s+/m.test(renderContent) ||
    /^\s*\d+\.\s+/m.test(renderContent) ||
    /^#{1,6}\s+/m.test(renderContent);

  const isHtml = startsWithTag || (hasCommonTags && !hasMarkdownMarkers);

  if (isHtml) {
    const proxiedHtml = proxyHtmlImages(renderContent, imageProxy);
    const sanitizedHtml = DOMPurify.sanitize(proxiedHtml, {
      ADD_TAGS: ['video', 'source'],
      ADD_ATTR: ['controls', 'autoplay', 'loop', 'muted', 'playsinline']
    });

    return (
      <div className={className}>
        {dailyTitle ? <DailyTitle title={dailyTitle} /> : null}
        <div className="preview-html-content break-words" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
      </div>
    );
  }

  return (
    <div
      className={`preview-markdown-content prose dark:prose-invert max-w-none min-w-0 break-words overflow-x-hidden ${className}`}
    >
      {dailyTitle ? <DailyTitle title={dailyTitle} /> : null}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          a: ({ ...props }) => (
            <a
              {...props}
              className="break-all underline decoration-primary/40"
              target="_blank"
              rel="noopener noreferrer"
            />
          ),
          p: ({ ...props }) => <p {...props} className="my-1 leading-relaxed break-words" />,
          li: ({ ...props }) => <li {...props} className="my-0.5 leading-relaxed break-words" />,
          ul: ({ ...props }) => <ul {...props} className="my-1" />,
          ol: ({ ...props }) => <ol {...props} className="my-1" />,
          h2: ({ ...props }) => <h2 {...props} className="mt-3 mb-1.5" />,
          h3: ({ ...props }) => <h3 {...props} className="mt-2.5 mb-1" />,
          pre: ({ children, ...props }) => (
            <pre
              {...props}
              className="whitespace-pre-wrap break-words overflow-x-visible max-w-full text-sm leading-snug my-2 py-2 px-3 bg-surface-soft text-text-charcoal dark:bg-white/5 dark:text-text-secondary rounded-2xl border border-hairline-soft dark:border-white/10 [&_code]:text-inherit"
            >
              {children}
            </pre>
          ),
          code: ({ className, children, ...props }) => {
            const isInline = !className?.includes('language-');
            return isInline ? (
              <code
                {...props}
                className="break-words whitespace-pre-wrap text-[0.9em] text-text-charcoal dark:text-text-secondary bg-surface dark:bg-white/10 px-1 rounded"
              >
                {children}
              </code>
            ) : (
              <code {...props} className="break-words whitespace-pre-wrap text-inherit">
                {children}
              </code>
            );
          },
          img: ({ ...props }) => (
            <img {...props} src={proxyImageUrl(props.src || '', imageProxy)} alt={props.alt || ''} />
          ),
          video: ({ ...props }) => (
            <video
              {...props}
              src={props.src ? proxyImageUrl(props.src, imageProxy) : undefined}
              controls
              className="max-w-full h-auto rounded-2xl shadow-card my-3"
            />
          ),
          source: ({ ...props }) => (
            <source {...props} src={props.src ? proxyImageUrl(props.src, imageProxy) : undefined} />
          )
        }}
      >
        {renderContent}
      </ReactMarkdown>
    </div>
  );
});

export default ContentRenderer;
