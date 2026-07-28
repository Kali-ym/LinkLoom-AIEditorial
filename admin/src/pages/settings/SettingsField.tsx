import React from 'react';
import { AiProvidersField } from './fields/AiProvidersField';
import { AdaptersField } from './fields/AdaptersField';
import { CategoriesField } from './fields/CategoriesField';
import { InteropKeysField } from './fields/InteropKeysField';
import { PublishersField } from './fields/PublishersField';
import { StoragesField } from './fields/StoragesField';
import { SimpleSettingsField } from './SimpleSettingsField';
import type { SettingsFieldContext } from './settingsFieldTypes';

type Props = {
  field: { key: string } & Record<string, unknown>;
  ctx: SettingsFieldContext;
};

export const SettingsField: React.FC<Props> = ({ field, ctx }) => {
  switch (field.key) {
    case 'STORAGES':
      return <StoragesField {...ctx} />;
    case 'PUBLISHERS':
      return <PublishersField {...ctx} />;
    case 'AI_PROVIDERS':
      return (
        <AiProvidersField
          settings={ctx.settings}
          showApiKeys={ctx.showApiKeys}
          setShowApiKeys={ctx.setShowApiKeys}
          providerModels={ctx.providerModels}
          isFetchingModels={ctx.isFetchingModels}
          isTestingProvider={ctx.isTestingProvider}
          onActiveProviderChange={(id) => ctx.handleFieldChange('ACTIVE_AI_PROVIDER_ID', id)}
          onCommitAIProvider={ctx.commitAIProvider}
          onDeleteAIProvider={ctx.handleDeleteAIProvider}
          onFetchModels={ctx.fetchModels}
          onFieldChange={ctx.handleFieldChange}
        />
      );
    case 'INTEROP_KEYS':
      return <InteropKeysField {...ctx} />;
    case 'ADAPTERS':
      return <AdaptersField {...ctx} />;
    case 'CATEGORIES':
      return <CategoriesField {...ctx} />;
    default:
      return <SimpleSettingsField field={field as any} ctx={ctx} />;
  }
};
