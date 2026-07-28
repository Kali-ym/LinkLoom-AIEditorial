import type { TaskThreadStatus } from '../../../../domain/types/taskMessage';

export const formatDuration = (duration: number | undefined | null): string | null => {
  if (!duration) return null;
  if (duration < 1000) return `${duration}ms`;
  if (duration < 60_000) return `${(duration / 1000).toFixed(1)}s`;
  const minutes = Math.floor(duration / 60_000);
  const seconds = ((duration % 60_000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
};

export const formatCost = (cost: number | undefined | null): string | null => {
  if (!cost) return null;
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
};

export const formatElapsedTime = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) {
    return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
};

export const isProcessingStatus = (status?: TaskThreadStatus): boolean => {
  if (!status) return false;
  return (
    status === 'Processing' ||
    status === 'InReview' ||
    status === 'Pending' ||
    status === 'Active' ||
    status === 'Todo'
  );
};

export const isTaskErrorStatus = (status?: TaskThreadStatus): boolean =>
  status === 'Failed' || status === 'Cancel';
