# Ant2api (Google Antigravity & GeminiCLI 大模型转译网关)

<div align="center">

<img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/GoogleCloud-Dark.svg" width="60" height="60" alt="Ant2api Logo" />

# 🚀 Ant2api
### 将 Google Antigravity 与 GeminiCLI 无缝转译为 OpenAI / Codex / Gemini 标准接口

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933.svg?style=flat-square&logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-3178C6.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?style=flat-square&logo=docker)](https://www.docker.com/)
[![OpenAI Compatible](https://img.shields.io/badge/OpenAI-API%20Compatible-412991.svg?style=flat-square&logo=openai)](https://platform.openai.com)
[![Codex FIM](https://img.shields.io/badge/Codex-FIM%20Autocomplete-00A871.svg?style=flat-square)](https://github.com/features/copilot)

[English Documentation](README.md) · [简体中文文档](README_ZH.md) · [快速上手](#-快速上手) · [客户端接入指南](#-客户端接入指南)

</div>

---

## 📖 项目简介

**Ant2api** 是一个高性能、轻量级、开箱即用的 AI 接口中继与协议转译网关。

它能够将 **Google Antigravity** 与 **GeminiCLI** 的会话凭据无缝转译为标准的 **OpenAI (`/v1/chat/completions`)**、**Codex / ChatGPT 官方客户端 (`/v1/responses`, `/v1/completions`)** 以及 **Gemini 原生 (`/v1beta/models`)** 兼容接口。

项目采用全新的**现代化暗黑科技风 Web 管理后台**，实现了 **管理后台与反向代理服务的双端口彻底分离**，支持在 Web 控制台中动态控制反向代理服务的启动、停止、重启与热配置。

---

## 🏗️ 架构设计：双端口彻底分离

```
┌─────────────────────────────────────────────────────────────┐
│ 🎛️ 管理端服务 (Admin Console & Management API)              │
│ 🌐 Web 界面端口:  http://localhost:8080 (可配 ADMIN_PORT)     │
│ 🔑 管理员密码:   ant2api_admin                             │
│ 📦 包含: Web 管理后台前端 + /api/admin/* 控制 API              │
└──────────────────────────────┬──────────────────────────────┘
                               │
                控制启停 / 重启 / 动态调优
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 🚀 API 反向代理服务 (API Reverse Proxy Service)              │
│ 📡 代理监听端口:  http://localhost:8045 (可在界面动态修改)    │
│ 📦 包含:                                                     │
│    • OpenAI 兼容端点:  /v1/chat/completions                 │
│    • ChatGPT / Codex:  /v1/responses, /v1/completions        │
│    • WebSocket 实时流: ws://localhost:8045/v1/responses     │
│    • Gemini 原生端点:  /v1beta/models                       │
│    • 健康检查端点:     /health                              │
└─────────────────────────────────────────────────────────────┘
```

---

## ✨ 核心特性

### 🌐 1. 多协议全功能中继与转译
- **OpenAI 兼容**：
  - `/v1/chat/completions`：完整支持 SSE 流式传输、函数调用（Tool Calling / Function Calling）、多模态 Vision 图像识别、思维链（Reasoning Budget）参数控制。
  - `/v1/models`：动态模型发现与路由。
- **Codex & ChatGPT 客户端深度兼容**：
  - `/v1/responses` 与 `/v1/completions`：完美支持官方 ChatGPT Desktop 客户端与 Codex 客户端协议。
  - **自主连续工具调用（Agent Loop）**：转译层深度优化，强制模型在遇到多文件阅读/修改需求时，即时触发 `read_file`、`view_file`、`apply_patch`、`edit_file` 等函数调用，杜绝中间停顿。
  - **Fill-in-the-Middle (FIM)**：无缝支持 VSCode Copilot、Continue.dev、Cursor 等 IDE 补全插件的前后缀代码补全。
- **Gemini 原生格式**：
  - `/v1beta/models/*`：直接兼容 Google 原生 SDK 与 API 格式。

### 🖥️ 2. 现代化 Web 管理控制台
- **⚙️ 服务配置**：
  - 实时状态灯展示（🟢 服务运行中 / ⚪ 服务已停止 / 🟡 正在重启）。
  - 服务生命周期动作：`[⚡ 启动服务]`、`[🛑 停止服务]`、`[🔄 重启服务]`。
  - 支持热修改监听端口（默认 `8045`）、请求超时时间（默认 `120s`）、局域网访问开关（`127.0.0.1` vs `0.0.0.0`）、鉴权模式、主 API 密钥（Master Key）、Web UI 密码、User-Agent 伪装覆盖。
- **📊 概览仪表盘**：实时总请求数、Token 消耗吞吐量、平均延迟统计与客户端接口一键复制。
- **👥 账号池管理**：支持多账号轮询调度、健康检测与故障自动冷却转移，内置 **Google OAuth 浏览器一键授权助手**。
- **🔑 API 密钥管理**：支持按客户端/应用生成独立子密钥，支持速率限制与模型白名单隔离。
- **🔀 模型路由映射**：自定义将客户端请求的来源模型路由至指定的 Gemini 目标模型。
- **📜 请求审计日志**：完整支持**服务端分页查询**（每页 10/20/50/100 条）、关键词实时搜索（带防抖）、状态码分类筛选与自动静默刷新。
- **🛡️ 系统高级设置**：支持配置出站科学上网代理（Clash/V2Ray HTTP/SOCKS5）、负载均衡调度策略与数据库全量 JSON 备份/恢复。

---

## 📡 接口端点速查

| 协议 / 格式 | 端点 (代理端口 `:8045`) | 请求方式 | 适用场景 / 客户端 |
| :--- | :--- | :--- | :--- |
| **OpenAI** | `/v1/chat/completions` | `POST` | NextChat、ChatBox、Cherry Studio、Cursor、Cline、自定义代码 |
| **Codex** | `/v1/responses` | `POST` | ChatGPT Desktop 客户端、Codex 官方插件、WebSocket 实时流 |
| **Codex** | `/v1/completions` | `POST` | Continue.dev、Copilot、Aider 代码 FIM 补全 |
| **Gemini** | `/v1beta/models/*` | `POST` | Google AI SDK 原生接入 |
| **健康检测** | `/health` | `GET` | 容器探针与服务健康状态检查 |

---

## 🚀 快速上手

### 方式一：本地开发启动（推荐）

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务（支持热重载）
npm run dev
```

打开浏览器访问管理控制台：[`http://localhost:8080`](http://localhost:8080)，默认管理员密码：`ant2api_admin`。

---

### 方式二：生产编译与启动

```bash
# 1. 编译 TypeScript 与前端静态资源
npm run build

# 2. 启动生产服务
npm start
```

---

### 方式三：Docker 部署

```bash
docker compose up -d
```

---

## 🔌 客户端接入指南

### 1. OpenAI 格式接入 (Cursor / NextChat / Cherry Studio)

- **API Base URL**：`http://<服务器IP>:8045/v1`
- **API Key**：服务配置中的 Master Key 或在 API 密钥页面生成的子密钥
- **推荐模型**：`gpt-4o`, `gpt-4o-mini`, `gemini-3.7-flash`, `gemini-3.7-thinking`

```bash
curl http://localhost:8045/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-ant2api-default-master-key" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "你好，请写一个冒泡排序算法。"}
    ],
    "stream": true
  }'
```

---

### 2. ChatGPT Desktop / Codex 客户端接入

在 Codex 配置文件（如 `~/.codex/config.toml` 或项目 `config.toml`）中添加以下自定义 Provider 配置：

```toml
model_provider = "custom"
model = "gemini-3.7-flash"
model_reasoning_effort = "high"
disable_response_storage = true

[model_providers.custom]
name = "custom"
wire_api = "responses"
requires_openai_auth = true
base_url = "http://127.0.0.1:8045/v1"
```

> **鉴权方式**：客户端提示输入 API Key 时，填入服务配置中的 **API 主密钥（Master Key）** 或在 API 密钥页面生成的 **子密钥 (`sk-ant2api-...`)** 即可。

---

## 📄 开源许可证

MIT License © 2026 Ant2api Team.
