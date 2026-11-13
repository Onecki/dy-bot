# 配置与运行

## 项目范围

```text
抖音群 ↔ Karin / 抖音适配器 ↔ 本项目桥接 ↔ MaiBot ↔ 模型服务
```

本仓库只包含桥接代码、初始化/安装脚本、配置模板、必要补丁和测试。上游 MaiBot 源码及 Python 环境由 `pnpm bootstrap` 安装到已忽略的 `maibot/`，不随仓库提交。

Windows 已验证。脚本也处理 POSIX Python 环境路径，但其他系统的抖音适配器和本机依赖需自行验证。

## 初次配置

`pnpm setup:local` 只生成缺失文件，不覆盖现有配置，也不修改已保存的抖音会话。新配置默认关闭回复、采用观察模式，并生成独立随机 WS 令牌。

| 文件 | 需要填写的内容 |
| --- | --- |
| `config/network.local.json` | HTTP/mixed 代理地址，可留空。仅提供给安装和 MaiBot Python 进程，抖音连接直连 |
| `config/model.local.json` | Gemini 原生 Base URL、密钥、聊天模型名、机器人名；默认文本嵌入模型及维度也可调整 |
| `config/maibot.local.json` | accountId、groupNames；WS 地址和随机 token 通常不用改 |
| `config/local.json` | allowedGroups；确认要发言后设 enabled 为 true |

例如代理 `http://127.0.0.1:7890`。请确保所选网络出口能够实际调用模型。

`pnpm login:douyin` 使用固定版本的 Windows 登录流程，将 Cookie、UID 和设备身份保存到 `@karinjs/karin-plugin-adapter-douyin/data/accounts/`。首次登录会补全空白 accountId，并仅显示群名称/ID，不输出 Cookie 或成员资料。重新登录前停止网关；短信验证码只在本机输入。

将选定群 ID 写入 `allowedGroups`，并在 `groupNames` 中按该 ID 填写群名。不要把真实资料写进 example 文件。

执行 `pnpm configure`，将模型、人设、文本记忆和同一群白名单写入 MaiBot 配置。已初始化过时脚本拒绝重复覆盖；确需重置配置可使用 `pnpm configure --overwrite`。

首次启动前执行 `pnpm maibot`，自行阅读并确认 MaiBot 条款。该命令用于运行后端；在另一个终端执行 `pnpm start` 启动网关。后续 `pnpm start` 会自动启动或复用后端。

实际允许发送需要同时满足：`enabled: true`、群在 allowedGroups 中、`observeOnly: false`。这些是本机配置，不会上传。

## 日常使用

- `pnpm start`：启动网关，按需启动或复用 MaiBot；也可运行 `start.ps1`。
- `pnpm maibot`：单独交互运行 MaiBot，适合首次确认条款和查看启动信息。
- MaiBot WebUI：`http://127.0.0.1:18001`；登录信息只在本机启动日志或 `maibot/data/webui.json` 中查看，勿分享。
- 网关状态：`http://127.0.0.1:7777/dybot/health`。
- 暂停：把 `config/local.json` 的 enabled 改为 false，立即阻止新入站/出站；改回 true 恢复。

网关和 MaiBot 是独立进程。关闭网关终端停止群聊桥接，不会删除登录态、聊天或记忆，也不会自动停止已经存在的 MaiBot 后端。

首次配置脚本只支持 Gemini 参考配置。日常更换服务、模型、人设、表达风格、主动程度和记忆设置，请在 MaiBot WebUI 或其实际 TOML 配置中操作，不要反复运行初始化脚本。

代理变更需要重启 MaiBot 后端；抖音网关的重启不会替代后端重启。WebUI 的后端重启完成后，桥接会自动重连。

## 能力和限制

- 普通群文字、真实 @ 和引用 ID 会传给 MaiBot；近期引用原文优先从缓存获取，必要时查询平台历史。未指定群和私聊不转发。
- 出站只发送文字。图片、语音、表情包等暂不转换，不会自动下载浏览器或启用外部工具。
- MaiBot 开启文本长期记忆、人物事实与聊天摘要写回。新实例初始为空，不会自动导入别的机器人历史。
- 出站默认每群间隔至少 10 秒、每条最多 600 字符、每天最多预留 100 次。次数与消息去重保存到 `data/maibot-delivery.json`，重启保留；失败不盲目重发。
- 断线期间不积压重放；丢弃超过 5 分钟的旧入站和超过 120 秒的旧出站。
- 发送上限不等于模型调用上限。MaiBot 的规划、回复、记忆、学习可能分别调用模型；价格字段初始为 0 只表示未填写统计价格，不代表 API 免费。

## 本地文件

| 路径 | 用途 |
| --- | --- |
| `@karinjs/karin-plugin-adapter-douyin/data/accounts/` | 抖音 Cookie、账号和设备身份，勿删除或公开 |
| `maibot/config/` | 实际模型密钥、人设、行为和访问策略 |
| `maibot/data/MaiBot.db` | 聊天数据库 |
| `maibot/data/a-memorix/` | 长期记忆与向量数据 |
| `data/runtime.json`、`data/maibot-runtime.json` | 后台进程及日志位置，仅在后台启动时生成 |
| `.tools/` | 可重新生成的安装缓存，不进入仓库 |

管理服务默认仅监听本机。初始化关闭遥测。聊天、记忆提取和向量化会发送给所配置的模型服务，聊天、记忆和日志保存在本机。

## 测试和补丁

`pnpm test` 运行离线单元测试；`pnpm test:maibot` 使用已安装的真实 maim-message 测试鉴权、入站解析、群路由、去重和真实消息 ID 回执，不连接抖音，也不调用模型。

`pnpm test:model` 使用 MaiBot 实际配置测试生成、文本向量和函数工具往返，会使用真实 API 额度，不向抖音发送消息。

必要补丁见 [上游说明](../THIRD_PARTY_NOTICES.md)。Node 补丁由 pnpm 安装时应用；MaiBot 补丁由 bootstrap 校验并应用。更新版本前先检查补丁和协议兼容性，不直接删除它们。

## 发布 GitHub

只提交源码、模板、文档、许可证、必要补丁及锁文件。先运行 `pnpm check:public`，再核对 `git status --short`。不要提交真实本地配置、Cookie、扫码图、数据库和任何日志，也不要将本机运行目录整体打包上传。
