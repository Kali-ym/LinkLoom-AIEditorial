import { Command } from 'cmdk';
import { ChevronRight } from 'lucide-react';
import { memo, useMemo } from 'react';

import { extractSettingsSubPath } from './utils/context';
import {
  getContextCommands,
  getGlobalSettingsCommands,
} from './utils/contextCommands';
import { useCommandMenuContext } from './CommandMenuContext';
import { CommandItem } from './components';
import { commandStrings } from './commandStrings';
import { useCommandMenu } from './useCommandMenu';

/** §C.41*/
export const ContextCommands = memo(function ContextCommands() {
  const { handleNavigate } = useCommandMenu();
  const { menuContext, pathname } = useCommandMenuContext();

  const subPath = useMemo(() => extractSettingsSubPath(pathname), [pathname]);

  const commands = getContextCommands(menuContext, subPath);
  const globalSettingsCommands = getGlobalSettingsCommands(menuContext);

  const hasCommands = commands.length > 0 || globalSettingsCommands.length > 0;
  if (!hasCommands) return null;

  const contextName = commandStrings.context[menuContext] ?? menuContext;
  const settingsContextName = commandStrings.context.settings;

  const renderCommand = (
    cmd: (typeof commands)[number],
    prefix: string,
    unpinned?: boolean,
  ) => {
    const Icon = cmd.icon;
    const searchValue = `${prefix} ${cmd.label} ${cmd.keywords.join(' ')}`;
    return (
      <CommandItem
        icon={<Icon />}
        key={cmd.path}
        unpinned={unpinned}
        value={searchValue}
        onSelect={() => handleNavigate(cmd.path)}
      >
        <span style={{ opacity: 0.5 }}>{prefix}</span>
        <ChevronRight
          size={14}
          style={{
            display: 'inline',
            marginInline: '6px',
            opacity: 0.5,
            verticalAlign: 'middle',
          }}
        />
        {cmd.label}
      </CommandItem>
    );
  };

  return (
    <>
      {commands.length > 0 ? (
        <Command.Group>{commands.map((cmd) => renderCommand(cmd, contextName))}</Command.Group>
      ) : null}

      {globalSettingsCommands.length > 0 ? (
        <Command.Group>
          {globalSettingsCommands.map((cmd) =>
            renderCommand(cmd, settingsContextName, true),
          )}
        </Command.Group>
      ) : null}
    </>
  );
});
