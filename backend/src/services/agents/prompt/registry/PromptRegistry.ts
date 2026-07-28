import path from 'path';
import { fileURLToPath } from 'url';
import { LogService } from '../../../LogService.js';
import type { StructuredPrompt } from '../types.js';
import { loadPromptAssetsFromDir } from './FragmentLoader.js';
import { renderTemplate, scanFragmentRefs, scanVariables } from './templateEngine.js';
import type {
  DocRefResolver,
  PromptFragmentMeta,
  PromptTemplateMeta,
  RenderOptions,
  RenderResult
} from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * PromptRegistry:集中注册、解析、渲染 prompt 模板与片段。
 *
 * 取代旧 PromptService 的「字符串模板 + 变量替换」职责,扩展:
 *   - 支持 fragment 引用 {{#fragment:xxx}}
 *   - 支持 docRef 解析({ docRef: 'xxx' } -> fragment 正文)
 *   - 支持运行时 register(覆盖加载的资产,便于测试与热更新)
 *   - 提供 fragment resolver,供 StructuredPrompt 各字段引用共享片段
 *
 * 单例:整个进程共享一个 registry,资产目录默认 backend/src/prompts。
 */
export class PromptRegistry implements DocRefResolver {
  private static instance: PromptRegistry;
  private readonly templates: Map<string, PromptTemplateMeta> = new Map();
  private readonly fragments: Map<string, PromptFragmentMeta> = new Map();
  private readonly structuredPrompts: Map<string, StructuredPrompt> = new Map();
  private promptsDir: string;
  private loaded = false;

  private constructor() {
    // backend/src/services/agents/prompt/registry -> ../../../../prompts
    this.promptsDir = path.join(__dirname, '..', '..', '..', '..', 'prompts');
  }

  static getInstance(): PromptRegistry {
    if (!PromptRegistry.instance) {
      PromptRegistry.instance = new PromptRegistry();
    }
    return PromptRegistry.instance;
  }

  /** 测试/自定义场景下覆盖默认目录 */
  setPromptsDir(dir: string): void {
    this.promptsDir = dir;
    this.loaded = false;
    this.templates.clear();
    this.fragments.clear();
    this.structuredPrompts.clear();
  }

  /** 加载磁盘资产。重复调用安全(已加载则跳过,除非 force) */
  async load(force = false): Promise<void> {
    if (this.loaded && !force) return;
    const assets = await loadPromptAssetsFromDir(this.promptsDir);
    for (const tpl of assets.templates) this.templates.set(tpl.name, tpl);
    for (const frag of assets.fragments) this.fragments.set(frag.id, frag);
    this.loaded = true;
  }

  /** 运行时注册模板(覆盖同名) */
  registerTemplate(meta: PromptTemplateMeta): void {
    this.templates.set(meta.name, meta);
  }

  /** 运行时注册片段(覆盖同名) */
  registerFragment(meta: PromptFragmentMeta): void {
    this.fragments.set(meta.id, meta);
  }

  /** 运行时注册结构化 prompt(覆盖同名),供 structuredPromptRef 引用 */
  registerStructuredPrompt(id: string, prompt: StructuredPrompt): void {
    this.structuredPrompts.set(id, prompt);
  }

  /** 取结构化 prompt 对象。找不到返回 undefined */
  getStructuredPrompt(id: string): StructuredPrompt | undefined {
    return this.structuredPrompts.get(id);
  }

  /** 取模板正文(未渲染)。找不到返回 undefined */
  getTemplateRaw(name: string): string | undefined {
    return this.templates.get(name)?.body;
  }

  /** 取片段正文(未渲染)。找不到返回 undefined */
  getFragmentRaw(id: string): string | undefined {
    return this.fragments.get(id)?.body;
  }

  /** DocRefResolver 实现:供 StructuredPrompt identity.docRef 等场景使用 */
  resolve(id: string): string | undefined {
    return this.getFragmentRaw(id) ?? this.getTemplateRaw(id);
  }

  /** 列出所有结构化 prompt id(调试/后台展示用) */
  listStructuredPromptIds(): string[] {
    return Array.from(this.structuredPrompts.keys());
  }

  /**
   * 渲染模板:展开 fragment + 替换变量。
   * 找不到模板时返回空字符串(沿用旧 PromptService 行为)并记 warning。
   */
  render(name: string, options: RenderOptions = {}): RenderResult {
    const meta = this.templates.get(name);
    if (!meta) {
      LogService.warn(`PromptRegistry: template not found: ${name}`);
      return { text: '', usedFragments: [], warnings: [`template not found: ${name}`] };
    }
    return renderTemplate(meta.body, options, (id) => this.resolve(id));
  }

  /** 渲染任意字符串(非注册模板),用于 StructuredPrompt 字段内嵌 fragment 引用 */
  renderString(text: string, options: RenderOptions = {}): RenderResult {
    return renderTemplate(text, options, (id) => this.resolve(id));
  }

  /** 兼容旧 PromptService.getPrompt 签名:返回纯字符串,变量替换 */
  getPrompt(name: string, variables?: Record<string, string>): string {
    const result = this.render(name, { variables });
    if (result.warnings.length > 0) {
      for (const w of result.warnings) LogService.warn(`PromptRegistry: ${w}`);
    }
    return result.text;
  }

  /** 静态分析:模板依赖哪些 fragment 与变量 */
  analyze(name: string): { fragments: string[]; variables: string[] } | null {
    const meta = this.templates.get(name);
    if (!meta) return null;
    return {
      fragments: scanFragmentRefs(meta.body),
      variables: scanVariables(meta.body)
    };
  }
}
