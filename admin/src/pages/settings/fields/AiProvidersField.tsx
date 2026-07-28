import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { testProvider, testRagService } from '../../../services/settingsService';
import { useToast } from '../../../context/ToastContext.js';
import { useMessageDialog } from '../../../context/MessageDialogContext';
import { AiProviderCard } from './ai/AiProviderCard';
import { AiProviderEditModal } from './ai/AiProviderEditModal';
import { SmallModelCard } from './ai/SmallModelCard';
import { SmallModelEditModal } from './ai/SmallModelEditModal';
import {
  AI_PROVIDER_TYPE_META,
  applyPrimaryModelId,
  createEmptyAIProviderDraft,
  setProviderMultimodalEnabled,
  type AIProviderType,
  type ProviderTestResult
} from './ai/aiProviderUtils';
import {
  createEmptySmallModelDraft,
  SMALL_MODEL_ROLE_META,
  type SmallModelRole,
  type SmallModelService,
  type SmallModelTestResult
} from './ai/smallModelUtils';

export interface AiProvidersFieldProps {
  settings: Record<string, any>;
  showApiKeys: Record<string, boolean>;
  setShowApiKeys: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  providerModels: Record<string, string[]>;
  isFetchingModels: Record<string, boolean>;
  isTestingProvider: Record<string, boolean>;
  onActiveProviderChange: (providerId: string) => void;
  onCommitAIProvider: (provider: any) => void;
  onDeleteAIProvider: (id: string) => Promise<boolean>;
  onFetchModels: (provider: any) => void;
  onFieldChange: (key: string, value: unknown) => void;
}

function providerForApiRequest(provider: any) {
  const key = provider.apiKey || '';
  return {
    ...provider,
    apiKey: /^•+$/.test(key) ? '' : key
  };
}

function smallModelForApiRequest(service: SmallModelService) {
  const { apiKeyConfigured: _configured, ...rest } = service;
  const key = rest.apiKey || '';
  return {
    ...rest,
    apiKey: /^•+$/.test(key) ? '' : key
  };
}

