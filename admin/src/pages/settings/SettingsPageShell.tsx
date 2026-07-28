import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedPillTabs } from '../../components/UI/ScrollablePillNav';

export type SettingsTab = {
  id: string;
  label: string;
  icon: string;
};

type SettingsPageShellProps = {
  tabs: SettingsTab[];
  activeTab: string;
  isLoading: boolean;
  isSaving: boolean;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
  footer: React.ReactNode;
};

const SettingsPageShell: React.FC<SettingsPageShellProps> = ({
  tabs,
  activeTab,
  isLoading,
  isSaving,
  onTabChange,
  children,
  footer
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-hairline border-t-ink"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-text-ink dark:text-white text-[32px] sm:text-[40px] leading-[1.1] font-medium tracking-tight">
            系统设置
          </h2>
          <p className="text-text-slate dark:text-text-secondary text-[15px] mt-2">
            配置 AI 模型、存储密钥及系统运行参数
          </p>
        </div>
        {isSaving ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline-soft bg-surface-soft px-3 py-1.5 text-[11px] font-medium text-text-slate dark:border-white/10 dark:text-text-secondary">
            <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
            自动保存中…
          </span>
        ) : (
          <span className="text-[11px] text-text-stone dark:text-text-secondary">修改将自动保存</span>
        )}
      </div>

      <AnimatedPillTabs
        tabs={tabs}
        active={activeTab}
        onChange={onTabChange}
        layoutId="settings-page-tabs"
        aria-label="系统设置分类"
      />

      <div className="relative min-h-[400px] space-y-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>

      {footer}
    </div>
  );
};

export default SettingsPageShell;
