/** User turn send contract — mirrors backend `userTurnPayload` (V2). */

export interface FileRef {
  fileId: string;
  name?: string;
  mimeType?: string;
  size?: number;
  url?: string;
}

export interface UserTurnPayload {
  message: string;
  editorData?: Record<string, unknown>;
  files?: FileRef[];
}
