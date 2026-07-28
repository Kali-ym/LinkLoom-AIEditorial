export interface Agent {
  id: string;
  name: string;
  description: string;
  gradient: string;
  welcome?: string;
  openingQuestions?: string[];
  /** 在 Agent Console 侧栏展示；默认 true。 */
  consoleVisible?: boolean;
  /** 主智能体（侧栏置顶项、默认 @ 目标）；由 metadata.ui.isPrimary 映射。 */
  isPrimary?: boolean;
  /** Group collaboration session — ChatHeader Tags show MemberCountTag. */
  sessionType?: 'group';
  groupMembers?: string[];
  /** Desktop local runtime — enables OpenInAppButton when set with workingDirectory. */
  isLocalSystemEnabled?: boolean;
  workingDirectory?: string;
  /** Git repo type — required for Review tab (`reviewAvailable`). */
  repoType?: 'git' | 'github';
  /** Remote device-bound execution — enables Files/Review without local runtime. */
  isDeviceMode?: boolean;
}

export interface AgentSummary {
  id: string;
  name: string;
  gradient: string;
}
