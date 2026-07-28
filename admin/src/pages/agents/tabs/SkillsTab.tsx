import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Skill, AiBuilderMention } from '../../../services/agentService';
import FileTreeNode from '../FileTreeNode';
import { createAiBuilderMention } from '../aiBuilder/AiBuilderPanel';

/**
 * B5 拆分第一步：把原 AgentsPage 内 `renderSkills()`（~310 行）抽到独立组件。
 *
 * 设计取舍：
 *  - 主页面对 Skills 的全部 state/handler 仍由父级持有，这里通过一个聚合 props 对象注入；
 *  - props 个数较多但都是直接 1:1 映射，避免引入新的 store / context，降低风险；
 *  - 后续阶段若进一步上 zustand，可把这些 props 替换为单个 selector，再拆 hook。
 */
export interface SkillsTabProps {
  skills: Skill[];
  uploadError: string | null;
  isUploading: boolean;
  isScanningSkills: boolean;
  isDragging: boolean;
  previewSkill: Skill | null;
  skillFileTree: any[];
  selectedFilePath: string | null;
  selectedFileContent: string | null;
  isLoadingFile: boolean;
  isSaving: boolean;
  skillFileRef: React.RefObject<HTMLInputElement | null>;
  openAiBuilder: (mention?: AiBuilderMention) => void;
  handleUploadSkill: (file: File) => void;
  handleScanSkills: () => void;
  handlePreviewSkill: (skill: Skill) => void;
  handleSelectFile: (skillId: string, path: string) => void;
  handleSaveFile: () => void;
  handleDeleteSkill: (id: string) => void;
  setUploadError: (msg: string | null) => void;
  setIsDragging: (v: boolean) => void;
  setPreviewSkill: (s: Skill | null) => void;
  setSelectedFileContent: (s: string | null) => void;
}

