import path from 'path';
import fs from 'fs-extra';
import { LogService } from '../../../LogService.js';
import type { PromptFragmentMeta, PromptTemplateMeta } from './types.js';

/**
 * 片段加载器:从 .md 文件解析命名片段与模板。
 *
 * 文件格式约定(单文件可同时包含 templates 与 fragments):
 *
 *   ## [templateName]            <- 模板,沿用旧 PromptService 多模板语法
 *   模板正文...
 *
 *   ### fragment: fragId         <- 片段,可被 {{#fragment:fragId}} 引用
 *   片段正文...
 *
 * 约束:
 * - template 与 fragment 共享同一命名空间,id 必须全局唯一
 * - fragment 正文可继续引用其他 fragment(递归展开由 templateEngine 负责)
 * - 解析时不做变量替换,只做结构化切分
 */

const TEMPLATE_HEADER = /^##\s*\[([\w.-]+)\]\s*$/;
const FRAGMENT_HEADER = /^###\s*fragment:\s*([\w.-]+)\s*$/;

export interface LoadedAssets {
  templates: PromptTemplateMeta[];
  fragments: PromptFragmentMeta[];
}

/** 解析单个 .md 文件内容,切分出 templates 与 fragments */
export function parsePromptMarkdown(
  content: string,
  source?: string
): LoadedAssets {
  const templates: PromptTemplateMeta[] = [];
  const fragments: PromptFragmentMeta[] = [];

  const lines = content.split('\n');
  let i = 0;
  // 当前正在累积的块:type/id/body 行区间
  let currentType: 'template' | 'fragment' | null = null;
  let currentId = '';
  let bodyStart = -1;

  const flush = (endIdx: number) => {
    if (!currentType || bodyStart < 0) return;
    const body = lines.slice(bodyStart, endIdx).join('\n').trim();
    if (currentType === 'template') {
      templates.push({ name: currentId, body, source });
    } else {
      fragments.push({ id: currentId, body, source });
    }
    currentType = null;
    currentId = '';
    bodyStart = -1;
  };

  while (i < lines.length) {
    const line = lines[i];
    const tplMatch = line.match(TEMPLATE_HEADER);
    const fragMatch = line.match(FRAGMENT_HEADER);

    if (tplMatch || fragMatch) {
      // 命中新块头:先 flush 旧块
      flush(i);
      if (tplMatch) {
        currentType = 'template';
        currentId = tplMatch[1];
      } else if (fragMatch) {
        currentType = 'fragment';
        currentId = fragMatch[1];
      }
      bodyStart = i + 1;
    }
    i++;
  }
  flush(lines.length);

  return { templates, fragments };
}

/** 从目录递归加载所有 .md / .txt 资产 */
export async function loadPromptAssetsFromDir(
  dir: string,
  baseDir?: string
): Promise<LoadedAssets> {
  const templates: PromptTemplateMeta[] = [];
  const fragments: PromptFragmentMeta[] = [];

  if (!(await fs.pathExists(dir))) {
    return { templates, fragments };
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = await loadPromptAssetsFromDir(fullPath, baseDir ?? dir);
      templates.push(...sub.templates);
      fragments.push(...sub.fragments);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.md') && !entry.name.endsWith('.txt')) continue;

    const content = await fs.readFile(fullPath, 'utf-8');
    const rel = path.relative(baseDir ?? dir, fullPath);
    const parsed = parsePromptMarkdown(content, rel);

    // 兼容旧格式:文件无 ## [name] 标记时,整个文件作为单模板,模板名=文件名
    if (parsed.templates.length === 0 && parsed.fragments.length === 0) {
      const trimmed = content.trim();
      if (trimmed) {
        const name = path.basename(entry.name, path.extname(entry.name));
        templates.push({ name, body: trimmed, source: rel });
      }
    } else {
      templates.push(...parsed.templates);
      fragments.push(...parsed.fragments);
    }
  }

  if (templates.length > 0) {
    LogService.info(`PromptRegistry loaded ${templates.length} template(s) from ${dir}`);
  }
  if (fragments.length > 0) {
    LogService.info(`PromptRegistry loaded ${fragments.length} fragment(s) from ${dir}`);
  }

  return { templates, fragments };
}
