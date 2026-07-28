import { Fragment, ReactNode } from 'react';

const INLINE_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
const SOURCE_PREFIX_RE = /^(来源[:：]\s*)/;

function renderInline(text: string): ReactNode[] {
  if (!text) return [];
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  const re = new RegExp(INLINE_LINK_RE);
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const [full, label, url] = match;
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    nodes.push(
      <a
        key={`lnk-${key++}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-primary underline decoration-primary/30 hover:text-primary-active"
      >
        {label}
      </a>
    );
    lastIndex = match.index + full.length;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

function renderSourceRest(text: string): ReactNode {
  const rest = text.trim();
  if (/^https?:\/\/\S+$/.test(rest)) {
    return (
      <a
        href={rest}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-primary underline decoration-primary/30 hover:text-primary-active"
      >
        {rest}
      </a>
    );
  }
  return <Fragment>{renderInline(rest)}</Fragment>;
}

function renderSourceBlock(text: string): ReactNode {
  const prefixMatch = text.match(SOURCE_PREFIX_RE);
  const prefix = prefixMatch?.[1] ?? '';
  const rest = prefixMatch ? text.slice(prefix.length) : text;

  return (
    <>
      {prefix ? <span className="text-muted">{prefix}</span> : null}
      {renderSourceRest(rest)}
    </>
  );
}

interface Props {
  body?: string;
  className?: string;
}

export function DailyBodyMarkdown({ body, className = '' }: Props) {
  const text = (body || '').trim();
  if (!text) return null;
  const lines = text.split(/\n+/);
  const paragraphs: { kind: 'p' | 'source'; text: string }[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^来源[:：]/.test(line)) {
      paragraphs.push({ kind: 'source', text: line });
    } else {
      paragraphs.push({ kind: 'p', text: line });
    }
  }

  return (
    <div className={className}>
      {paragraphs.map((para, i) =>
        para.kind === 'source' ? (
          <blockquote
            key={i}
            className="mt-3 break-words border-l-4 border-primary/25 bg-surface-cream px-3 py-2 text-xs leading-relaxed"
          >
            {renderSourceBlock(para.text)}
          </blockquote>
        ) : (
          <p
            key={i}
            className="mt-2 break-words text-[15px] leading-relaxed text-body first:mt-0"
          >
            <Fragment>{renderInline(para.text)}</Fragment>
          </p>
        )
      )}
    </div>
  );
}
