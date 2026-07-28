import { Highlighter } from '@lobehub/ui';
import { memo } from 'react';

import { InterventionPanel } from './InterventionSection';
import { interventionStyles } from './interventionStyles';

/** Highlighter in a wrap-only panel — CSS in commandBlock neutralizes Shiki line overflow. */
export const CommandSnippet = memo(function CommandSnippet({
  text,
  language = 'text',
}: {
  text: string;
  language?: string;
}) {
  return (
    <InterventionPanel className={interventionStyles.commandBlock} mono>
      <Highlighter
        className={interventionStyles.commandHighlighter}
        language={language}
        showLanguage={false}
        variant="borderless"
        wrap
      >
        {text}
      </Highlighter>
    </InterventionPanel>
  );
});
