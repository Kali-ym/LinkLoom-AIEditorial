import { Flexbox, Text } from '@lobehub/ui';
import { memo } from 'react';

import { CommandSnippet } from '../../CommandSnippet';
import { InterventionSection } from '../../InterventionSection';
import { interventionStyles } from '../../interventionStyles';
import type { BuiltinInterventionProps } from '../types';

const LANGUAGE_LABELS: Record<string, string> = {
  javascript: 'JavaScript',
  python: 'Python',
  typescript: 'TypeScript',
};

export const ExecuteCodeIntervention = memo(function ExecuteCodeIntervention({
  args,
}: BuiltinInterventionProps) {
  const code = typeof args.code === 'string' ? args.code : '';
  const language =
    typeof args.language === 'string' && args.language in LANGUAGE_LABELS
      ? args.language
      : 'python';
  const displayLanguage = LANGUAGE_LABELS[language] ?? language;
  const lineCount = code ? code.split('\n').length : 0;

  return (
    <Flexbox gap={12}>
      <InterventionSection
        description="代码将在隔离的云沙箱环境中运行，不会影响你的本地文件。"
        title="沙箱执行"
      >
        <div className={interventionStyles.metaRow}>
          <span className={interventionStyles.metaChip}>{displayLanguage}</span>
          {lineCount > 0 ? (
            <span className={interventionStyles.metaChip}>{lineCount} 行</span>
          ) : null}
        </div>
      </InterventionSection>
      {code ? <CommandSnippet language={language} text={code} /> : <Text type="secondary">未提供代码内容</Text>}
    </Flexbox>
  );
});
