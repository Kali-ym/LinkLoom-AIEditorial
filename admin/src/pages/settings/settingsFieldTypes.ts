import type React from 'react';

export type PluginMetadata = {
  adapters: any[];
  publishers: any[];
  storages: any[];
  aiProviders: any[];
};

export type SettingsFieldContext = {
  settings: Record<string, any>;
  pluginMetadata: PluginMetadata;
  isLoading: boolean;
  agents: any[];
  workflows: any[];
  showPasswords: Record<string, boolean>;
  setShowPasswords: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  showApiKeys: Record<string, boolean>;
  setShowApiKeys: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  expandedProviders: Record<string, boolean>;
  setExpandedProviders: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  providerModels: Record<string, string[]>;
  isFetchingModels: Record<string, boolean>;
  isTestingProvider: Record<string, boolean>;
  isImportingOPML: boolean;
  apiKeys: any[];
  setApiKeys: React.Dispatch<React.SetStateAction<any[]>>;
  newlyCreatedKey: { name: string; key: string } | null;
  setNewlyCreatedKey: React.Dispatch<React.SetStateAction<{ name: string; key: string } | null>>;
  getFieldValue: (key: string, defaultValue?: any) => any;
  handleFieldChange: (key: string, value: any) => void;
  handlePublisherChange: (id: string, field: string, value: any) => void;
  handleStorageChange: (id: string, field: string, value: any) => void;
  handleAdapterChange: (
    adapterId: string,
    itemId: string | null,
    field: string,
    value: any
  ) => void;
  handleAddItem: (adapterId: string) => void;
  handleDeleteItem: (adapterId: string, itemId: string) => void;
  handleAddAdapter: (type: string) => void;
  handleDeleteAdapter: (id: string) => void;
  handleMoveAdapter: (id: string, direction: 'up' | 'down') => void;
  handleMoveAdapterItem: (adapterId: string, itemId: string, direction: 'up' | 'down') => void;
  handleImportOPML: (adapterId?: string) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCategoryChange: (id: string, field: string, value: any) => void;
  handleAddCategory: () => void;
  handleDeleteCategory: (id: string) => void;
  handleMoveCategory: (id: string, direction: 'up' | 'down') => void;
  onOpenIconPicker: (catId: string, currentIcon: string) => void;
  commitAIProvider: (provider: any) => void;
  handleDeleteAIProvider: (id: string) => Promise<boolean>;
  handleTestProvider: (provider: any) => void;
  fetchModels: (provider: any) => void;
  handleCreateApiKey: () => void;
  handleDeleteApiKey: (id: string) => void;
  handleUpdateApiKey: (id: string, data: any) => void;
  renderDynamicConfigFields: (
    fields: any[],
    currentValues: any,
    onChange: (key: string, value: any) => void,
    scope?: 'adapter' | 'item',
    idPrefix?: string
  ) => React.ReactNode;
};
