import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { MCPServerConfig, Tool } from '../../../services/agentService';
import { getEntityIdFormatError, isResourceIdTaken } from '../../../utils/entityId';
import {
  filterPublicCatalogTools,
  getPublicToolCategories,
  type ToolCategory,
} from '../../../domain/consoleCatalog';

const CATEGORY_STYLES: Record<ToolCategory['color'], { bg: string; icon: string; badge: string }> = {
  sky: {
    bg: 'bg-sky-50/70 dark:bg-sky-500/8 border-sky-200/70 dark:border-sky-500/20',
    icon: 'bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-300',
    badge: 'bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300'
  },
  teal: {
    bg: 'bg-teal-50/70 dark:bg-teal-500/8 border-teal-200/70 dark:border-teal-500/20',
    icon: 'bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-300',
    badge: 'bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300'
  },
  amber: {
    bg: 'bg-amber-50/70 dark:bg-amber-500/8 border-amber-200/70 dark:border-amber-500/20',
    icon: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300',
    badge: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
  },
  violet: {
    bg: 'bg-violet-50/70 dark:bg-violet-500/8 border-violet-200/70 dark:border-violet-500/20',
    icon: 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-300',
    badge: 'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300'
  },
  rose: {
    bg: 'bg-rose-50/70 dark:bg-rose-500/8 border-rose-200/70 dark:border-rose-500/20',
    icon: 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300',
    badge: 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300'
  },
  emerald: {
    bg: 'bg-emerald-50/70 dark:bg-emerald-500/8 border-emerald-200/70 dark:border-emerald-500/20',
    icon: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300',
    badge: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
  },
  slate: {
    bg: 'bg-slate-50/70 dark:bg-slate-500/8 border-slate-200/70 dark:border-slate-500/20',
    icon: 'bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-300',
    badge: 'bg-slate-100 dark:bg-slate-500/20 text-slate-700 dark:text-slate-300'
  },
  indigo: {
    bg: 'bg-indigo-50/70 dark:bg-indigo-500/8 border-indigo-200/70 dark:border-indigo-500/20',
    icon: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300',
    badge: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300'
  },
  orange: {
    bg: 'bg-orange-50/70 dark:bg-orange-500/8 border-orange-200/70 dark:border-orange-500/20',
    icon: 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-300',
    badge: 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300'
  },
  red: {
    bg: 'bg-red-50/70 dark:bg-red-500/8 border-red-200/70 dark:border-red-500/20',
    icon: 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-300',
    badge: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300'
  },
  purple: {
    bg: 'bg-purple-50/70 dark:bg-purple-500/8 border-purple-200/70 dark:border-purple-500/20',
    icon: 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300',
    badge: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300'
  }
};

/**
 * B5 拆分：把原 AgentsPage 内 `renderTools()` 抽到独立组件。
 * state/handler 仍由父级持有，通过 props 注入（与 SkillsTab / WorkflowsTab 一致）。
 */
