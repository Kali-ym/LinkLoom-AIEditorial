import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedPillTabs } from '../../components/UI/ScrollablePillNav';

export type AgentsTab = {
  id: string;
  label: string;
  icon: string;
};

type AgentsPageShellProps = {
  tabs: AgentsTab[];
  activeTab: string;
  isLoading: boolean;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
};

const AgentsPageShell: React.FC<AgentsPageShellProps> = ({
  tabs,
  activeTab,
  isLoading,
  onTabChange,
  children
}) => (
  <div className="max-w-6xl mx-auto space-y-8 pb-8 sm:pb-12">
    <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <h2 className="text-[32px] sm:text-[40px] leading-[1.1] font-medium text-text-ink dark:text-white tracking-tight">
          多智能体
          <span className="ml-3 chip-yellow text-[13px] font-medium align-middle">编排系统</span>
        </h2>
        <p className="text-[15px] text-text-slate dark:text-text-secondary mt-2 max-w-2xl">
          定义智能体、管理技能库并编排自动化工作流
        </p>
      </div>
    </header>

    <AnimatedPillTabs
      tabs={tabs}
      active={activeTab}
      onChange={onTabChange}
      layoutId="agents-page-tabs"
      aria-label="多智能体分类"
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

export default AgentsPageShell;
