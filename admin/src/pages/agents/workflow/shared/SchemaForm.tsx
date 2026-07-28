import React from 'react';
import type { WorkflowInputField, WorkflowInputSpec } from '../../../../services/agentService';
import { Chip, SHARED_INPUT_CLASS } from './Section';
import { getByPath, groupFields, isExpressionString, setByPath } from './pathUtils';

/**
 * SchemaForm 是 schema-driven 的表单核心，统一服务于步骤 config 与历史运行入参表单：
 *  1) split-binding 模式：表达式存到 bindings[key]
 *  2) inline-expression 模式：表达式作为字符串值存到 values[path]
 *
 * 模式区分：传 bindings + onBindingChange 即为 split-binding；否则 inline。
 */

export interface ExpressionBinding {
  source: 'static' | 'variable';
  expression?: string;
  value?: unknown;
}

interface Props {
  spec: WorkflowInputSpec;
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  /** split-binding：当字段允许变量时，把表达式存到这里而不是 values。 */
  bindings?: Record<string, ExpressionBinding>;
  onBindingChange?: (key: string, binding: ExpressionBinding | undefined) => void;
  /** 表达式快捷预设（按钮，点击后填入表达式输入框）。 */
  expressionPresets?: Array<{ label: string; value: string; description?: string }>;
  /** 默认折叠的分组名（防止字段过多）。 */
  collapsedGroups?: string[];
  /** 是否隐藏组标题（紧凑视图）。 */
  hideGroupTitles?: boolean;
}

