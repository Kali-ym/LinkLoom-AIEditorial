import { DiscordIcon, GithubIcon } from '@lobehub/ui/icons';
import { Command } from 'cmdk';
import {
  Bot,
  Feather,
  FilePen,
  LayoutPanelLeft,
  LibraryBig,
  MessageSquarePlus,
  Monitor,
  PanelRightOpen,
  Settings,
  Sparkles,
  Star,
  SunMoon,
} from 'lucide-react';
import { memo } from 'react';

import { useNavigableRoutes, getSettingsRoutePath } from '../../hooks/data/useCatalog';
import { usePermission } from '../../hooks/usePermission';
import { useCommandMenuContext } from './CommandMenuContext';
import { ContextCommands } from './ContextCommands';
import { CommandItem } from './components';
import { commandStrings } from './commandStrings';
import { useCommandMenu } from './useCommandMenu';

/** §C.41*/
export const MainMenu = memo(function MainMenu() {
  const { menuContext, pathname, setPages, pages } = useCommandMenuContext();
  const { allowed: canCreate } = usePermission('create_content');

  const {
    handleCreateAgentTeam,
    handleCreateLibrary,
    handleCreatePage,
    handleCreateSession,
    handleCreateTopic,
    handleExternalLink,
    handleNavigate,
    handleOpenFeedback,
    handleOpenWorkingSidebar,
    handleToggleRightPanel,
    handleToggleSidebar,
    handleToggleZenMode,
  } = useCommandMenu();

  const unpinnedCreate = menuContext === 'agent';

  return (
    <>
      <ContextCommands />

      <Command.Group>
        <CommandItem
          disabled={!canCreate}
          icon={<Bot />}
          unpinned={unpinnedCreate}
          value="create new agent assistant"
          onSelect={handleCreateSession}
        >
          {commandStrings.newAgent}
        </CommandItem>

        <CommandItem
          disabled={!canCreate}
          icon={<Bot />}
          unpinned={unpinnedCreate}
          value="create new agent team"
          onSelect={handleCreateAgentTeam}
        >
          {commandStrings.newAgentTeam}
        </CommandItem>

        {menuContext === 'agent' ? (
          <CommandItem
            disabled={!canCreate}
            icon={<MessageSquarePlus />}
            value="create new topic"
            onSelect={handleCreateTopic}
          >
            {commandStrings.newTopic}
          </CommandItem>
        ) : null}

        <CommandItem
          disabled={!canCreate}
          icon={<FilePen />}
          value="create new page"
          onSelect={handleCreatePage}
        >
          {commandStrings.newPage}
        </CommandItem>

        <CommandItem
          disabled={!canCreate}
          icon={<LibraryBig />}
          value="create new library"
          onSelect={handleCreateLibrary}
        >
          {commandStrings.newLibrary}
        </CommandItem>

        {menuContext !== 'settings' ? (
          <CommandItem
            icon={<Settings />}
            value="settings"
            onSelect={() => handleNavigate(getSettingsRoutePath())}
          >
            {commandStrings.settings}
          </CommandItem>
        ) : null}

        <CommandItem icon={<Monitor />} value="theme" onSelect={() => setPages([...pages, 'theme'])}>
          {commandStrings.theme}
        </CommandItem>

        <CommandItem
          icon={<Sparkles />}
          value="open working sidebar skills"
          onSelect={handleOpenWorkingSidebar}
        >
          {commandStrings.console.openWorkingSidebar}
        </CommandItem>

        <CommandItem
          icon={<LayoutPanelLeft />}
          value="toggle left sidebar"
          onSelect={handleToggleSidebar}
        >
          {commandStrings.console.toggleLeftSidebar}
        </CommandItem>

        <CommandItem
          icon={<PanelRightOpen />}
          value="toggle right panel"
          onSelect={handleToggleRightPanel}
        >
          {commandStrings.console.toggleRightPanel}
        </CommandItem>

        <CommandItem icon={<SunMoon />} value="toggle zen mode" onSelect={handleToggleZenMode}>
          {commandStrings.console.toggleZenMode}
        </CommandItem>
      </Command.Group>

      <Command.Group heading={commandStrings.navigate}>
        {useNavigableRoutes().map((route) => {
          if (pathname?.startsWith(route.pathPrefix)) return null;
          const RouteIcon = route.icon;
          return (
            <CommandItem
              icon={<RouteIcon />}
              key={route.id}
              keywords={route.keywords}
              value={route.id}
              onSelect={() => handleNavigate(route.path)}
            >
              {commandStrings.routes[route.cmdkKey]}
            </CommandItem>
          );
        })}
      </Command.Group>

      <Command.Group heading={commandStrings.about}>
        <CommandItem
          icon={<Feather />}
          keywords={['contact', 'email', '反馈', '联系']}
          value="contact-via-email"
          onSelect={handleOpenFeedback}
        >
          {commandStrings.contactUs}
        </CommandItem>
        <CommandItem
          icon={<GithubIcon />}
          keywords={['github', 'issue', 'bug', '问题']}
          value="submit-issue"
          onSelect={() => handleExternalLink('https://github.com/example/app/issues')}
        >
          {commandStrings.submitIssue}
        </CommandItem>
        <CommandItem
          icon={<Star />}
          keywords={['star', 'github', '收藏']}
          value="star-github"
          onSelect={() => handleExternalLink('https://github.com/example/app')}
        >
          {commandStrings.starOnGitHub}
        </CommandItem>
        <CommandItem
          icon={<DiscordIcon />}
          keywords={['discord', 'community', '社区']}
          value="discord"
          onSelect={() => handleExternalLink('https://discord.gg/example')}
        >
          {commandStrings.communitySupport}
        </CommandItem>
      </Command.Group>
    </>
  );
});
