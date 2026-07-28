'use client';

import { ReactNode } from 'react';

interface Props {
  title: string;
  description?: string;
  toolbarExtra?: ReactNode;
}

export function FeedHeader({ title, description, toolbarExtra }: Props) {
  return (
    <header className="relative border-b border-hairline bg-canvas px-5 pb-6 pt-7 sm:px-8 sm:pb-7 sm:pt-8">
      <div className="flex flex-col gap-5">
        <div className="min-w-0 max-w-2xl">
          <p className="text-[13px] font-medium leading-snug tracking-wide text-muted">
            LinkLoom
          </p>
          <h1 className="mt-2 font-display text-[2.25rem] font-normal leading-[1.08] tracking-[-0.03em] text-ink sm:text-5xl sm:leading-[1.05] sm:tracking-[-0.04em]">
            {title}
          </h1>
          {description && (
            <p className="mt-3 max-w-xl text-base font-normal leading-[1.55] text-slate sm:text-[1.0625rem]">
              {description}
            </p>
          )}
        </div>

        {toolbarExtra ? (
          <div className="flex w-full flex-col gap-3">{toolbarExtra}</div>
        ) : null}
      </div>
    </header>
  );
}
