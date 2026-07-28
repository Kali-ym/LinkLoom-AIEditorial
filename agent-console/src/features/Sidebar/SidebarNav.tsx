import { Flexbox } from '@lobehub/ui';
import { MessageSquarePlus, MessagesSquare, Search } from 'lucide-react';
import { memo } from 'react';
import { useLocation } from 'react-router-dom';

import { isAgentSubRoute } from '../../constants/agentConsoleRoutes';
import { useCommandMenuStore, useTopicStore } from '../../stores';
import { NavItem } from '../NavPanel/NavItem';
import { useAgentSubRouteNavigation } from './hooks/useAgentSubRouteNavigation';

/** §C.1 Sidebar Nav — 所有 agent 共用同一套导航结构 */
export const SidebarNav = memo(function SidebarNav() {
  const location = useLocation();
  const newTopic = useTopicStore((s) => s.newTopic);
  const { goToChatHome, goToTopics } = useAgentSubRouteNavigation();

  const isTopicsActive = location.pathname.endsWith('/topics');

  const handleNewTopic = () => {
    if (isAgentSubRoute(location.pathname)) {
      goToChatHome();
    }
    newTopic();
  };

  return (
    <Flexbox gap={1} paddingInline={4} style={{ flexShrink: 0 }}>
      <NavItem
        icon={MessageSquarePlus}
        id="newTopicBtn"
        title="开启新话题"
        onClick={handleNewTopic}
      />
      <NavItem
        icon={Search}
        id="navSearch"
        title="搜索"
        onClick={() => useCommandMenuStore.getState().toggleCommandMenu(true)}
      />
      <NavItem
        active={isTopicsActive}
        icon={MessagesSquare}
        id="navTopics"
        title="话题"
        onClick={goToTopics}
      />
    </Flexbox>
  );
});
