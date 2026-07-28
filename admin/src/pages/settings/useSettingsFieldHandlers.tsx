import React, { useCallback, useState } from 'react';
import { devLogger } from '../../utils/devLogger';
import { isSavedApiKeyDisplay } from '../../utils/secretField';
import {
  getModels,
  testProvider,
  importOPML,
  getApiKeys,
  createApiKey
} from '../../services/settingsService';
import { DynamicConfigFields } from './DynamicConfigFields';
import { agentService } from '../../services/agentService';
import { useToast } from '../../context/ToastContext.js';
import { useMessageDialog } from '../../context/MessageDialogContext';
import type { PluginMetadata, SettingsFieldContext } from './settingsFieldTypes';

type UseSettingsFieldHandlersArgs = {
  settings: Record<string, any>;
  setSettings: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  pluginMetadata: PluginMetadata;
  isLoading: boolean;
  apiKeys: any[];
  setApiKeys: React.Dispatch<React.SetStateAction<any[]>>;
  deletedApiKeyIds: Set<string>;
  setDeletedApiKeyIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  updatedApiKeyIds: Set<string>;
  setUpdatedApiKeyIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  newlyCreatedKey: { name: string; key: string } | null;
  setNewlyCreatedKey: React.Dispatch<React.SetStateAction<{ name: string; key: string } | null>>;
  onOpenIconPicker: (catId: string, currentIcon: string) => void;
  onRequestCreateApiKey: () => void;
  onReloadSettings?: () => void;
};

