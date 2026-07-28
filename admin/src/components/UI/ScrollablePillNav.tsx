import React, { useCallback, useId } from 'react';
import { motion } from 'framer-motion';

type ScrollablePillNavProps = {
  children: React.ReactNode;
  className?: string;
  trackClassName?: string;
  as?: 'nav' | 'div';
  'aria-label'?: string;
};

/**
 * 横向可滑动的 pill 分类栏外壳。
 * 外层负责 overflow-x，内层 w-max 保证项不被压缩，移动端可左右滑动。
 */
export const ScrollablePillNav: React.FC<ScrollablePillNavProps> = ({
  children,
  className = '',
  trackClassName = '',
  as: Tag = 'div',
  'aria-label': ariaLabel
}) => (
  <div className={`scroll-x-tabs w-full min-w-0 ${className}`.trim()} data-scrollable-pill-nav>
    <Tag
      aria-label={ariaLabel}
      className={`scroll-x-tabs-track inline-flex w-max max-w-none flex-nowrap items-center p-1 rounded-full bg-surface dark:bg-white/5 border border-hairline-soft dark:border-white/10 ${trackClassName}`.trim()}
    >
      {children}
    </Tag>
  </div>
);

export const scrollablePillTabClass = 'shrink-0 whitespace-nowrap';

export type PillTabItem<T extends string = string> = {
  id: T;
  label: string;
  icon?: string;
};

const pillSpring = { type: 'spring' as const, stiffness: 380, damping: 32, mass: 0.85 };

type AnimatedPillTabsProps<T extends string> = {
  tabs: PillTabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
  trackClassName?: string;
  /** 同一页多个实例时需传不同 layoutId，避免指示器串位 */
  layoutId?: string;
  size?: 'sm' | 'md';
  /** ink：黑底白字（默认）；surface：浅色滑块（弹窗内次级 Tab） */
  variant?: 'ink' | 'surface';
  /** 均分轨道宽度（如生成页「素材 / 预览」双 Tab） */
  fullWidth?: boolean;
  'aria-label'?: string;
};

/**
 * 带滑动高亮块的 pill Tab（layout 弹簧动画）。
 */
export function AnimatedPillTabs<T extends string>({
  tabs,
  active,
  onChange,
  className = '',
  trackClassName = '',
  layoutId: layoutIdProp,
  size = 'md',
  variant = 'ink',
  fullWidth = false,
  'aria-label': ariaLabel
}: AnimatedPillTabsProps<T>) {
  const reactId = useId();
  const indicatorLayoutId = layoutIdProp ?? `pill-indicator-${reactId}`;

  const tabPad =
    size === 'sm'
      ? 'px-3 py-1.5 text-[10px] sm:px-4 sm:text-[12px]'
      : 'px-4 py-2 text-[13px] sm:px-5 sm:py-2.5';
  const tabLayout = fullWidth ? 'flex-1 min-w-0 justify-center' : '';
  const iconCls = size === 'sm' ? 'text-[14px] sm:text-[16px]' : 'text-[17px] sm:text-[18px]';
  const isSurface = variant === 'surface';
  const indicatorClass = isSurface
    ? 'absolute inset-0 rounded-md bg-canvas shadow-subtle dark:bg-surface-dark'
    : 'absolute inset-0 rounded-full bg-ink shadow-subtle dark:bg-white';
  const activeTextClass = isSurface ? 'text-ink-deep dark:text-white' : 'text-white dark:text-ink';
  const inactiveTextClass = isSurface
    ? 'text-text-slate hover:text-text-charcoal dark:text-text-secondary dark:hover:text-white'
    : 'text-text-slate hover:text-text-ink dark:text-text-secondary dark:hover:text-white';
  const tabRadius = isSurface ? 'rounded-md' : 'rounded-full';

  const handleTabListKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const currentIndex = tabs.findIndex((tab) => tab.id === active);
      if (currentIndex < 0) return;

      let nextIndex: number | null = null;
      if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = tabs.length - 1;

      if (nextIndex == null) return;
      event.preventDefault();
      onChange(tabs[nextIndex].id);
    },
    [active, onChange, tabs]
  );

  return (
    <ScrollablePillNav
      className={`${fullWidth ? 'w-full' : ''} ${className}`.trim()}
      trackClassName={`${fullWidth ? 'w-full !inline-flex' : ''} ${trackClassName}`.trim()}
      aria-label={ariaLabel}
    >
      <div
        className={`relative flex flex-nowrap items-center ${fullWidth ? 'w-full' : 'inline-flex'}`}
        role="tablist"
        onKeyDown={handleTabListKeyDown}
      >
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(tab.id)}
              className={`relative z-10 inline-flex items-center gap-1 font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 dark:focus-visible:ring-white/30 sm:gap-1.5 ${scrollablePillTabClass} ${tabPad} ${tabRadius} ${tabLayout} ${
                isActive ? activeTextClass : inactiveTextClass
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId={indicatorLayoutId}
                  className={indicatorClass}
                  transition={pillSpring}
                  aria-hidden
                />
              )}
              <span className="relative z-10 inline-flex items-center gap-1.5 sm:gap-2">
                {tab.icon && (
                  <span className={`material-symbols-outlined ${iconCls}`}>{tab.icon}</span>
                )}
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </ScrollablePillNav>
  );
}

export const ScrollableToolbarRow: React.FC<{
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
}> = ({ children, className = '', innerClassName = '' }) => (
  <div className={`scroll-x-tabs w-full min-w-0 ${className}`.trim()}>
    <div
      className={`inline-flex w-max max-w-none flex-nowrap items-center gap-2 pb-0.5 ${innerClassName}`.trim()}
    >
      {children}
    </div>
  </div>
);
