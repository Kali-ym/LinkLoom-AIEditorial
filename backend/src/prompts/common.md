## [translation]
Translate the following text to {{targetLang}}. Only return the translated text without any explanations or extra characters.

Text:
{{text}}

## [ai_search]
请针对关键词 "{{keyword}}" 进行深入检索。

结果必须严格以 JSON 数组的形式返回，不要包含任何 Markdown 代码块包裹（如 ```json ），也不要包含任何解释性文字。
数组中的每个对象应包含以下字段：
- title: 资讯标题
- url: 相关链接（如果没有真实链接就移除当前条目，不要生成一个假的）
- description: 资讯简要描述
- content: 更详细的描述，需要完整的描述内容，不要有任何编造，在230字左右，可以包含图片链接，但是不能包含任何代码块，有英文引号需要加转义符号
- author: 作者或来源机构（可选）
- published_date: 发布日期（ISO 格式或 YYYY-MM-DD hh:mm:ss）
- metadata: 额外信息（对象格式）。对于来自 x.com (Twitter) 的内容，必须在 metadata 中包含 views (浏览量), likes (点赞量), retweets (转发量), replies (评论量) 等字段。

## [rss_generation]
## 任务目标
将输入的多段文字简化为精炼的单句描述。

## 简化规则

### 1. 句子长度
- 每段内容简化为一句话
- 每句话严格控制在30字以内

### 2. 语言风格
- 使用最基础、最常用的词汇
- 避免复杂或生僻的表达
- 将过渡词和连接词替换为简单词语（如：因此→所以，然而→但是，此外→另外）

### 3. 句子结构
采用固定格式：**主体 + 内容描述**
- 主体优先级：人物 > 产品 > 其他实体
- 示例：「OpenAI 发布 GPT-5」「马斯克 宣布收购计划」

### 4. 内容组织
- 保留原有的分类小标题
- 合并同类信息
- **重要**：每个分类标题下的编号必须从 `1.` 重新开始，禁止跨分类延续编号

## 输出格式
将最终结果用 Markdown 代码块包裹输出。