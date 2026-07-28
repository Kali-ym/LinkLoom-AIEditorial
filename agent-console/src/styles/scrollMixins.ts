import { css } from 'antd-style';

/** Hide scrollbars while keeping overflow scroll (wheel / touch). */
export const hideScrollbar = css`
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }
`;

/** Wrap long prose; use on containers that must not show horizontal scrollbars. */
export const proseWrap = css`
  overflow-wrap: anywhere;
  word-break: break-word;
  min-width: 0;
  max-width: 100%;
`;

/** Code / diff blocks — keep native scrollbars for long lines. */
export const codeBlockScroll = css`
  overflow: auto;
  max-width: 100%;
  min-width: 0;
  overscroll-behavior: contain;
`;

/** Shell commands & short code snippets — wrap, no scrollbars. */
export const commandBlock = css`
  overflow: hidden;
  max-width: 100%;
  min-width: 0;
  ${hideScrollbar}
  ${proseWrap}

  & pre,
  & code,
  & :global(pre),
  & :global(code) {
    white-space: pre-wrap;
    word-break: break-all;
    overflow-wrap: anywhere;
    overflow: hidden;
    max-width: 100%;
  }

  /* lobehub Highlighter root */
  & :global(.ant-highlighter) {
    overflow: hidden;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    ${hideScrollbar}
  }

  /* SyntaxHighlighter sets pre { overflow-x: auto } — disable for wrapped snippets */
  & :global(.ant-highlighter pre) {
    overflow: hidden !important;
    max-width: 100%;
    white-space: pre-wrap !important;
    text-wrap: wrap !important;
    ${hideScrollbar}
  }

  /* Shiki .line uses calc(100% + 32px) + negative margin — causes phantom horizontal scroll */
  & :global(.ant-highlighter code .line) {
    width: 100% !important;
    max-width: 100% !important;
    margin-inline: 0 !important;
    padding-inline: 0 !important;
  }

  & :global(.ant-highlighter code) {
    min-width: 0;
    max-width: 100%;
  }
`;
