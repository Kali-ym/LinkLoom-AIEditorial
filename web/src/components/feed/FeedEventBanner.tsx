import Link from 'next/link';

interface Props {
  title: string;
  onClearHref: string;
}

export function FeedEventBanner({ title, onClearHref }: Props) {
  return (
    <div
      className="flex items-center justify-between gap-3 border-b border-hairline bg-surface-soft/60 px-5 py-2.5 sm:px-8"
      role="status"
    >
      <p className="min-w-0 truncate text-sm text-body">
        来自热搜：<span className="font-medium text-ink">{title}</span>
      </p>
      <Link
        href={onClearHref}
        className="shrink-0 text-sm font-medium text-muted underline-offset-2 transition-colors hover:text-ink hover:underline"
      >
        清除
      </Link>
    </div>
  );
}
