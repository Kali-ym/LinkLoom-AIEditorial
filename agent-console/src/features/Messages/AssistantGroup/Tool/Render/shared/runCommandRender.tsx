import { memo } from 'react';

import type { BuiltinRenderProps } from '../../toolComponentTypes';
import { CommandBlock } from '../../shared/CommandBlock';

interface RunCommandState {
  command?: string;
  exitCode?: number;
  output?: string;
  stderr?: string;
  stdout?: string;
}

/** §C.45*/
export const RunCommandRender = memo(function RunCommandRender({
  args,
  content,
  pluginState,
}: BuiltinRenderProps<{ command?: string }, RunCommandState>) {
  const state = (pluginState ?? {}) as RunCommandState;

  return (
    <CommandBlock
      command={args?.command || state.command || ''}
      exitCode={state.exitCode}
      output={state.output || state.stdout || content || ''}
      stderr={state.stderr}
    />
  );
});