export const SchemaForm: React.FC<Props> = ({
  spec,
  values,
  onChange,
  bindings,
  onBindingChange,
  expressionPresets = [],
  collapsedGroups = [],
  hideGroupTitles
}) => {
  const fields = spec?.fields || [];
  const grouped = React.useMemo(() => groupFields(fields), [fields]);
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const g of grouped) initial[g.name || ''] = !collapsedGroups.includes(g.name || '');
    return initial;
  });

  const splitMode = !!bindings && !!onBindingChange;

  const handleValueChange = (key: string, value: unknown) => {
    onChange(setByPath(values, key, value));
  };

  if (!fields.length) {
    return (
      <div className="rounded-2xl border border-dashed border-hairline-soft dark:border-white/10 p-4 text-xs text-text-slate dark:text-text-stone">
        当前没有可配置的字段。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {grouped.map((group) => {
        const groupKey = group.name || '';
        const open = openGroups[groupKey] !== false;
        return (
          <div key={groupKey} className="space-y-2">
            {!hideGroupTitles && group.name && (
              <button
                type="button"
                onClick={() => setOpenGroups((s) => ({ ...s, [groupKey]: !open }))}
                className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-text-slate dark:text-text-stone hover:text-text-charcoal"
              >
                <span className="material-symbols-outlined text-sm">
                  {open ? 'expand_less' : 'expand_more'}
                </span>
                {group.name}
              </button>
            )}
            {open && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {group.fields.map((field) => (
                  <FieldRow
                    key={field.key}
                    field={field}
                    value={getByPath(values, field.key) ?? field.default}
                    onValueChange={(v) => handleValueChange(field.key, v)}
                    binding={bindings?.[field.key]}
                    onBindingChange={
                      splitMode ? (b) => onBindingChange!(field.key, b) : undefined
                    }
                    expressionPresets={expressionPresets}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

interface FieldRowProps {
  field: WorkflowInputField;
  value: unknown;
  onValueChange: (value: unknown) => void;
  binding?: ExpressionBinding;
  onBindingChange?: (binding: ExpressionBinding | undefined) => void;
  expressionPresets: Array<{ label: string; value: string; description?: string }>;
}

const FieldRow: React.FC<FieldRowProps> = ({
  field,
  value,
  onValueChange,
  binding,
  onBindingChange,
  expressionPresets
}) => {
  const splitMode = !!onBindingChange;
  const wide =
    field.type === 'json' ||
    field.type === 'string-array' ||
    field.type === 'multiselect';

  // 表达式模式判定：
  //  - splitMode: 看 binding.source === 'variable'
  //  - inline: 看 value 自身是否表达式字符串
  const isExpr = splitMode ? binding?.source === 'variable' : isExpressionString(value);

  const allowVariables = field.allowVariables;

  const toggleExpression = () => {
    if (splitMode) {
      if (isExpr) onBindingChange!(undefined);
      else
        onBindingChange!({
          source: 'variable',
          expression: expressionPresets[0]?.value || '${date}'
        });
      return;
    }
    if (isExpr) onValueChange(undefined);
    else onValueChange(expressionPresets[0]?.value || '$.input.');
  };

  const exprValue = splitMode ? binding?.expression || '' : (typeof value === 'string' ? value : '');

  return (
    <div className={`flex flex-col gap-1.5 ${wide ? 'md:col-span-2' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-semibold text-text-charcoal dark:text-text-stone">
          {field.label}
          {field.required && <span className="ml-1 text-rose-500">*</span>}
        </label>
        {allowVariables && (
          <button
            type="button"
            onClick={toggleExpression}
            className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
              isExpr
                ? 'bg-ink text-white border-ink'
                : 'border-hairline-soft dark:border-white/10 text-text-slate hover:text-ink-deep'
            }`}
            title={isExpr ? '切回静态值' : '切换为表达式'}
          >
            {isExpr ? '表达式' : '静态'}
          </button>
        )}
      </div>

      {isExpr ? (
        <ExpressionEditor
          value={exprValue}
          onChange={(expr) => {
            if (splitMode) onBindingChange!({ source: 'variable', expression: expr });
            else onValueChange(expr);
          }}
          presets={expressionPresets}
        />
      ) : (
        <StaticValueEditor field={field} value={value} onChange={onValueChange} />
      )}

      {field.description && (
        <p className="text-[10px] text-text-stone leading-relaxed">{field.description}</p>
      )}
    </div>
  );
};

const ExpressionEditor: React.FC<{
  value: string;
  onChange: (v: string) => void;
  presets: Array<{ label: string; value: string; description?: string }>;
}> = ({ value, onChange, presets }) => (
  <div className="flex flex-col gap-1.5">
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${SHARED_INPUT_CLASS} font-mono`}
      placeholder="$.input.xxx 或 ${date}"
    />
    {presets.length > 0 && (
      <div className="flex flex-wrap gap-1">
        {presets.map((p) => (
          <Chip key={p.value} onClick={() => onChange(p.value)} title={p.description}>
            {p.label}
          </Chip>
        ))}
      </div>
    )}
  </div>
);

const StaticValueEditor: React.FC<{
  field: WorkflowInputField;
  value: unknown;
  onChange: (value: unknown) => void;
}> = ({ field, value, onChange }) => {
  switch (field.type) {
    case 'string':
    case 'date':
      return (
        <input
          type={field.type === 'date' ? 'date' : 'text'}
          value={value !== undefined && value !== null ? String(value) : ''}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value || undefined)}
          className={SHARED_INPUT_CLASS}
        />
      );
    case 'number':
      return (
        <input
          type="number"
          value={value === undefined || value === null || value === '' ? '' : (value as number)}
          placeholder={field.placeholder}
          min={field.min}
          max={field.max}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') onChange(undefined);
            else {
              const n = Number(raw);
              onChange(Number.isFinite(n) ? n : undefined);
            }
          }}
          className={SHARED_INPUT_CLASS}
        />
      );
    case 'boolean':
      return (
        <select
          value={value === undefined ? '' : value ? 'true' : 'false'}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === '' ? undefined : v === 'true');
          }}
          className={SHARED_INPUT_CLASS}
        >
          <option value="">未设置</option>
          <option value="true">是</option>
          <option value="false">否</option>
        </select>
      );
    case 'select':
      return (
        <select
          value={value !== undefined && value !== null ? String(value) : ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          className={SHARED_INPUT_CLASS}
        >
          <option value="">未设置</option>
          {(field.options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    case 'multiselect': {
      const selected: string[] = Array.isArray(value) ? (value as string[]) : [];
      const toggle = (val: string) => {
        const next = selected.includes(val) ? selected.filter((s) => s !== val) : [...selected, val];
        onChange(next.length > 0 ? next : undefined);
      };
      return (
        <div className="flex flex-wrap gap-1.5 p-2 bg-surface-soft dark:bg-surface-darker border border-hairline-soft dark:border-white/10 rounded-lg">
          {(field.options || []).map((opt) => (
            <Chip
              key={opt.value}
              active={selected.includes(opt.value)}
              onClick={() => toggle(opt.value)}
              title={(opt as any).description}
            >
              {opt.label}
            </Chip>
          ))}
        </div>
      );
    }
    case 'string-array': {
      const arr: string[] = Array.isArray(value) ? (value as string[]) : [];
      return (
        <input
          value={arr.join(',')}
          placeholder={field.placeholder || '使用英文逗号分隔'}
          onChange={(e) => {
            const items = e.target.value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
            onChange(items.length > 0 ? items : undefined);
          }}
          className={`${SHARED_INPUT_CLASS} font-mono`}
        />
      );
    }
    case 'json':
      return (
        <textarea
          value={
            value === undefined || value === null
              ? ''
              : typeof value === 'string'
                ? value
                : JSON.stringify(value, null, 2)
          }
          onChange={(e) => {
            const raw = e.target.value;
            if (raw.trim() === '') {
              onChange(undefined);
              return;
            }
            try {
              onChange(JSON.parse(raw));
            } catch {
              onChange(raw);
            }
          }}
          rows={4}
          className={`${SHARED_INPUT_CLASS} font-mono`}
          placeholder='{"key": "value"}'
        />
      );
    default:
      return (
        <input
          value={value !== undefined && value !== null ? String(value) : ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          className={SHARED_INPUT_CLASS}
        />
      );
  }
};
