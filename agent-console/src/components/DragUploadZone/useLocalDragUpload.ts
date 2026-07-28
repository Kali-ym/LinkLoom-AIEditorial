import { useCallback } from 'react';

export type DragContentKind = 'files' | 'folders' | 'mixed' | 'none';

export interface DroppedFolder {
  name: string;
  path: string;
}

export interface PartitionedDroppedItems {
  files: File[];
  folders: DroppedFolder[];
}

const resolveElectronFilePath = (file: File): string | null => {
  const webUtils = (
    globalThis as unknown as {
      window?: { electron?: { webUtils?: { getPathForFile?: (file: File) => string } } };
    }
  ).window?.electron?.webUtils;
  if (!webUtils?.getPathForFile) return null;
  try {
    const result = webUtils.getPathForFile(file);
    return result || null;
  } catch {
    return null;
  }
};

const safeGetEntry = (item: DataTransferItem): FileSystemEntry | null => {
  try {
    return item.webkitGetAsEntry();
  } catch {
    return null;
  }
};

const processEntry = async (entry: FileSystemEntry): Promise<File[]> => {
  return new Promise((resolve) => {
    if (entry.isFile) {
      (entry as FileSystemFileEntry).file((file) => {
        resolve([file]);
      });
    } else if (entry.isDirectory) {
      const dirReader = (entry as FileSystemDirectoryEntry).createReader();
      dirReader.readEntries(async (entries) => {
        const filesPromises = entries.map((element) => processEntry(element));
        const fileArrays = await Promise.all(filesPromises);
        resolve(fileArrays.flat());
      });
    } else {
      resolve([]);
    }
  });
};

export const getFileListFromDataTransferItems = async (
  items: DataTransferItem[],
): Promise<File[]> => {
  const filePromises: Promise<File[]>[] = [];

  for (const item of items) {
    if (item.kind === 'file') {
      const file = item.getAsFile();
      if (file) {
        filePromises.push(Promise.resolve([file]));
      } else {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          filePromises.push(processEntry(entry));
        }
      }
    }
  }

  const fileArrays = await Promise.all(filePromises);
  return fileArrays.flat();
};

export const detectDragContentKind = (items: DataTransferItemList | null): DragContentKind => {
  if (!items || items.length === 0) return 'none';

  let hasFolder = false;
  let hasFile = false;

  for (const item of Array.from(items)) {
    if (item.kind !== 'file') continue;
    const entry = safeGetEntry(item);
    if (entry?.isDirectory) {
      hasFolder = true;
    } else {
      hasFile = true;
    }
    if (hasFolder && hasFile) break;
  }

  if (hasFolder && hasFile) return 'mixed';
  if (hasFolder) return 'folders';
  if (hasFile) return 'files';
  return 'none';
};

export const partitionDroppedItems = async (
  items: DataTransferItem[],
): Promise<PartitionedDroppedItems> => {
  const folders: DroppedFolder[] = [];
  const files: File[] = [];

  for (const item of items) {
    if (item.kind !== 'file') continue;

    const entry = safeGetEntry(item);

    if (entry?.isDirectory) {
      const directoryFile = item.getAsFile();
      const path = directoryFile ? resolveElectronFilePath(directoryFile) : null;
      if (path) {
        folders.push({
          name: directoryFile?.name || entry.name || path.split('/').pop() || path,
          path,
        });
        continue;
      }
      const flattened = await processEntry(entry);
      files.push(...flattened);
      continue;
    }

    const file = item.getAsFile();
    if (file) {
      files.push(file);
    } else if (entry) {
      const flattened = await processEntry(entry);
      files.push(...flattened);
    }
  }

  return { files, folders };
};

export interface UseLocalDragUploadOptions {
  disabled?: boolean;
  enableLocalFolderMention?: boolean;
  onLocalFolders?: (folders: DroppedFolder[]) => void | Promise<void>;
  onUploadFiles: (files: File[]) => void | Promise<void>;
}

export interface UseLocalDragUploadResult {
  getContainerProps: () => {
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
}

export const useLocalDragUpload = (
  options: UseLocalDragUploadOptions,
): UseLocalDragUploadResult => {
  const { onUploadFiles, disabled = false, enableLocalFolderMention, onLocalFolders } = options;

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
    },
    [disabled],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      if (disabled) return;
      if (!e.dataTransfer?.items || e.dataTransfer.items.length === 0) return;
      if (!e.dataTransfer.types.includes('Files')) return;

      e.preventDefault();

      const items = Array.from(e.dataTransfer.items);

      if (enableLocalFolderMention && onLocalFolders) {
        const { folders, files } = await partitionDroppedItems(items);
        if (folders.length > 0) {
          await onLocalFolders(folders);
        }
        if (files.length > 0) {
          await onUploadFiles(files);
        }
        return;
      }

      const files = await getFileListFromDataTransferItems(items);
      if (files.length === 0) return;
      await onUploadFiles(files);
    },
    [disabled, enableLocalFolderMention, onLocalFolders, onUploadFiles],
  );

  const getContainerProps = useCallback(
    () => ({
      onDragOver: handleDragOver,
      onDrop: handleDrop,
    }),
    [handleDragOver, handleDrop],
  );

  return { getContainerProps };
};
