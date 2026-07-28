/**
 * AgentRepository 的 row ↔ entity 转换。
 *
 * 适配 PostgreSQL JSONB 列：`row.data` 可能是对象（pg 自动解析）或字符串（兼容旧逻辑）。
 */

interface JsonRow {
  data: string | any;
}

function safeParse(raw: string | any, source: string): any {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch (err: any) {
    throw new Error(`Failed to parse ${source} row: ${err?.message || err}`);
  }
}

export const AgentMapper = {
  toEntity(row: JsonRow | undefined): any | null {
    if (!row) return null;
    return safeParse(row.data, 'agent');
  },
  toEntityList(rows: JsonRow[]): any[] {
    return rows.map((row) => safeParse(row.data, 'agent'));
  },
  toRow(entity: any): string {
    return JSON.stringify(entity);
  }
};

export const SkillMapper = {
  toEntity(row: JsonRow | undefined): any | null {
    if (!row) return null;
    return safeParse(row.data, 'skill');
  },
  toEntityList(rows: JsonRow[]): any[] {
    return rows.map((row) => safeParse(row.data, 'skill'));
  },
  toRow(entity: any): string {
    return JSON.stringify(entity);
  }
};

export const WorkflowMapper = {
  toEntity(row: JsonRow | undefined): any | null {
    if (!row) return null;
    return safeParse(row.data, 'workflow');
  },
  toEntityList(rows: JsonRow[]): any[] {
    return rows.map((row) => safeParse(row.data, 'workflow'));
  },
  toRow(entity: any): string {
    return JSON.stringify(entity);
  }
};

export const McpConfigMapper = {
  toEntity(row: JsonRow | undefined): any | null {
    if (!row) return null;
    return safeParse(row.data, 'mcp_config');
  },
  toEntityList(rows: JsonRow[]): any[] {
    return rows.map((row) => safeParse(row.data, 'mcp_config'));
  },
  toRow(entity: any): string {
    return JSON.stringify(entity);
  }
};
