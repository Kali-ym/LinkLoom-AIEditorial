import {
  AgentStreaming,
  EditRender,
  GlobRender,
  GrepRender,
  ReadRender,
  SkillRender,
  TodoWriteRender,
  WriteRender,
} from '../Render/shared/claudeCodeRenders';
import { RunCommandRender } from '../Render/shared/runCommandRender';
import { wrapRender } from '../Render/wrapRender';

export const ClaudeCodeStreamings = {
  Agent: AgentStreaming,
  Bash: wrapRender(RunCommandRender),
  Edit: wrapRender(EditRender),
  Glob: wrapRender(GlobRender),
  Grep: wrapRender(GrepRender),
  Read: wrapRender(ReadRender),
  Skill: wrapRender(SkillRender),
  TodoWrite: wrapRender(TodoWriteRender),
  Write: wrapRender(WriteRender),
};
