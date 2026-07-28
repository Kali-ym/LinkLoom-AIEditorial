/**
 * §C.46 — runtime desktop vs web decision tree.
 * Set `VITE_AGENT_CONSOLE_IS_DESKTOP=false` to exercise Web-only WorkspaceControls paths.
 */
export const IS_ADMIN_DESKTOP = import.meta.env.VITE_AGENT_CONSOLE_IS_DESKTOP !== 'false';
