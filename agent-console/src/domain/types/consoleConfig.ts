export interface ConsoleConfig {
  enableBusinessFeatures: boolean;
  /** Demo doc id for HeaderActions document-compare menu item. */
  documentCompareDocId?: string;
  /** §C.18 show input disclaimer footnote */
  showInputFootnote?: boolean;
  /** §C.18 dev mode — SendButton hover menu */
  isDevMode?: boolean;
  /** §C.22 Plus attachments submenu */
  enableKnowledgeBase?: boolean;
  /** §C.22 gateway-mode switch visibility */
  enableGatewayMode?: boolean;
  /** §C.22 tools submenu — function calling */
  enableFC?: boolean;
  /** §C.22 search three-option submenu */
  showProviderSearch?: boolean;
  /** §C.57 Lab — false 时 ActionBar 隐藏 typo 按钮 */
  enableInputMarkdown?: boolean;
}
