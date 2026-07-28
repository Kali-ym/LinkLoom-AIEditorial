import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedPillTabs } from '../../components/UI/ScrollablePillNav';

export type OpsTab = {
  id: string;
  label: string;
  icon: string;
};

const DEFAULT_SUBTITLE = '平台健康度总览、运行监控、审批待办与知识库检索配置.';

type OpsCenterPageShellProps = {
  tabs: OpsTab[];
  activeTab: string;
  isLoading: boolean;
  onTabChange: (tab: string) => void;
  subtitle?: string;
  children: React.ReactNode;
};

const OpsCenterPageShell: React.FC<OpsCenterPageShellProps> = ({
  tabs,
  activeTab,
  isLoading,
  onTabChange,
  subtitle,
  children
}) => (
  <div className="max-w-6xl mx-auto space-y-6 pb-8 sm:pb-10">
    <header>
      <h2 className="text-[28px] sm:text-[32px] leading-[1.15] font-medium text-text-ink dark:text-white tracking-tight">
        运营中心
      </h2>
      <p className="text-[14px] leading-relaxed text-text-charcoal dark:text-text-secondary mt-2 max-w-2xl">
        {subtitle ?? DEFAULT_SUBTITLE}
      </p>
    </header>

    <AnimatedPillTabs
      tabs={tabs}
      active={activeTab}
      onChange={onTabChange}
      layoutId="ops-center-tabs"
      aria-label="运营中心分类"
    />

    <AnimatePresence mode="wait">
      <motion.div
        key={activeTab}
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -12, opacity: 0 }}
        transition={{ duration: 0.25 }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-2 border-hairline border-t-ink rounded-full animate-spin"></div>
          </div>
        ) : (
          children
        )}
      </motion.div>
    </AnimatePresence>
  </div>
);

export default OpsCenterPageShell;