export const AiProvidersField: React.FC<AiProvidersFieldProps> = ({
  settings,
  showApiKeys,
  setShowApiKeys,
  providerModels,
  isFetchingModels,
  isTestingProvider,
  onActiveProviderChange,
  onCommitAIProvider,
  onDeleteAIProvider,
  onFetchModels,
  onFieldChange
}) => {
  const { info: toastInfo, success: toastSuccess } = useToast();
  const { confirm: showConfirm } = useMessageDialog();

  const closedPlugins = settings.CLOSED_PLUGINS || [];
  const providers = (settings.AI_PROVIDERS || []).filter((p: any) => !closedPlugins.includes(p.id));
  const smallServices: SmallModelService[] = settings.SMALL_MODEL_SERVICES || [];

  const [typeFilter, setTypeFilter] = useState<'ALL' | AIProviderType>('ALL');
  const [smallRoleFilter, setSmallRoleFilter] = useState<'ALL' | SmallModelRole>('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftProvider, setDraftProvider] = useState<any | null>(null);
  const [editingSmallId, setEditingSmallId] = useState<string | null>(null);
  const [draftSmall, setDraftSmall] = useState<SmallModelService | null>(null);
  const [testResults, setTestResults] = useState<Record<string, ProviderTestResult>>({});
  const [smallTestResults, setSmallTestResults] = useState<Record<string, SmallModelTestResult>>({});
  const [localTesting, setLocalTesting] = useState<Record<string, boolean>>({});

  const editingProvider = draftProvider;
  const isDraftMode = Boolean(
    draftProvider && !providers.some((provider: any) => provider.id === draftProvider.id)
  );
  const isSmallDraftMode = Boolean(
    draftSmall && !smallServices.some((svc) => svc.id === draftSmall.id)
  );

  const availableTypes = useMemo(() => {
    const set = new Set<AIProviderType>();
    providers.forEach((p: any) => {
      if (AI_PROVIDER_TYPE_META[p.type as AIProviderType]) set.add(p.type);
    });
    return Array.from(set).filter((type) => type !== 'SMALL');
  }, [providers]);

  const filteredProviders = useMemo(() => {
    if (typeFilter === 'ALL') return providers;
    return providers.filter((p: any) => p.type === typeFilter);
  }, [providers, typeFilter]);

  const filteredSmallServices = useMemo(() => {
    if (smallRoleFilter === 'ALL') return smallServices;
    return smallServices.filter((svc) => svc.role === smallRoleFilter);
  }, [smallServices, smallRoleFilter]);

  const availableSmallRoles = useMemo(
    () =>
      (['EMBEDDING', 'RERANK'] as const).filter((role) =>
        smallServices.some((svc) => svc.role === role)
      ),
    [smallServices]
  );

  useEffect(() => {
    if (smallRoleFilter !== 'ALL' && !availableSmallRoles.includes(smallRoleFilter)) {
      setSmallRoleFilter('ALL');
    }
  }, [availableSmallRoles, smallRoleFilter]);

  const activeProviderId = editingProvider?.id;
  const activeSmallId = editingSmallId;

  const commitServices = (next: SmallModelService[]) => onFieldChange('SMALL_MODEL_SERVICES', next);

  const runTest = useCallback(async (provider: any) => {
    const req = providerForApiRequest(provider);
    if (!req.apiUrl || (!req.apiKey && req.type !== 'OLLAMA' && !provider.apiKeyConfigured)) {
      setTestResults((prev) => ({
        ...prev,
        [provider.id]: { status: 'error', message: '请先填写 API 地址和密钥', testedAt: Date.now() }
      }));
      return;
    }

    setLocalTesting((prev) => ({ ...prev, [provider.id]: true }));
    setTestResults((prev) => ({
      ...prev,
      [provider.id]: { status: 'testing', testedAt: Date.now() }
    }));

    try {
      const result = await testProvider(req);
      setTestResults((prev) => ({
        ...prev,
        [provider.id]: {
          status: result.status === 'healthy' ? 'healthy' : 'error',
          message: result.message,
          testedAt: Date.now()
        }
      }));
    } catch (error: any) {
      setTestResults((prev) => ({
        ...prev,
        [provider.id]: {
          status: 'error',
          message: error?.message || '连通性检查失败',
          testedAt: Date.now()
        }
      }));
    } finally {
      setLocalTesting((prev) => ({ ...prev, [provider.id]: false }));
    }
  }, []);

  const runSmallTest = useCallback(
    async (service: SmallModelService) => {
      const req = smallModelForApiRequest(service);
      if (!req.apiUrl?.trim()) {
        setSmallTestResults((prev) => ({
          ...prev,
          [service.id]: {
            status: 'error',
            message: '请先填写接口地址',
            testedAt: Date.now()
          }
        }));
        return;
      }
      if (!req.apiKey && !service.apiKeyConfigured && service.role === 'EMBEDDING' && service.backend !== 'OLLAMA') {
        setSmallTestResults((prev) => ({
          ...prev,
          [service.id]: {
            status: 'error',
            message: '请先填写访问密钥',
            testedAt: Date.now()
          }
        }));
        return;
      }
      setLocalTesting((prev) => ({ ...prev, [service.id]: true }));
      setSmallTestResults((prev) => ({
        ...prev,
        [service.id]: { status: 'testing', testedAt: Date.now() }
      }));
      try {
        const result = await testRagService({ service: req });
        const dimensionText = result.dimensions ? ` · ${result.dimensions} 维` : '';
        setSmallTestResults((prev) => ({
          ...prev,
          [service.id]: {
            status: 'healthy',
            message: `连通性 OK · ${result.durationMs}ms${dimensionText}`,
            testedAt: Date.now()
          }
        }));
      } catch (error: any) {
        setSmallTestResults((prev) => ({
          ...prev,
          [service.id]: {
            status: 'error',
            message: error?.message || '连通性测试失败',
            testedAt: Date.now()
          }
        }));
      } finally {
        setLocalTesting((prev) => ({ ...prev, [service.id]: false }));
      }
    },
    []
  );

  const handleTestAll = async () => {
    for (const provider of filteredProviders) {
      await runTest(provider);
    }
  };

  const handleTestAllSmall = async () => {
    for (const service of filteredSmallServices) {
      await runSmallTest(service);
    }
  };

  const isProviderTesting = (id: string) => Boolean(localTesting[id] || isTestingProvider[id]);

  const openNewDraft = () => {
    const draft = createEmptyAIProviderDraft(typeFilter === 'ALL' || typeFilter === 'SMALL' ? 'OPENAI' : typeFilter);
    setDraftProvider(draft);
    setEditingId(draft.id);
  };

  const openNewSmallDraft = () => {
    const role: SmallModelRole =
      smallRoleFilter === 'RERANK' ? 'RERANK' : 'EMBEDDING';
    const draft = createEmptySmallModelDraft(role);
    setDraftSmall(draft);
    setEditingSmallId(draft.id);
  };

  const openEdit = (provider: any) => {
    setDraftProvider({
      ...provider,
      models: Array.isArray(provider.models) ? [...provider.models] : []
    });
    setEditingId(provider.id);
  };

  const openSmallEdit = (service: SmallModelService) => {
    setDraftSmall({ ...service });
    setEditingSmallId(service.id);
  };

  const openDuplicateDraft = (provider: any) => {
    const newId = `ai-${Math.random().toString(36).substr(2, 5)}`;
    const { apiKeyConfigured: _c, ...rest } = provider;
    setDraftProvider({
      ...rest,
      id: newId,
      name: provider.name ? `${provider.name} (副本)` : '',
      apiKey: provider.apiKey || '',
      apiKeyConfigured: Boolean(provider.apiKeyConfigured && !provider.apiKey)
    });
    setEditingId(newId);
  };

  const openSmallDuplicateDraft = (service: SmallModelService) => {
    const draft = createEmptySmallModelDraft(service.role);
    setDraftSmall({
      ...service,
      ...draft,
      id: draft.id,
      name: service.name ? `${service.name} (副本)` : '',
      apiKey: service.apiKey || '',
      apiKeyConfigured: Boolean(service.apiKeyConfigured && !service.apiKey)
    });
    setEditingSmallId(draft.id);
  };

  const closeEditor = () => {
    setEditingId(null);
    setDraftProvider(null);
  };

  const closeSmallEditor = () => {
    setEditingSmallId(null);
    setDraftSmall(null);
  };

  const handleModalChange = (field: string, value: any) => {
    if (!activeProviderId) return;
    setDraftProvider((prev: any) => {
      if (!prev) return prev;
      if (field === 'type') {
        const next = createEmptyAIProviderDraft(value as AIProviderType);
        return { ...next, id: prev.id, apiKey: prev.apiKey, models: prev.models, name: prev.name };
      }
      if (field === 'models') {
        const models = Array.isArray(value) ? value : prev.models;
        return applyPrimaryModelId(prev, models[0] || '');
      }
      if (field === 'multimodalEnabled') {
        return setProviderMultimodalEnabled(prev, Boolean(value));
      }
      return { ...prev, [field]: value };
    });
  };

  const handleSmallModalChange = (field: string, value: unknown) => {
    if (!draftSmall) return;
    setDraftSmall((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleModalSave = () => {
    if (!editingProvider) return;
    const modelId = editingProvider.models?.[0]?.trim();
    if (!modelId) {
      toastInfo('请填写模型标识');
      return;
    }
    const payload = {
      ...editingProvider,
      name: editingProvider.name?.trim() || modelId,
      models: [modelId]
    };
    onCommitAIProvider(payload);
    closeEditor();
  };

  const handleSmallModalSave = () => {
    if (!draftSmall) return;
    if (!draftSmall.model?.trim()) {
      toastInfo('请填写模型标识');
      return;
    }
    if (!draftSmall.apiUrl?.trim()) {
      toastInfo('请填写接口地址');
      return;
    }
    if (draftSmall.role === 'EMBEDDING' && !draftSmall.dimensions) {
      toastInfo('Embedding 服务需填写向量维度');
      return;
    }
    const payload: SmallModelService = {
      ...draftSmall,
      name: draftSmall.name?.trim() || draftSmall.model.trim()
    };
    const index = smallServices.findIndex((svc) => svc.id === payload.id);
    const next =
      index >= 0
        ? smallServices.map((svc, i) => (i === index ? payload : svc))
        : [...smallServices, payload];
    commitServices(next);
    closeSmallEditor();
    toastSuccess('小模型服务已保存，请在设置页底部保存全局配置');
  };

  const handleDelete = async (provider: any) => {
    if (
      !(await showConfirm({
        title: '删除模型配置',
        message: `确定删除「${provider.name?.trim() || provider.models?.[0] || '此配置'}」？此操作不可撤销。`,
        confirmLabel: '删除',
        confirmTone: 'danger'
      }))
    ) {
      return;
    }
    const ok = await onDeleteAIProvider(provider.id);
    if (ok && editingId === provider.id) closeEditor();
  };

  const handleSmallDelete = async (service: SmallModelService) => {
    if (
      !(await showConfirm({
        title: '删除小模型服务',
        message: `确定删除「${service.name || service.id}」？此操作不可撤销。`,
        confirmLabel: '删除',
        confirmTone: 'danger'
      }))
    ) {
      return;
    }
    commitServices(smallServices.filter((item) => item.id !== service.id));
    if (settings.ACTIVE_EMBEDDING_SERVICE_ID === service.id) {
      onFieldChange('ACTIVE_EMBEDDING_SERVICE_ID', '');
    }
    if (settings.ACTIVE_RERANK_SERVICE_ID === service.id) {
      onFieldChange('ACTIVE_RERANK_SERVICE_ID', '');
    }
    if (editingSmallId === service.id) closeSmallEditor();
  };

  return (
    <div className="col-span-full space-y-10">
      <section className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="text-sm font-semibold text-text-ink dark:text-white">大模型配置</h4>
            <p className="mt-0.5 text-xs text-text-slate">管理 AI 提供商连接、模型与端点设置</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleTestAll}
              disabled={filteredProviders.length === 0}
              className="inline-flex items-center gap-1.5 rounded-full border border-hairline-strong bg-surface-soft px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-slate transition-all hover:border-ink hover:text-ink disabled:opacity-50 dark:border-white/10 dark:hover:border-white dark:hover:text-white"
            >
              <span className="material-symbols-outlined text-sm">bolt</span>
              测试全部
            </button>
            <button
              type="button"
              onClick={openNewDraft}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white transition-all hover:bg-charcoal dark:bg-white dark:text-ink dark:hover:bg-slate-100"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              新增模型
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTypeFilter('ALL')}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
              typeFilter === 'ALL'
                ? 'border-ink/30 bg-surface-lavender text-ink-deep dark:border-white/20 dark:bg-white/10 dark:text-white'
                : 'border-hairline-soft bg-surface-soft text-text-slate hover:border-hairline-strong dark:border-white/10'
            }`}
          >
            全部
            <span className="text-[10px] opacity-70">{providers.length}</span>
          </button>
          {availableTypes.map((type) => {
            const meta = AI_PROVIDER_TYPE_META[type];
            const count = providers.filter((p: any) => p.type === type).length;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setTypeFilter(type)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                  typeFilter === type
                    ? 'border-ink/30 bg-surface-lavender text-ink-deep dark:border-white/20 dark:bg-white/10 dark:text-white'
                    : 'border-hairline-soft bg-surface-soft text-text-slate hover:border-hairline-strong dark:border-white/10'
                }`}
              >
                <span className="material-symbols-outlined text-sm">{meta.icon}</span>
                {meta.shortLabel}
                <span className="text-[10px] opacity-70">{count}</span>
              </button>
            );
          })}
        </div>

        {filteredProviders.length === 0 ? (
          <button
            type="button"
            onClick={openNewDraft}
            className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-hairline py-16 text-text-stone transition-all hover:border-ink/40 hover:bg-surface-soft hover:text-ink dark:border-white/10"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface dark:bg-white/5">
              <span className="material-symbols-outlined">add</span>
            </div>
            <span className="text-sm font-medium">暂无大模型配置，点击新增</span>
          </button>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredProviders.map((provider: any) => (
              <AiProviderCard
                key={provider.id}
                provider={provider}
                isActive={settings.ACTIVE_AI_PROVIDER_ID === provider.id}
                testResult={testResults[provider.id]}
                isTesting={isProviderTesting(provider.id)}
                onTest={() => runTest(provider)}
                onEdit={() => openEdit(provider)}
                onDuplicate={() => openDuplicateDraft(provider)}
                onDelete={() => void handleDelete(provider)}
                onSetActive={() => onActiveProviderChange(provider.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-6 border-t border-hairline-soft pt-8 dark:border-white/10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="text-sm font-semibold text-text-ink dark:text-white">小模型配置</h4>
            <p className="mt-0.5 text-xs text-text-slate">
              配置 Embedding 与 Rerank 小模型连接；生效服务请在运维中心 RAG 面板选择
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleTestAllSmall()}
              disabled={filteredSmallServices.length === 0}
              className="inline-flex items-center gap-1.5 rounded-full border border-hairline-strong bg-surface-soft px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-slate transition-all hover:border-ink hover:text-ink disabled:opacity-50 dark:border-white/10 dark:hover:border-white dark:hover:text-white"
            >
              <span className="material-symbols-outlined text-sm">bolt</span>
              测试全部
            </button>
            <button
              type="button"
              onClick={openNewSmallDraft}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white transition-all hover:bg-charcoal dark:bg-white dark:text-ink dark:hover:bg-slate-100"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              新增模型
            </button>
          </div>
        </div>

        {smallServices.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSmallRoleFilter('ALL')}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                smallRoleFilter === 'ALL'
                  ? 'border-ink/30 bg-surface-lavender text-ink-deep dark:border-white/20 dark:bg-white/10 dark:text-white'
                  : 'border-hairline-soft bg-surface-soft text-text-slate hover:border-hairline-strong dark:border-white/10'
              }`}
            >
              全部
              <span className="text-[10px] opacity-70">{smallServices.length}</span>
            </button>
            {availableSmallRoles.map((role) => {
              const meta = SMALL_MODEL_ROLE_META[role];
              const count = smallServices.filter((svc) => svc.role === role).length;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => setSmallRoleFilter(role)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                    smallRoleFilter === role
                      ? 'border-ink/30 bg-surface-lavender text-ink-deep dark:border-white/20 dark:bg-white/10 dark:text-white'
                      : 'border-hairline-soft bg-surface-soft text-text-slate hover:border-hairline-strong dark:border-white/10'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">{meta.icon}</span>
                  {meta.shortLabel}
                  <span className="text-[10px] opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {filteredSmallServices.length === 0 ? (
          <button
            type="button"
            onClick={openNewSmallDraft}
            className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-hairline py-16 text-text-stone transition-all hover:border-ink/40 hover:bg-surface-soft hover:text-ink dark:border-white/10"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface dark:bg-white/5">
              <span className="material-symbols-outlined">add</span>
            </div>
            <span className="text-sm font-medium">暂无小模型配置，点击新增</span>
          </button>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredSmallServices.map((service) => (
              <SmallModelCard
                key={service.id}
                service={service}
                testResult={smallTestResults[service.id]}
                isTesting={isProviderTesting(service.id)}
                onTest={() => void runSmallTest(service)}
                onEdit={() => openSmallEdit(service)}
                onDuplicate={() => openSmallDuplicateDraft(service)}
                onDelete={() => void handleSmallDelete(service)}
              />
            ))}
          </div>
        )}
      </section>

      <AiProviderEditModal
        open={Boolean(editingProvider)}
        provider={editingProvider}
        isDraft={isDraftMode}
        showApiKey={Boolean(activeProviderId && showApiKeys[activeProviderId])}
        syncedModels={activeProviderId ? providerModels[activeProviderId] || [] : []}
        isFetchingModels={Boolean(activeProviderId && isFetchingModels[activeProviderId])}
        isTesting={Boolean(activeProviderId && isProviderTesting(activeProviderId))}
        testResult={activeProviderId ? testResults[activeProviderId] : undefined}
        onClose={closeEditor}
        onSave={handleModalSave}
        onChange={handleModalChange}
        onToggleApiKey={() =>
          activeProviderId &&
          setShowApiKeys((prev) => ({ ...prev, [activeProviderId]: !prev[activeProviderId] }))
        }
        onFetchModels={() => editingProvider && onFetchModels(editingProvider)}
        onTest={() => editingProvider && runTest(editingProvider)}
      />

      <SmallModelEditModal
        open={Boolean(draftSmall)}
        service={draftSmall}
        isDraft={isSmallDraftMode}
        showApiKey={Boolean(activeSmallId && showApiKeys[activeSmallId])}
        isTesting={Boolean(activeSmallId && isProviderTesting(activeSmallId))}
        testResult={activeSmallId ? smallTestResults[activeSmallId] : undefined}
        onClose={closeSmallEditor}
        onSave={handleSmallModalSave}
        onChange={handleSmallModalChange}
        onToggleApiKey={() =>
          activeSmallId &&
          setShowApiKeys((prev) => ({ ...prev, [activeSmallId]: !prev[activeSmallId] }))
        }
        onTest={() => draftSmall && void runSmallTest(draftSmall)}
      />
    </div>
  );
};
