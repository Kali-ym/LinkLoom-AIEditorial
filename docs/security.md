# 安全说明

LinkLoom 的安全模型是：公开只读前端 + 单管理员后台。

## 必填密钥

生产环境必须设置：

- `JWT_SECRET`
- `AI_BUILDER_POLICY_SECRET`
- `SYSTEM_PASSWORD`

不要使用默认口令 `admin123` 对外运行。

## 公开接口

公开面限于 Web 页面、RSS、Feed timeline、picks 和 report-json。后台 settings、workflow、schedule、agent、tool 等接口默认需要管理员 JWT。

## 敏感配置

`/api/settings` 会脱敏返回 API Key、token、secret、cookie 和 password 字段。保存 settings 时，脱敏占位符（如 `••••`）不会覆盖旧密钥。

整表保存时，`ADAPTERS`、`AI_PROVIDERS`、`CATEGORIES`、`PUBLISHERS`、`STORAGES` 以请求中的数组为权威快照：从列表中删除的 id 不会在 merge 后被旧库数据复活。其它嵌套对象仍按 id 深度合并。

## 网络与代理

图片代理会阻止 localhost、内网 IP、link-local 和 metadata 地址，降低 SSRF 风险。

## 命令执行工具

`execute_command` 在生产环境默认关闭。若确需启用，设置 `ENABLE_EXECUTE_COMMAND_TOOL=1` 并限制部署环境权限。
