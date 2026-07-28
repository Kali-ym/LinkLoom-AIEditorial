import React from 'react';
import {
  AI_PROVIDER_TYPE_META,
  getProviderDisplayName,
  listConfigsByType,
  listProviderTypesInUse,
  type AIProviderType
} from '../../settings/fields/ai/aiProviderUtils';

const fieldClass =
  'box-border w-full min-w-0 max-w-full px-3 py-2.5 bg-canvas text-sm text-text-ink border border-hairline-soft rounded-xl outline-none focus:ring-2 focus:ring-ink/10 dark:border-white/5 dark:bg-surface-dark dark:text-white';

const labelClass =
  'block text-[11px] font-semibold uppercase tracking-wide text-text-stone break-words dark:text-text-secondary';

interface TemplateVariableDef {
  id: string;
  name: string;
  defaultValue?: unknown;
  description?: string;
}

interface TemplateVariablesFormProps {
  variables: TemplateVariableDef[];
  values: Record<string, string>;
  aiProviders: any[];
  onChange: (id: string, value: string) => void;
}

export const TemplateVariablesForm: React.FC<TemplateVariablesFormProps> = ({
  variables,
  values,
  aiProviders,
  onChange
}) => {
  const selectedProvider = aiProviders.find((provider: any) => provider.id === values.providerId);
  const selectedType = selectedProvider?.type || listProviderTypesInUse(aiProviders)[0] || '';
  const typesInUse = listProviderTypesInUse(aiProviders);
  const configsForType = listConfigsByType(aiProviders, selectedType);

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
      {variables.map((variable) => {
        if (variable.id === 'providerId') {
          return (
            <label key={variable.id} className="block min-w-0 space-y-1.5">
              <span className={labelClass}>{variable.name || 'AI 提供商'}</span>
              {variable.description ? (
                <span className="block text-[11px] leading-relaxed text-text-stone">
                  {variable.description}
                </span>
              ) : null}
              <select
                value={selectedType}
                onChange={(e) => {
                  const type = e.target.value;
                  const first = listConfigsByType(aiProviders, type)[0];
                  onChange('providerId', first?.id || '');
                  onChange('model', first?.models?.[0] || '');
                }}
                className={fieldClass}
              >
                <option value="">选择提供商类型</option>
                {typesInUse.map((type) => (
                  <option key={type} value={type}>
                    {AI_PROVIDER_TYPE_META[type as AIProviderType].label}
                  </option>
                ))}
              </select>
            </label>
          );
        }

        if (variable.id === 'model') {
          return (
            <label key={variable.id} className="block min-w-0 space-y-1.5">
              <span className={labelClass}>{variable.name || '模型'}</span>
              {variable.description ? (
                <span className="block text-[11px] leading-relaxed text-text-stone">
                  {variable.description}
                </span>
              ) : null}
              <select
                value={values.providerId ?? ''}
                onChange={(e) => {
                  const provider = aiProviders.find((item: any) => item.id === e.target.value);
                  onChange('providerId', e.target.value);
                  onChange('model', provider?.models?.[0] || '');
                }}
                className={fieldClass}
              >
                <option value="">选择模型</option>
                {configsForType.map((provider: any) => (
                  <option key={provider.id} value={provider.id}>
                    {getProviderDisplayName(provider)}
                  </option>
                ))}
              </select>
            </label>
          );
        }

        return (
          <label key={variable.id} className="block min-w-0 space-y-1.5 md:col-span-2">
            <span className={labelClass}>{variable.name || variable.id}</span>
            {variable.description ? (
              <span className="block text-[11px] leading-relaxed text-text-stone">
                {variable.description}
              </span>
            ) : null}
            <input
              value={values[variable.id] ?? ''}
              onChange={(e) => onChange(variable.id, e.target.value)}
              className={`${fieldClass} font-mono text-[13px]`}
              spellCheck={false}
            />
          </label>
        );
      })}
    </div>
  );
};
