/**
 * PromptRegistry 类型定义。
 *
 * 设计目标:
 * - 统一管理「模板字符串」与「结构化片段」两类 prompt 资产
 * - 支持 docRef / fragment 引用,把通用行为约束抽到 .md 片段中复用
 * - 支持 version 与 examples 元信息,便于后续灰度与评估
 */

/** 单个片段(共享行为块)的元数据 */
export interface PromptFragmentMeta {
  /** 片段 ID,用于 docRef / {{#fragment:xxx}} 引用 */
  id: string;
  /** 片段正文(markdown) */
  body: string;
  /** 来源文件相对路径,用于调试 */
  source?: string;
  /** 可选描述,仅用于后台展示 */
  description?: string;
}

/** 模板元数据:除正文外携带的元信息 */
export interface PromptTemplateMeta {
  /** 模板名,等价旧 PromptService 的 key */
  name: string;
  /** 模板正文(可含 {{var}} / {{#fragment:xxx}} 占位) */
  body: string;
  /** 来源文件相对路径 */
  source?: string;
  /** 版本号,默认 1 */
  version?: number;
  /** 可选 few-shot 示例,供 registry 渲染时附带 */
  examples?: Array<{ input: string; output: string }>;
}

/** Registry 渲染选项 */
export interface RenderOptions {
  /** 普通变量替换 */
  variables?: Record<string, string>;
  /** 是否展开 fragment 引用,默认 true */
  expandFragments?: boolean;
  /** fragment 缺失时的策略:warn(默认) | throw | ignore */
  onMissingFragment?: 'warn' | 'throw' | 'ignore';
  /** fragment 递归展开最大深度,防止循环引用,默认 3 */
  maxDepth?: number;
}

/** Registry 渲染结果 */
export interface RenderResult {
  /** 最终文本(fragment 已展开、变量已替换) */
  text: string;
  /** 命中的 fragment id 列表(去重,顺序为先外层后内层) */
  usedFragments: string[];
  /** 渲染过程中产生的警告 */
  warnings: string[];
}

/** docRef 解析结果:把 { docRef: 'xxx' } 解析成片段正文 */
export interface DocRefResolver {
  /** 按 id 取片段正文,找不到返回 undefined */
  resolve(id: string): string | undefined;
}
