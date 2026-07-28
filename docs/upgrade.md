# 升级指南

## 升级流程

1. 停止写入任务或暂停调度。
2. 执行 `pnpm run backup:data`。
3. 拉取新版本代码。
4. 执行 `pnpm install --frozen-lockfile`。
5. 执行 `pnpm run build:all`。
6. 重启 LinkLoom。
7. 执行 `pnpm run doctor:data`。

## 回滚

1. 停止服务。
2. 回到上一版本代码。
3. 使用升级前备份执行 `pnpm run restore:data -- <backup-dir>`。
4. 重启服务并检查 `/api/ready`。

## 数据库迁移

PostgreSQL schema 由启动时 `SchemaMigrator` 自动处理（幂等 DDL）。无需手工跑 SQL，但升级后建议：

1. 查看启动日志是否有 migration 报错。
2. 执行 `pnpm run doctor:data` 与 `curl http://127.0.0.1:3000/api/ready`。
3. 首次启动新版本时，`WorkflowNormalizationSeeder` 会把存量工作流中的 `nextStepId` 归一为 `nextStepIds`，并清理已废弃的 batch/dedupe 兼容字段（日志关键字 `[WorkflowNormalization]`）。

涉及 `source_data`、settings、workflow 模板或 KV 结构的 PR，应在描述中说明 schema / 数据兼容性；大版本升级前务必 `pnpm run backup:data`。

## 配置与设置

- 管理端「系统设置」整表保存时，`ADAPTERS`、`AI_PROVIDERS`、`CATEGORIES`、`PUBLISHERS`、`STORAGES` 以客户端列表为准（允许删除项）；单项字段仍按 id merge，脱敏密钥不会被 `••••` 占位覆盖。
- API Key 测试/运行时使用库内完整密钥，接口响应仍为脱敏字段。
