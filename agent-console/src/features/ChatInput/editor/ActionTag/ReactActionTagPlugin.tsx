import { useLexicalComposerContext } from '@lobehub/editor';
import { type FC, useLayoutEffect } from 'react';

import { InlineActionTag } from './InlineActionTag';
import { ActionTagPlugin } from './ActionTagPlugin';

const ReactActionTagPlugin: FC = () => {
  const [editor] = useLexicalComposerContext();

  useLayoutEffect(() => {
    editor.registerPlugin(ActionTagPlugin, {
      decorator: (node, lexicalEditor) => (
        <InlineActionTag editor={lexicalEditor} node={node} />
      ),
    });
  }, [editor]);

  return null;
};

ReactActionTagPlugin.displayName = 'ReactActionTagPlugin';

export default ReactActionTagPlugin;
