import { Github } from '@lobehub/icons';
import { Mail } from 'lucide-react';
import { memo, type ComponentProps, type ReactNode } from 'react';

import { FaviconIcon } from '../../../components/FaviconIcon';
import { LinkChip } from './LinkChip';
import { LinearIcon } from './LinearIcon';
import { parseInlineLink } from './parseInlineLink';

const ICON_SIZE = 15;

export const UserUrlChip = memo(function UserUrlChip({
  href,
  label,
}: {
  href: string;
  label?: string;
}) {
  const parsed = parseInlineLink(href);
  const displayLabel = label || parsed?.canonicalLabel || href;

  if (parsed?.kind === 'github') {
    return <LinkChip href={href} icon={<Github size={ICON_SIZE} />} label={displayLabel} />;
  }
  if (parsed?.kind === 'linear') {
    return <LinkChip href={href} icon={<LinearIcon size={ICON_SIZE} />} label={displayLabel} />;
  }
  if (parsed?.kind === 'email') {
    return <LinkChip href={href} icon={<Mail size={ICON_SIZE} />} label={displayLabel} />;
  }

  return (
    <LinkChip
      href={href}
      icon={<FaviconIcon host={parsed?.domain} size={ICON_SIZE} />}
      label={displayLabel}
    />
  );
});

function readLinkLabel(children: ReactNode): string | undefined {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) {
    const parts = children.map((child) => readLinkLabel(child)).filter(Boolean);
    return parts.length > 0 ? parts.join('') : undefined;
  }
  return undefined;
}

export const UserMarkdownAnchor = memo(function UserMarkdownAnchor({
  href,
  children,
  ...rest
}: ComponentProps<'a'>) {
  if (href && parseInlineLink(href)) {
    return <UserUrlChip href={href} label={readLinkLabel(children)} />;
  }

  return (
    <a href={href} rel="noopener noreferrer" target="_blank" {...rest}>
      {children}
    </a>
  );
});
