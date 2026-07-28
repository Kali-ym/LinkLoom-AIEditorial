import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type {
  Agent,
  AiBuilderMention,
  MCPServerConfig,
  Skill,
  Tool
} from '../../../services/agentService';
import { getEntityIdFormatError, isResourceIdTaken } from '../../../utils/entityId';
import { agentToolNeedsCategoryPicker } from '../../../utils/agentToolBindings';
import { isAdminExclusiveTool } from '../../../domain/consoleCatalog';
import { createAiBuilderMention } from '../aiBuilder/AiBuilderPanel';
import {
  AI_PROVIDER_TYPE_META,
  getProviderDisplayName,
  getProviderTypeLabel,
  listConfigsByType,
  listProviderTypesInUse,
  type AIProviderType
} from '../../settings/fields/ai/aiProviderUtils';

/**
 * B5 拆分：把原 AgentsPage 内 `renderAgents()` 抽到独立组件。
 * state/handler 仍由父级持有，通过 props 注入（与 SkillsTab / WorkflowsTab 一致）。
 */
export interface AgentsTabProps {
  agents: Agent[];
  skills: Skill[];
  tools: Tool[];
  settings: any;
  mcpConfigs: MCPServerConfig[];
  agentTools: Tool[];
  editingAgent: Agent | null;
  foldedGroups: Record<string, boolean>;
  testingAgentId: string | null;
  testInput: string;
  testResults: Record<string, string>;
  testDate: string;
  isSaving: boolean;
  agentOriginalIdRef: React.RefObject<string | null>;
  openAiBuilder: (mention?: AiBuilderMention) => void;
  getToolDisplayName: (tool: Tool) => string;
  formatBindingSummary: (toolId: string, agent: Agent) => string;
  handleAgentToolClick: (tool: Tool) => void;
  handleAgentToolDisable: (tool: Tool, e: React.MouseEvent) => void;
  setFoldedGroups: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setEditingAgent: React.Dispatch<React.SetStateAction<Agent | null>>;
  setTestingAgentId: (id: string | null) => void;
  setTestInput: (v: string) => void;
  setTestResults: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setTestDate: (v: string) => void;
  handleDeleteAgent: (agent: Agent) => void | Promise<void>;
  handleSaveAgent: (agent: Agent) => void | Promise<void>;
  handleRunAgent: (id: string, input: string) => void | Promise<void>;
  handleStartPlatformRun: (id: string, input: string) => void | Promise<void>;
  onViewAgentRuns?: (agentId: string) => void;
  handleCopy: (text: string) => void | Promise<void>;
  handleImportAsDataSource: (content: string, titlePrefix: string) => void | Promise<void>;
}

