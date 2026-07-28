import React, { useEffect, useRef, useState } from 'react';

type ComboFieldProps = {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  mono?: boolean;
  /** 仅能通过下拉选择，输入框不可编辑 */
  readOnly?: boolean;
  /** 下拉是否按输入内容过滤；模型同步列表应设为 false 以展示完整列表 */
  filterOptionsByValue?: boolean;
  /** 选项增多时自动展开（如同步模型成功后） */
  autoOpenWhenOptionsIncrease?: boolean;
};

export const ComboField: React.FC<ComboFieldProps> = ({
  value,
  onChange,
  options,
  placeholder,
  className = '',
  mono = false,
  readOnly = false,
  filterOptionsByValue = false,
  autoOpenWhenOptionsIncrease = false
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const prevOptionsLenRef = useRef(0);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (
      autoOpenWhenOptionsIncrease &&
      options.length > prevOptionsLenRef.current &&
      options.length > 0
    ) {
      setOpen(true);
    }
    prevOptionsLenRef.current = options.length;
  }, [options.length, autoOpenWhenOptionsIncrease]);

  const dropdownOptions = filterOptionsByValue
    ? options.filter((o) => !value || o.toLowerCase().includes(value.toLowerCase()))
    : options;

  return (
    <div ref={rootRef} className="relative">
      <input
        type="text"
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={readOnly ? undefined : (e) => onChange(e.target.value)}
        onFocus={readOnly ? undefined : () => setOpen(false)}
        className={`w-full rounded-xl border border-hairline-strong bg-surface-soft px-4 py-2.5 pr-10 text-xs text-text-charcoal outline-none transition-all focus:border-ink dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:focus:border-white ${mono ? 'font-mono' : ''} ${readOnly ? 'cursor-default bg-surface-soft/80 dark:bg-white/[0.02]' : 'cursor-text'} ${className}`}
      />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={options.length === 0}
        className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-text-stone transition-colors hover:bg-surface hover:text-ink disabled:opacity-40 dark:hover:bg-white/10 dark:hover:text-white"
        aria-label="展开选项"
      >
        <span className="material-symbols-outlined text-lg">expand_more</span>
      </button>
      {open && dropdownOptions.length > 0 ? (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-hairline-strong bg-canvas py-1 shadow-modal dark:border-white/10 dark:bg-surface-dark">
          {dropdownOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              className={`block w-full truncate px-3 py-2 text-left text-xs transition-colors hover:bg-surface-soft dark:hover:bg-white/5 ${mono ? 'font-mono' : ''} ${option === value ? 'bg-surface-lavender text-ink-deep dark:bg-white/10 dark:text-white' : 'text-text-charcoal dark:text-text-secondary'}`}
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};
