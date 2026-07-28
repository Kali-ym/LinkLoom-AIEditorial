# 运维 Runbook

## 服务是否活着

```bash
curl http://127.0.0.1:3000/api/health
curl http://127.0.0.1:3000/api/ready
```

`/api/ready` 失败且日志含 `ECONNREFUSED` / `password authentication failed`：检查 `.env` 中 `DATABASE_URL`、PostgreSQL 是否监听、用户/库是否已创建（见 README §5.2.1）。

## Next upstream 异常

1. 确认已执行 `pnpm run build:web`。
2. 检查 `web/.next/standalone` 是否存在。
3. 查看日志中的 `[next]` 和 `[next:err]`。
4. 如果独立部署 Web，设置 `SKIP_NEXT_SPAWN=1` 和正确的 `NEXT_UPSTREAM_URL`。

## 数据库变慢

1. 执行 `pnpm run db:stats` 查看数据量。
2. 执行 `pnpm run db:vacuum` 做 `VACUUM ANALYZE`。
3. 检查 PostgreSQL 连接池是否耗尽（查看日志中的 pool error）。
4. 对旧数据执行 `pnpm run db:archive -- --before YYYY-MM-DD`。

## 任务 stuck

1. 查看 `/api/admin/status` 和 dashboard 日志。
2. 重启服务会把残留 running 任务标记为 interrupted。
3. 确认 AI Provider、发布器 token 和网络代理可用。

## 升级前检查

1. `pnpm run backup:data`
2. `pnpm run ci`
3. `pnpm run build:all`
4. 重启服务后执行 `pnpm run doctor:data`
