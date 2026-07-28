import React from 'react';
import type { SettingsFieldContext } from './settingsFieldTypes';

type FieldDef = {
  key: string;
  label: string;
  type: string;
  defaultValue?: unknown;
  placeholder?: string;
  options?: Array<string | { label: string; value: unknown }>;
};

type Props = {
  field: FieldDef;
  ctx: Pick<
    SettingsFieldContext,
    'getFieldValue' | 'handleFieldChange' | 'showPasswords' | 'setShowPasswords'
  >;
};

export const SimpleSettingsField: React.FC<Props> = ({ field, ctx }) => {
  const { getFieldValue, handleFieldChange, showPasswords, setShowPasswords } = ctx;
  const currentValue = getFieldValue(field.key);

  return (
    <div key={field.key} className="space-y-2.5">
      <label className="text-sm font-semibold text-text-charcoal dark:text-text-secondary">
        {field.label}
      </label>
      {field.type === 'select' ? (
        <div className="relative">
          <select
            value={(currentValue ?? field.defaultValue) as string}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            className="w-full appearance-none pl-4 pr-10 py-2.5 bg-surface-soft dark:bg-surface-darker border border-hairline-strong dark:border-white/10 rounded-full text-text-ink dark:text-white focus:border-ink dark:focus:border-white outline-none transition-all cursor-pointer"
          >
            {field.options?.map((opt) => {
              const label = typeof opt === 'string' ? opt : opt.label;
              const value = typeof opt === 'string' ? opt : opt.value;
              return (
                <option key={field.key + String(value)} value={String(value)}>
                  {label}
                </option>
              );
            })}
          </select>
          <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[20px] leading-none text-text-stone">
            expand_more
          </span>
        </div>
      ) : field.type === 'textarea' ? (
        <textarea
          rows={3}
          placeholder={field.placeholder}
          value={(currentValue as string) || ''}
          onChange={(e) => handleFieldChange(field.key, e.target.value)}
          className="w-full px-4 py-2.5 bg-surface-soft dark:bg-surface-darker border border-hairline-strong dark:border-white/10 rounded-2xl text-text-ink dark:text-white placeholder:text-text-stone focus:border-ink dark:focus:border-white outline-none transition-all resize-none"
        />
      ) : (
        <div className="relative">
          <input
            type={
              field.type === 'password'
                ? showPasswords[field.key]
                  ? 'text'
                  : 'password'
                : field.type
            }
            placeholder={field.placeholder}
            value={(currentValue as string) || ''}
            onChange={(e) =>
              handleFieldChange(
                field.key,
                field.type === 'number' ? parseInt(e.target.value, 10) || 0 : e.target.value
              )
            }
            className={`w-full px-4 py-2.5 bg-surface-soft dark:bg-surface-darker border border-hairline-strong dark:border-white/10 rounded-full text-text-ink dark:text-white placeholder:text-text-stone focus:border-ink dark:focus:border-white outline-none transition-all ${field.type === 'password' ? 'pr-12' : ''}`}
          />
          {field.type === 'password' && (
            <button
              type="button"
              onClick={() =>
                setShowPasswords((prev) => ({ ...prev, [field.key]: !prev[field.key] }))
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-stone hover:text-ink transition-colors"
            >
              <span className="material-symbols-outlined text-lg">
                {showPasswords[field.key] ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
