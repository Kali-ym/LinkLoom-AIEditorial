import React from 'react';
import { AnimatedPillTabs } from '../../components/UI/ScrollablePillNav';

type GenerationMobileTabBarProps = {
  activeTab: 'source' | 'preview';
  onChange: (tab: 'source' | 'preview') => void;
};

const GenerationMobileTabBar: React.FC<GenerationMobileTabBarProps> = ({ activeTab, onChange }) => (
  <AnimatedPillTabs
    className="md:hidden"
    fullWidth
    layoutId="generation-mobile-workspace-tabs"
    aria-label="生成工作区"
    tabs={[
      { id: 'source', label: '素材列表', icon: 'list_alt' },
      { id: 'preview', label: '生成预览', icon: 'markdown' }
    ]}
    active={activeTab}
    onChange={onChange}
  />
);

export default GenerationMobileTabBar;
