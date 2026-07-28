export function getISODate(dateObj: Date = new Date()): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Shanghai'
  };
  const dateString = dateObj.toLocaleDateString('en-CA', options);
  return dateString;
}

/**
 * 规范化标签，确保返回 string[]
 */
export function normalizeTags(tags: any): string[] {
  if (!tags) return [];

  // 如果已经是数组
  if (Array.isArray(tags)) {
    return tags.map((t) => String(t).trim()).filter(Boolean);
  }

  // 如果是字符串，尝试解析
  if (typeof tags === 'string') {
    const trimmed = tags.trim();
    if (!trimmed) return [];

    // 尝试解析 JSON 数组
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        return normalizeTags(parsed);
      } catch (e) {
        // 解析失败，按逗号分隔
      }
    }

    // 尝试按逗号、空格或分号分隔
    return trimmed
      .split(/[,\s;]+/)
      .map((t) => t.trim())
      .filter(Boolean);
  }

  // 其他类型转换为字符串
  return [String(tags)];
}

/**
 * JSON 处理函数已迁移到 `shared/json.ts`。
 * 本文件保留 re-export 以避免广泛调用面 churn，新代码请直接 import 自 `shared/json.ts`。
 */
export {
  sanitizeJsonStringLiterals,
  sliceJsonPayload,
  parseJsonLenient,
  extractJson,
  removeMarkdownCodeBlock
} from '../shared/json.js';

export function stripHtml(html: string): string {
  if (!html) return '';

  // 1. 移除 script 和 style 标签及其内容 (HTML 中的 CSS 和 JS)
  let processedHtml = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  processedHtml = processedHtml.replace(/<style[\s\S]*?<\/style>/gi, '');

  // 2. 移除 Markdown 格式的 CSS 代码块 (如果存在)
  processedHtml = processedHtml.replace(/```css[\s\S]*?```/gi, '');

  // 3. 处理图片和视频（保留基本信息，作为纯文本中的占位符）
  processedHtml = processedHtml.replace(
    /<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi,
    (match, src, alt) => {
      return alt ? `[图片: ${alt} ${src}]` : `[图片: ${src}]`;
    }
  );
  processedHtml = processedHtml.replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, '[图片: $1]');
  processedHtml = processedHtml.replace(
    /<video[^>]*src="([^"]*)"[^>]*>.*?<\/video>/gi,
    '[视频: $1]'
  );

  // 4. 移除所有其他 HTML 标签，保留原有换行和空格
  return processedHtml.replace(/<[^>]+>/g, ' ').trim();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getRandomUserAgent(): string {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

export function truncateContent(content: string, maxLength = 150): string {
  if (!content || content.length <= maxLength) {
    return content;
  }

  // 截断到指定长度
  let truncated = content.substring(0, maxLength);

  // 尝试在最后一个换行符处截断
  const lastNewlineEnd = truncated.lastIndexOf('\n');

  // 如果找到换行符且位置合理（至少保留一半内容），则在换行符处截断
  if (lastNewlineEnd > maxLength / 2) {
    truncated = content.substring(0, lastNewlineEnd);
  }

  // 添加省略样式
  truncated += '\n\n......\n\n*[剩余内容已省略]*';

  return truncated;
}

/** 将历史遗留的 /daily-json 链接统一替换为 /daily。 */
export function normalizeDailyViewUrl(url: string): string {
  if (!url) return '';
  return url.replace(/\/daily-json(?=\/|$|\?|#)/gi, '/daily');
}
