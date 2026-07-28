import React from 'react';
import { motion } from 'framer-motion';
import type { Tool } from '../../services/agentService';

/**
 * B5 拆分第二步：把原 AgentsPage 中独立度最高的 "执行工具" 弹窗抽出。
 * 主要用于 Tools tab 中点击 "Run Tool" 后弹出的参数表单 + 结果展示。
 */
export interface ToolExecutionModalProps {
  executingTool: Tool;
  toolArguments: Record<string, any>;
  toolExecutionResult: any;
  isExecutingTool: boolean;
  onClose: () => void;
  onChangeArguments: (next: Record<string, any>) => void;
  onExecute: () => void;
  onCopy: (text: string) => void;
  onImportAsDataSource: (content: string, titlePrefix: string) => void;
}

export const ToolExecutionModal: React.FC<ToolExecutionModalProps> = ({
  executingTool,
  toolArguments,
  toolExecutionResult,
  isExecutingTool,
  onClose,
  onChangeArguments,
  onExecute,
  onCopy,
  onImportAsDataSource
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-canvas dark:bg-surface-dark rounded-3xl shadow-modal border border-hairline-soft dark:border-white/10 w-full max-w-lg p-4 sm:p-6 md:p-8 max-h-[90vh] overflow-y-auto no-scrollbar"
      >
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-yellow text-ink flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">construction</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold dark:text-white">执行工具</h3>
              <p className="text-xs text-text-stone">{executingTool.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 inline-flex items-center justify-center text-text-stone hover:text-text-ink hover:bg-surface dark:hover:bg-canvas/5 dark:hover:text-white rounded-full transition-all"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="space-y-4">
          {Object.entries(executingTool.parameters.properties || {}).map(
            ([key, prop]: [string, any]) => {
              const isRequired = executingTool.parameters.required?.includes(key);
              const type = prop.type || 'string';

              return (
                <div key={key} className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-semibold text-text-steel uppercase tracking-widest ml-1">
                      {prop.title || key} {isRequired && <span className="text-coral-dark">*</span>}
                    </label>
                    {prop.description && (
                      <span
                        className="text-[9px] text-text-stone italic max-w-[60%] truncate"
                        title={prop.description}
                      >
                        {prop.description}
                      </span>
                    )}
                  </div>

                  {prop.enum ? (
                    <div className="relative">
                      <select
                        value={toolArguments[key] || ''}
                        onChange={(e) =>
                          onChangeArguments({ ...toolArguments, [key]: e.target.value })
                        }
                        className="w-full appearance-none px-4 py-2.5 bg-surface-soft dark:bg-surface-dark border border-hairline-strong dark:border-white/10 rounded-full text-sm outline-none focus:border-ink dark:focus:border-white transition-all dark:text-white cursor-pointer"
                      >
                        <option value="">请选择...</option>
                        {prop.enum.map((v: string) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-stone">
                        expand_more
                      </span>
                    </div>
                  ) : type === 'array' ? (
                    prop.items?.enum ? (
                      <div className="grid grid-cols-1 gap-2 p-3 bg-surface-soft dark:bg-canvas/[0.02] rounded-2xl border border-hairline-soft dark:border-white/5">
                        {prop.items.enum.map((v: string) => (
                          <label
                            key={v}
                            className="flex items-center gap-2 cursor-pointer hover:bg-surface dark:hover:bg-canvas/5 px-2 py-1.5 rounded-full transition-all"
                          >
                            <input
                              type="checkbox"
                              checked={
                                Array.isArray(toolArguments[key]) && toolArguments[key].includes(v)
                              }
                              onChange={(e) => {
                                const current = Array.isArray(toolArguments[key])
                                  ? toolArguments[key]
                                  : [];
                                const next = e.target.checked
                                  ? [...current, v]
                                  : current.filter((i: string) => i !== v);
                                onChangeArguments({ ...toolArguments, [key]: next });
                              }}
                              className="w-4 h-4 rounded border-hairline-strong text-ink focus:ring-ink"
                            />
                            <span className="text-sm text-text-charcoal dark:text-text-secondary">
                              {v}
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <textarea
                        value={
                          Array.isArray(toolArguments[key])
                            ? toolArguments[key].join('\n')
                            : toolArguments[key] || ''
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          const arr = val
                            .split('\n')
                            .map((s) => s.trim())
                            .filter(Boolean);
                          onChangeArguments({ ...toolArguments, [key]: arr });
                        }}
                        placeholder="请输入列表项，每行一个"
                        className="w-full px-4 py-2.5 bg-surface-soft dark:bg-surface-dark border border-hairline-strong dark:border-white/10 rounded-2xl text-sm outline-none focus:border-ink dark:focus:border-white transition-all dark:text-white min-h-[100px] resize-y font-mono"
                      />
                    )
                  ) : type === 'boolean' ? (
                    <div className="flex items-center gap-3 p-3 bg-surface-soft dark:bg-canvas/[0.02] rounded-2xl border border-hairline-soft dark:border-white/5">
                      <span className="text-xs text-text-slate">启用</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={!!toolArguments[key]}
                          onChange={(e) =>
                            onChangeArguments({ ...toolArguments, [key]: e.target.checked })
                          }
                        />
                        <div className="w-11 h-6 bg-hairline rounded-full peer peer-checked:bg-ink dark:peer-checked:bg-canvas transition-all after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-canvas dark:peer-checked:after:bg-ink after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                      </label>
                    </div>
                  ) : type === 'number' || type === 'integer' ? (
                    <input
                      type="number"
                      value={toolArguments[key] ?? ''}
                      onChange={(e) =>
                        onChangeArguments({
                          ...toolArguments,
                          [key]: e.target.value === '' ? undefined : Number(e.target.value)
                        })
                      }
                      placeholder={prop.default !== undefined ? `默认: ${prop.default}` : ''}
                      className="w-full px-4 py-2.5 bg-surface-soft dark:bg-surface-dark border border-hairline-strong dark:border-white/10 rounded-full text-sm outline-none focus:border-ink dark:focus:border-white transition-all dark:text-white"
                    />
                  ) : (
                    <input
                      type="text"
                      value={toolArguments[key] || ''}
                      onChange={(e) =>
                        onChangeArguments({ ...toolArguments, [key]: e.target.value })
                      }
                      placeholder={prop.default !== undefined ? `默认: ${prop.default}` : ''}
                      className="w-full px-4 py-2.5 bg-surface-soft dark:bg-surface-dark border border-hairline-strong dark:border-white/10 rounded-full text-sm outline-none focus:border-ink dark:focus:border-white transition-all dark:text-white"
                    />
                  )}
                </div>
              );
            }
          )}

          <button
            onClick={onExecute}
            disabled={isExecutingTool}
            className="w-full py-3 bg-ink text-white dark:bg-canvas dark:text-ink rounded-full font-medium hover:bg-charcoal dark:hover:bg-surface transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
          >
            <span className="material-symbols-outlined text-xl">
              {isExecutingTool ? 'hourglass_top' : 'send'}
            </span>
            {isExecutingTool ? '执行中...' : '立即执行'}
          </button>

          {toolExecutionResult && (
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-semibold text-text-steel uppercase tracking-widest">
                  执行结果
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onCopy(JSON.stringify(toolExecutionResult, null, 2))}
                    className="flex items-center gap-1 text-[10px] font-semibold text-ink hover:text-charcoal transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">content_copy</span>
                    复制
                  </button>
                  <button
                    onClick={() =>
                      onImportAsDataSource(
                        JSON.stringify(toolExecutionResult, null, 2),
                        `工具执行: ${executingTool.name}`
                      )
                    }
                    className="flex items-center gap-1 text-[10px] font-semibold text-ink-deep hover:text-ink transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">input</span>
                    导入为数据源
                  </button>
                </div>
              </div>
              <div
                className={`w-full p-4 rounded-2xl text-xs font-mono whitespace-pre-wrap break-words max-h-60 overflow-y-auto border ${
                  toolExecutionResult.success === false
                    ? 'bg-coral-light dark:bg-brand-coral/10 border-coral-light dark:border-red-500/20 text-coral-dark dark:text-red-400'
                    : 'bg-surface-soft dark:bg-black/20 border-hairline-soft dark:border-white/5 text-text-charcoal dark:text-text-secondary'
                }`}
              >
                {JSON.stringify(toolExecutionResult, null, 2)}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
