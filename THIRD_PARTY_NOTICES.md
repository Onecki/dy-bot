# 上游项目与本地补丁

本仓库是独立的抖音消息桥接程序。MaiBot 源码、依赖包、Python 环境和运行数据不随本仓库提交；安装时按固定版本从上游下载，保留其原始许可证与协议。

| 项目 | 用途 | 许可及说明 |
| --- | --- | --- |
| [MaiBot](https://github.com/Mai-with-u/MaiBot) v1.3.15 | 群聊行为、模型调用、长期记忆 | 主程序 GPL-3.0；子目录另有声明的部分按各自许可 |
| [Karin](https://github.com/KarinJS/Karin) 1.18.0 | 抖音网关运行框架 | MIT，Copyright (c) 2024 karinjs |
| karin-plugin-adapter-douyin 1.2.1 | 平台事件与发送接口 | MIT，Copyright (c) 2024 karinjs |
| [douyin.ts](https://github.com/dmmdekkd/douyin.ts) | 适配器 SDK、扫码登录 SDK | 按 npm 包及上游随附许可证使用 |
| maim-message 0.6.8 | MaiBot 统一消息协议 | 由 MaiBot 的固定依赖安装，保留原许可 |

`patches/` 只保留当前运行需要的三项修复：

- `karin-plugin-adapter-douyin@1.2.1.patch`：保存二维码图片、恢复 UID/设备身份并采用 Windows UA。
- `douyin.ts@0.2.1.patch`：恢复持久化设备身份。
- `maibot-v1.3.15-gemini-tool-role.patch`：修正 Gemini 工具结果角色。此文件修改的是 MaiBot 的 MIT 子模块 `src/llm_models`，Copyright (c) 2025 Mai.To.The.Gate。

扫码登录固定使用 douyin.ts 0.6.7；适配器仍固定依赖 0.2.1。两者分别用于已验证的 Windows 登录流程和现有收发格式，不能直接把适配器强行升级到新 SDK。

MIT 许可原文（适用于上述标注 MIT 的上游代码和相应补丁；不改变其他上游许可）：

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
