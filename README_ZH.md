# Ant2api

<div align="center">

<img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/GoogleCloud-Dark.svg" width="56" height="56" alt="Ant2api Logo" />

### Google Antigravity ↔ OpenAI / Codex / Gemini 统一接口网关

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933.svg?style=flat-square&logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-3178C6.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?style=flat-square&logo=docker)](https://www.docker.com/)
[![OpenAI Compatible](https://img.shields.io/badge/OpenAI-Compatible-412991.svg?style=flat-square&logo=openai)](https://platform.openai.com)

[English](README.md) · [简体中文](README_ZH.md) · [快速上手](#-快速上手) · [客户端接入](#-客户端接入指南) · [接口端点](#-接口端点速查)

</div>

---

## 📖 项目简介

**Ant2api** 是一个高性能的 AI 接口转译网关，可将 **Google Antigravity**（Google Cloud Code / Code Assist）凭据无缝转译为标准 **OpenAI**、**Codex / ChatGPT 桌面端** 以及 **Gemini 原生** 兼容接口。

- 👥 **多账号池调度**：Google OAuth 一键授权，显示真实 Google 邮箱，实时监测 Gemini 额度与重置倒计时。
- 🔄 **全协议转译**：完整兼容 `/v1/chat/completions`、`/v1/responses`、`/v1/completions` 与 `/v1beta/models`。
- 🛠️ **Codex 深度适配**：支持自主连续工具调用（Agent Loop）、Fill-in-the-Middle (FIM) 代码补全与实时流。
- 🎛️ **双端口彻底分离**：Web 管理控制台（`:8080`）与 API 反代服务（`:8045`）独立运行与热控制。

---

## 🏗️ 架构设计

```
┌────────────────────────────────────────────────────────┐
│ 🎛️ 管理控制台服务 (端口 8080)                          │
│ 🌐 Web 界面: http://localhost:8080                     │
│ 🔑 默认管理员密码: ant2api_admin                        │
└──────────────────────────┬─────────────────────────────┘
                           │ 动态启停 / 热配置
┌──────────────────────────▼─────────────────────────────┐
│ 🚀 API 反向代理服务 (端口 8045)                        │
│ • OpenAI 兼容:   /v1/chat/completions, /v1/models      │
│ • Codex 兼容:    /v1/responses, /v1/completions        │
│ • Gemini 原生:   /v1beta/models                        │
│ • 健康检查:      /health                               │
└────────────────────────────────────────────────────────┘
```

---

## ✨ 核心特性

- **多协议全能网关**：
  - **OpenAI**：SSE 流式传输、Tool Calls / Function Calling、思考链预算（Thinking Budget）、多模态图片识别。
  - **Codex & ChatGPT**：官方 `/v1/responses` 智能体协议，自主触发 `read_file`、`apply_patch`、`grep_search` 等工具调用。
  - **FIM 代码补全**：无缝支持 VSCode、Cursor、Continue.dev、Aider 等 IDE 插件的前后缀补全。
- **账号池与配额监控**：
  - 内置 Google OAuth 浏览器一键授权。
  - 自动识别真实 Google 邮箱、订阅级别（PRO / FREE）与 Gemini 实时配额及倒计时。
- **现代化 Web 管理后台**：
  - 反代服务生命周期管理（启动 / 停止 / 重启）。
  - 自定义 API 密钥（`sk-ant2api-...`）、模型别名路由、出站科学代理（HTTP/SOCKS5）与分页审计日志。

---

## 📡 接口端点速查

| 协议 / 格式 | 端点 (反代端口 `:8045`) | 请求方式 | 适用场景 |
| :--- | :--- | :--- | :--- |
| **OpenAI** | `/v1/chat/completions` | `POST` | NextChat、ChatBox、Cursor、Cline |
| **Codex** | `/v1/responses` | `POST` | ChatGPT 桌面端、Codex 扩展、WebSocket 流 |
| **Codex** | `/v1/completions` | `POST` | Continue.dev、Copilot、Aider 代码补全 |
| **Gemini** | `/v1beta/models/*` | `POST` | Google AI SDK 原生接入 |
| **健康检测** | `/health` | `GET` | 容器健康检查与监控 |

---

## 🚀 快速上手

### 1. 本地开发启动（推荐）

```bash
# 安装依赖
npm install

# 启动开发服务（管理后台：http://localhost:8080）
npm run dev
```

### 2. 生产编译运行

```bash
npm run build
npm start
```

### 3. Docker 部署

```bash
docker compose up -d
```

---

## 🔌 客户端接入指南

### OpenAI 格式接入（Cursor / NextChat / Cherry Studio）

- **API 地址 (Base URL)**：`http://localhost:8045/v1`
- **API 密钥 (API Key)**：`sk-ant2api-default-master-key`（或管理后台自定义密钥）
- **模型名称**：`gpt-4o`、`gemini-3.7-flash`、`gemini-3.7-thinking`

```bash
curl http://localhost:8045/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-ant2api-default-master-key" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "你好，请介绍一下你自己。"}],
    "stream": true
  }'
```

---

## 📄 开源协议

[MIT](LICENSE) © 2026 Ant2api Team