export interface ToolsTabProps {
  visibleToolCatalog: Tool[];
  mcpConfigs: MCPServerConfig[];
  editingMCP: MCPServerConfig | null;
  isSaving: boolean;
  mcpOriginalIdRef: React.RefObject<string | null>;
  getToolDisplayName: (tool: Tool) => string;
  setExecutingTool: (tool: Tool | null) => void;
  setToolArguments: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  setToolExecutionResult: React.Dispatch<React.SetStateAction<any>>;
  setEditingMCP: React.Dispatch<React.SetStateAction<MCPServerConfig | null>>;
  createEmptyMCP: () => MCPServerConfig;
  handleDeleteMCP: (id: string) => void | Promise<void>;
  handleSaveMCP: (config: MCPServerConfig) => void | Promise<void>;
  foldedGroups: Record<string, boolean>;
  setFoldedGroups: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

export const ToolsTab: React.FC<ToolsTabProps> = ({
  visibleToolCatalog,
  mcpConfigs,
  editingMCP,
  isSaving,
  mcpOriginalIdRef,
  getToolDisplayName,
  setExecutingTool,
  setToolArguments,
  setToolExecutionResult,
  setEditingMCP,
  createEmptyMCP,
  handleDeleteMCP,
  handleSaveMCP,
  foldedGroups,
  setFoldedGroups
}) => {
  const mcpIdFmtErr = editingMCP ? getEntityIdFormatError(editingMCP.id) : null;
  const mcpIdTakenErr =
    editingMCP &&
    !mcpIdFmtErr &&
    isResourceIdTaken(mcpConfigs, editingMCP.id, mcpOriginalIdRef.current);

  const publicToolCatalog = filterPublicCatalogTools(visibleToolCatalog);
  const toolMap = new Map(publicToolCatalog.map((t) => [t.id, t]));
  const publicCategories = getPublicToolCategories();

  // Filter categories to only those with at least one matching tool
  const activeCategories = publicCategories
    .map((cat) => {
      const tools = cat.toolIds.map((id) => toolMap.get(id)).filter(Boolean) as Tool[];
      return { ...cat, tools };
    })
    .filter((cat) => cat.tools.length > 0);

  // Tools that don't belong to any category (rare fallback)
  const categorizedIds = new Set(publicCategories.flatMap((c) => c.toolIds));
  const uncategorizedTools = publicToolCatalog.filter((t) => !categorizedIds.has(t.id));

  const toggleFold = (catId: string) =>
    setFoldedGroups((prev) => ({ ...prev, [catId]: !prev[catId] }));

  return (
    <div className="space-y-6">
      <div className="bg-surface-lavender dark:bg-purple-500/5 border border-hairline dark:border-violet-500/10 p-6 rounded-3xl">
        <div className="flex items-center gap-3 mb-2 text-ink-deep dark:text-violet-300">
          <span className="material-symbols-outlined">info</span>
          <h4 className="font-semibold">关于工具箱</h4>
        </div>
        <p className="text-sm text-ink-deep/80 dark:text-violet-300/80 leading-relaxed">
          工具分为 Agent
          自主调用工具、工作流流程动作和系统内部能力。普通列表默认隐藏系统内部工具，避免把批处理等执行细节当成业务步骤。
        </p>
      </div>

      {/* Categorized Tools Section */}
      <div>
        <h3 className="text-lg font-medium text-text-ink dark:text-white mb-4">工具列表</h3>

        {activeCategories.map((cat) => {
          const styles = CATEGORY_STYLES[cat.color];
          const folded = !!foldedGroups[cat.id];
          return (
            <div key={cat.id} className="mb-6">
              {/* Category Header */}
              <button
                onClick={() => toggleFold(cat.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border mb-3 transition-all text-left ${styles.bg} hover:opacity-80`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${styles.icon}`}>
                  <span className="material-symbols-outlined text-lg leading-none">{cat.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-sm text-text-ink dark:text-white">{cat.label}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles.badge}`}>
                    {cat.tools.length}
                  </span>
                  <span className="material-symbols-outlined text-base text-text-slate transition-transform duration-200" style={{ transform: folded ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                    expand_more
                  </span>
                </div>
              </button>

              {/* Category Tools Grid */}
              <AnimatePresence initial={false}>
                {!folded && (
                  <motion.div
                    key="content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-2">
                      {cat.tools.map((tool) => (
                        <div
                          key={tool.id}
                          className="bg-canvas dark:bg-surface-dark rounded-2xl border border-hairline-soft dark:border-white/5 p-4 card-interactive-subtle flex flex-col"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${styles.icon}`}>
                                <span className="material-symbols-outlined text-lg leading-none">{cat.icon}</span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="font-medium text-sm text-text-ink dark:text-white truncate">
                                  {getToolDisplayName(tool)}
                                </h4>
                                <p className="text-[10px] text-text-slate dark:text-text-secondary">
                                  {tool.id}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setExecutingTool(tool);
                                setToolArguments({});
                                setToolExecutionResult(null);
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 bg-surface-lavender text-ink-deep rounded-full hover:bg-ink hover:text-white transition-all text-[11px] font-medium shrink-0 ml-2"
                            >
                              <span className="material-symbols-outlined text-sm">play_arrow</span>
                              执行
                            </button>
                          </div>
                          <p className="text-xs text-text-charcoal dark:text-text-secondary leading-relaxed flex-1 break-words">
                            {tool.description}
                          </p>
                          <div className="mt-3 p-2 bg-surface-soft dark:bg-black/20 rounded-xl max-h-32 overflow-y-auto no-scrollbar">
                            <span className="text-[9px] font-semibold text-text-steel uppercase tracking-widest block mb-1.5">
                              参数
                            </span>
                            <pre className="text-[9px] text-text-slate font-mono whitespace-pre-wrap break-all">
                              {tool.parameters != null
                                ? JSON.stringify(tool.parameters, null, 2)
                                : '无参数'}
                            </pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* Uncategorized tools fallback */}
        {uncategorizedTools.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {uncategorizedTools.map((tool) => (
              <div
                key={tool.id}
                className="bg-canvas dark:bg-surface-dark rounded-2xl border border-hairline-soft dark:border-white/5 p-4 card-interactive-subtle flex flex-col"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-surface dark:bg-canvas/5 text-text-slate">
                      <span className="material-symbols-outlined text-lg leading-none">construction</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-sm text-text-ink dark:text-white truncate">
                        {getToolDisplayName(tool)}
                      </h4>
                      <p className="text-[10px] text-text-slate dark:text-text-secondary">
                        {tool.id}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setExecutingTool(tool);
                      setToolArguments({});
                      setToolExecutionResult(null);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 bg-surface-lavender text-ink-deep rounded-full hover:bg-ink hover:text-white transition-all text-[11px] font-medium shrink-0 ml-2"
                  >
                    <span className="material-symbols-outlined text-sm">play_arrow</span>
                    执行
                  </button>
                </div>
                <p className="text-xs text-text-charcoal dark:text-text-secondary leading-relaxed flex-1 break-words">
                  {tool.description}
                </p>
                <div className="mt-3 p-2 bg-surface-soft dark:bg-black/20 rounded-xl max-h-32 overflow-y-auto no-scrollbar">
                  <span className="text-[9px] font-semibold text-text-steel uppercase tracking-widest block mb-1.5">
                    参数
                  </span>
                  <pre className="text-[9px] text-text-slate font-mono whitespace-pre-wrap break-all">
                    {tool.parameters != null
                      ? JSON.stringify(tool.parameters, null, 2)
                      : '无参数'}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        )}

        {publicToolCatalog.length === 0 && (
          <div className="p-8 text-center text-sm text-text-stone border border-dashed border-hairline dark:border-white/10 rounded-3xl">
            暂无可见工具
          </div>
        )}
      </div>

      {/* MCP Servers Section */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-medium text-text-ink dark:text-white shrink-0">
            MCP 服务配置
          </h3>
          <button
            onClick={() => {
              mcpOriginalIdRef.current = null;
              setEditingMCP(createEmptyMCP());
            }}
            className="flex items-center gap-2 px-4 py-2 bg-ink text-white dark:bg-canvas dark:text-ink rounded-full hover:bg-charcoal dark:hover:bg-surface transition-all text-sm font-medium"
          >
            <span className="material-symbols-outlined">add</span>
            新增 MCP
          </button>
        </div>

        {mcpConfigs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-surface-soft dark:bg-canvas/[0.02] rounded-3xl border border-dashed border-hairline dark:border-white/5">
            <div className="w-16 h-16 rounded-full bg-surface-lavender flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl text-ink-deep">hub</span>
            </div>
            <h4 className="text-base font-medium text-text-stone dark:text-text-secondary mb-1">
              暂无 MCP 配置
            </h4>
            <p className="text-xs text-text-stone dark:text-text-secondary">
              点击「新增 MCP」添加自定义 Model Context Protocol 服务端
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {mcpConfigs.map((mcp) => (
              <div
                key={mcp.id}
                className="bg-canvas dark:bg-surface-dark rounded-3xl border border-hairline-soft dark:border-white/5 p-6 card-interactive group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${mcp.enabled ? 'bg-surface-lavender text-ink-deep' : 'bg-surface dark:bg-canvas/5 text-text-stone'}`}
                    >
                      <span className="material-symbols-outlined text-2xl">hub</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-medium text-text-ink dark:text-white truncate">
                          {mcp.name || '未命名'}
                        </h4>
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider shrink-0 ${mcp.enabled ? 'bg-teal-light text-moss-dark' : 'bg-surface dark:bg-canvas/5 text-text-stone'}`}
                        >
                          {mcp.enabled ? '已启用' : '已禁用'}
                        </span>
                      </div>
                      <p className="text-xs text-text-slate dark:text-text-secondary line-clamp-1 break-words">
                        {mcp.description || '无描述'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        mcpOriginalIdRef.current = mcp.id;
                        setEditingMCP(mcp);
                      }}
                      className="w-8 h-8 inline-flex items-center justify-center text-text-stone hover:text-ink hover:bg-surface dark:hover:bg-canvas/5 rounded-full transition-all"
                    >
                      <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteMCP(mcp.id)}
                      className="w-8 h-8 inline-flex items-center justify-center text-text-stone hover:text-coral-dark hover:bg-coral-light dark:hover:bg-brand-coral/10 rounded-full transition-all"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="chip-lavender text-[10px] py-0.5 uppercase">
                      {mcp.transportType}
                    </span>
                    {mcp.transportType === 'stdio' && mcp.command && (
                      <span className="text-[10px] text-text-stone font-mono truncate">
                        {mcp.command} {(mcp.args || []).join(' ')}
                      </span>
                    )}
                    {(mcp.transportType === 'sse' || mcp.transportType === 'streamable-http') &&
                      mcp.url && (
                        <span className="text-[10px] text-text-stone font-mono truncate">
                          {mcp.url}
                        </span>
                      )}
                  </div>
                  {mcp.env && Object.keys(mcp.env).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {Object.keys(mcp.env).map((key) => (
                        <span key={key} className="chip-neutral text-[9px] py-0.5 font-mono">
                          {key}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MCP Editing Modal */}
      <AnimatePresence>
        {editingMCP && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-canvas dark:bg-surface-dark rounded-3xl shadow-modal border border-hairline-soft dark:border-white/10 w-full max-w-2xl max-h-[90vh] overflow-y-auto no-scrollbar p-4 sm:p-6 md:p-8"
            >
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-surface-lavender text-ink-deep flex items-center justify-center">
                    <span className="material-symbols-outlined text-2xl">hub</span>
                  </div>
                  <h3 className="text-xl font-semibold dark:text-white">配置 MCP 服务</h3>
                </div>
                <button
                  onClick={() => setEditingMCP(null)}
                  className="w-9 h-9 inline-flex items-center justify-center text-text-stone hover:text-text-ink hover:bg-surface dark:hover:bg-canvas/5 dark:hover:text-white rounded-full transition-all"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="space-y-6">
                {/* Name & ID */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-text-steel uppercase tracking-widest ml-1">
                      名称
                    </label>
                    <input
                      type="text"
                      value={editingMCP.name}
                      onChange={(e) => setEditingMCP({ ...editingMCP, name: e.target.value })}
                      placeholder="例如: filesystem-server"
                      className="w-full px-4 py-2.5 bg-surface-soft dark:bg-surface-dark border border-hairline-strong dark:border-white/10 rounded-full text-sm outline-none focus:border-ink dark:focus:border-white transition-all dark:text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-text-steel uppercase tracking-widest ml-1">
                      ID
                    </label>
                    <input
                      type="text"
                      value={editingMCP.id}
                      onChange={(e) => setEditingMCP({ ...editingMCP, id: e.target.value })}
                      placeholder="例如 mcp_filesystem"
                      spellCheck={false}
                      className={`w-full px-4 py-2.5 bg-surface-soft dark:bg-surface-dark border rounded-full text-sm font-mono outline-none transition-all dark:text-white ${
                        mcpIdFmtErr || mcpIdTakenErr
                          ? 'border-red-300 dark:border-red-500/40 focus:ring-red-500/20'
                          : 'border-hairline-strong dark:border-white/10 focus:border-ink dark:focus:border-white'
                      }`}
                    />
                    <p className="text-[10px] text-text-stone dark:text-text-secondary leading-relaxed ml-1">
                      新建时预填 ID，可按需修改；规则同智能体 ID。
                    </p>
                    {mcpIdFmtErr && (
                      <p className="text-xs text-coral-dark dark:text-red-400 font-medium ml-1">
                        {mcpIdFmtErr}
                      </p>
                    )}
                    {!mcpIdFmtErr && mcpIdTakenErr && (
                      <p className="text-xs text-coral-dark dark:text-red-400 font-medium ml-1">
                        该 ID 已被使用
                      </p>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-text-steel uppercase tracking-widest ml-1">
                    描述
                  </label>
                  <input
                    type="text"
                    value={editingMCP.description}
                    onChange={(e) => setEditingMCP({ ...editingMCP, description: e.target.value })}
                    placeholder="简短描述此 MCP 服务的功能..."
                    className="w-full px-4 py-2.5 bg-surface-soft dark:bg-surface-dark border border-hairline-strong dark:border-white/10 rounded-full text-sm outline-none focus:border-ink dark:focus:border-white transition-all dark:text-white"
                  />
                </div>

                {/* Transport Type */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-text-steel uppercase tracking-widest ml-1">
                    传输方式 (Transport)
                  </label>
                  <div className="flex gap-2">
                    {(['stdio', 'sse', 'streamable-http'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setEditingMCP({ ...editingMCP, transportType: t })}
                        className={`px-4 py-2 rounded-full text-xs font-medium transition-all border ${
                          editingMCP.transportType === t
                            ? 'bg-ink text-white dark:bg-canvas dark:text-ink border-ink dark:border-white shadow-subtle'
                            : 'bg-canvas dark:bg-canvas/5 text-text-slate border-hairline dark:border-white/10 hover:border-ink'
                        }`}
                      >
                        {t.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* stdio fields */}
                {editingMCP.transportType === 'stdio' && (
                  <div className="space-y-4 p-4 bg-surface-soft dark:bg-canvas/[0.02] rounded-3xl border border-hairline-soft dark:border-white/5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-text-steel uppercase tracking-widest ml-1">
                        启动命令 (Command)
                      </label>
                      <input
                        type="text"
                        value={editingMCP.command || ''}
                        onChange={(e) => setEditingMCP({ ...editingMCP, command: e.target.value })}
                        placeholder="例如: npx, node, python"
                        className="w-full px-4 py-2.5 bg-canvas dark:bg-surface-dark border border-hairline-strong dark:border-white/10 rounded-full text-sm font-mono outline-none focus:border-ink dark:focus:border-white transition-all dark:text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-text-steel uppercase tracking-widest ml-1">
                        参数 (Args, 每行一个)
                      </label>
                      <textarea
                        rows={3}
                        value={(editingMCP.args || []).join('\n')}
                        onChange={(e) =>
                          setEditingMCP({
                            ...editingMCP,
                            args: e.target.value.split('\n').filter(Boolean)
                          })
                        }
                        placeholder={'-y\n@modelcontextprotocol/server-filesystem\n/path/to/dir'}
                        className="w-full px-4 py-2.5 bg-canvas dark:bg-surface-dark border border-hairline-strong dark:border-white/10 rounded-2xl text-sm font-mono outline-none focus:border-ink dark:focus:border-white transition-all dark:text-white resize-none"
                      />
                    </div>
                  </div>
                )}

                {/* sse / streamable-http fields */}
                {(editingMCP.transportType === 'sse' ||
                  editingMCP.transportType === 'streamable-http') && (
                  <div className="space-y-4 p-4 bg-surface-soft dark:bg-canvas/[0.02] rounded-3xl border border-hairline-soft dark:border-white/5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-text-steel uppercase tracking-widest ml-1">
                        服务地址 (URL)
                      </label>
                      <input
                        type="text"
                        value={editingMCP.url || ''}
                        onChange={(e) => setEditingMCP({ ...editingMCP, url: e.target.value })}
                        placeholder="例如: https://mcp.example.com/sse"
                        className="w-full px-4 py-2.5 bg-canvas dark:bg-surface-dark border border-hairline-strong dark:border-white/10 rounded-full text-sm font-mono outline-none focus:border-ink dark:focus:border-white transition-all dark:text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-text-stone uppercase tracking-widest ml-1">
                        请求头 (Headers, JSON 格式)
                      </label>
                      <textarea
                        rows={2}
                        value={JSON.stringify(editingMCP.headers || {}, null, 2)}
                        onChange={(e) => {
                          try {
                            setEditingMCP({ ...editingMCP, headers: JSON.parse(e.target.value) });
                          } catch {
                            /* ignore parse errors while typing */
                          }
                        }}
                        placeholder={'{\n  "Authorization": "Bearer xxx"\n}'}
                        className="w-full px-4 py-2.5 bg-canvas dark:bg-surface-dark border border-hairline-soft dark:border-white/5 rounded-2xl text-sm font-mono outline-none focus:ring-2 focus:ring-ink/10 transition-all dark:text-white resize-none"
                      />
                    </div>
                  </div>
                )}

                {/* Environment Variables */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-text-stone uppercase tracking-widest ml-1">
                    环境变量 (JSON 格式)
                  </label>
                  <textarea
                    rows={3}
                    value={JSON.stringify(editingMCP.env || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        setEditingMCP({ ...editingMCP, env: JSON.parse(e.target.value) });
                      } catch {
                        /* ignore parse errors while typing */
                      }
                    }}
                    placeholder={'{\n  "API_KEY": "your-key"\n}'}
                    className="w-full px-4 py-2.5 bg-surface-soft dark:bg-surface-dark border border-hairline-soft dark:border-white/5 rounded-2xl text-sm font-mono outline-none focus:ring-2 focus:ring-ink/10 transition-all dark:text-white resize-none"
                  />
                </div>

                {/* Enabled toggle */}
                <div className="p-4 bg-surface-soft dark:bg-canvas/[0.02] rounded-2xl border border-hairline-soft dark:border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-ink-deep">
                        power_settings_new
                      </span>
                      <span className="text-xs font-semibold dark:text-white">启用此 MCP 服务</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={editingMCP.enabled}
                        onChange={(e) =>
                          setEditingMCP({ ...editingMCP, enabled: e.target.checked })
                        }
                      />
                      <div className="w-11 h-6 bg-hairline rounded-full peer peer-checked:bg-purple-500 transition-all after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-canvas after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                    </label>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => handleSaveMCP(editingMCP)}
                    disabled={
                      isSaving || !editingMCP.name.trim() || !!mcpIdFmtErr || !!mcpIdTakenErr
                    }
                    className="flex-1 py-3 bg-ink text-white rounded-2xl font-semibold hover:bg-charcoal transition-all shadow-card shadow-violet-500/20 disabled:opacity-50"
                  >
                    {isSaving ? '保存中...' : '确认保存'}
                  </button>
                  <button
                    onClick={() => setEditingMCP(null)}
                    className="flex-1 py-3 bg-surface dark:bg-canvas/5 text-text-charcoal dark:text-white rounded-2xl font-semibold hover:bg-hairline dark:hover:bg-canvas/10 transition-all"
                  >
                    取消
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