export const AgentsTab: React.FC<AgentsTabProps> = ({
  agents,
  skills,
  tools,
  settings,
  mcpConfigs,
  agentTools,
  editingAgent,
  foldedGroups,
  testingAgentId,
  testInput,
  testResults,
  testDate,
  isSaving,
  agentOriginalIdRef,
  openAiBuilder,
  getToolDisplayName,
  formatBindingSummary,
  handleAgentToolClick,
  handleAgentToolDisable,
  setFoldedGroups,
  setEditingAgent,
  setTestingAgentId,
  setTestInput,
  setTestResults,
  setTestDate,
  handleDeleteAgent,
  handleSaveAgent,
  handleRunAgent,
  handleStartPlatformRun,
  onViewAgentRuns,
  handleCopy,
  handleImportAsDataSource
}) => {
  const agentIdFmtErr = editingAgent ? getEntityIdFormatError(editingAgent.id) : null;
  const agentIdTakenErr =
    editingAgent &&
    !agentIdFmtErr &&
    isResourceIdTaken(agents, editingAgent.id, agentOriginalIdRef.current);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-lg font-medium text-text-ink dark:text-white shrink-0">Agent 列表</h3>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => openAiBuilder(createAiBuilderMention('create', 'agent'))}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-yellow text-ink rounded-full hover:bg-brand-yellow-deep transition-all text-[13px] font-medium"
          >
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            AI Builder
          </button>
          <button
            onClick={() => {
              agentOriginalIdRef.current = null;
              const defaultProviderId =
                settings.ACTIVE_AI_PROVIDER_ID || settings.AI_PROVIDERS?.[0]?.id || '';
              const defaultProvider = (settings.AI_PROVIDERS || []).find(
                (p: any) => p.id === defaultProviderId
              );
              setEditingAgent({
                id: `agent_${Math.random().toString(36).substr(2, 5)}`,
                name: '新 Agent',
                description: '',
                systemPrompt: '',
                providerId: defaultProviderId,
                model: defaultProvider?.models?.[0] || '',
                temperature: 1.0,
                toolIds: [],
                skillIds: [],
                mcpServerIds: [],
                runtime: {
                  mode: 'classic',
                  maxRounds: 5,
                  returnTrace: true,
                  toolErrorStrategy: 'observe-and-continue',
                  maxRepeatedToolErrors: 2,
                  stopOnRepeatedToolError: true
                },
                knowledgeCategoryIds: [],
                knowledgeSaveCategoryIds: [],
                memoryCategoryIds: [],
                memorySaveCategoryIds: []
              });
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-ink text-white dark:bg-canvas dark:text-ink rounded-full hover:bg-charcoal dark:hover:bg-surface transition-all text-[13px] font-medium"
          >
            <span className="material-symbols-outlined">add</span>
            手动创建
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {Object.entries(
          agents.reduce(
            (acc, agent) => {
              const group = agent.category || '未分类';
              if (!acc[group]) acc[group] = [];
              acc[group].push(agent);
              return acc;
            },
            {} as Record<string, Agent[]>
          )
        )
          .sort(([a], [b]) => {
            if (a === '未分类') return 1;
            if (b === '未分类') return -1;
            return a.localeCompare(b);
          })
          .map(([group, groupAgents]) => (
            <div key={group} className="space-y-4">
              <button
                onClick={() => setFoldedGroups((prev) => ({ ...prev, [group]: !prev[group] }))}
                className="flex items-center gap-2 group/title w-full text-left"
              >
                <h4 className="text-[10px] font-semibold text-text-steel dark:text-text-secondary uppercase tracking-widest">
                  {group}
                </h4>
                <span className="text-[10px] text-text-stone dark:text-text-charcoal font-semibold">
                  ({groupAgents.length})
                </span>
                <span
                  className={`material-symbols-outlined text-sm text-text-stone dark:text-text-charcoal transition-transform ${foldedGroups[group] ? '-rotate-90' : ''}`}
                >
                  expand_more
                </span>
                <div className="flex-1 h-px bg-hairline-soft dark:bg-canvas/5 ml-2"></div>
              </button>

              {!foldedGroups[group] && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {groupAgents.map((agent) => (
                    <div
                      key={agent.id}
                      className="bg-canvas dark:bg-surface-dark rounded-3xl border border-hairline-soft dark:border-white/5 p-6 card-interactive group"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-2xl bg-brand-yellow text-ink flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-3xl fill">
                              smart_toy
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-text-ink dark:text-white truncate">
                                {agent.name}
                              </h4>
                              {agent.streaming && (
                                <span
                                  className="chip-lavender text-[9px] py-0.5 shrink-0"
                                  title="流式输出"
                                >
                                  流式
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-text-slate dark:text-text-secondary line-clamp-1 break-words">
                              {agent.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1 sm:gap-2 shrink-0 flex-wrap justify-end">
                          <button
                            onClick={() => {
                              setTestingAgentId(agent.id);
                              setTestInput('');
                              setTestResults((prev) => {
                                const next = { ...prev };
                                delete next[agent.id];
                                return next;
                              });
                            }}
                            className="w-9 h-9 inline-flex items-center justify-center text-text-stone hover:text-moss-dark hover:bg-teal-light dark:hover:bg-teal-light/10 rounded-full transition-all"
                            title="对话试跑"
                          >
                            <span className="material-symbols-outlined text-xl">play_arrow</span>
                          </button>
                          {onViewAgentRuns && (
                            <button
                              onClick={() => onViewAgentRuns(agent.id)}
                              className="w-9 h-9 inline-flex items-center justify-center text-text-stone hover:text-ink hover:bg-surface dark:hover:bg-canvas/5 rounded-full transition-all"
                              title="查看平台 Runs"
                            >
                              <span className="material-symbols-outlined text-xl">history</span>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              agentOriginalIdRef.current = agent.id;
                              setEditingAgent(agent);
                            }}
                            className="w-9 h-9 inline-flex items-center justify-center text-text-stone hover:text-ink hover:bg-surface dark:hover:bg-canvas/5 rounded-full transition-all"
                          >
                            <span className="material-symbols-outlined text-xl">edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteAgent(agent)}
                            className="w-9 h-9 inline-flex items-center justify-center text-text-stone hover:text-coral-dark hover:bg-coral-light dark:hover:bg-brand-coral/10 rounded-full transition-all"
                          >
                            <span className="material-symbols-outlined text-xl">delete</span>
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3 mb-6">
                        <div className="flex items-center gap-1.5 text-[10px] text-text-stone dark:text-text-secondary overflow-hidden">
                          {agent.providerId && (
                            <span className="flex items-center gap-1 shrink-0">
                              <span className="material-symbols-outlined text-[12px]">memory</span>
                              {getProviderTypeLabel(
                                settings.AI_PROVIDERS?.find((p: any) => p.id === agent.providerId)
                                  ?.type
                              )}
                            </span>
                          )}
                          {agent.providerId && <span className="shrink-0 opacity-50">/</span>}
                          <span
                            className={`truncate ${!agent.providerId ? 'opacity-50 italic' : ''}`}
                            title={
                              getProviderDisplayName(
                                settings.AI_PROVIDERS?.find(
                                  (p: any) => p.id === agent.providerId
                                ) || {}
                              ) || '未选择模型'
                            }
                          >
                            {agent.providerId
                              ? getProviderDisplayName(
                                  settings.AI_PROVIDERS?.find(
                                    (p: any) => p.id === agent.providerId
                                  ) || {}
                                )
                              : '未选择模型'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {agent.skillIds.map((sid) => (
                            <span key={sid} className="chip-lavender text-[10px] py-1">
                              {skills.find((s) => s.id === sid)?.name || sid}
                            </span>
                          ))}
                          {agent.toolIds
                            .filter((tid) => !isAdminExclusiveTool(tid))
                            .map((tid) => (
                            <span key={tid} className="chip-neutral text-[10px] py-1">
                              {tools.find((t) => t.id === tid)
                                ? getToolDisplayName(tools.find((t) => t.id === tid)!)
                                : tid}
                            </span>
                          ))}
                          {(agent.mcpServerIds || []).map((mid) => (
                            <span key={mid} className="chip-teal text-[10px] py-1">
                              {mcpConfigs.find((m) => m.id === mid)?.name || mid}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
      </div>

      {/* Editing Modal */}
      <AnimatePresence>
        {editingAgent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-canvas dark:bg-surface-dark rounded-3xl shadow-modal border border-hairline-soft dark:border-white/10 w-full max-w-2xl max-h-[90vh] overflow-y-auto no-scrollbar p-4 sm:p-6 md:p-8"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-semibold dark:text-white">配置智能体</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      openAiBuilder(
                        agentOriginalIdRef.current
                          ? createAiBuilderMention('agent', editingAgent)
                          : createAiBuilderMention('create', 'agent')
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-yellow text-ink text-xs font-medium hover:bg-brand-yellow-deep transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">auto_awesome</span>
                    AI Builder
                  </button>
                  <button
                    onClick={() => setEditingAgent(null)}
                    className="w-9 h-9 inline-flex items-center justify-center text-text-stone hover:text-text-ink hover:bg-surface dark:hover:bg-canvas/5 dark:hover:text-white rounded-full transition-all"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-text-steel uppercase tracking-widest ml-1">
                      名称
                    </label>
                    <input
                      type="text"
                      value={editingAgent.name}
                      onChange={(e) => setEditingAgent({ ...editingAgent, name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-surface-soft dark:bg-surface-dark border border-hairline-strong dark:border-white/10 rounded-full text-sm outline-none focus:border-ink dark:focus:border-white transition-all dark:text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-text-steel uppercase tracking-widest ml-1">
                      ID
                    </label>
                    <input
                      type="text"
                      value={editingAgent.id}
                      onChange={(e) => setEditingAgent({ ...editingAgent, id: e.target.value })}
                      placeholder="例如 my_agent"
                      spellCheck={false}
                      className={`w-full px-4 py-2.5 bg-surface-soft dark:bg-surface-dark border rounded-full text-sm font-mono outline-none transition-all dark:text-white ${
                        agentIdFmtErr || agentIdTakenErr
                          ? 'border-red-300 dark:border-red-500/40 focus:ring-red-500/20'
                          : 'border-hairline-strong dark:border-white/10 focus:border-ink dark:focus:border-white'
                      }`}
                    />
                    <p className="text-[10px] text-text-stone dark:text-text-secondary leading-relaxed ml-1">
                      新建时预填随机 ID，可按需修改；仅字母、数字、下划线与连字符，长度 1～80。
                    </p>
                    {agentIdFmtErr && (
                      <p className="text-xs text-coral-dark dark:text-red-400 font-medium ml-1">
                        {agentIdFmtErr}
                      </p>
                    )}
                    {!agentIdFmtErr && agentIdTakenErr && (
                      <p className="text-xs text-coral-dark dark:text-red-400 font-medium ml-1">
                        该 ID 已被使用
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-text-steel uppercase tracking-widest ml-1">
                    描述
                  </label>
                  <input
                    type="text"
                    value={editingAgent.description}
                    onChange={(e) =>
                      setEditingAgent({ ...editingAgent, description: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-surface-soft dark:bg-surface-dark border border-hairline-strong dark:border-white/10 rounded-full text-sm outline-none focus:border-ink dark:focus:border-white transition-all dark:text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-text-steel uppercase tracking-widest ml-1">
                    分类 (Category)
                  </label>
                  {editingAgent.category === '__new__' ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        autoFocus
                        placeholder="输入新分类名称..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = (e.target as HTMLInputElement).value.trim();
                            setEditingAgent({ ...editingAgent, category: val || '' });
                          }
                          if (e.key === 'Escape') {
                            setEditingAgent({ ...editingAgent, category: '' });
                          }
                        }}
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          if (val) {
                            setEditingAgent({ ...editingAgent, category: val });
                          } else {
                            setEditingAgent({ ...editingAgent, category: '' });
                          }
                        }}
                        className="flex-1 px-4 py-2.5 bg-surface-soft dark:bg-surface-dark border border-hairline-strong dark:border-white/10 rounded-full text-sm outline-none focus:border-ink dark:focus:border-white transition-all dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => setEditingAgent({ ...editingAgent, category: '' })}
                        className="shrink-0 w-9 h-9 inline-flex items-center justify-center text-text-stone hover:text-text-ink hover:bg-surface dark:hover:bg-canvas/5 rounded-full transition-all"
                      >
                        <span className="material-symbols-outlined text-lg">close</span>
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <select
                        value={editingAgent.category || ''}
                        onChange={(e) =>
                          setEditingAgent({ ...editingAgent, category: e.target.value })
                        }
                        className="w-full appearance-none px-4 py-2.5 bg-surface-soft dark:bg-surface-dark border border-hairline-strong dark:border-white/10 rounded-full text-sm outline-none focus:border-ink dark:focus:border-white transition-all cursor-pointer dark:text-white"
                      >
                        <option value="">未分类</option>
                        {Array.from(new Set(agents.map((a) => a.category).filter(Boolean)))
                          .sort()
                          .map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        <option
                          value="__new__"
                          className="text-text-steel border-t border-hairline pt-1"
                        >
                          + 新建分类...
                        </option>
                      </select>
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-stone">
                        expand_more
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-text-steel uppercase tracking-widest ml-1">
                    系统提示词 (System Prompt)
                  </label>
                  <textarea
                    rows={10}
                    value={editingAgent.systemPrompt}
                    onChange={(e) =>
                      setEditingAgent({ ...editingAgent, systemPrompt: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-surface-soft dark:bg-surface-dark border border-hairline-strong dark:border-white/10 rounded-2xl text-sm font-mono outline-none focus:border-ink dark:focus:border-white transition-all dark:text-white resize-y min-h-[200px]"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(() => {
                    const visibleProviders = (settings.AI_PROVIDERS || []).filter(
                      (p: any) => !(settings.CLOSED_PLUGINS || []).includes(p.id)
                    );
                    const typesInUse = listProviderTypesInUse(visibleProviders);
                    const currentProvider = visibleProviders.find(
                      (p: any) => p.id === editingAgent.providerId
                    );
                    const selectedType =
                      currentProvider?.type || typesInUse[0] || ('' as AIProviderType | '');
                    const configsForType = listConfigsByType(visibleProviders, selectedType);

                    return (
                      <>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-semibold text-text-steel uppercase tracking-widest ml-1">
                            AI 提供商
                          </label>
                          <div className="relative">
                            <select
                              value={selectedType}
                              onChange={(e) => {
                                const type = e.target.value;
                                const first = listConfigsByType(visibleProviders, type)[0];
                                setEditingAgent({
                                  ...editingAgent,
                                  providerId: first?.id || '',
                                  model: first?.models?.[0] || ''
                                });
                              }}
                              className="w-full appearance-none px-4 py-2.5 bg-surface-soft dark:bg-surface-dark border border-hairline-strong dark:border-white/10 rounded-full text-sm outline-none focus:border-ink dark:focus:border-white transition-all cursor-pointer dark:text-white"
                            >
                              <option value="">请选择提供商</option>
                              {typesInUse.map((type) => (
                                <option key={type} value={type}>
                                  {AI_PROVIDER_TYPE_META[type].label}
                                </option>
                              ))}
                            </select>
                            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-stone">
                              expand_more
                            </span>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-semibold text-text-steel uppercase tracking-widest ml-1">
                            模型
                          </label>
                          <div className="relative">
                            {configsForType.length > 0 ? (
                              <>
                                <select
                                  value={editingAgent.providerId}
                                  onChange={(e) => {
                                    const provider = visibleProviders.find(
                                      (p: any) => p.id === e.target.value
                                    );
                                    setEditingAgent({
                                      ...editingAgent,
                                      providerId: e.target.value,
                                      model: provider?.models?.[0] || ''
                                    });
                                  }}
                                  className="w-full appearance-none px-4 py-2.5 bg-surface-soft dark:bg-surface-dark border border-hairline-strong dark:border-white/10 rounded-full text-sm outline-none focus:border-ink dark:focus:border-white transition-all cursor-pointer dark:text-white"
                                >
                                  <option value="">请选择模型</option>
                                  {configsForType.map((p: any) => (
                                    <option key={p.id} value={p.id}>
                                      {getProviderDisplayName(p)}
                                    </option>
                                  ))}
                                </select>
                                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-stone">
                                  expand_more
                                </span>
                              </>
                            ) : (
                              <input
                                type="text"
                                value={editingAgent.model}
                                placeholder="请先在设置中添加该类型的模型配置"
                                disabled
                                className="w-full px-4 py-2.5 bg-surface-soft dark:bg-surface-dark border border-hairline-strong dark:border-white/10 rounded-full text-sm outline-none opacity-60 dark:text-white"
                              />
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-[10px] font-semibold text-text-steel uppercase tracking-widest">
                      Temperature ({editingAgent.temperature})
                    </label>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={editingAgent.temperature}
                    onChange={(e) =>
                      setEditingAgent({
                        ...editingAgent,
                        temperature: parseFloat(e.target.value)
                      })
                    }
                    className="w-full h-2 bg-hairline dark:bg-canvas/10 rounded-full appearance-none cursor-pointer accent-ink"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-text-steel uppercase tracking-widest ml-1">
                    关联技能
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill) => (
                      <button
                        key={skill.id}
                        onClick={() => {
                          const skillIds = editingAgent.skillIds || [];
                          const ids = skillIds.includes(skill.id)
                            ? skillIds.filter((id) => id !== skill.id)
                            : [...skillIds, skill.id];
                          setEditingAgent({ ...editingAgent, skillIds: ids });
                        }}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all border ${
                          (editingAgent.skillIds || []).includes(skill.id)
                            ? 'bg-ink text-white dark:bg-canvas dark:text-ink border-ink dark:border-white shadow-subtle'
                            : 'bg-canvas dark:bg-canvas/5 text-text-slate border-hairline dark:border-white/10'
                        }`}
                      >
                        {skill.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-text-steel uppercase tracking-widest ml-1">
                    可用工具
                  </label>
                  <p className="text-[11px] text-text-slate dark:text-text-secondary ml-1">
                    启用知识库/记忆相关工具时会弹出分类选择；已启用项可点击修改关联，× 移除。
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {agentTools.map((tool) => {
                      const enabled = (editingAgent.toolIds || []).includes(tool.id);
                      const bindingSummary =
                        enabled && agentToolNeedsCategoryPicker(tool.id)
                          ? formatBindingSummary(tool.id, editingAgent)
                          : '';
                      return (
                        <button
                          key={tool.id}
                          type="button"
                          onClick={() => handleAgentToolClick(tool)}
                          className={`group relative pl-3 pr-8 py-1.5 rounded-lg text-[10px] font-semibold transition-all border text-left ${
                            enabled
                              ? 'bg-ink dark:bg-canvas text-white dark:text-ink border-ink dark:border-white shadow-subtle'
                              : 'bg-canvas dark:bg-canvas/5 text-text-slate border-hairline dark:border-white/10'
                          }`}
                          title={tool.description}
                        >
                          <span>{getToolDisplayName(tool)}</span>
                          {bindingSummary && (
                            <span className="block text-[9px] font-normal opacity-80 mt-0.5 max-w-[140px] truncate">
                              {bindingSummary}
                            </span>
                          )}
                          {enabled && (
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => handleAgentToolDisable(tool, e)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter')
                                  handleAgentToolDisable(tool, e as unknown as React.MouseEvent);
                              }}
                              className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 inline-flex items-center justify-center rounded-full hover:bg-canvas/20 dark:hover:bg-ink/20"
                              title="移除工具"
                            >
                              <span className="material-symbols-outlined text-[14px]">close</span>
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {agentTools.length === 0 && (
                      <span className="text-[11px] text-text-stone">
                        暂无可由 Agent 自主调用的工具
                      </span>
                    )}
                  </div>
                </div>

                {mcpConfigs.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-text-steel uppercase tracking-widest ml-1">
                      MCP 工具服务
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {mcpConfigs.map((mcp) => (
                        <button
                          key={mcp.id}
                          onClick={() => {
                            const mcpIds = editingAgent.mcpServerIds || [];
                            const ids = mcpIds.includes(mcp.id)
                              ? mcpIds.filter((id) => id !== mcp.id)
                              : [...mcpIds, mcp.id];
                            setEditingAgent({ ...editingAgent, mcpServerIds: ids });
                          }}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all border flex items-center gap-1.5 ${
                            (editingAgent.mcpServerIds || []).includes(mcp.id)
                              ? 'bg-ink text-white dark:bg-canvas dark:text-ink border-ink dark:border-white shadow-subtle'
                              : 'bg-canvas dark:bg-canvas/5 text-text-slate border-hairline dark:border-white/10'
                          }`}
                        >
                          {mcp.name}
                          {!mcp.enabled && <span className="text-[8px] opacity-60">(已禁用)</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-4 bg-surface-soft dark:bg-canvas/[0.02] rounded-3xl border border-hairline-soft dark:border-white/5 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-ink">psychology</span>
                      <span className="text-xs font-semibold dark:text-white">运行模式</span>
                    </div>
                    <div className="relative min-w-[160px]">
                      <select
                        value={editingAgent.runtime?.mode || 'classic'}
                        onChange={(e) =>
                          setEditingAgent({
                            ...editingAgent,
                            runtime: {
                              ...(editingAgent.runtime || {}),
                              mode: e.target.value as 'classic' | 'react'
                            }
                          })
                        }
                        className="w-full appearance-none px-3 py-2 bg-canvas dark:bg-surface-dark border border-hairline-strong dark:border-white/10 rounded-full text-xs outline-none focus:border-ink dark:focus:border-white transition-all cursor-pointer dark:text-white"
                      >
                        <option value="classic">Classic</option>
                        <option value="react">ReAct</option>
                      </select>
                      <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-text-stone text-base">
                        expand_more
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="space-y-1.5">
                      <span className="text-[10px] font-semibold text-text-steel uppercase tracking-widest ml-1">
                        最大轮次
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={editingAgent.runtime?.maxRounds ?? 5}
                        onChange={(e) =>
                          setEditingAgent({
                            ...editingAgent,
                            runtime: {
                              ...(editingAgent.runtime || {}),
                              maxRounds: Math.max(1, Number(e.target.value) || 5)
                            }
                          })
                        }
                        className="w-full px-4 py-2.5 bg-canvas dark:bg-surface-dark border border-hairline-strong dark:border-white/10 rounded-full text-sm outline-none focus:border-ink dark:focus:border-white transition-all dark:text-white"
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-[10px] font-semibold text-text-steel uppercase tracking-widest ml-1">
                        重复错误上限
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={editingAgent.runtime?.maxRepeatedToolErrors ?? 2}
                        onChange={(e) =>
                          setEditingAgent({
                            ...editingAgent,
                            runtime: {
                              ...(editingAgent.runtime || {}),
                              maxRepeatedToolErrors: Math.max(1, Number(e.target.value) || 2)
                            }
                          })
                        }
                        className="w-full px-4 py-2.5 bg-canvas dark:bg-surface-dark border border-hairline-strong dark:border-white/10 rounded-full text-sm outline-none focus:border-ink dark:focus:border-white transition-all dark:text-white"
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-[10px] font-semibold text-text-steel uppercase tracking-widest ml-1">
                        工具错误策略
                      </span>
                      <div className="relative">
                        <select
                          value={editingAgent.runtime?.toolErrorStrategy || 'observe-and-continue'}
                          onChange={(e) =>
                            setEditingAgent({
                              ...editingAgent,
                              runtime: {
                                ...(editingAgent.runtime || {}),
                                toolErrorStrategy: e.target.value as 'observe-and-continue' | 'stop'
                              }
                            })
                          }
                          className="w-full appearance-none px-4 py-2.5 bg-canvas dark:bg-surface-dark border border-hairline-strong dark:border-white/10 rounded-full text-sm outline-none focus:border-ink dark:focus:border-white transition-all cursor-pointer dark:text-white"
                        >
                          <option value="observe-and-continue">观察错误并继续</option>
                          <option value="stop">工具错误即停止</option>
                        </select>
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-stone">
                          expand_more
                        </span>
                      </div>
                    </label>
                  </div>

                  <label className="inline-flex items-center gap-2 text-[11px] text-text-slate dark:text-text-secondary">
                    <input
                      type="checkbox"
                      checked={editingAgent.runtime?.returnTrace !== false}
                      onChange={(e) =>
                        setEditingAgent({
                          ...editingAgent,
                          runtime: {
                            ...(editingAgent.runtime || {}),
                            returnTrace: e.target.checked
                          }
                        })
                      }
                    />
                    返回结构化执行轨迹
                  </label>
                  <label className="inline-flex items-center gap-2 text-[11px] text-text-slate dark:text-text-secondary">
                    <input
                      type="checkbox"
                      checked={editingAgent.runtime?.stopOnRepeatedToolError !== false}
                      onChange={(e) =>
                        setEditingAgent({
                          ...editingAgent,
                          runtime: {
                            ...(editingAgent.runtime || {}),
                            stopOnRepeatedToolError: e.target.checked
                          }
                        })
                      }
                    />
                    重复同一工具错误时提前停止
                  </label>
                  <p className="text-[10px] text-text-stone">
                    ReAct 模式允许模型在多轮中自主调用已绑定工具，并基于工具观察继续生成最终答案。
                  </p>
                </div>

                <div className="p-4 bg-surface-soft dark:bg-canvas/[0.02] rounded-3xl border border-hairline-soft dark:border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-ink">stream</span>
                      <span className="text-xs font-semibold dark:text-white">流式输出</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={editingAgent.streaming || false}
                        onChange={(e) => {
                          setEditingAgent({ ...editingAgent, streaming: e.target.checked });
                        }}
                      />
                      <div className="w-11 h-6 bg-hairline rounded-full peer peer-checked:bg-ink dark:peer-checked:bg-canvas transition-all after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-canvas dark:peer-checked:after:bg-ink after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                    </label>
                  </div>
                  <p className="text-[10px] text-text-stone mt-2">
                    开启后，智能体将以流式方式返回响应，提升交互体验。
                  </p>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => {
                      let agentToSave = { ...editingAgent };
                      if (!agentToSave.model && agentToSave.providerId) {
                        const provider = (settings.AI_PROVIDERS || []).find(
                          (p: any) => p.id === agentToSave.providerId
                        );
                        if (provider?.models?.length > 0) {
                          agentToSave.model = provider.models[0];
                        }
                      }
                      handleSaveAgent(agentToSave);
                    }}
                    disabled={
                      isSaving || !editingAgent.name.trim() || !!agentIdFmtErr || !!agentIdTakenErr
                    }
                    className="flex-1 py-3 bg-ink text-white dark:bg-canvas dark:text-ink rounded-full font-medium hover:bg-charcoal dark:hover:bg-surface transition-all disabled:opacity-50"
                  >
                    {isSaving ? '保存中...' : '确认保存'}
                  </button>
                  <button
                    onClick={() => setEditingAgent(null)}
                    className="flex-1 py-3 border border-hairline-strong dark:border-white/10 text-text-charcoal dark:text-white rounded-full font-medium hover:bg-surface dark:hover:bg-canvas/10 transition-all"
                  >
                    取消
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Test Modal */}
      <AnimatePresence>
        {testingAgentId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-canvas dark:bg-surface-dark rounded-3xl shadow-modal border border-hairline-soft dark:border-white/10 w-full max-w-lg p-4 sm:p-6 md:p-8"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-teal-light text-moss-dark flex items-center justify-center">
                    <span className="material-symbols-outlined text-2xl">play_arrow</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold dark:text-white">对话验证</h3>
                    <p className="text-xs text-text-stone">
                      {agents.find((a) => a.id === testingAgentId)?.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setTestingAgentId(null)}
                  className="w-9 h-9 inline-flex items-center justify-center text-text-stone hover:text-text-ink hover:bg-surface dark:hover:bg-canvas/5 dark:hover:text-white rounded-full transition-all"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1 space-y-1.5">
                    <label className="text-[10px] font-semibold text-text-steel uppercase tracking-widest ml-1">
                      处理日期
                    </label>
                    <input
                      type="date"
                      value={testDate}
                      onChange={(e) => setTestDate(e.target.value)}
                      className="w-full px-4 py-2 bg-surface-soft dark:bg-surface-dark border border-hairline-strong dark:border-white/10 rounded-full text-sm outline-none focus:border-ink dark:focus:border-white transition-all dark:text-white"
                    />
                  </div>
                </div>
                <textarea
                  rows={3}
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  placeholder="输入对话内容…"
                  className="w-full px-4 py-3 bg-surface-soft dark:bg-surface-dark border border-hairline-strong dark:border-white/10 rounded-2xl text-sm outline-none focus:border-ink dark:focus:border-white transition-all dark:text-white resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      handleRunAgent(testingAgentId, testInput);
                    }
                  }}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    onClick={() => handleStartPlatformRun(testingAgentId, testInput)}
                    disabled={!testInput.trim()}
                    className="w-full py-3 bg-ink text-white dark:bg-white dark:text-ink rounded-full font-medium hover:bg-charcoal dark:hover:bg-surface transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-xl">rocket_launch</span>
                    平台 Run（推荐）
                  </button>
                  <button
                    onClick={() => handleRunAgent(testingAgentId, testInput)}
                    disabled={!testInput.trim() || testResults[testingAgentId] === '正在思考...'}
                    className="w-full py-3 border border-hairline-strong dark:border-white/10 rounded-full font-medium hover:bg-surface-soft dark:hover:bg-canvas/5 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-xl">
                      {testResults[testingAgentId] === '正在思考...' ? 'hourglass_top' : 'bolt'}
                    </span>
                    {testResults[testingAgentId] === '正在思考...' ? '快速试跑中…' : '快速试跑'}
                  </button>
                </div>

                {testResults[testingAgentId] && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[10px] font-semibold text-text-steel uppercase tracking-widest">
                        回复内容
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleCopy(testResults[testingAgentId])}
                          className="flex items-center gap-1 text-[10px] font-semibold text-ink hover:text-charcoal transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">content_copy</span>
                          复制
                        </button>
                        <button
                          onClick={() =>
                            handleImportAsDataSource(
                              testResults[testingAgentId],
                              `智能体对话: ${agents.find((a) => a.id === testingAgentId)?.name}`
                            )
                          }
                          className="flex items-center gap-1 text-[10px] font-semibold text-ink-deep hover:text-ink transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">input</span>
                          导入为数据源
                        </button>
                      </div>
                    </div>
                    <div className="w-full p-4 bg-surface-soft dark:bg-black/20 rounded-2xl text-xs text-text-charcoal dark:text-text-secondary font-mono whitespace-pre-wrap break-words max-h-60 overflow-y-auto border border-hairline-soft dark:border-white/5">
                      {testResults[testingAgentId]}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
