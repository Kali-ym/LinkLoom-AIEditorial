import { getAgentConsolePorts } from '../../adapters/registry';
import { buildNewMarkdownDocumentContent } from '../../domain/utils/markdownFrontmatter';
import { useWorkspaceControlsStore } from '../../stores/workspaceControlsStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import {
  isWorkspaceNotProvisionedError,
  workspaceMutationErrorMessage,
} from '../../utils/workspaceProvision';
import { showToast, showErrorToast } from '../ui/toast';
import { pruneDescendantWorkspacePaths, resolveDocumentParentPath } from '../../utils/documentTree';

export async function refreshWorkspaceDocuments(agentId: string) {
  await useWorkspaceStore.getState().refreshWorkspaceDocuments(agentId);
}

async function runWithSandboxBootstrap<T>(agentId: string, mutation: () => Promise<T>): Promise<T> {
  try {
    return await mutation();
  } catch (error) {
    if (!isWorkspaceNotProvisionedError(error)) {
      showErrorToast(workspaceMutationErrorMessage(error, '操作失败'));
      throw error;
    }

    const started = await useWorkspaceControlsStore.getState().startSandbox(agentId);
    if (!started || started.status === 'not_provisioned' || started.status === 'error') {
      showErrorToast('请先启动沙箱后再操作');
      throw error;
    }

    try {
      return await mutation();
    } catch (retryError) {
      showErrorToast(workspaceMutationErrorMessage(retryError, '操作失败'));
      throw retryError;
    }
  }
}

export async function createWorkspaceFolder(agentId: string, parentPath: string | null) {
  return runWithSandboxBootstrap(agentId, async () => {
    const name = `新建文件夹 ${new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }).replace(/:/g, '-')}`;
    const path = parentPath ? `${parentPath}/${name}` : name;
    await getAgentConsolePorts().workspace.createWorkspaceDirectory(agentId, path);
    await refreshWorkspaceDocuments(agentId);
    showToast(`已创建文件夹：${name}`);
    return path;
  });
}

export async function createWorkspaceMarkdown(agentId: string, parentPath: string | null) {
  return runWithSandboxBootstrap(agentId, async () => {
    const fileName = `未命名-${Date.now()}.md`;
    const path = parentPath ? `${parentPath}/${fileName}` : fileName;
    await getAgentConsolePorts().workspace.createWorkspaceFile(
      agentId,
      path,
      buildNewMarkdownDocumentContent(fileName),
    );
    await refreshWorkspaceDocuments(agentId);
    showToast(`已创建文档：${fileName}`);
    return path;
  });
}

export async function renameWorkspaceEntry(agentId: string, fromPath: string, newName: string) {
  const parent = resolveDocumentParentPath(fromPath);
  const to = parent ? `${parent}/${newName}` : newName;
  await getAgentConsolePorts().workspace.moveWorkspaceEntry(agentId, fromPath, to);
  await refreshWorkspaceDocuments(agentId);
  return to;
}

export async function deleteWorkspaceEntry(
  agentId: string,
  path: string,
  options?: { silent?: boolean },
) {
  await getAgentConsolePorts().workspace.deleteWorkspaceEntry(agentId, path);
  if (!options?.silent) {
    await refreshWorkspaceDocuments(agentId);
    showToast('已删除');
  }
}

export async function deleteWorkspaceEntries(agentId: string, paths: string[]) {
  const targets = pruneDescendantWorkspacePaths(paths);
  for (const path of targets) {
    await deleteWorkspaceEntry(agentId, path, { silent: true });
  }
  await refreshWorkspaceDocuments(agentId);
  showToast(`已删除 ${targets.length} 项`);
}

export async function moveWorkspaceEntry(agentId: string, from: string, toDir: string) {
  const baseName = from.split('/').pop() ?? from;
  const to = toDir ? `${toDir}/${baseName}` : baseName;
  await getAgentConsolePorts().workspace.moveWorkspaceEntry(agentId, from, to);
  await refreshWorkspaceDocuments(agentId);
}

export async function writeWorkspaceFileContent(
  agentId: string,
  path: string,
  content: string,
  options?: { expectedUpdatedAt?: number },
): Promise<{ updatedAt: number }> {
  return getAgentConsolePorts().workspace.writeWorkspaceFile(agentId, path, content, options);
}
