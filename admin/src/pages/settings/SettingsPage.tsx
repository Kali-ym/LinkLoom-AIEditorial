import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { devLogger } from '../../utils/devLogger';
import {
  getSettings,
  saveSettings,
  getPluginMetadata,
  getApiKeys,
  deleteApiKey,
  updateApiKey
} from '../../services/settingsService';
import IconPicker from '../../components/UI/IconPicker';
import InputDialog from '../../components/UI/InputDialog';
import { useToast } from '../../context/ToastContext.js';
import { useMessageDialog } from '../../context/MessageDialogContext';
import SettingsPageShell from './SettingsPageShell';
import SettingsSectionCard from './SettingsSectionCard';
import { SettingsField } from './SettingsField';
import { buildSections, buildTabs } from './sectionsConfig';
import { useSettingsFieldHandlers } from './useSettingsFieldHandlers';
import type { PluginMetadata } from './settingsFieldTypes';
import { backfillCoverage } from '../../services/editorialService';
import { prepareSettingsForSave, sanitizeAiProvidersForForm, sanitizeSmallModelServicesForForm } from '../../utils/secretField';

const Settings: React.FC = () => {
  const { success: toastSuccess, error: toastError } = useToast();
  const { confirm: showConfirm } = useMessageDialog();

  const [activeTab, setActiveTab] = useState('ai');
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [pluginMetadata, setPluginMetadata] = useState<PluginMetadata>({
    adapters: [],
    publishers: [],
    storages: [],
    aiProviders: []
  });
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [deletedApiKeyIds, setDeletedApiKeyIds] = useState<Set<string>>(new Set());
  const [updatedApiKeyIds, setUpdatedApiKeyIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<{ name: string; key: string } | null>(
    null
  );
  const [apiKeyNameDialogOpen, setApiKeyNameDialogOpen] = useState(false);
  const [isBackfillingCoverage, setIsBackfillingCoverage] = useState(false);
  const [iconPickerState, setIconPickerState] = useState({
    isOpen: false,
    catId: null as string | null,
    currentIcon: ''
  });

  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const [data, metadata, apiKeysData] = await Promise.all([
        getSettings(),
        getPluginMetadata(),
        getApiKeys()
      ]);
      const closedPlugins = data?.CLOSED_PLUGINS || [];
      setPluginMetadata({
        adapters: (metadata.adapters || []).filter((a: any) => !closedPlugins.includes(a.type)),
        publishers: (metadata.publishers || []).filter((p: any) => !closedPlugins.includes(p.id)),
        storages: (metadata.storages || []).filter((s: any) => !closedPlugins.includes(s.id)),
        aiProviders: (data?.AI_PROVIDERS || []).filter((p: any) => !closedPlugins.includes(p.id))
      });
      setSettings(
        data
          ? {
              ...data,
              AI_PROVIDERS: sanitizeAiProvidersForForm(data.AI_PROVIDERS || []),
              SMALL_MODEL_SERVICES: sanitizeSmallModelServicesForForm(data.SMALL_MODEL_SERVICES || [])
            }
          : {}
      );
      setApiKeys(apiKeysData || []);
      setDeletedApiKeyIds(new Set());
      setUpdatedApiKeyIds(new Set());
    } catch (error) {
      devLogger.error('Failed to load settings:', error);
      toastError('加载配置失败，请重试');
    } finally {
      setIsLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const fieldHandlers = useSettingsFieldHandlers({
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
    onOpenIconPicker: (catId, currentIcon) =>
      setIconPickerState({ isOpen: true, catId, currentIcon }),
    onRequestCreateApiKey: () => setApiKeyNameDialogOpen(true),
    onReloadSettings: () => void loadSettings()
  });

  const { reloadAgentsAndWorkflows } = fieldHandlers;
  useEffect(() => {
    if (!isLoading) void reloadAgentsAndWorkflows();
  }, [isLoading, reloadAgentsAndWorkflows]);

  const handleSave = useCallback(async () => {
    try {
      setIsSaving(true);
      await saveSettings(prepareSettingsForSave(settings));
      if (deletedApiKeyIds.size > 0) {
        await Promise.all(Array.from(deletedApiKeyIds).map((id) => deleteApiKey(id)));
        setDeletedApiKeyIds(new Set());
      }
      if (updatedApiKeyIds.size > 0) {
        await Promise.all(
          Array.from(updatedApiKeyIds).map((id) => {
            const key = apiKeys.find((k) => k.id === id);
            if (key) return updateApiKey(id, { name: key.name, status: key.status });
            return Promise.resolve();
          })
        );
        setUpdatedApiKeyIds(new Set());
      }
    } catch (error) {
      devLogger.error('Failed to save settings:', error);
      toastError('自动保存失败，请检查网络或控制台。');
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [
    settings,
    deletedApiKeyIds,
    updatedApiKeyIds,
    apiKeys,
    toastError
  ]);

  const readyToAutosaveRef = useRef(false);
  useEffect(() => {
    if (isLoading) {
      readyToAutosaveRef.current = false;
      return;
    }
    if (!readyToAutosaveRef.current) {
      readyToAutosaveRef.current = true;
      return;
    }
    const timer = window.setTimeout(() => {
      void handleSave();
    }, 700);
    return () => window.clearTimeout(timer);
  }, [settings, apiKeys, deletedApiKeyIds, updatedApiKeyIds, isLoading, handleSave]);

  const handleIconSelect = (icon: string) => {
    if (iconPickerState.catId) {
      fieldHandlers.handleCategoryChange(iconPickerState.catId, 'icon', icon);
    }
  };

  const tabs = useMemo(() => buildTabs(pluginMetadata), [pluginMetadata]);
  const sections = useMemo(() => buildSections(settings), [settings]);
  const activeSections = sections.filter(
    (section) => section.tab === activeTab || section.id === activeTab
  );

  const renderField = (field: any) => <SettingsField field={field} ctx={fieldHandlers} />;

  const editorialBackfillFooter = (
    <div className="pt-4 border-t border-hairline-soft dark:border-white/5">
      <p className="text-xs text-text-slate dark:text-text-secondary mb-3">
        从历史存档重建发布覆盖明细与知识库文档（按日期幂等覆盖）。无结构化 editorialPlan
        时仅从正文解析 URL；长期记忆不会写入日报内容。
      </p>
      <button
        type="button"
        disabled={isBackfillingCoverage}
        onClick={async () => {
          if (
            !(await showConfirm({
              title: '重建覆盖明细',
              message: '确定从历史存档重建发布覆盖明细？该操作按日期幂等覆盖。',
              confirmLabel: '开始重建'
            }))
          )
            return;
          setIsBackfillingCoverage(true);
          try {
            const res = await backfillCoverage(80);
            toastSuccess(
              `回填完成：处理 ${res.processed} 条，跳过 ${res.skipped} 条` +
                (res.itemCount !== undefined ? `；覆盖明细 ${res.itemCount} 条` : '') +
                (res.deletedDailyMemoryEntries
                  ? `；清理日报记忆 ${res.deletedDailyMemoryEntries} 条`
                  : '') +
                (res.errors?.length ? `；${res.errors.length} 条失败` : '')
            );
            if (res.errors?.length) devLogger.warn('Coverage backfill errors', res.errors);
          } catch (err: any) {
            toastError(err.message || '回填失败');
          } finally {
            setIsBackfillingCoverage(false);
          }
        }}
        className="px-5 py-2 rounded-full text-sm font-medium btn-pill-primary disabled:opacity-100"
      >
        {isBackfillingCoverage ? '重建中…' : '从历史存档重建发布覆盖明细'}
      </button>
    </div>
  );

  return (
    <SettingsPageShell
      tabs={tabs}
      activeTab={activeTab}
      isLoading={isLoading}
      isSaving={isSaving}
      onTabChange={setActiveTab}
      footer={
        <>
          <IconPicker
            isOpen={iconPickerState.isOpen}
            currentIcon={iconPickerState.currentIcon}
            onClose={() => setIconPickerState((s) => ({ ...s, isOpen: false }))}
            onSelect={handleIconSelect}
          />
          <InputDialog
            isOpen={apiKeyNameDialogOpen}
            onClose={() => setApiKeyNameDialogOpen(false)}
            title="新建互联 API Key"
            description="为该密钥设置便于识别的名称，用于区分不同接入方。生成后立即生效，撤销后对方将失去访问权限。"
            label="密钥名称"
            placeholder="例如：外部助手"
            hint="建议与接入系统或用途一致，便于后续审计与管理。"
            icon="vpn_key"
            inputType="text"
            emptyErrorMessage="请填写 API Key 名称"
            confirmLabel="继续生成"
            onConfirm={(name) => {
              void fieldHandlers.performCreateApiKey(name);
            }}
          />
        </>
      }
    >
      {activeSections.map((section) => (
        <SettingsSectionCard
          key={section.id}
          section={section}
          renderField={renderField}
          footer={section.id === 'editorial' ? editorialBackfillFooter : undefined}
        />
      ))}
    </SettingsPageShell>
  );
};

export default Settings;
