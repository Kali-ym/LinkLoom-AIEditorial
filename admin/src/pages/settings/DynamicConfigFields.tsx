import React from 'react';

/**
 * 渲染插件 / Provider 的"动态配置字段"——每个 plugin 在元数据里声明 `configSchema`，
 * 这里把每个 field 按 type 渲染为 input / select / textarea。
 *
 * 拆出原因：原来在 SettingsPage 内是一个 ~85 行的内联函数 `renderDynamicConfigFields`，
 * 被 STORAGES / AI_PROVIDERS / ADAPTERS / PUBLISHERS 四处共用，独立成组件避免重复闭包。
 */
export interface DynamicConfigFieldsProps {
  fields: any[];
  currentValues: Record<string, any>;
  onChange: (key: string, value: any) => void;
  scope?: 'adapter' | 'item';
  idPrefix?: string;
  showPasswords: Record<string, boolean>;
  setShowPasswords: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  /** 仅在 type === 'executor' 时需要：用于把 `agent:xxx` / `workflow:xxx` 渲染成可读 label */
  agents: { id: string; name: string }[];
  workflows: { id: string; name: string }[];
}

export const DynamicConfigFields: React.FC<DynamicConfigFieldsProps> = ({
  fields,
  currentValues,
  onChange,
  scope,
  idPrefix,
  showPasswords,
  setShowPasswords,
  agents,
  workflows
}) => {
  const filtered = scope
    ? fields.filter((f) => f.scope === scope || (!f.scope && scope === 'item'))
    : fields;

  return (
    <>
      {filtered.map((field) => {
        const fieldId = idPrefix ? `${idPrefix}-${field.key}` : field.key;
        const isPassword = field.type === 'password';
        const showPassword = showPasswords[fieldId];

        let fieldType = field.type;
        let fieldOptions = field.options;

        if (field.type === 'executor') {
          fieldType = 'select';
          fieldOptions = [
            '',
            ...agents.map((a) => `agent:${a.id}`),
            ...workflows.map((w) => `workflow:${w.id}`)
          ];
        }

        return (
          <div key={field.key} className="space-y-1.5 flex-1 min-w-[150px]">
            <div className="flex items-center gap-1.5 ml-1">
              <label className="text-[10px] font-semibold text-text-steel uppercase tracking-[0.08em]">
                {field.label} {field.required && <span className="text-coral-dark">*</span>}
              </label>
            </div>
            {fieldType === 'select' ? (
              <select
                value={currentValues[field.key] ?? field.default ?? ''}
                onChange={(e) => onChange(field.key, e.target.value)}
                className="w-full px-3 py-1.5 bg-canvas dark:bg-surface-dark border border-hairline-strong dark:border-white/10 rounded-full text-xs text-text-charcoal dark:text-white focus:border-ink dark:focus:border-white outline-none transition-all"
              >
                {fieldOptions?.map((opt: any) => {
                  let displayLabel = opt || '使用默认';
                  if (field.type === 'executor' && opt) {
                    if (opt.startsWith('agent:')) {
                      const id = opt.replace('agent:', '');
                      const agent = agents.find((a) => a.id === id);
                      displayLabel = `[Agent] ${agent ? agent.name : id}`;
                    } else if (opt.startsWith('workflow:')) {
                      const id = opt.replace('workflow:', '');
                      const workflow = workflows.find((w) => w.id === id);
                      displayLabel = `[工作流] ${workflow ? workflow.name : id}`;
                    }
                  }
                  return (
                    <option key={opt} value={opt}>
                      {displayLabel}
                    </option>
                  );
                })}
              </select>
            ) : fieldType === 'textarea' ? (
              <textarea
                value={currentValues[field.key] ?? field.default ?? ''}
                onChange={(e) => onChange(field.key, e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-canvas dark:bg-surface-dark border border-hairline-strong dark:border-white/10 rounded-2xl text-xs text-text-charcoal dark:text-white focus:border-ink dark:focus:border-white outline-none transition-all resize-none"
              />
            ) : (
              <div className="relative">
                <input
                  type={
                    isPassword
                      ? showPassword
                        ? 'text'
                        : 'password'
                      : fieldType === 'number'
                        ? 'number'
                        : 'text'
                  }
                  value={currentValues[field.key] ?? field.default ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    onChange(
                      field.key,
                      fieldType === 'number' ? (val === '' ? 0 : parseInt(val)) : val
                    );
                  }}
                  className={`w-full px-3 py-1.5 bg-canvas dark:bg-surface-dark border border-hairline-strong dark:border-white/10 rounded-full text-xs text-text-charcoal dark:text-white focus:border-ink dark:focus:border-white outline-none transition-all ${isPassword ? 'pr-9' : ''}`}
                />
                {isPassword && (
                  <button
                    type="button"
                    onClick={() =>
                      setShowPasswords((prev) => ({ ...prev, [fieldId]: !prev[fieldId] }))
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-stone hover:text-ink transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
};
