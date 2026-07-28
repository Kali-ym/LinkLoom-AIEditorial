/** §C.52 — agent knowledge/file bind mock */
export async function bindKnowledgeBaseToAgent(
  agentId: string,
  knowledgeBaseId: string,
): Promise<void> {
  await new Promise((r) => window.setTimeout(r, 160));
  void agentId;
  void knowledgeBaseId;
}

export async function unbindKnowledgeBaseFromAgent(
  agentId: string,
  knowledgeBaseId: string,
): Promise<void> {
  await new Promise((r) => window.setTimeout(r, 120));
  void agentId;
  void knowledgeBaseId;
}

export async function bindFileToAgent(agentId: string, fileId: string): Promise<void> {
  await new Promise((r) => window.setTimeout(r, 160));
  void agentId;
  void fileId;
}

export async function unbindFileFromAgent(agentId: string, fileId: string): Promise<void> {
  await new Promise((r) => window.setTimeout(r, 120));
  void agentId;
  void fileId;
}