export function useSettingsFieldHandlers({
  settings,
  setSettings,
  pluginMetadata,
  isLoading,
  apiKeys,
  setApiKeys,
  deletedApiKeyIds,
  setDeletedApiKeyIds,
  updatedApiKeyIds,
  setUpdatedApiKeyIds,
  newlyCreatedKey,
  setNewlyCreatedKey,
  onOpenIconPicker,
  onRequestCreateApiKey,
  onReloadSettings
}: UseSettingsFieldHandlersArgs): SettingsFieldContext & {
  performCreateApiKey: (name: string) => Promise<void>;
  reloadAgentsAndWorkflows: () => Promise<void>;
} {
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();
  const { confirm: showConfirm } = useMessageDialog();

  const [agents, setAgents] = useState<any[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [providerModels, setProviderModels] = useState<Record<string, string[]>>({});
  const [isFetchingModels, setIsFetchingModels] = useState<Record<string, boolean>>({});
  const [isTestingProvider, setIsTestingProvider] = useState<Record<string, boolean>>({});
  const [isImportingOPML, setIsImportingOPML] = useState(false);
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});

  const loadAgentsAndWorkflows = useCallback(async () => {
    const [agentsData, workflowsData] = await Promise.all([
      agentService.getAgents(),
      agentService.getWorkflows()
    ]);
    setAgents(agentsData || []);
    setWorkflows(workflowsData || []);
  }, []);

  React.useEffect(() => {
    void loadAgentsAndWorkflows();
  }, [loadAgentsAndWorkflows]);

  const handleFieldChange = useCallback(
    (key: string, value: any) => {
      setSettings((prev) => {
        if (key.includes('.')) {
          const [parent, child] = key.split('.');
          return {
            ...prev,
            [parent]: {
              ...prev[parent],
              [child]: value
            }
          };
        }
        return { ...prev, [key]: value };
      });
    },
    [setSettings]
  );

  const getFieldValue = useCallback(
    (key: string, defaultValue?: any) => {
      if (!key) return defaultValue;
      if (key.includes('.')) {
        const [parent, child] = key.split('.');
        return settings[parent]?.[child] ?? defaultValue;
      }
      return settings[key] ?? defaultValue;
    },
    [settings]
  );

  const handlePublisherChange = useCallback(
    (id: string, field: string, value: any) => {
      setSettings((prev) => {
        const publishers = [...(prev.PUBLISHERS || [])];
        let idx = publishers.findIndex((p) => p.id === id);
        if (idx === -1) {
          publishers.push({ id, enabled: false, config: {} });
          idx = publishers.length - 1;
        }
        if (field === 'enabled') {
          publishers[idx] = { ...publishers[idx], enabled: value };
        } else {
          publishers[idx] = {
            ...publishers[idx],
            config: { ...(publishers[idx].config || {}), [field]: value }
          };
        }
        return { ...prev, PUBLISHERS: publishers };
      });
    },
    [setSettings]
  );

  const handleStorageChange = useCallback(
    (id: string, field: string, value: any) => {
      setSettings((prev) => {
        const storages = [...(prev.STORAGES || [])];
        let idx = storages.findIndex((s) => s.id === id);
        if (idx === -1) {
          storages.push({ id, enabled: false, config: {} });
          idx = storages.length - 1;
        }
        if (field === 'enabled') {
          storages[idx] = { ...storages[idx], enabled: value };
        } else {
          storages[idx] = {
            ...storages[idx],
            config: { ...(storages[idx].config || {}), [field]: value }
          };
        }
        return { ...prev, STORAGES: storages };
      });
    },
    [setSettings]
  );

  const handleAdapterChange = useCallback(
    (adapterId: string, itemId: string | null, field: string, value: any) => {
      setSettings((prev) => {
        const adapters = [...(prev.ADAPTERS || [])];
        const adapterIdx = adapters.findIndex((a) => a.id === adapterId);
        if (adapterIdx === -1) return prev;
        const updatedAdapter = { ...adapters[adapterIdx] };
        if (itemId === null) {
          (updatedAdapter as any)[field] = value;
        } else {
          const items = [...(updatedAdapter.items || [])];
          const itemIdx = items.findIndex((i) => i.id === itemId);
          if (itemIdx !== -1) {
            items[itemIdx] = { ...items[itemIdx], [field]: value };
            updatedAdapter.items = items;
          }
        }
        adapters[adapterIdx] = updatedAdapter;
        return { ...prev, ADAPTERS: adapters };
      });
    },
    [setSettings]
  );

  const handleAddItem = useCallback(
    (adapterId: string) => {
      setSettings((prev) => {
        const adapters = [...(prev.ADAPTERS || [])];
        const adapterIdx = adapters.findIndex((a) => a.id === adapterId);
        if (adapterIdx === -1) return prev;
        const adapter = adapters[adapterIdx];
        const adapterMeta = pluginMetadata.adapters.find((a) => a.type === adapter.adapterType);
        const newItemId = Math.random().toString(36).substr(2, 9);
        const categories = prev.CATEGORIES || [];
        const defaultCategory = categories[0]?.id || 'rss';
        const newItem: any = {
          id: newItemId,
          name: '新数据项',
          category: defaultCategory,
          enabled: true,
          useProxy: false
        };
        if (adapterMeta?.configFields) {
          adapterMeta.configFields.forEach((f: any) => {
            if (f.default !== undefined && (f.scope === 'item' || !f.scope)) {
              newItem[f.key] = f.default;
            }
          });
        }
        adapters[adapterIdx] = { ...adapter, items: [...(adapter.items || []), newItem] };
        return { ...prev, ADAPTERS: adapters };
      });
    },
    [pluginMetadata.adapters, setSettings]
  );

  const handleDeleteItem = useCallback(
    (adapterId: string, itemId: string) => {
      setSettings((prev) => {
        const adapters = [...(prev.ADAPTERS || [])];
        const adapterIdx = adapters.findIndex((a) => a.id === adapterId);
        if (adapterIdx === -1) return prev;
        const adapter = adapters[adapterIdx];
        adapters[adapterIdx] = {
          ...adapter,
          items: (adapter.items || []).filter((i: any) => i.id !== itemId)
        };
        return { ...prev, ADAPTERS: adapters };
      });
    },
    [setSettings]
  );

  const handleAddAdapter = useCallback(
    (type: string) => {
      const meta = pluginMetadata.adapters.find((a) => a.type === type);
      if (!meta) return;
      setSettings((prev) => {
        const adapters = [...(prev.ADAPTERS || [])];
        const newAdapter = {
          id: `adapter-${Math.random().toString(36).substr(2, 5)}`,
          name: meta.name,
          adapterType: type as any,
          enabled: true,
          apiUrl: '',
          items: []
        };
        return { ...prev, ADAPTERS: [...adapters, newAdapter] };
      });
    },
    [pluginMetadata.adapters, setSettings]
  );

  const handleDeleteAdapter = useCallback(
    async (id: string) => {
      if (
        !(await showConfirm({
          title: '删除适配器组',
          message: '确定要删除整个适配器组及其所有子项吗？',
          confirmLabel: '删除',
          variant: 'danger',
          confirmTone: 'danger'
        }))
      )
        return;
      setSettings((prev) => ({
        ...prev,
        ADAPTERS: (prev.ADAPTERS || []).filter((a: any) => a.id !== id)
      }));
    },
    [setSettings, showConfirm]
  );

  const handleCategoryChange = useCallback(
    (id: string, field: string, value: any) => {
      setSettings((prev) => {
        const categories = [...(prev.CATEGORIES || [])];
        const idx = categories.findIndex((c) => c.id === id);
        if (idx === -1) return prev;
        const oldId = categories[idx].id;
        categories[idx] = { ...categories[idx], [field]: value };
        if (field === 'id' && oldId !== value) {
          const adapters = (prev.ADAPTERS || []).map((adapter: any) => ({
            ...adapter,
            items: (adapter.items || []).map((item: any) =>
              item.category === oldId ? { ...item, category: value } : item
            )
          }));
          return { ...prev, CATEGORIES: categories, ADAPTERS: adapters };
        }
        return { ...prev, CATEGORIES: categories };
      });
    },
    [setSettings]
  );

  const commitAIProvider = useCallback(
    (provider: any) => {
      setSettings((prev) => {
        const providers = [...(prev.AI_PROVIDERS || [])];
        const idx = providers.findIndex((p) => p.id === provider.id);
        const { apiKeyConfigured: _c, ...rest } = provider;
        const primaryModel = rest.models?.length ? rest.models[0] : '';
        const next = {
          ...rest,
          apiKey: rest.apiKey || '',
          models: primaryModel ? [primaryModel] : [],
          modelCapabilities:
            primaryModel && rest.modelCapabilities?.[primaryModel]?.includes('vision')
              ? { [primaryModel]: ['vision'] as const }
              : undefined,
        };
        if (idx >= 0) {
          providers[idx] = { ...providers[idx], ...next };
        } else {
          providers.push(next);
        }
        return { ...prev, AI_PROVIDERS: providers };
      });
    },
    [setSettings]
  );

  const handleDeleteAIProvider = useCallback(
    async (id: string): Promise<boolean> => {
      if (settings.ACTIVE_AI_PROVIDER_ID === id) {
        toastInfo('不能删除当前正在使用的提供商。请先切换到其他提供商。');
        return false;
      }
      setSettings((prev) => ({
        ...prev,
        AI_PROVIDERS: (prev.AI_PROVIDERS || []).filter((p: any) => p.id !== id)
      }));
      return true;
    },
    [settings.ACTIVE_AI_PROVIDER_ID, setSettings, toastInfo]
  );

  const handleMoveCategory = useCallback(
    (id: string, direction: 'up' | 'down') => {
      setSettings((prev) => {
        const categories = [...(prev.CATEGORIES || [])];
        const idx = categories.findIndex((c) => c.id === id);
        if (idx === -1) return prev;
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= categories.length) return prev;
        [categories[idx], categories[targetIdx]] = [categories[targetIdx], categories[idx]];
        return { ...prev, CATEGORIES: categories };
      });
    },
    [setSettings]
  );

  const handleMoveAdapter = useCallback(
    (id: string, direction: 'up' | 'down') => {
      setSettings((prev) => {
        const originalAdapters = [...(prev.ADAPTERS || [])];
        const closedPlugins = prev.CLOSED_PLUGINS || [];
        const visibleIdxs = originalAdapters
          .map((a, i) => (!closedPlugins.includes(a.adapterType) ? i : -1))
          .filter((i) => i !== -1);
        const currentIdxInOriginal = originalAdapters.findIndex((a) => a.id === id);
        if (currentIdxInOriginal === -1) return prev;
        const currentIdxInVisible = visibleIdxs.indexOf(currentIdxInOriginal);
        if (currentIdxInVisible === -1) return prev;
        const targetIdxInVisible =
          direction === 'up' ? currentIdxInVisible - 1 : currentIdxInVisible + 1;
        if (targetIdxInVisible < 0 || targetIdxInVisible >= visibleIdxs.length) return prev;
        const targetIdxInOriginal = visibleIdxs[targetIdxInVisible];
        [originalAdapters[currentIdxInOriginal], originalAdapters[targetIdxInOriginal]] = [
          originalAdapters[targetIdxInOriginal],
          originalAdapters[currentIdxInOriginal]
        ];
        return { ...prev, ADAPTERS: originalAdapters };
      });
    },
    [setSettings]
  );

  const handleMoveAdapterItem = useCallback(
    (adapterId: string, itemId: string, direction: 'up' | 'down') => {
      setSettings((prev) => {
        const adapters = [...(prev.ADAPTERS || [])];
        const adapterIdx = adapters.findIndex((a) => a.id === adapterId);
        if (adapterIdx === -1) return prev;
        const items = [...(adapters[adapterIdx].items || [])];
        const itemIdx = items.findIndex((i) => i.id === itemId);
        if (itemIdx === -1) return prev;
        const targetIdx = direction === 'up' ? itemIdx - 1 : itemIdx + 1;
        if (targetIdx < 0 || targetIdx >= items.length) return prev;
        [items[itemIdx], items[targetIdx]] = [items[targetIdx], items[itemIdx]];
        adapters[adapterIdx] = { ...adapters[adapterIdx], items };
        return { ...prev, ADAPTERS: adapters };
      });
    },
    [setSettings]
  );

  const handleAddCategory = useCallback(() => {
    setSettings((prev) => {
      const categories = [...(prev.CATEGORIES || [])];
      const nextIndex = categories.length + 1;
      const newId = `category_${nextIndex}`;
      return {
        ...prev,
        CATEGORIES: [...categories, { id: newId, label: `新分类 ${nextIndex}`, icon: 'label' }]
      };
    });
  }, [setSettings]);

  const handleDeleteCategory = useCallback(
    async (id: string) => {
      const usingAdapters = (settings.ADAPTERS || []).filter((adapter: any) => {
        if (adapter.enabled === false) return false;
        return (adapter.items || []).some(
          (item: any) => item.enabled !== false && item.category === id
        );
      });
      if (usingAdapters.length > 0) {
        const adapterNames = usingAdapters
          .map((adapter: any) => {
            const items = (adapter.items || [])
              .filter((item: any) => item.enabled !== false && item.category === id)
              .map((item: any) => item.name)
              .filter(Boolean);
            return items.length > 0 ? `${adapter.name}（${items.join('、')}）` : adapter.name;
          })
          .join('；');
        if (
          !(await showConfirm({
            title: '删除分类',
            message: `分类「${id}」正在被适配器 [${adapterNames}] 使用。删除后相关数据源在筛选页可能被隐藏（除非重新指定分类）。是否确定删除？`,
            confirmLabel: '删除',
            variant: 'warning',
            confirmTone: 'danger'
          }))
        ) {
          return;
        }
      }
      setSettings((prev) => ({
        ...prev,
        CATEGORIES: (prev.CATEGORIES || []).filter((c: any) => c.id !== id)
      }));
    },
    [settings.ADAPTERS, setSettings, showConfirm]
  );

  const providerForApiRequest = (provider: any) => {
    const key = typeof provider.apiKey === 'string' ? provider.apiKey : '';
    return {
      ...provider,
      apiKey: isSavedApiKeyDisplay(key) ? '' : key
    };
  };

  const fetchModels = useCallback(
    async (provider: any) => {
      const req = providerForApiRequest(provider);
      if (!req.apiUrl || (!req.apiKey && req.type !== 'OLLAMA' && !provider.apiKeyConfigured)) {
        toastInfo('请先填写 API 地址和 API 密钥');
        return;
      }
      try {
        setIsFetchingModels((prev) => ({ ...prev, [provider.id]: true }));
        const result = await getModels(req);
        const models = Array.isArray(result)
          ? result
          : Array.isArray((result as any)?.data)
            ? (result as any).data
            : [];
        setProviderModels((prev) => ({ ...prev, [provider.id]: models }));
        if (models.length === 0) {
          toastInfo('同步完成，但未获取到模型列表');
        } else {
          toastSuccess(`模型列表同步成功（${models.length} 个）`);
        }
      } catch (error: any) {
        devLogger.error('Failed to fetch models:', error);
        toastError('获取模型列表失败: ' + error.message);
      } finally {
        setIsFetchingModels((prev) => ({ ...prev, [provider.id]: false }));
      }
    },
    [toastInfo, toastSuccess, toastError]
  );

  const handleTestProvider = useCallback(
    async (provider: any) => {
      const req = providerForApiRequest(provider);
      if (!req.apiUrl || (!req.apiKey && req.type !== 'OLLAMA' && !provider.apiKeyConfigured)) {
        toastInfo('请先填写 API 地址和 API 密钥');
        return;
      }
      try {
        setIsTestingProvider((prev) => ({ ...prev, [provider.id]: true }));
        const result = await testProvider(req);
        if (result.status === 'healthy') {
          toastSuccess('连接成功: ' + result.message);
        } else {
          toastError('连接失败: ' + result.message);
        }
      } catch (error: any) {
        devLogger.error('Failed to test provider:', error);
        toastError('连通性检查失败: ' + error.message);
      } finally {
        setIsTestingProvider((prev) => ({ ...prev, [provider.id]: false }));
      }
    },
    [toastInfo, toastSuccess, toastError]
  );

  const handleImportOPML = useCallback(
    (adapterId?: string) => async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        setIsImportingOPML(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const content = event.target?.result as string;
            const result = await importOPML(content, adapterId);
            toastSuccess(`导入成功！共发现 ${result.count} 个订阅源，新增 ${result.added} 个。`);
            onReloadSettings?.();
          } catch (error: any) {
            toastError('导入失败：' + (error.message || '格式不正确'));
          } finally {
            setIsImportingOPML(false);
            e.target.value = '';
          }
        };
        reader.readAsText(file);
      } catch {
        toastError('读取文件失败');
        setIsImportingOPML(false);
      }
    },
    [onReloadSettings, toastSuccess, toastError]
  );

  const handleDeleteApiKey = useCallback(
    async (id: string) => {
      if (
        !(await showConfirm({
          title: '移除 API Key',
          message: '确定要移除此 API Key 吗？',
          confirmLabel: '移除',
          variant: 'danger',
          confirmTone: 'danger'
        }))
      )
        return;
      setApiKeys((prev) => prev.filter((k) => k.id !== id));
      setDeletedApiKeyIds((prev) => new Set(prev).add(id));
      setUpdatedApiKeyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    [setApiKeys, setDeletedApiKeyIds, setUpdatedApiKeyIds, showConfirm]
  );

  const handleCreateApiKey = useCallback(() => {
    onRequestCreateApiKey();
  }, [onRequestCreateApiKey]);

  const performCreateApiKey = useCallback(
    async (name: string) => {
      if (
        !(await showConfirm({
          title: '生成 API Key',
          message: '生成新的 API Key 将立即写入数据库并生效，是否继续？',
          confirmLabel: '生成'
        }))
      )
        return;
      try {
        const result = await createApiKey(name);
        setNewlyCreatedKey({ name, key: result.key });
        const latestFromBackend = await getApiKeys();
        setApiKeys((prev) =>
          latestFromBackend
            .map((bk: any) => {
              const pendingUpdate = prev.find((pk) => pk.id === bk.id);
              if (pendingUpdate && updatedApiKeyIds.has(bk.id)) {
                return { ...bk, ...pendingUpdate };
              }
              return bk;
            })
            .filter((bk: any) => !deletedApiKeyIds.has(bk.id))
        );
        toastSuccess('API Key 已即时生成并生效');
      } catch (error: any) {
        toastError('生成失败: ' + error.message);
      }
    },
    [
      deletedApiKeyIds,
      setApiKeys,
      setNewlyCreatedKey,
      showConfirm,
      toastSuccess,
      toastError,
      updatedApiKeyIds
    ]
  );

  const handleUpdateApiKey = useCallback(
    (id: string, data: any) => {
      setApiKeys((prev) => prev.map((k) => (k.id === id ? { ...k, ...data } : k)));
      setUpdatedApiKeyIds((prev) => new Set(prev).add(id));
    },
    [setApiKeys, setUpdatedApiKeyIds]
  );

  const renderDynamicConfigFields = useCallback(
    (
      fields: any[],
      currentValues: any,
      onChange: (key: string, value: any) => void,
      scope?: 'adapter' | 'item',
      idPrefix?: string
    ) => (
      <DynamicConfigFields
        fields={fields}
        currentValues={currentValues}
        onChange={onChange}
        scope={scope}
        idPrefix={idPrefix}
        showPasswords={showPasswords}
        setShowPasswords={setShowPasswords}
        agents={agents}
        workflows={workflows}
      />
    ),
    [agents, showPasswords, workflows]
  );

  return {
    settings,
    pluginMetadata,
    isLoading,
    agents,
    workflows,
    showPasswords,
    setShowPasswords,
    showApiKeys,
    setShowApiKeys,
    expandedProviders,
    setExpandedProviders,
    providerModels,
    isFetchingModels,
    isTestingProvider,
    isImportingOPML,
    apiKeys,
    setApiKeys,
    newlyCreatedKey,
    setNewlyCreatedKey,
    getFieldValue,
    handleFieldChange,
    handlePublisherChange,
    handleStorageChange,
    handleAdapterChange,
    handleAddItem,
    handleDeleteItem,
    handleAddAdapter,
    handleDeleteAdapter,
    handleMoveAdapter,
    handleMoveAdapterItem,
    handleImportOPML,
    handleCategoryChange,
    handleAddCategory,
    handleDeleteCategory,
    handleMoveCategory,
    onOpenIconPicker,
    commitAIProvider,
    handleDeleteAIProvider,
    handleTestProvider,
    fetchModels,
    handleCreateApiKey,
    handleDeleteApiKey,
    handleUpdateApiKey,
    renderDynamicConfigFields,
    performCreateApiKey,
    reloadAgentsAndWorkflows: loadAgentsAndWorkflows
  };
}

export type SettingsFieldHandlers = ReturnType<typeof useSettingsFieldHandlers>;
