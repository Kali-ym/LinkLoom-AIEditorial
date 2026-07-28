import type { Plugin } from 'unified';
import { SKIP, visit } from 'unist-util-visit';

const escapeRegExp = (str: string) => str.replaceAll(/[$()*+.?[\\\]^{|}]/g, '\\$&');

const attributeRegex = /([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

const parseAttributes = (attributeString: string): Record<string, string | boolean> => {
  const attributes: Record<string, string | boolean> = {};
  let match: RegExpExecArray | null;
  while ((match = attributeRegex.exec(attributeString)) !== null) {
    const [, key, valueDouble, valueSingle, valueUnquoted] = match;
    attributes[key] = valueDouble ?? valueSingle ?? valueUnquoted ?? true;
  }
  return attributes;
};

/** Remark plugin: `<tagName ... />` in user messages → custom Markdown component. */
export const createRemarkSelfClosingTagPlugin =
  (tagName: string): Plugin =>
  () => {
    const escapedTagName = escapeRegExp(tagName);
    const exactTagRegex = new RegExp(`^<${escapedTagName}(\\s+[^>]*?)?\\s*\\/>\\s*$`, 'i');
    const textTagRegex = new RegExp(`<${escapedTagName}(\\s+[^>]*?)?\\s*\\/>`, 'gi');

    return (tree) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      visit(tree, 'html', (node, index, parent: any) => {
        const htmlNode = node as { value?: string };
        const match = htmlNode.value?.match(exactTagRegex);

        if (match && parent && typeof index === 'number') {
          const [, attributesString] = match;
          const properties = attributesString ? parseAttributes(attributesString.trim()) : {};

          const newNode = {
            data: {
              hName: tagName,
              hProperties: properties,
            },
            type: tagName,
          };

          parent.children.splice(index, 1, newNode);
          return [SKIP, index + 1];
        }

        if (
          parent &&
          typeof index === 'number' &&
          typeof htmlNode.value === 'string' &&
          htmlNode.value.toLowerCase().includes(`<${tagName.toLowerCase()}`)
        ) {
          const html = htmlNode.value;
          const newChildren: Array<{ data?: { hName: string; hProperties: Record<string, string | boolean> }; type: string; value?: string }> = [];
          let lastIndex = 0;
          let textMatch: RegExpExecArray | null;

          textTagRegex.lastIndex = 0;
          while ((textMatch = textTagRegex.exec(html)) !== null) {
            const [fullMatch, attributesString] = textMatch;
            const matchIndex = textMatch.index;

            if (matchIndex > lastIndex) {
              const fragment = html.slice(lastIndex, matchIndex);
              if (fragment) newChildren.push({ type: 'html', value: fragment });
            }

            const properties = attributesString ? parseAttributes(attributesString.trim()) : {};
            newChildren.push({
              data: { hName: tagName, hProperties: properties },
              type: tagName,
            });

            lastIndex = matchIndex + fullMatch.length;
          }

          if (newChildren.length > 0) {
            if (lastIndex < html.length) {
              const fragment = html.slice(lastIndex);
              if (fragment) newChildren.push({ type: 'html', value: fragment });
            }

            if (newChildren.some((n) => n?.type === tagName)) {
              parent.children.splice(index, 1, ...newChildren);
              return [SKIP, index + newChildren.length];
            }
          }
        }
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      visit(tree, 'text', (node, index, parent: any) => {
        const textNode = node as { value?: string };
        if (
          !parent ||
          typeof index !== 'number' ||
          typeof textNode.value !== 'string' ||
          !textNode.value.toLowerCase().includes(`<${tagName.toLowerCase()}`)
        ) {
          return;
        }

        const text = textNode.value;
        let lastIndex = 0;
        const newChildren: Array<{ data?: { hName: string; hProperties: Record<string, string | boolean> }; type: string; value?: string }> = [];
        let match: RegExpExecArray | null;

        textTagRegex.lastIndex = 0;

        while ((match = textTagRegex.exec(text)) !== null) {
          const [fullMatch, attributesString] = match;
          const matchIndex = match.index;

          if (matchIndex > lastIndex) {
            newChildren.push({ type: 'text', value: text.slice(lastIndex, matchIndex) });
          }

          const properties = attributesString ? parseAttributes(attributesString.trim()) : {};
          newChildren.push({
            data: {
              hName: tagName,
              hProperties: properties,
            },
            type: tagName,
          });

          lastIndex = matchIndex + fullMatch.length;
        }

        if (newChildren.length > 0) {
          if (lastIndex < text.length) {
            newChildren.push({ type: 'text', value: text.slice(lastIndex) });
          }

          parent.children.splice(index, 1, ...newChildren);
          return [SKIP, index + newChildren.length];
        }
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      visit(tree, 'inlineCode', (node, index, parent: any) => {
        const codeNode = node as { value?: string };
        if (
          !parent ||
          typeof index !== 'number' ||
          typeof codeNode.value !== 'string' ||
          !codeNode.value.toLowerCase().includes(`<${tagName.toLowerCase()}`)
        ) {
          return;
        }

        const match = codeNode.value.match(exactTagRegex);
        if (match) {
          const [, attributesString] = match;
          const properties = attributesString ? parseAttributes(attributesString.trim()) : {};

          const newNode = {
            data: {
              hName: tagName,
              hProperties: properties,
            },
            type: tagName,
          };

          parent.children.splice(index, 1, newNode);
          return [SKIP, index + 1];
        }
      });
    };
  };
