# 参考工作流（非运行时）

本目录存放 **YAML 格式的工作流示例**，用于文档、AI Builder 参考或手动导入，**不会**被 `pnpm run build:backend` 拷贝到 `dist/`，也不会在启动时自动加载。

## 与 `backend/templates/` 的区别

|          | `docs/reference-workflows/` | `backend/templates/`             |
| -------- | --------------------------- | -------------------------------- |
| 格式     | YAML（`workflows/*.yaml`）  | JSON                             |
| 用途     | 设计参考、迁移草稿          | 默认种子工作流（Seeder 读取）    |
| 构建     | 不参与                      | 拷贝到 `backend/dist/templates/` |
| 修改影响 | 无运行时影响                | 影响新环境默认数据               |

运行时工作流与 Agent 配置保存在 **PostgreSQL**；管理端「工作流」页可导出/导入 JSON。

## 目录

- `workflows/` — 示例流水线（如 `build-book.yaml`、`pages.yaml`）
