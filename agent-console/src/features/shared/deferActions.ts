import { isAgentConsoleApiMode } from '../../adapters/registry';
import { showToast } from '../../services/ui/toast';
import { deferStrings } from './deferStrings';

export type DeferStringKey = keyof typeof deferStrings;

export function isDeferApiMode(): boolean {
  return isAgentConsoleApiMode();
}

export function showDeferHint(key: DeferStringKey): void {
  showToast(deferStrings[key].hint);
}

/** api 模式显示 defer 提示；mock 模式执行演示动作 */
export function runOrDefer(key: DeferStringKey, mockAction: () => void): void {
  if (isAgentConsoleApiMode()) {
    showDeferHint(key);
    return;
  }
  mockAction();
}
