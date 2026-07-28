/** §C.13 — queued outbound message. */
export interface QueuedFile {
  id: string;
  name: string;
  mimeType: string;
  url?: string;
}

export interface QueueItem {
  id: string;
  text: string;
  filesPreview?: QueuedFile[];
}
