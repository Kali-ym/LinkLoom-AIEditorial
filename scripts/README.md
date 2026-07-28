# 根目录维护脚本

仓库级质量门禁脚本，由根 `package.json` 的 `check:*` 调用，**不**参与运行时。

| 文件                       | 命令                             | 作用                     |
| -------------------------- | -------------------------------- | ------------------------ |
| `check-encoding.js`        | `pnpm run check:encoding`        | 扫描关键路径 UTF-8 / BOM |
| `check-maintainability.js` | `pnpm run check:maintainability` | 文件行数、循环依赖等规则 |
| `extract-aihot-sources.py` | `python3 scripts/extract-aihot-sources.py` | 从 AI HOT 公开 API 导出 Folo 用 OPML / X 清单到 `exports/aihot-folo/` |

后端构建、DB 维护与集成冒烟见 [`backend/scripts/`](../backend/scripts/)（无独立 README，索引见 [`docs/STRUCTURE.md`](../docs/STRUCTURE.md)）。
