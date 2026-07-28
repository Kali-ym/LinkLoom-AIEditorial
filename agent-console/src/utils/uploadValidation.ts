const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export interface UploadValidationResult {
  ok: boolean;
  message?: string;
}

export function validateChatUploadFile(
  file: File,
  options?: { canUploadImage?: boolean; canUploadVideo?: boolean },
): UploadValidationResult {
  const canUploadImage = options?.canUploadImage ?? true;
  const canUploadVideo = options?.canUploadVideo ?? true;

  if (file.type.startsWith('image/') && !canUploadImage) {
    return { ok: false, message: '当前模型不支持上传图片' };
  }
  if (file.type.startsWith('video/') && !canUploadVideo) {
    return { ok: false, message: '当前模型不支持上传视频' };
  }
  if (file.type.startsWith('video/') && file.size > MAX_VIDEO_BYTES) {
    const maxMb = Math.round(MAX_VIDEO_BYTES / (1024 * 1024));
    const actualMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      ok: false,
      message: `视频大小 ${actualMb}MB 超过上限 ${maxMb}MB`,
    };
  }
  return { ok: true };
}

export function validateChatUploadFiles(
  files: FileList | File[],
  options?: { canUploadImage?: boolean; canUploadVideo?: boolean },
): UploadValidationResult {
  for (const file of Array.from(files)) {
    const result = validateChatUploadFile(file, options);
    if (!result.ok) return result;
  }
  return { ok: true };
}