export const SkillsTab: React.FC<SkillsTabProps> = ({
  skills,
  uploadError,
  isUploading,
  isScanningSkills,
  isDragging,
  previewSkill,
  skillFileTree,
  selectedFilePath,
  selectedFileContent,
  isLoadingFile,
  isSaving,
  skillFileRef,
  openAiBuilder,
  handleUploadSkill,
  handleScanSkills,
  handlePreviewSkill,
  handleSelectFile,
  handleSaveFile,
  handleDeleteSkill,
  setUploadError,
  setIsDragging,
  setPreviewSkill,
  setSelectedFileContent
}) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-lg font-medium text-text-ink dark:text-white shrink-0">技能库</h3>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={() => openAiBuilder(createAiBuilderMention('create', 'skill'))}
            disabled={isUploading || isScanningSkills}
            className="flex items-center gap-2 px-4 py-2 bg-brand-yellow text-ink rounded-full hover:bg-brand-yellow-deep transition-all text-sm font-medium disabled:opacity-50"
          >
            <span className="material-symbols-outlined">auto_awesome</span>
            AI Builder
          </button>
          <input
            ref={skillFileRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUploadSkill(file);
            }}
          />
          <button
            onClick={handleScanSkills}
            disabled={isUploading || isScanningSkills}
            className="flex items-center gap-2 px-4 py-2 border border-hairline-strong dark:border-white/10 text-text-charcoal dark:text-white rounded-full hover:border-ink dark:hover:border-white transition-all text-sm font-medium disabled:opacity-50"
          >
            <span className="material-symbols-outlined">
              {isScanningSkills ? 'hourglass_top' : 'autorenew'}
            </span>
            {isScanningSkills ? '扫描中...' : '扫描本地技能'}
          </button>
          <button
            onClick={() => skillFileRef.current?.click()}
            disabled={isUploading || isScanningSkills}
            className="flex items-center gap-2 px-4 py-2 bg-ink text-white dark:bg-canvas dark:text-ink rounded-full hover:bg-charcoal dark:hover:bg-surface transition-all text-sm font-medium disabled:opacity-50"
          >
            <span className="material-symbols-outlined">
              {isUploading ? 'hourglass_top' : 'upload_file'}
            </span>
            {isUploading ? '上传中...' : '上传技能包'}
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="flex items-center gap-3 p-4 bg-coral-light dark:bg-brand-coral/10 border border-coral-light dark:border-red-500/20 rounded-2xl">
          <span className="material-symbols-outlined text-coral-dark">error</span>
          <span className="text-sm text-coral-dark dark:text-red-400 font-medium">
            {uploadError}
          </span>
          <button
            onClick={() => setUploadError(null)}
            className="ml-auto w-8 h-8 inline-flex items-center justify-center text-red-400 hover:bg-red-100 dark:hover:bg-brand-coral/10 rounded-full transition-all"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      )}

      {skills.length === 0 ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleUploadSkill(file);
          }}
          className={`flex flex-col items-center justify-center py-20 rounded-[40px] border-2 border-dashed transition-all ${
            isDragging
              ? 'border-ink/30 bg-surface-lavender dark:bg-canvas/10'
              : 'border-hairline-soft dark:border-white/5 bg-surface-soft dark:bg-canvas/[0.02]'
          }`}
        >
          <div className="w-20 h-20 rounded-full bg-surface-lavender flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-4xl text-ink-deep">inventory_2</span>
          </div>
          <h3 className="text-xl font-medium text-text-stone dark:text-text-secondary mb-2">
            暂无技能
          </h3>
          <p className="text-sm text-text-stone dark:text-text-secondary mb-6">
            拖拽 .zip 压缩包到此处，或点击上方按钮上传，也可以先扫描本地已存在的 skill 目录
          </p>
          <button
            onClick={handleScanSkills}
            disabled={isUploading || isScanningSkills}
            className="mb-6 flex items-center gap-2 px-4 py-2 bg-ink text-white dark:bg-canvas dark:text-ink rounded-full hover:bg-charcoal dark:hover:bg-surface transition-all text-sm font-medium disabled:opacity-50"
          >
            <span className="material-symbols-outlined">
              {isScanningSkills ? 'hourglass_top' : 'autorenew'}
            </span>
            {isScanningSkills ? '扫描中...' : '扫描本地技能'}
          </button>
          <div className="p-4 bg-canvas dark:bg-surface-dark rounded-3xl border border-hairline-soft dark:border-white/5 max-w-md">
            <p className="text-[10px] font-semibold text-text-steel uppercase tracking-widest mb-2">
              压缩包结构 (Claude Skills 规范)
            </p>
            <pre className="text-[11px] text-text-slate font-mono leading-relaxed">{`my-skill.zip
├── SKILL.md       (必需)
├── scripts/       (可选: 脚本)
└── resources/     (可选: 模板/数据)`}</pre>
            <div className="mt-3 p-3 bg-surface-soft dark:bg-black/20 rounded-2xl">
              <p className="text-[10px] font-semibold text-text-steel mb-1">SKILL.md 示例:</p>
              <pre className="text-[10px] text-text-slate font-mono leading-relaxed whitespace-pre-wrap">{`---
name: my-skill
description: 技能描述，说明何时使用
---
# My Skill

## Instructions
具体指令内容...`}</pre>
            </div>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleUploadSkill(file);
          }}
          className={`transition-all rounded-3xl ${isDragging ? 'ring-2 ring-blue-400 ring-offset-4 dark:ring-offset-slate-900' : ''}`}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {skills.map((skill) => (
              <div
                key={skill.id}
                onClick={() => handlePreviewSkill(skill)}
                className="bg-canvas dark:bg-surface-dark rounded-3xl border border-hairline-soft dark:border-white/5 p-6 card-interactive group cursor-pointer"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-teal-light text-moss-dark flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-2xl">bolt</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-text-ink dark:text-white truncate">
                        {skill.name}
                      </h4>
                      <p className="text-[10px] text-text-slate dark:text-text-secondary line-clamp-1 break-words">
                        {skill.description}
                      </p>
                    </div>
                  </div>
                  {!skill.isBuiltin && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openAiBuilder(createAiBuilderMention('skill', skill));
                        }}
                        className="w-8 h-8 inline-flex items-center justify-center text-text-stone hover:text-ink hover:bg-surface dark:hover:bg-canvas/5 rounded-full transition-all"
                        title="AI Builder"
                      >
                        <span className="material-symbols-outlined text-lg">auto_awesome</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSkill(skill.id);
                        }}
                        className="w-8 h-8 inline-flex items-center justify-center text-text-stone hover:text-coral-dark hover:bg-coral-light dark:hover:bg-brand-coral/10 rounded-full transition-all"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  )}
                </div>
                {skill.instructions && (
                  <p className="text-[11px] text-text-slate dark:text-text-secondary mb-3 line-clamp-3 font-mono bg-surface-soft dark:bg-canvas/[0.02] p-2 rounded-2xl whitespace-pre-wrap">
                    {skill.instructions.slice(0, 200)}
                    {skill.instructions.length > 200 ? '...' : ''}
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {(skill.files || []).length > 0 && (
                    <span className="chip-lavender text-[9px] py-0.5">
                      {skill.files.length} 个附件
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {previewSkill && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-canvas dark:bg-surface-dark rounded-3xl shadow-modal border border-hairline-soft dark:border-white/10 w-full max-w-4xl h-[85vh] overflow-hidden flex flex-col"
            >
              <div className="flex justify-between items-center p-6 pb-4 border-b border-hairline-soft dark:border-white/5 bg-surface-soft/60 dark:bg-canvas/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-teal-light text-moss-dark flex items-center justify-center">
                    <span className="material-symbols-outlined text-2xl">bolt</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold dark:text-white">{previewSkill.name}</h3>
                    <p className="text-xs text-text-slate dark:text-text-secondary">
                      {previewSkill.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!previewSkill.isBuiltin && (
                    <button
                      onClick={() => openAiBuilder(createAiBuilderMention('skill', previewSkill))}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-yellow text-ink text-xs font-medium hover:bg-brand-yellow-deep transition-all"
                    >
                      <span className="material-symbols-outlined text-sm">auto_awesome</span>
                      AI Builder
                    </button>
                  )}
                  <button
                    onClick={() => setPreviewSkill(null)}
                    className="w-9 h-9 inline-flex items-center justify-center text-text-stone hover:text-text-ink hover:bg-surface dark:hover:bg-canvas/5 dark:hover:text-white rounded-full transition-all"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
                <div className="w-full md:w-64 max-h-[40vh] md:max-h-none border-b md:border-b-0 md:border-r border-hairline-soft dark:border-white/5 overflow-y-auto p-4 flex-shrink-0 bg-surface-soft/40 dark:bg-canvas/[0.02]">
                  <p className="text-[10px] font-semibold text-text-steel uppercase tracking-widest mb-3 ml-1">
                    文件结构
                  </p>
                  {skillFileTree.length === 0 ? (
                    <p className="text-xs text-text-stone ml-1">加载中...</p>
                  ) : (
                    <FileTreeNode
                      items={skillFileTree}
                      skillId={previewSkill.id}
                      selectedPath={selectedFilePath}
                      onSelect={handleSelectFile}
                    />
                  )}
                </div>

                <div className="flex-1 flex flex-col overflow-hidden p-6 min-w-0">
                  {!selectedFilePath ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-12">
                      <span className="material-symbols-outlined text-5xl text-text-muted dark:text-white/10 mb-4">
                        description
                      </span>
                      <p className="text-sm text-text-stone dark:text-text-secondary">
                        点击左侧文件查看并编辑内容
                      </p>
                    </div>
                  ) : isLoadingFile ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
                    </div>
                  ) : (
                    <div className="flex flex-col h-full">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm text-text-stone">
                            description
                          </span>
                          <span className="text-xs font-mono text-text-slate dark:text-text-secondary">
                            {selectedFilePath}
                          </span>
                        </div>
                        <button
                          onClick={handleSaveFile}
                          disabled={isSaving}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-ink text-white dark:bg-canvas dark:text-ink rounded-full text-xs font-medium hover:bg-charcoal dark:hover:bg-surface transition-all disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-sm">save</span>
                          {isSaving ? '保存中...' : '保存修改'}
                        </button>
                      </div>
                      <textarea
                        value={selectedFileContent || ''}
                        onChange={(e) => setSelectedFileContent(e.target.value)}
                        className="flex-1 w-full text-[12px] text-text-charcoal dark:text-text-secondary font-mono whitespace-pre-wrap bg-surface-soft dark:bg-black/20 p-4 rounded-2xl border border-hairline-strong dark:border-white/10 leading-relaxed outline-none focus:border-ink dark:focus:border-white transition-all resize-none"
                        spellCheck={false}
                      />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
