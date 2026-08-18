# Ant2api (Antigravity & GeminiCLI to Universal AI API Gateway)

<div align="center">

<img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/GoogleCloud-Dark.svg" width="60" height="60" alt="Ant2api Logo" />

# 🚀 Ant2api
### 将 Google Antigravity & GeminiCLI 无缝转为 OpenAI / Claude / Gemini 通用 API 网关

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933.svg?style=flat-square&logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-3178C6.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?style=flat-square&logo=docker)](https://www.docker.com/)
[![OpenAI Compatible](https://img.shields.io/badge/OpenAI-API%20Compatible-412991.svg?style=flat-square&logo=openai)](https://platform.openai.com)
[![Claude Compatible](https://img.shields.io/badge/Claude-Messages%20API-D97706.svg?style=flat-square&logo=anthropic)](https://anthropic.com)
[![Codex FIM](https://img.shields.io/badge/Codex-FIM%20Autocomplete-00A871.svg?style=flat-square)](https://github.com/features/copilot)

[English Documentation](README.md) · [简体中文文档](README_ZH.md) · [快速开始](#-快速开始) · [客户端配置](#-客户端接入指南) · [常见问题](#-常见问题--排查)

</div>

---

## 📖 简介

**Ant2api** 是一个高性能、轻量级、开箱即用的 AI API 聚合与协议转换网关。

它能够将 **Google Antigravity**（Google Cloud Code / Code Assist）与 **GeminiCLI** 的会话认证与凭据，无缝转译为行业通用的 **OpenAI (`/v1/chat/completions`)**、**Claude (`/v1/messages`)**、**Codex/FIM 代码补全 (`/v1/completions`)** 以及 **Gemini 原生 (`/v1beta/models`)** 接口。同时配备了全功能的现代 Web 管理控制台、多账号智能负载均衡调度池、请求审计与 Linux 生产环境运维套件。

---

## ✨ 核心特性

### 🌐 1. 全协议兼容与接口转换
- **OpenAI 兼容**：
  - `/v1/chat/completions`：支持流式 (Stream SSE) 与非流式输出、Function Calling (Tool Calls)、System Prompt 注入、多模态图片识别。
  - `/v1/models`：动态模型发现与路由。
  - `/v1/embeddings`：文本向量生成接口。
  - `/v1/images/generations`：支持 Imagen 3 高清图片生成转换。
- **Claude 兼容**：
  - `/v1/messages`：完整支持 Anthropic 协议事件流 (`message_start`, `content_block_delta`, `message_stop`)。
  - **Extended Thinking**：支持思维链（Thinking Process / Reasoning）深度思考流式输出。
- **Codex 代码补全兼容**：
  - `/v1/completions`、`/v1/engines/:engine/completions`、`/v1/responses`。
  - **FIM (Fill-in-the-Middle)**：完美支持代码前缀 (Prompt) + 后缀 (Suffix) 中间插值补全，适配 VSCode Copilot、Continue.dev、Aider、Cursor 代码补全。
- **Gemini 原生兼容**：
  - `/v1beta/models/*:generateContent` & `:streamGenerateContent`。

### 🔄 2. 多账号智能调度池 & 自动容灾
- **多凭证支持**：支持 Google OAuth2 Refresh Token、Session Cookie 以及官方 Gemini API Key。
- **负载均衡策略**：支持轮询调度 (Round-Robin)、最少错误优先调度 (Least Errors)。
- **智能故障转移 (Failover)**：当某个账号遭遇 `429 Too Many Requests`、配额耗尽或认证失效时，自动进入冷却队列，并秒级平滑切换至可用账号重试。
- **自动续期**：内置 Google OAuth2 Token 自动刷新器，过期前自动置换 Access Token，无需人工干预。

### 🖥️ 3. 现代化 Web 管理控制台
- **监控仪表盘**：实时展示 QPS、24 小时请求趋势、Token 吞吐量、平均耗时、成功率分布图表。
- **凭证池管理**：可视化增删改查账号，内置 **Google OAuth 一键授权引导助手**，3 步快速获取 Refresh Token。
- **API Key 分发**：支持签发自定义客户端密钥（`sk-ant2api-...`），按 Key 限制 RPM（每分钟请求数）与 Token 使用配额。
- **模型智能映射**：自由配置别名，例如将 `gpt-4o` 映射为 `gemini-2.5-pro`，或将 `claude-3-7-sonnet` 映射为 `gemini-3.7-flash`。
- **在线演练场 (Playground)**：无需启动第三方软件，直接在浏览器中测试 OpenAI / Claude / Gemini 的流式对话与参数调节。
- **审计日志**：完整记录调用时间、模型、客户端 IP、Token 消耗、响应耗时、HTTP 状态码及错误详情。

### 🐧 4. 生产级运维支持
- 提供 Docker 与 Docker Compose 一键启动配置。
- 提供 Linux 一键安装脚本 (`deploy/install.sh`)、Systemd 系统守护进程 (`ant2api.service`) 与 Nginx SSE 优化反代配置 (`deploy/nginx.conf`)。

---

## 📡 接口端点一览

| 协议类型 | 接口端点 | 方法 | 说明 | 兼容客户端 |
| :--- | :--- | :--- | :--- | :--- |
| **OpenAI** | `/v1/chat/completions` | `POST` | 对话补全 (支持 Stream & Function Call) | NextChat, ChatBox, Cherry Studio, Cursor |
| **OpenAI** | `/v1/completions` | `POST` | 代码与文本续写 / FIM 中间补全 | Continue.dev, Copilot, Aider |
| **OpenAI** | `/v1/models` | `GET` | 可用模型列表 | 所有 OpenAI 兼容应用 |
| **OpenAI** | `/v1/embeddings` | `POST` | 向量化嵌入计算 | LangChain, RAG 检索知识库 |
| **OpenAI** | `/v1/images/generations` | `POST` | Imagen 3 高清图像生成 | NextChat 生图, 绘图客户端 |
| **Claude** | `/v1/messages` | `POST` | Anthropic Messages 协议与思考链 | Claude Code, Cline, Roo-Code, LibreChat |
| **Gemini** | `/v1beta/models/*:generateContent` | `POST` | Google 原生内容生成接口 | Google AI SDK, 原生调用库 |
| **Gemini** | `/v1beta/models/*:streamGenerateContent` | `POST` | Google 原生流式内容生成接口 | Google AI SDK, 原生调用库 |
| **Admin** | `/admin/*` & `/` | `ALL` | Web 管理控制台与数据接口 | 浏览器直接访问 (默认端口 8080) |

---

## 🚀 快速开始

### 方式一：Docker Compose 一键启动 (推荐)

```bash
# 1. 克隆代码仓库
git clone https://github.com/your-repo/Ant2api.git
cd Ant2api

# 2. (可选) 配置环境变量
cp .env.example .env

# 3. 启动容器服务
docker compose up -d
```
启动成功后，浏览器打开 `http://localhost:8080`，输入默认密码 `ant2api_admin` 即可进入管理面板。

---

### 方式二：本地 Node.js / TypeScript 运行

> 要求环境：Node.js >= 18.0.0, npm / pnpm

```bash
# 1. 安装依赖
npm install

# 2. 编译项目 (同时复制前端静态资源)
npm run build

# 3. 启动服务
npm start
```

若需本地开发热重载，可执行：
```bash
npm run dev
```

---

### 方式三：Linux 服务器一键脚本安装 (Ubuntu / Debian / CentOS)

```bash
# 赋予安装脚本执行权限并运行
chmod +x deploy/install.sh
sudo ./deploy/install.sh
```
安装脚本会自动配置 Node.js 运行时、构建产物、注册 `ant2api` Systemd 守护服务并设置为开机自启。

```bash
# 常用运维命令
sudo systemctl status ant2api   # 查看服务运行状态
sudo systemctl restart ant2api  # 重启服务
sudo journalctl -u ant2api -f   # 查看实时运行日志
```

---

## 📖 Web 管理控制台使用指南

1. **登录控制台**：
   访问 `http://<你的服务器IP>:8080`，输入管理员密码（默认为 `ant2api_admin`，可通过环境变量 `ADMIN_PASSWORD` 更改）。
2. **添加账号凭证**：
   - 进入 **「账号与凭证池」** 页面。
   - 点击 **「OAuth 授权助手」** 弹窗，点击链接登录你的 Google 账号完成授权。
   - 将返回的授权 Code 粘贴回输入框，点击 **「换取并保存 Token」**，系统将自动生成包含 Refresh Token 的账号并纳入负载均衡池。
3. **创建 API Key**：
   - 进入 **「API 密钥管理」** 页面。
   - 点击 **「创建新密钥」**，可自定义设置名称、限速 (RPM) 以及 Token 配额上限。
4. **在线测试**：
   - 进入 **「在线演练场 (Playground)」**，选择协议类型（OpenAI / Claude / Gemini），即可立即开始对话测试！

---

## 🔌 客户端接入指南

### 1. OpenAI 格式客户端 (NextChat / ChatBox / Cherry Studio)

- **接口地址 (Base URL / API Host)**: `http://<服务器IP>:8080/v1`
- **API Key**: `sk-ant2api-...` (在 Web 控制台中获取)
- **推荐模型**: `gpt-4o`, `gpt-4o-mini`, `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-3.7-flash`

#### cURL 测试示例：
```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-ant2api-your-api-key" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "system", "content": "你是一位出色的编程专家。"},
      {"role": "user", "content": "用 TypeScript 写一个快速排序。"}
    ],
    "stream": true
  }'
```

---

### 2. Claude 格式客户端 (Claude Code CLI / Cline / Roo-Code / LibreChat)

#### Claude Code 终端命令行工具配置：
```bash
export ANTHROPIC_BASE_URL="http://localhost:8080"
export ANTHROPIC_API_KEY="sk-ant2api-your-api-key"
claude
```

#### cURL 测试示例 (Anthropic Messages API)：
```bash
curl http://localhost:8080/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk-ant2api-your-api-key" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-3-7-sonnet",
    "max_tokens": 2048,
    "messages": [
      {"role": "user", "content": "请分析 Rust 与 Go 在高并发服务中的异同。"}
    ],
    "stream": true
  }'
```

---

### 3. VSCode Continue / Copilot 代码补全 (FIM Fill-In-The-Middle)

在 Continue.dev 的 `config.json` 中配置 Tab Autocomplete 代码自动补全：

```json
{
  "tabAutocompleteModel": {
    "title": "Ant2api Code Completion",
    "provider": "openai",
    "model": "gemini-3.7-flash",
    "apiBase": "http://localhost:8080/v1",
    "apiKey": "sk-ant2api-your-api-key"
  }
}
```

#### FIM cURL 测试示例：
```bash
curl http://localhost:8080/v1/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-ant2api-your-api-key" \
  -d '{
    "model": "gemini-3.7-flash",
    "prompt": "function calculateSum(a: number, b: number): number {\n",
    "suffix": "\n}",
    "max_tokens": 100,
    "temperature": 0.1,
    "stream": true
  }'
```

---

### 4. Cursor 编辑器接入

1. 打开 Cursor 设置 -> **Models**。
2. 开启 **OpenAI API Key**，填入 `sk-ant2api-your-api-key`。
3. 点击 **Override OpenAI Base URL**，填入 `http://<服务器IP>:8080/v1`。
4. 添加模型名称：`gemini-2.5-pro`, `gemini-3.7-flash`, `gpt-4o`。

---

## ⚙️ 环境变量说明

在项目根目录下创建 `.env` 文件即可覆盖以下默认配置：

| 环境变量名 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `PORT` | `8080` | HTTP 服务监听端口 |
| `HOST` | `0.0.0.0` | 监听的主机网络地址 |
| `ADMIN_PASSWORD` | `ant2api_admin` | Web 控制台管理员登录密码 |
| `DATA_DIR` | `./data` | 账号、Key、映射及日志的数据持久化存储目录 |
| `DEFAULT_MODEL` | `gemini-2.5-pro` | 客户端未指定或未匹配时的默认兜底模型 |
| `HTTP_PROXY` | - | 上游 Google 服务的出站网络 HTTP/HTTPS 代理 (如 `http://127.0.0.1:7890`) |

---

## 📂 项目结构

```
Ant2api/
├── package.json               # 项目依赖与构建脚本配置
├── tsconfig.json              # TypeScript 编译配置
├── Dockerfile                 # 多阶段生产环境构建 Dockerfile
├── docker-compose.yml         # 容器编排服务定义
├── deploy/                    # 生产部署与运维工具套件
│   ├── install.sh             # Linux 一键安装配置脚本
│   ├── ant2api.service        # Systemd 系统服务守护配置
│   └── nginx.conf             # Nginx 反向代理与 SSE 流式防缓冲配置
├── src/
│   ├── index.ts               # 服务启动主入口
│   ├── config.ts              # 环境变量与默认配置解析
│   ├── middleware/            # 中间件（API Key 鉴权、错误拦截、访问日志）
│   ├── routes/                # 路由层 (OpenAI / Claude / Gemini / Codex / Admin)
│   ├── converters/            # 协议转换核心 (OpenAI / Claude / Codex / SSE 流式 / Tools)
│   ├── providers/             # 上游服务驱动 (Antigravity / Gemini CLI / Google OAuth)
│   ├── services/              # 业务逻辑 (账号池负载均衡、Key 统计限流、模型路由、持久化)
│   └── web/                   # 现代 Web 控制台前端 (SPA: HTML / CSS / JavaScript)
└── data/                      # 运行时持久化数据 (账号池、Key、模型别名、日志)
```

---

## ❓ 常见问题 & 排查

### Q1: 上游接口出现 429 Too Many Requests 怎么处理？
> **解答**：Ant2api 内置了账号池熔断与冷却机制。建议在 Web 控制台的 **「账号管理」** 中添加 2 个或更多账号，系统在检测到 429 时会自动将受限账号置入冷却队列，并秒级切换到其他正常账号继续完成请求。

### Q2: 使用 Nginx 反向代理后，流式输出出现卡顿或一次性吐出？
> **解答**：这是由于 Nginx 开启了响应缓冲（`proxy_buffering`）。请参考 `deploy/nginx.conf` 中的配置，确保在 `location /` 中添加：
> ```nginx
> proxy_buffering off;
> proxy_cache off;
> proxy_set_header Connection '';
> chunked_transfer_encoding on;
> ```

### Q3: 国内服务器无法直连 Google 服务怎么办？
> **解答**：在 `.env` 中配置 `HTTP_PROXY=http://你的代理IP:端口`，服务会自动将发往 Google 的请求通过代理转发。

---

## 📄 开源许可证

本项目基于 [MIT 许可证](LICENSE) 开源发布。
