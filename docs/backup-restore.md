# 备份与恢复

LinkLoom 的持久化数据以 **PostgreSQL** 为主（设置、采集源、工作流、记忆、知识库、任务日志等）。`data/` 目录下的 `skills/`（及构建时同步的 prompts/templates）为文件资产；`memory/`、`knowledge/` 若仍存在则多为历史目录，备份脚本会一并拷贝，但新业务数据已在库表 `agent_memories`、`kb_*` 中。

## 备份

```bash
pnpm run backup:data
```

默认输出到 `./backups/linkloom-<timestamp>/`。可以通过 `BACKUP_DIR` 修改目录。

备份内容：

- `database.sql`：通过 `pg_dump` 导出的完整数据库。
- `memory/`、`knowledge/`、`skills/`：文件型资产。

## 恢复

恢复前先停止 LinkLoom 进程：

```bash
pnpm run restore:data -- /path/to/linkloom-backup
```

恢复后重启服务，再执行：

```bash
pnpm run doctor:data
```

## 建议频率

- 个人站点：每日一次。
- 高频资讯站：每 1 到 6 小时一次。
- 升级、归档、清理前必须手动备份一次。
